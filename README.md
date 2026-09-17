# Web Section Extractor & Offline Deconstruct Engine

An automated, self-contained service with a **REST API** and **Interactive Web Dashboard** designed to deconstruct any website using Playwright, capture high-resolution screenshots, extract and classify sections against master archetypes (e.g. `navbar`, `hero`, `features`, `pricing`, `testimonials`, `footer`), semantically rename classes across HTML, CSS, and JS, purge and minify CSS, localize all assets for offline fidelity, and rewrite internal links to relative paths (`/abcd/`).

---

## Key Features

1. **Playwright Headless Crawler**:
   - Renders modern JS-heavy sites (React, Vue, Next.js, etc.).
   - Scrolls dynamically to trigger IntersectionObserver, lazy loading, and CSS animations.
   - Captures full-page screenshots and section-specific screenshots.
2. **Master Archetype Classification**:
   - Automatically segments pages into labeled sections (`s1-navbar`, `s2-hero`, `s3-pricing`, `s4-testimonials`, `s5-footer`, etc.).
   - Multi-dimensional heuristic scoring matching against master archetypes: tag semantics, DOM structure, keywords, currency patterns, card grids, carousels, and layout position.
3. **Semantic Class Renaming & Propagation**:
   - Replaces minified or cryptic CSS classes (e.g., `_2k8df9_x` or `tw-py-4`) with clean, readable semantic classes based on section archetype (`hero-title`, `navbar-brand`, `pricing-card`, `testimonial-quote`).
   - Propagates renaming synchronously across **HTML DOM**, **CSS AST (PostCSS)**, and **JavaScript scripts (querySelectors, classList)**.
4. **CSS Purging & Minification**:
   - Evaluates selectors against section DOM trees to discard unused rules.
   - Generates both human-readable beautified CSS (`section.css`) and compact minified CSS (`section.min.css`).
5. **100% Offline Fidelity & Relative Link Rewriting**:
   - Downloads images, SVGs, webfonts, videos, and background media into a local `./assets/` directory.
   - Recursively resolves ES Module imports (`import './*.built.js'`) for offline runtime fidelity.
   - Preserves HTML5 full document tags, video resolution basepaths, desktop hover flyouts, search modals, and mobile responsive menus.
   - Automatic mobile navigation drilldown glitch patch preventing submenu text collisions.
   - Rewrites all internal website links (e.g., `https://example.com/pricing` -> `/pricing/`) while preserving anchor hashes and search params.
   - See [WALKTHROUGH.md](./WALKTHROUGH.md) for full architectural breakdown and offline fidelity case studies.
6. **Production & VPS Ready**:
   - Built-in `Dockerfile` and `docker-compose.yml` pre-configured with Linux font dependencies and Chromium.
   - REST API and interactive browser-based dashboard.

---

## Quick Start (VPS / Docker)

### Using Docker Compose (Recommended for VPS)

```bash
# Clone or copy the project to your VPS
cd web-extractor-engine

# Start the container in background
docker compose up -d

# Check status and logs
docker compose logs -f
```

The Web Dashboard will be available at: `http://<your-vps-ip>:3000/`  
The REST API will be available at: `http://<your-vps-ip>:3000/api`

### Direct Node.js Run

```bash
cd web-extractor-engine
npm install
npx playwright install chromium
npm run build
npm start
```

---

## REST API Reference

### 1. Submit URL for Extraction
**`POST /api/extract`**

#### Request Body:
```json
{
  "url": "https://example.com",
  "options": {
    "renameClasses": true,
    "purgeCss": true,
    "deminify": true,
    "localizeAssets": true,
    "rewriteLinks": true,
    "mobile": false
  }
}
```

#### Response (`202 Accepted`):
```json
{
  "success": true,
  "jobId": "a1b2c3d4",
  "message": "Extraction job started",
  "statusUrl": "/api/jobs/a1b2c3d4",
  "previewUrl": "/api/jobs/a1b2c3d4/preview",
  "downloadUrl": "/api/jobs/a1b2c3d4/download"
}
```

#### cURL Example:
```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://stripe.com", "options": {"renameClasses": true, "purgeCss": true}}'
```

---

### 2. Check Job Status & Progress
**`GET /api/jobs/:id`**

#### Response:
```json
{
  "id": "a1b2c3d4",
  "url": "https://stripe.com",
  "status": "completed",
  "progress": 100,
  "currentStep": "Extraction completed successfully",
  "sections": [
    {
      "id": "s1",
      "name": "s1-navbar",
      "archetype": "navbar",
      "confidence": 0.95,
      "elementCount": 42
    },
    {
      "id": "s2",
      "name": "s2-hero",
      "archetype": "hero",
      "confidence": 0.9,
      "elementCount": 68
    }
  ],
  "stats": {
    "originalCssBytes": 284102,
    "minifiedCssBytes": 38120,
    "assetCount": 18,
    "sectionCount": 6
  }
}
```

---

### 3. Live Offline Preview
**`GET /api/jobs/:id/preview`**
Serves the rendered, localized, offline-ready page directly in your browser.

---

### 4. Download Complete Package (ZIP)
**`GET /api/jobs/:id/download`**
Downloads `site-package.zip` containing:
- `full-page/index.html` (beautified, relative links `/abcd/`, localized assets)
- `full-page/style.css` (deminified & beautified)
- `full-page/style.min.css` (purged & minified)
- `full-page/script.js` (deminified & transformed)
- `full-page/full-page.png` (high-res screenshot)
- `full-page/assets/` (images, SVGs, fonts)
- `sections/s1-navbar/` (section HTML, CSS, JS, preview, screenshot, metadata)
- `sections/s2-hero/`
- `report.json` (complete analysis metrics)

---

### 5. Inspect Specific Section
**`GET /api/jobs/:id/sections/:sectionId`**
Returns HTML, beautified CSS, minified CSS, JS, and metadata for a specific section.

**`GET /api/jobs/:id/sections/:sectionId/preview`**
Serves a standalone preview page rendering only that section with its scoped styles.

**`GET /api/jobs/:id/sections/:sectionId/screenshot`**
Returns the PNG screenshot of that specific section.

---

### 6. List Master Archetypes
**`GET /api/archetypes`**
Lists all supported section archetypes (`navbar`, `hero`, `features`, `card-grid`, `carousel`, `pricing`, `testimonials`, `cta`, `stats`, `faq`, `contact`, `gallery`, `footer`, `content`).

---

## CLI Usage

You can also run the engine directly from the terminal without starting the HTTP server:

```bash
node dist/index.js --url https://example.com
```

---

## Directory Structure

```
web-extractor-engine/
├── Dockerfile                   # VPS Docker container spec
├── docker-compose.yml           # VPS orchestration config
├── package.json                 # Dependencies & build scripts
├── tsconfig.json                # TypeScript settings
├── public/                      # Interactive Web Dashboard
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   ├── index.ts                 # CLI & server entrypoint
│   ├── server.ts                # Express REST API routes
│   ├── config.ts                # System settings & crawler options
│   ├── types.ts                 # TypeScript interfaces
│   ├── classifier/              # Section archetypes & matching engine
│   ├── crawler/                 # Playwright browser manager & extractor
│   ├── localizer/               # Asset downloader & offline localizer
│   ├── optimizer/               # CSS purger & minifier
│   ├── packager/                # ZIP builder & report generator
│   └── transformer/             # HTML, CSS, and JS semantic rewriters
└── storage/
    └── jobs/                    # Output jobs, previews, assets, and ZIPs
```
