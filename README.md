# RRB Answer-Key Analyzer (starter)

A React + Express starter for analyzing a publicly accessible RRB response-sheet/answer-key webpage.

## What works in this starter
- Paste a URL into the UI.
- Backend fetches public HTML with basic URL/SSRF protections.
- Adapter-based extraction architecture.
- Normalized question model.
- Correct / incorrect / unattempted classification.
- Configurable marking scheme.
- Section filters and CSV export in the browser.
- Demo mode to test the UI before the real RRB page selectors are configured.

## Important limitation
RRB response-sheet pages do not necessarily share one HTML structure. This starter includes generic extraction heuristics, but reliable extraction requires the actual response-sheet URL and inspection of its page structure. If the page loads data through JavaScript, the Playwright adapter may be needed. Do not put passwords, registration numbers, or other credentials into this app.

## Requirements
- Node.js 20+
- npm

## Run locally
Open two terminals:

### API
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually http://localhost:5173).

## API
- `GET /api/health`
- `POST /api/analyze` with `{ "url": "https://public-page.example/response-sheet" }`
- `POST /api/demo` returns a sample analysis

## Configure official hosts
Set `ALLOWED_HOSTS` in `server/.env` to a comma-separated list of the official hostnames you have verified, for example:
```
ALLOWED_HOSTS=example.rrb.gov.in,rrbapply.gov.in
```
The server rejects hosts not in this list when it is configured. This is recommended before deployment.

## How to make extraction accurate
1. Paste the exact public response-sheet URL into the analyzer.
2. Inspect the page's HTML and network behavior.
3. Add selectors to `server/src/adapters/rrbSectionController.js`.
4. Map the site's labels to `selectedOption` and `correctOption`.
5. Verify the output against several known questions before trusting a score.

Never treat a guessed extraction as a verified score. The API returns a warning when it cannot confidently identify question records.
