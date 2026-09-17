# Replicator Mechanism - Comprehensive Walkthrough & Development Guide

> **Repository**: [https://github.com/DhruvalBhansali2912/replicator-mechanism.git](https://github.com/DhruvalBhansali2912/replicator-mechanism.git)  
> **System**: Web Section Extractor, Classifier, Semantic Renamer & Offline Localization Engine

---

## 📖 Overview

The **Replicator Mechanism** is an end-to-end autonomous engine designed to crawl, deconstruct, clean, and localize any website. It runs as a self-contained service with both a **REST API** (for programmatic external use) and a **Web Dashboard** (for visual inspection and testing), and is packaged for VPS deployment via Docker.

### Core Capabilities:
1. **Playwright Deep Crawl & Screenshots**:
   - Visits any submitted URL, simulates user interactions, and smoothly scrolls to trigger lazy loading, `IntersectionObserver` elements, and CSS animations.
   - Captures high-resolution full-page screenshot (`full-page.png`) and bounding box screenshots for each detected section.
2. **Dynamic Section Detection & Classification**:
   - Segments web pages into semantic sections (`s1`, `s2`, `s3`, ...).
   - Matches against master design archetypes (`navbar`, `hero`, `features`, `card-grid`, `carousel`, `pricing`, `testimonials`, `cta`, `stats`, `faq`, `contact`, `gallery`, `footer`, `content`) using multi-factor heuristic scoring.
3. **Semantic Class Renaming Across HTML, CSS & JS**:
   - Strips minified or cryptic CSS classes (e.g., `tw-flex items-center`, `css-83hf9`, `_2k8df9_x`) and assigns clean, readable, BEM-style semantic classes based on section archetype (e.g., `navbar-brand`, `navbar-menu`, `hero-title`, `hero-cta-btn`, `pricing-card`).
   - Propagates these changes across **HTML (Cheerio DOM)**, **CSS (PostCSS AST)**, and **JavaScript (Babel / AST / Query Selectors)** so the code remains fully functional and synchronized.
4. **CSS Purging & Minification**:
   - Scans CSS rules against each section's DOM elements to eliminate unreferenced rules.
   - Produces both formatted, readable CSS (`section.css`) and ultra-compact minified CSS (`section.min.css`) with 60%+ size reduction.
5. **100% Offline Fidelity & Link Sanitization**:
   - Downloads images, SVGs, and webfonts to a local `assets/` directory.
   - Rewrites all internal website links (e.g., `https://example.com/abcd` -> `/abcd/`, `/pricing/`, `/about/`) while preserving anchor tags and query parameters.
   - Retains responsive mobile menu toggles, animations, and typography offline.
6. **Package Generation**:
   - Automatically builds an organized folder structure for the full page and every section, generates a detailed `report.json`, and zips everything into `site-package.zip`.

---

## 💻 Office Laptop Setup Guide

Follow these steps to clone and continue developing on your office laptop (macOS, Linux, or Windows).

### 1. Prerequisites
- **Git**
- **Node.js** (v18, v20, or v22+)
- **npm** (v9+)
- *(Optional)* **Docker & Docker Compose** (for running in a container)

### 2. Clone the Repository
```bash
git clone https://github.com/DhruvalBhansali2912/replicator-mechanism.git
cd replicator-mechanism
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Install Browser Binaries (Playwright)
```bash
npx playwright install chromium
```
> **Note for macOS users**: If you have Google Chrome installed, the engine includes automatic fallback detection to use your local Chrome binary (`/Applications/Google Chrome.app`) if needed.

### 5. Build TypeScript
```bash
npm run build
```

### 6. Run the Application

#### Development Mode (Hot-Reloading):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

#### Terminal CLI Mode (Single URL Extraction):
```bash
node dist/index.js --url https://example.com
```

Once started:
- **Web Dashboard**: Open [http://localhost:3000](http://localhost:3000) in your browser.
- **REST API**: Reachable at [http://localhost:3000/api](http://localhost:3000/api).

---

## 🐳 Running via Docker (VPS or Office Laptop)

If you want an isolated environment with all Linux font libraries and Chromium pre-installed:

```bash
# Build and run container in background
docker compose up -d

# View logs
docker compose logs -f

# Stop container
docker compose down
```

The `./storage` folder on your host machine will be mounted to `/app/storage` in the container, so all extracted jobs, screenshots, and ZIP packages are preserved.

---

## 🧪 Running Verification & Tests

To verify that the crawler, classifier, transformer, purger, and packager are working properly:

```bash
npx tsx test/run-test.ts
```

This launches a test server with a rich sample website (Navbar, Hero, Features grid, Pricing tables, Testimonials, Footer, and responsive JavaScript) and runs the entire pipeline end-to-end.

---

## 🏗️ Architecture & Codebase Map

```
replicator-mechanism/
├── Dockerfile                      # Production container image with Playwright & font dependencies
├── docker-compose.yml              # Multi-container orchestration config
├── package.json                    # Project dependencies and npm scripts
├── tsconfig.json                   # TypeScript compiler configuration
├── README.md                       # High-level overview and API summary
├── WALKTHROUGH.md                  # This detailed developer walkthrough
├── public/                         # Web Dashboard UI (vanilla HTML/CSS/JS)
│   ├── index.html                  # Dashboard layout with progress bar, stats, tabs
│   ├── style.css                   # Dark theme, modern typography, responsive cards
│   └── app.js                      # Polling, live preview iframes, section tabs
├── src/
│   ├── index.ts                    # Entrypoint: handles CLI mode or starts HTTP server
│   ├── server.ts                   # Express REST API routes and static file serving
│   ├── config.ts                   # System configuration, ports, timeouts, viewport sizes
│   ├── types.ts                    # TypeScript types (SectionArchetype, JobState, etc.)
│   ├── classifier/
│   │   ├── archetypes.ts           # Master archetype definitions, heuristics, and weights
│   │   └── section-classifier.ts   # Section classification scoring engine
│   ├── crawler/
│   │   ├── browser.ts              # Playwright browser lifecycle & path detection
│   │   └── page-extractor.ts       # Page visit, lazy scroll, DOM extraction, screenshots
│   ├── transformer/
│   │   ├── html-transformer.ts     # Cheerio-based semantic class renamer & link rewriter
│   │   ├── css-transformer.ts      # PostCSS AST selector renamer & beautifier
│   │   └── js-transformer.ts       # Script selector renamer & Prettier deminifier
│   ├── optimizer/
│   │   └── css-purger.ts           # PostCSS selector matcher & CleanCSS minifier
│   ├── localizer/
│   │   └── asset-localizer.ts      # Downloads images, fonts, SVGs & rewrites local paths
│   └── packager/
│       └── zip-packager.ts         # Organizes output directories & builds site-package.zip
├── storage/                        # Persistent storage for extraction jobs
│   └── jobs/                       # Output jobs keyed by job ID
└── test/
    ├── sample-site.html            # Test webpage fixture with interactive scripts
    └── run-test.ts                 # Automated end-to-end test script
```

---

## 📦 Output Job Structure

When an extraction job completes, it creates the following structure inside `storage/jobs/<jobId>/`:

```
storage/jobs/<jobId>/
├── full-page/
│   ├── index.html            # Complete offline page with relative links & localized assets
│   ├── style.css             # Deminified & beautified full stylesheet
│   ├── style.min.css         # Purged & minified full stylesheet
│   ├── script.js             # Deminified & synchronized JavaScript
│   ├── full-page.png         # High-DPI full-page screenshot
│   └── assets/               # Localized images, SVGs, and webfonts
├── sections/
│   ├── s1-navbar/
│   │   ├── section.html      # Section HTML with clean semantic classes
│   │   ├── section.css       # Section-purged beautified CSS
│   │   ├── section.min.css   # Section-purged minified CSS
│   │   ├── section.js        # Section-scoped JavaScript
│   │   ├── preview.html      # Standalone preview rendering only this section
│   │   ├── screenshot.png    # Section screenshot
│   │   └── metadata.json     # Archetype confidence, selector, and class mapping
│   ├── s2-hero/
│   ├── s3-features/
│   ├── s4-pricing/
│   ├── s5-testimonials/
│   └── s6-footer/
├── report.json               # Detailed metrics: bytes reduction, asset counts, reasons
└── site-package.zip          # Complete downloadable bundle
```

---

## 📡 REST API Reference

### 1. Submit URL for Extraction
`POST /api/extract`
```json
{
  "url": "https://stripe.com",
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

### 2. Check Job Status & Progress
`GET /api/jobs/:id`
```json
{
  "id": "e4f8a1b2",
  "url": "https://stripe.com",
  "status": "completed",
  "progress": 100,
  "currentStep": "Extraction completed successfully",
  "sections": [ ... ],
  "stats": {
    "originalCssBytes": 142050,
    "minifiedCssBytes": 28400,
    "assetCount": 14,
    "sectionCount": 6
  }
}
```

### 3. Live Offline Preview
`GET /api/jobs/:id/preview`  
Serves `full-page/index.html` with all localized assets and relative links.

### 4. Download ZIP Archive
`GET /api/jobs/:id/download`  
Downloads `site-package.zip`.

### 5. Section Specific Data & Standalone Preview
- `GET /api/jobs/:id/sections/:sectionId` - JSON containing section HTML, CSS, minified CSS, JS, and metadata.
- `GET /api/jobs/:id/sections/:sectionId/preview` - Standalone HTML preview page for the section.
- `GET /api/jobs/:id/sections/:sectionId/screenshot` - PNG screenshot of the section.

---

## 🚀 Next Steps & Ideas for Office Laptop Continuation

When continuing development on your office laptop, here are recommended enhancements you can explore:

1. **LLM Integration for Contextual Semantic Naming**:
   - Hook an OpenAI / Anthropic / Gemini API key to refine section names and element classes based on actual visual/business context (e.g. `hero-fintech-headline`, `pricing-enterprise-tier`).
2. **Tailwind CSS Generation**:
   - Add an optional reverse-compilation step that converts arbitrary CSS properties into modern Tailwind v3/v4 utility classes.
3. **Web Component / React Component Export**:
   - Add an option to output each extracted section as an isolated React / Vue component (`.jsx` / `.vue`) with scoped CSS modules.
4. **Authentication & Cookie Scraping**:
   - Add support for passing custom session cookies or basic auth headers in `POST /api/extract` to deconstruct pages behind logins.
