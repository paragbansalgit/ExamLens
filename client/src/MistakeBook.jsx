import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  RotateCcw,
  Trash2,
  BookOpenCheck,
  Search,
} from "lucide-react";
import {
  getMistakes,
  markMistakeRevised,
  deleteMistake,
} from "./utils/mistakeBookStorage";

const styles = {
  page: {
    display: "grid",
    gap: 20,
    color: "#e5e7eb",
    width: "100%",
  },
  headingRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  title: { margin: 0, fontSize: 26, lineHeight: 1.2, color: "#f8fafc" },
  subtitle: {
    margin: "7px 0 0",
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.5,
  },
  stats: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  filterButton: {
    border: "1px solid #334155",
    borderRadius: 9,
    padding: "9px 13px",
    background: "#111827",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  search: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "10px 12px",
    border: "1px solid #334155",
    borderRadius: 10,
    background: "#0b1220",
    color: "#94a3b8",
    minWidth: 220,
    flex: "1 1 220px",
  },
  searchInput: {
    border: 0,
    outline: 0,
    background: "transparent",
    color: "#f8fafc",
    width: "100%",
    minWidth: 0,
    fontSize: 14,
  },
  card: {
    background: "linear-gradient(145deg, #111827 0%, #0b1220 100%)",
    border: "1px solid #334155",
    borderRadius: 15,
    padding: 20,
    display: "grid",
    gap: 16,
    boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  questionHeading: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.45,
  },
  meta: { marginTop: 4, color: "#94a3b8", fontSize: 12, lineHeight: 1.5 },
  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  question: {
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 1.7,
    margin: 0,
    whiteSpace: "pre-wrap",
  },
  options: { display: "grid", gap: 8 },
  option: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "11px 12px",
    borderRadius: 9,
    border: "1px solid #334155",
    background: "#172033",
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  optionLabel: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 25px",
    width: 25,
    height: 25,
    borderRadius: 6,
    background: "#263449",
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
  },
  answerRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  answerBox: {
    flex: "1 1 180px",
    border: "1px solid #334155",
    background: "#0b1220",
    borderRadius: 9,
    padding: "10px 12px",
    display: "grid",
    gap: 4,
  },
  answerLabel: {
    color: "#94a3b8",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 700,
  },
  answerValue: { color: "#f1f5f9", fontSize: 14, fontWeight: 700 },
  actions: { display: "flex", gap: 9, flexWrap: "wrap" },
  actionButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: "1px solid #475569",
    borderRadius: 9,
    padding: "9px 12px",
    background: "#1e293b",
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 650,
    cursor: "pointer",
  },
  empty: {
    border: "1px dashed #475569",
    borderRadius: 14,
    padding: "34px 20px",
    textAlign: "center",
    background: "#0b1220",
    color: "#cbd5e1",
  },

  passage: {
    background: "#172438",
    border: "1px solid #334155",
    borderLeft: "4px solid #818cf8",
    borderRadius: 10,
    padding: "14px 16px",
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 1.75,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  passageTitle: {
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
};

export default function MistakeBook() {
  const [mistakes, setMistakes] = useState(() => getMistakes());
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const refresh = () => setMistakes(getMistakes());
    window.addEventListener("storage", refresh);
    window.addEventListener("mistakebook:updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("mistakebook:updated", refresh);
    };
  }, []);

  function refresh() {
    setMistakes(getMistakes());
  }

  function toggleRevised(item) {
    if (markMistakeRevised(item.id, !item.revised)) refresh();
  }

  function removeItem(item) {
    const confirmed = window.confirm(
      `Remove Question ${item.number ?? ""} from your Mistake Book?`,
    );
    if (confirmed && deleteMistake(item.id)) refresh();
  }

  const counts = useMemo(
    () => ({
      all: mistakes.length,
      incorrect: mistakes.filter((item) => item.status === "incorrect").length,
      review: mistakes.filter((item) => item.status === "needs-review").length,
      unattempted: mistakes.filter((item) => item.status === "unattempted")
        .length,
      revised: mistakes.filter((item) => item.revised).length,
    }),
    [mistakes],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mistakes.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "incorrect" && item.status === "incorrect") ||
        (filter === "review" && item.status === "needs-review") ||
        (filter === "unattempted" && item.status === "unattempted") ||
        (filter === "revised" && item.revised);

      const searchable = [
        item.number,
        item.section,
        item.examName,
        item.questionText,
        item.selectedOption,
        item.correctOption,
        ...(item.options || []).flatMap((option) => [
          option.label,
          option.text,
        ]),
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [mistakes, filter, search]);

  const filters = [
    ["all", `All (${counts.all})`],
    ["incorrect", `Incorrect (${counts.incorrect})`],
    ["review", `Needs Review (${counts.review})`],
    ["unattempted", `Unattempted (${counts.unattempted})`],
    ["revised", `Revised (${counts.revised})`],
  ];

  return (
    <section style={styles.page}>
      <div style={styles.headingRow}>
        <div>
          <h2 style={styles.title}>Mistake Book</h2>
          <p style={styles.subtitle}>
            Review missed questions, verify answers, and track your revision.
          </p>
        </div>
        <div style={styles.stats}>
          <span
            style={{
              ...styles.status,
              background: "#172554",
              color: "#bfdbfe",
            }}
          >
            <BookOpenCheck size={13} /> {counts.all} saved
          </span>
        </div>
      </div>

      <div style={styles.stats}>
        {filters.map(([value, label]) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={active}
              style={{
                ...styles.filterButton,
                background: active ? "#e2e8f0" : "#111827",
                color: active ? "#0f172a" : "#cbd5e1",
                borderColor: active ? "#e2e8f0" : "#334155",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <label style={styles.search}>
        <Search size={17} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search questions, options, or sections"
          style={styles.searchInput}
          aria-label="Search saved questions"
        />
      </label>

      {filtered.length === 0 ? (
        <div style={styles.empty}>
          <BookOpenCheck size={28} style={{ marginBottom: 10, opacity: 0.8 }} />
          <div style={{ fontWeight: 700, marginBottom: 5 }}>
            {mistakes.length === 0
              ? "Your Mistake Book is empty"
              : "No matching questions"}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
            {mistakes.length === 0
              ? "Analyze a response sheet to automatically save incorrect questions and questions that need review."
              : "Try another filter or search term."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {filtered.map((item) => {
            const isReview = item.status === "needs-review";
            const isUnattempted = item.status === "unattempted";
            const statusStyle = isReview
              ? { background: "#422006", color: "#fde68a" }
              : isUnattempted
                ? { background: "#1e293b", color: "#cbd5e1" }
                : { background: "#450a0a", color: "#fecaca" };

            return (
              <article key={item.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.questionHeading}>
                      Question {item.number ?? "—"} ·{" "}
                      {item.examName || "ExamLens"}
                    </div>
                    <div style={styles.meta}>
                      {item.section || "Uncategorized"}
                      {item.revised ? " · Revised" : ""}
                    </div>
                  </div>
                  <span style={{ ...styles.status, ...statusStyle }}>
                    {isReview || isUnattempted ? (
                      <CircleAlert size={13} />
                    ) : (
                      <XStatusIcon />
                    )}
                    {isReview
                      ? "Needs review"
                      : isUnattempted
                        ? "Unattempted"
                        : "Incorrect"}
                  </span>
                </div>

                {item.passage && (
                  <div style={styles.passage}>
                    <div style={styles.passageTitle}>Reading passage</div>
                    <div>{item.passage}</div>
                  </div>
                )}

                <p style={styles.question}>
                  {item.questionText || "Question text unavailable"}
                </p>

                {item.options?.length > 0 && (
                  <div style={styles.options}>
                    {item.options.map((option, index) => {
                      const label = option.label ?? String(index + 1);
                      const selected =
                        item.selectedOption != null &&
                        String(label).toUpperCase() ===
                          String(item.selectedOption).toUpperCase();
                      const correct =
                        item.correctOption != null &&
                        String(label).toUpperCase() ===
                          String(item.correctOption).toUpperCase();

                      let optionStyle = styles.option;
                      if (correct) {
                        optionStyle = {
                          ...styles.option,
                          background: "#052e2b",
                          borderColor: "#0f766e",
                          color: "#ccfbf1",
                        };
                      } else if (selected) {
                        optionStyle = {
                          ...styles.option,
                          background: "#3b1018",
                          borderColor: "#be123c",
                          color: "#ffe4e6",
                        };
                      }

                      return (
                        <div key={`${label}-${index}`} style={optionStyle}>
                          <span
                            style={{
                              ...styles.optionLabel,
                              ...(correct
                                ? { background: "#0f766e", color: "#f0fdfa" }
                                : selected
                                  ? { background: "#9f1239", color: "#fff1f2" }
                                  : {}),
                            }}
                          >
                            {label}
                          </span>
                          <span style={{ flex: 1 }}>
                            {option.text || "Option text unavailable"}
                            {correct && (
                              <strong style={{ marginLeft: 8, fontSize: 12 }}>
                                ✓ Correct answer
                              </strong>
                            )}
                            {selected && (
                              <strong style={{ marginLeft: 8, fontSize: 12 }}>
                                {correct ? "" : "Your answer"}
                              </strong>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={styles.answerRow}>
                  <div style={styles.answerBox}>
                    <span style={styles.answerLabel}>Your answer</span>
                    <span
                      style={{
                        ...styles.answerValue,
                        color: item.selectedOption ? "#fda4af" : "#cbd5e1",
                      }}
                    >
                      {item.selectedOption ?? "Not identified"}
                    </span>
                  </div>
                  <div style={styles.answerBox}>
                    <span style={styles.answerLabel}>Correct answer</span>
                    <span
                      style={{
                        ...styles.answerValue,
                        color: item.correctOption ? "#5eead4" : "#fbbf24",
                      }}
                    >
                      {item.correctOption ?? "Not verified"}
                    </span>
                  </div>
                </div>

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.actionButton}
                    onClick={() => toggleRevised(item)}
                  >
                    {item.revised ? (
                      <RotateCcw size={15} />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    {item.revised ? "Undo revised" : "Mark as revised"}
                  </button>
                  <button
                    type="button"
                    style={styles.actionButton}
                    onClick={() => removeItem(item)}
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function XStatusIcon() {
  return <CircleAlert size={13} />;
}
