
import { chromium } from "playwright";
import { validatePublicUrl } from "./urlSafety.js";
import { extractRrbSectionController } from "../adapters/rrbSectionController.js";
import { scoreQuestions } from "./scoring.js";

const MAX_HTML_SIZE = 10 * 1024 * 1024;

export async function analyzeUrl(rawUrl) {
  let validatedUrl;

  try {
    validatedUrl = await validatePublicUrl(rawUrl);
  } catch (error) {
    throw new Error(error.message || "The supplied URL is not allowed.");
  }

  let browser;

  try {
    browser = await chromium.launch({
  headless: true,
});

    const context = await browser.newContext({
      javaScriptEnabled: true,
      serviceWorkers: "block",
      locale: "en-IN",
      viewport: { width: 1365, height: 900 },
    });

    const page = await context.newPage();

    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(15000);

    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-IN,en;q=0.9",
      "Cache-Control": "no-cache",
    });

    // Validate every requested URL to reduce SSRF risk.
    // Do not silently change the submitted URL's path.
    await page.route("**/*", async (route) => {
      try {
        const requestUrl = route.request().url();

        if (
          requestUrl.startsWith("data:") ||
          requestUrl.startsWith("blob:")
        ) {
          return await route.continue();
        }

        await validatePublicUrl(requestUrl);
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });

    let response;

    try {
      response = await page.goto(validatedUrl.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch (error) {
      console.error("RRB navigation failed:", {
        url: validatedUrl.toString(),
        message: error.message,
      });

      throw new Error(
        "Could not load the answer-sheet URL. Check the URL and try again."
      );
    }

    if (!response) {
      throw new Error("The answer-sheet page returned no HTTP response.");
    }

    const status = response.status();
    const contentType = response.headers()["content-type"] || "";

    if (!response.ok()) {
      let responseBody = "";

      try {
        responseBody = (await response.text()).slice(0, 2000);
      } catch {
        responseBody = "(Response body could not be read)";
      }

      console.error("RRB HTTP error:", {
        status,
        statusText: response.statusText(),
        url: response.url(),
        body: responseBody,
      });

    const isAccessDenied =
  status === 403 ||
  /<title>\s*403\s*<\/title>|access denied|forbidden/i.test(responseBody);

throw new Error(
  isAccessDenied
    ? "The RRB website denied the automated request. Open the response sheet in your browser and upload its saved HTML instead."
    : `The answer-sheet website returned HTTP ${status}.`
);
    }

    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error(
        "The supplied URL did not return an HTML answer-sheet page."
      );
    }

    // Wait briefly for the question tables to appear after page scripts run.
    try {
     
try {
  await page.waitForSelector(
    "table.questionPlTbl, table.questionRowTbl",
    { timeout: 20000 }
  );
} catch {
  console.log("Question tables not found after waiting.");
}

const diagnostics = await page.evaluate(() => ({
  title: document.title,
  url: location.href,
  bodyText: document.body?.innerText?.slice(0, 1500) || "",
  questionPlTblCount: document.querySelectorAll("table.questionPlTbl").length,
  questionRowTblCount: document.querySelectorAll("table.questionRowTbl").length,
  tableCount: document.querySelectorAll("table").length,
}));

// console.log("RRB page diagnostics:", diagnostics);

const html = await page.content();

if (!html || html.length > MAX_HTML_SIZE) {
  throw new Error("The answer-sheet HTML is empty or too large.");
}

const parsed = extractRrbSectionController(html, page.url());

if (!parsed.questions || parsed.questions.length === 0) {
  // Save a local diagnostic copy of the HTML for inspection.
  const fs = await import("node:fs/promises");
  await fs.writeFile("rrb-debug.html", html, "utf8");

  console.error(
    "No questions extracted. Saved page HTML to server/rrb-debug.html"
  );

  throw new Error(
    "The page loaded, but no questions were extracted. " +
      "Check the page diagnostics and server/rrb-debug.html."
  );
}

const scored = scoreQuestions(parsed.questions);

return {
  ...parsed,
  ...scored,
  sourceUrl: page.url(),
  analyzedAt: new Date().toISOString(),
  questionCount: parsed.questions.length,
};

    } catch {
      // Continue so the parser can return a more useful diagnostic.
    }

    const html = await page.content();

    if (!html || html.length > MAX_HTML_SIZE) {
      throw new Error(
        "The answer-sheet HTML is empty or too large to process safely."
      );
    }

    const parsed = extractRrbSectionController(html, page.url());

    if (!parsed.questions || parsed.questions.length === 0) {
      throw new Error(
        "The page loaded, but no questions could be extracted. " +
          "The website may have returned a different page or changed its HTML."
      );
    }

    const scored = scoreQuestions(parsed.questions);

    return {
      ...parsed,
      ...scored,
      sourceUrl: page.url(),
      analyzedAt: new Date().toISOString(),
      questionCount: parsed.questions.length,
    };
  } finally {
  if (browser) {
    if (process.env.KEEP_BROWSER_OPEN === "true") {
      // console.log("Debug mode: browser left open.");
    } else {
      await browser.close().catch(() => {});
    }
  }
}
}
