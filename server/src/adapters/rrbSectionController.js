
import { load } from "cheerio";

function clean(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textOf($, element) {
  const node = $(element).clone();

  node.find("script, style").remove();

  node.find("img").each((_, img) => {
    const image = $(img);
    const alt = clean(image.attr("alt"));
    const title = clean(image.attr("title"));

    // Use accessible image text where available.
    const description = alt || title;

    if (description) {
      image.replaceWith(` ${description} `);
    } else {
      // Preserve a marker so image-only options are not discarded.
      image.replaceWith(" [IMAGE OPTION] ");
    }
  });

  return clean(node.text());
}

function getLabeledValue($, root, label) {
  let value = null;
  const wanted = label.toLowerCase();

  $(root)
    .find("td, th, div, span")
    .each((_, element) => {
      if (value) return;

      const text = textOf($, element);
      const match = text.match(
        new RegExp(
          "^" +
            wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
            "\\s*:\\s*(.*)$",
          "i"
        )
      );

      if (match && match[1]) {
        value = clean(match[1]);
      } else if (match && $(element).next().length) {
        value = textOf($, $(element).next());
      }
    });

  if (value) return value;

  // Handles layouts where the label and value share a text node.
  const allText = clean($(root).text());
  const match = allText.match(
    new RegExp(
      wanted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "\\s*:\\s*([^:]+?)(?=\\s+(?:Question ID|Option \\d+ ID|Status|Chosen Option)\\s*:|$)",
      "i"
    )
  );

  return match ? clean(match[1]) : null;
}

function extractQuestionNumber($, table, index) {
  const firstCell = $(table)
    .find("table.questionRowTbl tr")
    .first()
    .find("td")
    .first();

  const text = textOf($, firstCell);
  const match = text.match(/Q\.?\s*(\d+)/i);

  return match ? Number(match[1]) : index + 1;
}

function extractQuestionText($, table) {
  const rows = $(table).find("table.questionRowTbl tr");

  for (const row of rows.toArray()) {
    const cells = $(row).children("td");

    if (cells.length < 2) continue;

    const firstText = textOf($, cells.eq(0));

    if (/^Q\.?\s*\d+$/i.test(firstText)) {
      const questionText = textOf($, cells.eq(1));

      if (questionText) return questionText;
    }
  }

  // Fallback for minor differences in the site's markup.
  const candidate = $(table)
    .find("table.questionRowTbl td.bold")
    .filter((_, el) => !/^Q\.?\s*\d+$/i.test(textOf($, el)))
    .first();

  const text = textOf($, candidate);
  return text || "Question text was not extracted.";
}




function extractOptions($, table) {
  const root = $(table);

  const questionTable = root.is("table.questionRowTbl")
    ? root
    : root.find("table.questionRowTbl").first();

  const options = [];
  const seen = new Set();

  questionTable.find("td.rightAns, td.wrngAns").each((_, element) => {
    const cell = $(element);

    // Extract the option label independently of the option content.
    const rawText = clean(cell.text());
    const labelMatch = rawText.match(/(?:^|\s)([A-D])\s*[.)：:]/i);

    if (!labelMatch) return;

    const label = labelMatch[1].toUpperCase();
    if (seen.has(label)) return;
    seen.add(label);

    // Keep ordinary text and mathematical image descriptions.
    const imageDescriptions = cell
      .find("img")
      .map((_, image) => {
        const img = $(image);
        return clean(
          img.attr("alt") ||
          img.attr("aria-label") ||
          img.attr("title") ||
          ""
        );
      })
      .get()
      .filter(Boolean);

    const visibleText = rawText
      .replace(/^\s*[A-D]\s*[.)：:]\s*/i, "")
      .trim();

    const optionText =
      visibleText ||
      imageDescriptions.join(" ") ||
      "[Image option]";

    options.push({
      label,
      text: optionText,
      isCorrect: cell.hasClass("rightAns"),
    });
  });

  return options.sort((a, b) => a.label.localeCompare(b.label));
}




function extractSection($, table) {
  const sectionText = clean(
    $(table)
      .prevAll()
      .first()
      .text()
  );

  const localText = clean($(table).text());
  const combined = `${sectionText} ${localText}`;

  const match = combined.match(
    /Section\s*:\s*(RRB\s+SECTION\s+CONTROLLER[^|]*)/i
  );

  return match ? clean(match[1]) : "RRB Section Controller CBT 1";
}

function parseQuestion($, table, index) {
  const root = $(table);

  const metadata =
    root.find("table.menu-tbl").add(root.find("table.questionRowTbl"));

  const chosenOption = getLabeledValue(
    $,
    metadata,
    "Chosen Option"
  );

  const statusText = getLabeledValue($, metadata, "Status");
  const number = extractQuestionNumber($, table, index);
  const questionText = extractQuestionText($, table);
  const options = extractOptions($, table);

  const chosenMatch = clean(chosenOption).match(/\b([A-D])\b/i);
  const selectedOption = chosenMatch
    ? chosenMatch[1].toUpperCase()
    : null;

  const correctOptions = options.filter((option) => option.isCorrect);
  const correctOption =
    correctOptions.length === 1 ? correctOptions[0].label : null;

  const normalizedStatus = clean(statusText).toLowerCase();

  let status = "needs-review";

  if (
    normalizedStatus.includes("not answered") ||
    normalizedStatus.includes("not attempted")
  ) {
    status = "unattempted";
  } else if (selectedOption && correctOption) {
    status = selectedOption === correctOption ? "correct" : "incorrect";
  } else if (
    normalizedStatus === "answered" &&
    !selectedOption
  ) {
    status = "needs-review";
  } else if (!selectedOption) {
    status = "unattempted";
  }

  return {
    id: `q-${number}`,
    number,
    section: extractSection($, table),
    questionText,
    options,
    selectedOption,
    correctOption,
    status,
    sourceStatus: statusText || "Unknown",
  };
}

export function extractRrbSectionController(html, sourceUrl = "") {
  const $ = load(html);
//   console.log(
//   "Question-related tables:",
//   $("table").map((_, el) => ({
//     class: $(el).attr("class"),
//     text: $(el).text().trim().slice(0, 180),
//   })).get().filter((x) =>
//     /Question ID|Chosen Option|Question Type/.test(x.text)
//   ).slice(0, 5)
// );
  const warnings = [];

  const questionTables = $("table.questionPnlTbl").toArray();
  // console.log("Question tables found:", questionTables.length);

  if (questionTables.length === 0) {
    return {
      sourceUrl,
      exam: clean($("title").text()) || "RRB Answer Analysis",
      questions: [],
      warnings: [
        "No table.questionPlTbl elements were found. Ensure the HTML file contains the rendered response-sheet questions.",
      ],
    };
  }

  const questions = questionTables.map((table, index) =>
    parseQuestion($, table, index)
  );

 // Preserve all detected questions, even if some fields need review.
const validQuestions = questions;

  const missingCorrect = validQuestions.filter(
    (question) => !question.correctOption
  ).length;

  const needsReview = validQuestions.filter(
    (question) => question.status === "needs-review"
  ).length;

  if (missingCorrect > 0) {
    warnings.push(
      `${missingCorrect} question(s) have no confidently identified correct option. Check that the green tick and rightAns markers are present in the HTML.`
    );
  }

  if (needsReview > 0) {
    warnings.push(
      `${needsReview} question(s) need manual review because the selected or correct option could not be identified confidently.`
    );
  }

  return {
    sourceUrl,
    exam: "RRB Section Controller CBT 1",
    questions: validQuestions,
    warnings,
  };
}
