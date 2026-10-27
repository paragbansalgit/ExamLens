
const STORAGE_KEY = "examlens_mistake_book_v1";

function readMistakes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not read Mistake Book:", error);
    return [];
  }
}

function writeMistakes(mistakes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mistakes));

    // Notify the Mistake Book UI that its data has changed.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("mistakebook:updated"));
    }

    return true;
  } catch (error) {
    console.error("Could not save Mistake Book:", error);
    return false;
  }
}

export function getMistakeId(question) {
  const normalize = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const options = Array.isArray(question.options)
    ? question.options
        .map(
          (option) =>
            `${option.label ?? ""}:${option.text ?? ""}`
        )
        .join("|")
    : "";

  return [
    question.section,
    question.number ?? question.questionNumber,
    question.questionText ?? question.question,
    options,
  ]
    .map(normalize)
    .join("::");
}

export function getMistakes() {
  return readMistakes();
}

export function saveMistakesFromAnalysis(
  questions,
  examName = "ExamLens"
) {
  if (!Array.isArray(questions)) {
    return false;
  }

  const existing = readMistakes();
  const byId = new Map(
    existing.map((item) => [item.id, item])
  );
  const now = new Date().toISOString();

  questions.forEach((question) => {
    const status = String(question.status ?? "")
      .trim()
      .toLowerCase();

    // Save incorrect, unattempted, and uncertain questions.
    if (
      !["incorrect", "unattempted", "needs-review"].includes(
        status
      )
    ) {
      return;
    }

    const id = getMistakeId(question);
    const previous = byId.get(id);

    byId.set(id, {
      ...previous,
      id,
      number:
        question.number ?? question.questionNumber ?? null,
      section: question.section || "Uncategorized",
      questionText:
        question.questionText ??
        question.question ??
        "Question text unavailable",
        
      questionText:
        question.questionText || question.question || "Question text unavailable",
      passage: question.passage ?? previous?.passage ?? null,
      options: Array.isArray(question.options) ? question.options : [],

      options: Array.isArray(question.options)
        ? question.options
        : [],
      selectedOption:
        question.selectedOption ??
        question.chosenOption ??
        null,
      correctOption: question.correctOption ?? null,
      status,
      sourceStatus: question.sourceStatus ?? null,
      examName,
      firstSavedAt: previous?.firstSavedAt ?? now,
      lastSeenAt: now,
      revised: previous?.revised ?? false,
      revisedAt: previous?.revisedAt ?? null,
    });
  });

  return writeMistakes([...byId.values()]);
}

export function markMistakeRevised(id, revised) {
  const mistakes = readMistakes();

  const updated = mistakes.map((item) =>
    item.id === id
      ? {
          ...item,
          revised,
          revisedAt: revised
            ? new Date().toISOString()
            : null,
        }
      : item
  );

  return writeMistakes(updated);
}

export function deleteMistake(id) {
  return writeMistakes(
    readMistakes().filter((item) => item.id !== id)
  );
}

export function clearMistakeBook() {
  try {
    localStorage.removeItem(STORAGE_KEY);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("mistakebook:updated"));
    }

    return true;
  } catch (error) {
    console.error("Could not clear Mistake Book:", error);
    return false;
  }
}
