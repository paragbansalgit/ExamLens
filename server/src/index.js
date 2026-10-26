
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { analyzeUrl } from "./services/analyzeUrl.js";
import { demoResult } from "./services/demo.js";
import { extractRrbSectionController } from "./adapters/rrbSectionController.js";
import { scoreQuestions } from "./services/scoring.js";

const app = express();
const port = Number(process.env.PORT || 4000);

const MAX_HTML_SIZE = 10 * 1024 * 1024;

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);

// The JSON limit must allow for HTML plus JSON encoding overhead.
app.use(express.json({ limit: "12mb" }));

app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "rrb-answer-key-analyzer",
  });
});

app.post("/api/analyze", async (req, res) => {
  const url = req.body?.url;

  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({
      error: "Paste a valid response-sheet URL.",
    });
  }

  try {
    const result = await analyzeUrl(url.trim());
    return res.json(result);
  } catch (error) {
    console.error("URL analysis failed:", error.message);

    return res.status(error.statusCode || 500).json({
      error:
        error.publicMessage ||
        error.message ||
        "Could not analyze this page.",
    });
  }
});

app.post("/api/analyze-html", (req, res) => {
  const { html, filename } = req.body || {};

  if (typeof html !== "string" || !html.trim()) {
    return res.status(400).json({
      error: "Upload a non-empty HTML file.",
    });
  }

  if (Buffer.byteLength(html, "utf8") > MAX_HTML_SIZE) {
    return res.status(413).json({
      error: "The HTML file must be 10 MB or smaller.",
    });
  }

  if (!/<html[\s>]/i.test(html)) {
    return res.status(400).json({
      error: "The uploaded file does not appear to contain an HTML document.",
    });
  }

  // Do not accidentally analyze an access-denied page.
  if (
    /<title>\s*(?:403|forbidden|access denied)\s*<\/title>/i.test(html) ||
    /request denied|access has been denied|you don't have permission to access/i.test(
      html.slice(0, 50000)
    )
  ) {
    return res.status(422).json({
      error:
        "This file contains an access-denied page, not the response sheet.",
    });
  }

  try {
    const parsed = extractRrbSectionController(html);

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return res.status(422).json({
        error:
          "No questions were extracted. The saved HTML may not contain the rendered question tables.",
        warnings: parsed.warnings || [],
      });
    }

    const scored = scoreQuestions(parsed.questions);

    return res.json({
      ...parsed,
      ...scored,
      exam: parsed.title || "RRB Answer Analysis",
      extractionMethod: "html-upload",
      filename:
        typeof filename === "string" ? filename.slice(0, 255) : undefined,
      extractedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("HTML analysis failed:", error);

    return res.status(500).json({
      error: "Could not parse the uploaded HTML file.",
    });
  }
});

app.post("/api/demo", (_req, res) => {
  res.json(demoResult());
});

// Report oversized requests cleanly instead of returning a stack trace.
app.use((error, _req, res, next) => {
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return res.status(413).json({
      error: "Request too large. Upload an HTML file no larger than 10 MB.",
    });
  }

  return next(error);
});

app.listen(port, () => {
  console.log(`RRB Analyzer API listening on http://localhost:${port}`);
});
