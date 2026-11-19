# Figma → DOM Visual & CSS QA

Compare a Figma frame against a live website. The tool pulls layout and type values from the Figma REST API, renders the site in headless Chromium (Playwright), pairs each Figma node with a DOM element, and flags **typography**, **padding**, **spacing** and **missing element** problems. Each problem is drawn on a full-page screenshot.

```
shared/types.ts      Shared TypeScript contracts (copied into worker/src/shared and web/src/shared)
worker/              Fastify + Playwright API, CLI, Dockerfile (port 7860)
web/                 Next.js visual inspector
.github/workflows/   Optional PR check
```

## Run locally

Requires Node 20 or later.

```bash
cd worker
npm install
npx playwright install chromium
npm run build
npm start                       # http://localhost:7860

cd ../web
npm install
cp .env.example .env.local      # NEXT_PUBLIC_WORKER_URL=http://localhost:7860
npm run dev                     # http://localhost:3000
```

Open http://localhost:3000 and fill in:

1. **Figma Frame URL.** In Figma, right-click a frame, choose *Copy link to selection*, and paste it. The link must contain `node-id`.
2. **Website URL** to audit. The site is rendered at the frame's width.
3. **Figma Personal Access Token.** Create one in Figma under Settings → Security → Personal access tokens (read access to file content is enough). The token is kept in `localStorage` only.

### Reading the results
- **Page inspector:** the full-page screenshot with numbered boxes. Red boxes are errors and amber boxes are warnings. For spacing issues, a magenta bar marks the gap. Click a box or a sidebar item to open the diff drawer, which shows expected vs actual values, the CSS selector and a zoomed close-up of the defect.
- **Defect screenshots:** a gallery with a cropped screenshot of every defect.
- **Download annotated PNG**, **Download defect screenshot** and **Export JSON** save the evidence. Use **Open report JSON** to load a saved report or a CLI report.

## CLI

```bash
cd worker
FIGMA_TOKEN=figd_xxx node dist/cli.js --figma "<frameUrl>" --site "<siteUrl>" --tolerance 2 --out ./qa-report --min-score 80
```

This writes `qa-report/report.json` and `qa-report/screenshot.png`. The command exits with a non-zero code when the score is below `--min-score`.

## API

`POST /api/audit` with `{ figmaUrl, figmaToken, siteUrl, tolerance }` returns an `AuditReport`.
Error codes: `400` invalid Figma URL or missing node-id, `401` bad Figma token, `422` site unreachable, `429` Figma rate limit, `503` worker busy.
`GET /health` returns the worker status.

Worker environment variables: `PORT` (7860), `CORS_ORIGIN` (all origins by default), `MAX_CONCURRENT` (2), `MAX_SCREENSHOT_HEIGHT` (16000), `CHROMIUM_SINGLE_PROCESS=1` (for 512 MB hosts such as Render), `FIGMA_API_BASE` (used for tests).

## Matching accuracy tips
- Add `data-figma-id="12:34"` to important elements. These match with 100% confidence.
- Text nodes match by normalized text. When the same text appears more than once, the element closest to the Figma position wins.
- Containers match by IoU ≥ 0.70 and must contain their matched children. The IoU is also checked after aligning the container to where its children actually rendered, so layout drift does not break matching.

## Tests

```bash
cd worker && npm run test:e2e
```

The test starts a mock Figma API and a page with planted defects. It checks that every defect is found and that the 400, 401 and 422 errors are returned.

## Free deployment
- **Worker:** create a Hugging Face Space with the Docker SDK and push the contents of `worker/` to it. The included `Dockerfile` serves the API on port 7860.
- **Web:** import the repo into Vercel, set the root directory to `web` and set `NEXT_PUBLIC_WORKER_URL` to your Space URL.
- **Auditing localhost:** run `npx cloudflared tunnel --url http://localhost:3000` and audit the generated `trycloudflare.com` URL.
- **CI:** set the repo variables `FIGMA_FRAME_URL` and `QA_SITE_URL` (optionally `QA_MIN_SCORE`) and the secret `FIGMA_TOKEN`.
