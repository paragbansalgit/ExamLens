import { scoreQuestions } from "./scoring.js";
export function demoResult() {
  const questions = [
    { id: "1", number: 1, section: "Mathematics", questionText: "Demo: 12 × 8 = ?", selectedOption: "96", correctOption: "96", options: [] },
    { id: "2", number: 2, section: "Mathematics", questionText: "Demo: 15 + 17 = ?", selectedOption: "30", correctOption: "32", options: [] },
    { id: "3", number: 3, section: "Reasoning", questionText: "Demo: Select the next number", selectedOption: null, correctOption: "B", options: [] },
    { id: "4", number: 4, section: "General Awareness", questionText: "Demo: Example question", selectedOption: "C", correctOption: "C", options: [] }
  ];
  const scored = scoreQuestions(questions);
  return {
    exam: "RRB Section Controller (demo)",
    sourceUrl: null,
    extractedAt: new Date().toISOString(),
    extractionMethod: "demo",
    warnings: ["This is sample data, not an official RRB result."],
    questions: scored.questions,
    summary: scored.summary
  };
}
