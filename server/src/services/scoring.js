
export function scoreQuestions(
  questions,
  marking = {
    correct: 1,
    incorrect: -1 / 3,
    unattempted: 0,
  }
) {
  const results = questions.map((q) => {
    const selected = normalizeAnswer(q.selectedOption);
    const correct = normalizeAnswer(q.correctOption);
    const sourceStatus = String(q.sourceStatus ?? "").trim();

    let status;

    // Explicitly unattempted according to the source response sheet.
    if (/not answered|not attempted|unanswered/i.test(sourceStatus)) {
      status = "unattempted";
    } else if (selected !== null && correct !== null) {
      // Both answers are available, so score confidently.
      status = selected === correct ? "correct" : "incorrect";
    } else if (selected !== null && correct === null) {
      // The candidate answered, but the official answer is missing.
      status = "needs-review";
    } else if (/^answered$/i.test(sourceStatus)) {
      // The response sheet says answered, but the chosen option
      // was not extracted. Do not count it as unattempted.
      status = "needs-review";
    } else if (
      String(q.status ?? "").toLowerCase() === "unattempted"
    ) {
      status = "unattempted";
    } else {
      // Missing data must not be silently classified as unattempted.
      status = "needs-review";
    }

    return { ...q, status };
  });

  const counts = {
    correct: 0,
    incorrect: 0,
    unattempted: 0,
    needsReview: 0,
  };

  const sectionMap = new Map();

  for (const q of results) {
    if (q.status === "needs-review") {
      counts.needsReview++;
    } else {
      counts[q.status]++;
    }

    const name = q.section || "Uncategorized";

    if (!sectionMap.has(name)) {
      sectionMap.set(name, {
        section: name,
        total: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        needsReview: 0,
      });
    }

    const section = sectionMap.get(name);
    section.total++;

    if (q.status === "needs-review") {
      section.needsReview++;
    } else {
      section[q.status]++;
    }
  }

  const score =
    counts.correct * marking.correct +
    counts.incorrect * marking.incorrect +
    counts.unattempted * marking.unattempted;

  const attempted = counts.correct + counts.incorrect;

  const accuracy = attempted
    ? (counts.correct / attempted) * 100
    : 0;

  // Include every extracted question, including questions needing review.
  const total = results.length;

  const classified =
    counts.correct +
    counts.incorrect +
    counts.unattempted +
    counts.needsReview;

  if (classified !== total) {
    throw new Error(
      `Scoring count mismatch: ${classified} classified, ${total} total.`
    );
  }

  return {
    questions: results,
    summary: {
      total,
      ...counts,
      attempted,
      score: round(score, 2),
      accuracy: round(accuracy, 2),
      marking,
      sections: [...sectionMap.values()],
    },
  };
}

function normalizeAnswer(value) {
  if (value == null) return null;

  let answer = String(value).trim().toUpperCase();

  if (
    !answer ||
    /^(NOT ATTEMPTED|NOT ANSWERED|UNATTEMPTED|--|N\/A|NA)$/.test(answer)
  ) {
    return null;
  }

  answer = answer.replace(
    /^(OPTION|ANSWER|RESPONSE)\s*[:\-]?\s*/,
    ""
  );

  // Normalize letter options such as "B" and "Option B".
  const letterMatch = answer.match(/^([A-D])(?:[.)\s:]|$)/);

  if (letterMatch) {
    return letterMatch[1];
  }

  return answer.replace(/\s+/g, " ");
}

function round(number, places) {
  return Number(number.toFixed(places));
}
