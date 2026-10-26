
import { useMemo } from "react";

const STATUS_CONFIG = [
  { key: "correct", label: "Correct", color: "#14b8a6" },
  { key: "incorrect", label: "Incorrect", color: "#f43f5e" },
  { key: "unattempted", label: "Unattempted", color: "#f59e0b" },
];

export default function QuestionStatusChart({ questions = [] }) {
  const stats = useMemo(() => {
    const counts = { correct: 0, incorrect: 0, unattempted: 0 };

    questions.forEach((question) => {
      const status = String(question.status || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-");

      if (status === "correct") {
        counts.correct++;
      } else if (status === "incorrect" || status === "wrong") {
        counts.incorrect++;
      } else if (
        ["unattempted", "unattempted-question", "not-attempted"].includes(status)
      ) {
        counts.unattempted++;
      }
    });

    return counts;
  }, [questions]);

  const total = stats.correct + stats.incorrect + stats.unattempted;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <section className="status-chart-card">
      <div className="status-chart-header">
        <div>
          <h2>Question Analysis</h2>
          <p>Response sheet performance breakdown</p>
        </div>
        <span className="status-chart-total">{total} Questions</span>
      </div>

      {total === 0 ? (
        <div className="status-chart-empty">
          Analyze a response sheet to see your question statistics.
        </div>
      ) : (
        <div className="status-chart-content">
          <div className="status-donut-wrapper">
            <svg
              viewBox="0 0 100 100"
              className="status-donut"
              role="img"
              aria-label={`Question breakdown: ${stats.correct} correct, ${stats.incorrect} incorrect, ${stats.unattempted} unattempted`}
            >
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                opacity="0.10"
                strokeWidth="12"
              />

              {STATUS_CONFIG.map((item) => {
                const value = stats[item.key];
                const length = (value / total) * circumference;
                const offset = accumulated;
                accumulated += length;

                if (!value) return null;

                return (
                  <circle
                    key={item.key}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="12"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 50 50)"
                    strokeLinecap="butt"
                  />
                );
              })}

              <text
                x="50"
                y="46"
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill="currentColor"
              >
                {total}
              </text>
              <text
                x="50"
                y="59"
                textAnchor="middle"
                fontSize="7"
                fill="currentColor"
                opacity="0.7"
              >
                QUESTIONS
              </text>
            </svg>
          </div>

          <div className="status-chart-legend">
            {STATUS_CONFIG.map((item) => {
              const count = stats[item.key];
              const percentage = ((count / total) * 100).toFixed(1);

              return (
                <div className="status-chart-row" key={item.key}>
                  <span
                    className="status-chart-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="status-chart-label">
                    <span>{item.label}</span>
                    <div className="status-chart-track">
                      <div
                        className="status-chart-fill"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                  <div className="status-chart-value">
                    <strong>{count}/{total}</strong>
<small>{percentage}%</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
