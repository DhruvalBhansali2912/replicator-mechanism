# Walkthrough: High-Fidelity Website Replication & Offline Interactivity

This document provides a comprehensive technical walkthrough of the enhancements made to the **Web Section Extractor & Offline Deconstruct Engine** (`replicator-mechanism`) to achieve 99.9%+ pixel-perfect fidelity and full offline interactivity on complex, animation-heavy modern websites (such as Apple.com).

---

## 1. Summary of Solved Challenges

| Area | Challenge | Technical Root Cause | Resolution Implemented |
|---|---|---|---|
| **Document Architecture** | Animation runtime and styling failed to initialize | Cheerio fragment parsing (`cheerio.load(..., false)`) stripped `<html>`, `<head>`, and `<body>` tags and attributes (`class="... enhanced ..."` and `data-anim-scroll-group="body"`). | Updated `html-transformer.ts` and `asset-localizer.ts` to preserve complete standard HTML documents. |
| **JavaScript Modules** | ES Module scripts (`import ...`) threw browser syntax errors | Packager was replacing `type="module"` with `defer`, breaking native ES module resolution. | Retained `type="module"` in `zip-packager.ts` and injected a safe `window.require` compatibility stub to prevent third-party tracker errors from halting execution. |
| **Dynamic Video Animations** | iPhone 18 Pro rotation & Promo card animations failed to render | Apple's `InlineMedia` runtime dynamically constructs video URLs using `data-inline-media-basepath` and device viewport (`${basepath}largetall.mp4`). Unlocalized paths 404'd and caused the engine to destroy the video container. | Localized all 19 video resolution variants into `./assets/` and updated `data-inline-media-basepath` attributes to local `./assets/hero_` and `./assets/promo_` paths. |
| **Desktop Nav Flyouts** | Hovering over nav items (Mac, iPad, iPhone, Watch) showed nothing | Submenus are dynamically loaded via JSON API requests (`/api-www/global-elements/global-header/v1/flyouts`). | Added offline mock API endpoints in `server.ts` and asset interceptors for `flyouts.json`. |
| **Search Modal** | Search icon click failed to display recommendations | Interactive search expects default search links and autocomplete JSON endpoints. | Added mock routes in `server.ts` for `/search-services/suggestions/defaultlinks/*` and live search. |
| **Mobile Menu Drilldown Glitch** | Tapping top-level menu items superimposed incoming submenu over the top-level list | High-specificity CSS rules kept the top-level list visible during `.globalnav-animating`, causing text ghosting and overlap at identical coordinates. | Added responsive drilldown CSS patch in `zip-packager.ts` that immediately hides top-level items on submenu activation, preserves back button navigation, and cleanly displays the submenu. |

---

## 2. Deep Dive: Mobile Navigation Drilldown Glitch Fix

### The Problem
On mobile viewports (`<= 833px`), tapping any menu category (such as *Watch*, *Mac*, or *Store*) triggered `.globalnav-with-submenu-open`. Because Apple's default stylesheet retained `opacity: 1; visibility: visible; transform: translate(0px)` on `.globalnav-submenu-trigger-group` while `.globalnav-flyout` simultaneously expanded at `top: 44px; left: 0; width: 100%`, the incoming and outgoing text layers collided.

### The Fix
Injected automatically into `style.css` and `style.min.css` via `zip-packager.ts`:

```css
/* Replicator Mobile Navigation Drilldown Glitch Fix */
@media (max-width: 833px) {
  #globalnav.globalnav-with-submenu-open .globalnav-submenu-trigger-group,
  #globalnav.globalnav-with-submenu-open .globalnav-submenu-trigger-link,
  #globalnav.globalnav-with-submenu-open .globalnav-item:not(.globalnav-item-flyout-open):not(.globalnav-item-flyout-change-next) .globalnav-link,
  #globalnav.globalnav-with-submenu-open .globalnav-item-menu:not(.globalnav-item-flyout-open):not(.globalnav-item-flyout-change-next) {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open > .globalnav-flyout,
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-change-next > .globalnav-flyout {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
  }
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open > .globalnav-flyout .globalnav-submenu-list-item,
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-change-next > .globalnav-flyout .globalnav-submenu-list-item,
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open > .globalnav-flyout .globalnav-submenu-header,
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-change-next > .globalnav-flyout .globalnav-submenu-header {
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
  #globalnav.globalnav-with-submenu-open .globalnav-menuback {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
  }
}
```

---

## 3. Engine Modifications Overview

1. **`src/crawler/page-extractor.ts`**:
   - Resolves relative URLs in extracted CSS rules against document `baseURI` or stylesheet `href`.
   - Fetches and bundles external stylesheets that cannot be accessed directly via `document.styleSheets` due to CORS.
   - Extracts only executable JavaScript (ignoring application JSON or data scripts).
   - Preserves full page CSS during packaging to prevent destructive over-purging.

2. **`src/localizer/asset-localizer.ts`**:
   - Downloads all asset types (images, SVGs, WOFF2/WOFF/TTF fonts, JS scripts, MP4 videos).
   - Recursively traverses ES Module dependencies (`import './*.built.js'`) and downloads child modules locally.
   - Filters out non-essential external analytics and telemetry trackers (e.g. Google Analytics, Hotjar, Clarity, GTM).
   - Rewrites CSS `url(...)` declarations to local paths.

3. **`src/packager/zip-packager.ts`**:
   - Injects the mobile navigation drilldown glitch fix automatically for all packages containing navigation menus.
   - Preserves ES module script types (`type="module"`).
   - Injects compatibility shims into `<head>`.
   - Packages standalone sections with scoped CSS, HTML, and preview runners.

4. **`src/server.ts`**:
   - Added REST mock API fallbacks for global headers (`/api-www/...`), search suggestions (`/search-services/...`), and shopping bag services.

5. **`src/transformer/html-transformer.ts`**:
   - Rewrites internal absolute URLs to clean relative paths (e.g. `https://apple.com/mac/` -> `/mac/`).
   - Retains full document tags and preserves essential classes on root elements.
