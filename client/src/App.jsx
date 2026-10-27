import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  Link2,
  LoaderCircle,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import MistakeBook from "./MistakeBook";
import { saveMistakesFromAnalysis } from "./utils/mistakeBookStorage";
import QuestionStatusChart from "./QuestionStatusChart";

const API = import.meta.env.VITE_API_URL || "";
const MAX_HTML_SIZE = 10 * 1024 * 1024;

export default function App() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [section, setSection] = useState("all");
  const [search, setSearch] = useState("");
  const [showMistakeBook, setShowMistakeBook] = useState(false);

  async function requestAnalysis(endpoint, body) {
    setError("");
    setLoading(true);
    setData(null);

    try {
      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || `Analysis failed (HTTP ${response.status}).`,
        );
      }

      if (!Array.isArray(result.questions)) {
        throw new Error("The server returned an invalid analysis result.");
      }

      setData(result);
      setFilter("all");
      setSection("all");
      setSearch("");
    } catch (e) {
      console.error("Answer analyzer request failed:", e);

      const message = e?.message || "Request failed.";
      const isAccessDenied =
        /TCS iON denied|RRB website denied|HTTP 403|access denied|forbidden/i.test(
          message,
        );
      const isNetworkError =
        e instanceof TypeError && /fetch|network|failed/i.test(message);

      if (endpoint === "/api/analyze" && isAccessDenied) {
        setError(
          "TCS iON denied the automated URL request. Open the response sheet in your regular browser, save the page as an HTML file, then select ‘Analyze saved HTML’ below. The API responded, so this is an access restriction—not a backend connection error.",
        );
      } else if (isNetworkError) {
        setError(
          "Could not connect to the ExamLens API. Check your internet connection and the VITE_API_URL deployment setting, then try again.",
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function analyze(endpoint = "/api/analyze") {
    if (endpoint === "/api/demo") {
      return requestAnalysis(endpoint, {});
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError("Enter the public response-sheet URL first.");
      return;
    }

    try {
      const parsedUrl = new URL(trimmedUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Only HTTP and HTTPS URLs are supported.");
      }
    } catch {
      setError("Enter a valid HTTP or HTTPS URL.");
      return;
    }

    return requestAnalysis(endpoint, { url: trimmedUrl });
  }

  async function analyzeHtmlFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!/\.(html?|xhtml)$/i.test(file.name)) {
      setError("Choose an HTML file ending in .html, .htm, or .xhtml.");
      return;
    }

    if (file.size > MAX_HTML_SIZE) {
      setError("The HTML file must be 10 MB or smaller.");
      return;
    }

    if (file.size === 0) {
      setError("The selected HTML file is empty.");
      return;
    }

    try {
      const html = await file.text();

      if (!/<html[\s>]/i.test(html)) {
        setError("This file does not appear to contain an HTML document.");
        return;
      }

      if (
        /<title>\s*(?:403|forbidden|access denied)\s*<\/title>/i.test(html) ||
        /request denied|access has been denied|unable to service your request|you don't have permission to access/i.test(
          html.slice(0, 50000),
        )
      ) {
        setError(
          "This file appears to contain an access-denied page, not the response sheet. Open the actual response sheet in your browser and save that page as HTML.",
        );
        return;
      }

      await requestAnalysis("/api/analyze-html", {
        html,
        filename: file.name,
      });
    } catch (e) {
      setError(e.message || "Could not read the selected HTML file.");
    }
  }

  useEffect(() => {
    if (!Array.isArray(data?.questions)) return;

    saveMistakesFromAnalysis(
      data.questions,
      data.exam || "RRB Section Controller CBT 1",
    );
  }, [data]);

  const questions = data?.questions || [];

  const sections = useMemo(
    () => [
      ...new Set(
        (data?.questions || []).map((q) => q.section || "Uncategorized"),
      ),
    ],
    [data],
  );

  const visibleQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return questions.filter((q) => {
      const status = String(q.status || "needs-review").toLowerCase();
      const questionNumber = q.number ?? q.questionNumber ?? "";
      const questionText = q.questionText ?? q.question ?? "";
      const selected = q.selectedOption ?? q.chosenOption ?? "";
      const correct = q.correctOption ?? "";

      const matchesFilter = filter === "all" || status === filter;
      const matchesSection =
        section === "all" || (q.section || "Uncategorized") === section;

      const searchableText = [
        questionNumber,
        questionText,
        selected,
        correct,
        q.section || "",
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesFilter &&
        matchesSection &&
        (!query || searchableText.includes(query))
      );
    });
  }, [questions, filter, section, search]);

  function exportCsv() {
    if (!data) return;

    const rows = [
      [
        "Question No",
        "Section",
        "Question",
        "Options",
        "Selected Answer",
        "Correct Answer",
        "Status",
      ],
      ...visibleQuestions.map((q) => [
        q.number ?? q.questionNumber ?? "",
        q.section || "Uncategorized",
        q.questionText ?? q.question ?? "",
        (q.options || [])
          .map((o) => `${o.label || ""}. ${o.text || ""}`)
          .join(" | "),
        q.selectedOption ?? q.chosenOption ?? "",
        q.correctOption ?? "",
        q.status || "needs-review",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = "rrb-answer-analysis.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  const summary = data?.summary;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brandIcon">
            <Activity size={20} />
          </span>
          <span>
            ExamLens
            <small>RRB ANSWER ANALYZER</small>
          </span>
        </a>

        <div className="topbarActions">
          <button
            type="button"
            className="secondary"
            onClick={() => setShowMistakeBook((current) => !current)}
          >
            {showMistakeBook ? "Back to Analysis" : "Mistake Book"}
          </button>
          <span className="pill">
            <span className="dot" /> Beta · Local prototype
          </span>
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">RESPONSE SHEET → PERFORMANCE REPORT</div>
        <h1>
          Know exactly where
          <br />
          <span>you stand.</span>
        </h1>
        <p>
          Analyze your RRB response sheet to classify correct, incorrect, and
          unattempted questions, calculate your score, and review every answer.
        </p>
      </section>

      <section className="inputCard">
        <label htmlFor="answerUrl">Public response-sheet URL</label>

        <div className="urlInput">
          <Link2 size={19} />
          <input
            id="answerUrl"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://official-rrb-site.gov.in/response-sheet"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) analyze();
            }}
            disabled={loading}
          />
        </div>

        <div className="actions">
          <button
            className="primary"
            disabled={loading || !url.trim()}
            onClick={() => analyze()}
          >
            {loading ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <FileSearch size={18} />
            )}
            Analyze response sheet
          </button>

          <button
            className="secondary"
            disabled={loading}
            onClick={() => analyze("/api/demo")}
          >
            Try demo data
          </button>
        </div>

        <div className="uploadRow">
          <label
            htmlFor="htmlUpload"
            className={`secondary uploadButton ${loading ? "disabled" : ""}`}
          >
            {loading ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Upload size={17} />
            )}
            Analyze saved HTML
          </label>

          <input
            id="htmlUpload"
            type="file"
            accept=".html,.htm,.xhtml,text/html,application/xhtml+xml"
            onChange={analyzeHtmlFile}
            disabled={loading}
            hidden
          />
        </div>

        <p className="privacyNote">
          If URL analysis is denied by TCS iON, open the response sheet in your
          regular browser and save that page as an HTML file. Then choose
          “Analyze saved HTML” above. Never enter account passwords or login
          credentials.
        </p>
      </section>

      {showMistakeBook ? (
        <MistakeBook />
      ) : (
        <>
          {error && (
            <div className="errorBox" role="alert">
              <CircleAlert size={19} />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="loadingBox" role="status">
              <LoaderCircle className="spin" size={20} />
              <span>Analyzing your response sheet…</span>
            </div>
          )}

          {data && (
            <>
              {data.warnings?.length > 0 && (
                <div className="warningBox">
                  <CircleAlert size={19} />
                  <div>
                    <strong>Extraction needs verification</strong>
                    {data.warnings.map((warning, index) => (
                      <p key={`${index}-${warning}`}>{warning}</p>
                    ))}
                  </div>
                </div>
              )}

              <section className="resultsHead">
                <div>
                  <div className="eyebrow">ANALYSIS REPORT</div>
                  <h2>{data.exam || "RRB Answer Analysis"}</h2>
                  <p>
                    {data.extractionMethod === "demo"
                      ? "Sample data · not an official result"
                      : data.extractedAt
                        ? `Analyzed ${new Date(data.extractedAt).toLocaleString()}`
                        : data.analyzedAt
                          ? `Analyzed ${new Date(data.analyzedAt).toLocaleString()}`
                          : "Analysis complete"}
                  </p>
                </div>

                <button
                  className="secondary"
                  onClick={exportCsv}
                  disabled={visibleQuestions.length === 0}
                >
                  <ArrowDownToLine size={17} />
                  Export CSV
                </button>
              </section>

              {summary && (
                <section className="statsGrid">
                  <Stat
                    label="Calculated score"
                    // value={summary.score ?? "—"}
                    value={`${summary.score ?? 0}/${summary.total ?? 0}`}
                    detail="Verify the marking scheme"
                    tone="score"
                  />
                  <Stat
                    label="Correct"
                    value={`${summary.correct ?? 0}/${summary.total ?? 0}`}
                    detail={`${
                      summary.total
                        ? Math.round(
                            ((summary.correct ?? 0) / summary.total) * 100,
                          )
                        : 0
                    }% of all questions`}
                    tone="correct"
                  />
                  <Stat
                    label="Incorrect"
                    value={`${summary.incorrect ?? 0}/${summary.total ?? 0}`}
                    detail="1/3 Negative marking may apply"
                    tone="incorrect"
                  />
                  <Stat
                    label="Unattempted"
                    value={`${summary.unattempted ?? 0}/${summary.total ?? 0}`}
                    detail={`${summary.needsReview ?? 0} need review`}
                    tone="blank"
                  />
                </section>
              )}

              {summary?.sections?.length > 0 && (
                <section className="sectionCard">
                  <div className="cardTitle">
                    <h3>Section breakdown</h3>
                    <span>
                      {summary.total ?? questions.length} questions detected
                    </span>
                  </div>

                  <div className="sectionRows">
                    {summary.sections.map((item) => (
                      <div className="sectionRow" key={item.section}>
                        <div className="sectionName">
                          {item.section}
                          <small>{item.total} questions</small>
                        </div>

                        <div
                          className="bar"
                          role="progressbar"
                          aria-label={`${item.section} correct answers`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={
                            item.total
                              ? Math.round((item.correct / item.total) * 100)
                              : 0
                          }
                        >
                          <span
                            style={{
                              width: `${
                                item.total
                                  ? Math.min(
                                      100,
                                      (item.correct / item.total) * 100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>

                        <div className="sectionCounts">
                          <b className="greenText">{item.correct} C</b>
                          <b className="redText">{item.incorrect} W</b>
                          <b>{item.unattempted} U</b>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section>
                {data && (
                  <QuestionStatusChart questions={data.questions ?? []} />
                )}
              </section>

              <section className="sectionCard">
                <div className="cardTitle">
                  <h3>Question review</h3>
                  <span>{visibleQuestions.length} shown</span>
                </div>

                <div className="filters">
                  <div className="searchBox">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search question or answer"
                      aria-label="Search questions"
                    />
                  </div>

                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    aria-label="Filter by status"
                  >
                    <option value="all">All statuses</option>
                    <option value="correct">Correct</option>
                    <option value="incorrect">Incorrect</option>
                    <option value="unattempted">Unattempted</option>
                    <option value="needs-review">Needs review</option>
                  </select>

                  <select
                    value={section}
                    onChange={(event) => setSection(event.target.value)}
                    aria-label="Filter by section"
                  >
                    <option value="all">All sections</option>
                    {sections.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="questionList">
                  {visibleQuestions.map((question, index) => (
                    <Question
                      key={
                        question.id ??
                        question.number ??
                        question.questionNumber ??
                        index
                      }
                      q={question}
                    />
                  ))}

                  {visibleQuestions.length === 0 && (
                    <div className="empty">
                      No questions match these filters.
                    </div>
                  )}
                </div>
              </section>

              <p className="disclaimer">
                Verify extracted answers against the official response sheet
                before relying on the calculated score. Missing official answers
                should never be treated as confirmed incorrect answers.
              </p>
            </>
          )}
        </>
      )}

      <footer>ExamLens · Built for transparent exam review</footer>
    </main>
  );
}

function Stat({ label, value, detail, tone }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
      <div className="statDetail">{detail}</div>
    </div>
  );
}

function Question({ q }) {
  const status = String(q.status || "needs-review").toLowerCase();

  const meta = {
    correct: {
      label: "Correct",
      icon: <CheckCircle2 size={16} />,
    },
    incorrect: {
      label: "Incorrect",
      icon: <XCircle size={16} />,
    },
    unattempted: {
      label: "Unattempted",
      icon: <CircleAlert size={16} />,
    },
    "needs-review": {
      label: "Needs review",
      icon: <CircleAlert size={16} />,
    },
  }[status] || {
    label: "Needs review",
    icon: <CircleAlert size={16} />,
  };

  const number = q.number ?? q.questionNumber ?? "?";
  const questionText =
    q.questionText ?? q.question ?? "Question text was not extracted.";
  const selectedOption = q.selectedOption ?? q.chosenOption ?? null;

  return (
    <article className="question">
      <div className="questionTop">
        <span className="qNumber">Q{number}</span>
        <span className={`status ${status}`}>
          {meta.icon}
          {meta.label}
        </span>
      </div>

      {q.passage && (
  <div className="questionPassage">
    <strong>Passage</strong>
    <p>{q.passage}</p>
  </div>
)}

      <p className="questionText">{questionText}</p>

      <div className="answerGrid">
        <div>
          <small>Your response</small>
          <strong
            className={
              status === "incorrect"
                ? "redText"
                : status === "correct"
                  ? "greenText"
                  : ""
            }
          >
            {selectedOption ?? "Not attempted / not detected"}
          </strong>
        </div>

        <div>
          <small>Official answer</small>
          <strong>{q.correctOption ?? "Not detected"}</strong>
        </div>
      </div>

      {q.options?.length > 0 && (
        <div className="options">
          {q.options.map((option, index) => (
            <span key={`${option.label ?? "option"}-${index}`}>
              <b>{option.label ? `${option.label}.` : `${index + 1}.`}</b>{" "}
              {option.text ?? option}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
