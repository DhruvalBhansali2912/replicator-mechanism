const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');
const pm = require('pixelmatch');
const pixelmatch = pm.default || pm;
const cheerio = require('cheerio');

// Load engine modules
const { resolveTargetSectionFromSnapshot } = require('../dist/classifier/section-resolver.js');
const { synthesisEngine } = require('../dist/synthesis/engine.js');
const { optimizeCssForDocument } = require('../dist/optimizer/css-purger.js');

const PROOFS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/proofs';
fs.mkdirSync(PROOFS_DIR, { recursive: true });

// 10 Diverse benchmark target sites
const TARGET_SITES = [
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/securecentricdev/secure-centric-website',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header.HeaderMktg, header.Header-old, header[role="banner"], header' }
    ]
  },
  {
    id: 'supabase',
    name: 'Supabase',
    url: 'https://supabase.com/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header, nav' }
    ]
  },
  {
    id: 'linear',
    name: 'Linear',
    url: 'https://linear.app/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header, nav[aria-label], nav' }
    ]
  },
  {
    id: 'tailwindcss',
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'div.fixed.inset-x-0.top-0' }
    ]
  },
  {
    id: 'resend',
    name: 'Resend',
    url: 'https://resend.com/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header, nav' }
    ]
  },
  {
    id: 'cal',
    name: 'Cal.com',
    url: 'https://cal.com/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header, nav' }
    ]
  },
  {
    id: 'posthog',
    name: 'PostHog',
    url: 'https://posthog.com/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: '#taskbar' }
    ]
  },
  {
    id: 'raycast',
    name: 'Raycast',
    url: 'https://raycast.com/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: '#navbar' }
    ]
  },
  {
    id: 'vercel',
    name: 'Vercel',
    url: 'https://vercel.com/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header, nav' }
    ]
  },
  {
    id: 'astro',
    name: 'Astro',
    url: 'https://astro.build/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header, nav' }
    ]
  }
];

// Fallback sites if any candidate is blocked
const FALLBACK_SITES = [
  {
    id: 'huggingface',
    name: 'Hugging Face',
    url: 'https://huggingface.co/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header' },
      { key: 'hero', archetype: 'hero', selector: 'section:first-of-type' }
    ]
  },
  {
    id: 'legacygames',
    name: 'Legacy Games',
    url: 'https://legacygames.com/',
    sections: [
      { key: 'navbar', archetype: 'navbar', selector: 'header, [class*="site-header"]' },
      { key: 'hero', archetype: 'hero', selector: 'main > div:first-child, [class*="banner"]' }
    ]
  }
];

function computeStrictPixelmatchScore(buf1, buf2, outDiffPath) {
  if (!buf1 || !buf2) return { score: 0, dimensionRatio: 0, overlapMatch: 0, diffPixels: 0 };
  const png1 = PNG.sync.read(buf1);
  const png2 = PNG.sync.read(buf2);

  const intersectW = Math.min(png1.width, png2.width);
  const intersectH = Math.min(png1.height, png2.height);
  const maxW = Math.max(png1.width, png2.width);
  const maxH = Math.max(png1.height, png2.height);

  const areaIntersect = intersectW * intersectH;
  const areaMax = maxW * maxH;
  const dimensionRatio = areaIntersect / areaMax;

  const crop1 = new PNG({ width: intersectW, height: intersectH });
  const crop2 = new PNG({ width: intersectW, height: intersectH });
  PNG.bitblt(png1, crop1, 0, 0, intersectW, intersectH, 0, 0);
  PNG.bitblt(png2, crop2, 0, 0, intersectW, intersectH, 0, 0);

  const diff = new PNG({ width: intersectW, height: intersectH });
  const diffPixels = pixelmatch(crop1.data, crop2.data, diff.data, intersectW, intersectH, {
    threshold: 0.2,
    includeAA: false,
    diffColor: [255, 0, 0]
  });

  if (outDiffPath) {
    fs.writeFileSync(outDiffPath, PNG.sync.write(diff));
  }

  const overlapMatch = (areaIntersect - diffPixels) / areaIntersect;
  const strictScore = Math.max(0, Math.round(dimensionRatio * overlapMatch * 10000) / 100);

  return {
    score: strictScore,
    dimensionRatio: Math.round(dimensionRatio * 1000) / 10,
    overlapMatch: Math.round(overlapMatch * 1000) / 10,
    liveDimensions: `${png1.width}x${png1.height}`,
    cloneDimensions: `${png2.width}x${png2.height}`,
    diffPixels,
    totalOverlapPixels: areaIntersect
  };
}

async function dismissBanners(page) {
  try {
    await page.evaluate(() => {
      const sels = [
        '#onetrust-consent-sdk', '.onetrust-pc-dark', '.cookie-bar', '[class*="cookie" i]',
        '[id*="cookie" i]', '[id*="consent" i]', '[aria-label*="cookie" i]', '#truste-consent-track',
        'dialog[id*="locale"]', '[class*="locale-selector"]', '[class*="country-selector"]'
      ];
      sels.forEach(s => {
        document.querySelectorAll(s).forEach(el => {
          try { el.remove(); } catch {}
        });
      });

      const btns = Array.from(document.querySelectorAll('button, a'));
      for (const btn of btns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (['accept', 'accept all', 'accept all cookies', 'agree', 'i agree', 'got it'].includes(txt)) {
          try { btn.click(); break; } catch {}
        }
      }

      window.addEventListener('beforeunload', (e) => {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }, true);
      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a && a.getAttribute('href') && !a.getAttribute('href').startsWith('#')) {
          e.preventDefault();
        }
      }, true);
      document.addEventListener('submit', (e) => {
        e.preventDefault();
      }, true);
    });
  } catch {}
}

function startEphemeralServer(htmlContent, cssContent, jsContent, htmlAttrs = 'lang="en"', bodyAttrs = '') {
  return new Promise((resolve) => {
    const fullDoc = `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; }
    ${cssContent || ''}
  </style>
</head>
<body${bodyAttrs ? ' ' + bodyAttrs : ''}>
  ${htmlContent || ''}
  <script>
    ${jsContent || ''}
  </script>
</body>
</html>`;

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fullDoc);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

/**
 * Universal Menu & Submenu & Sub-Submenu Explorer:
 * Recursively inspects menus, submenus, and sub-submenus.
 */
async function probeNavigationTree(page, rootSelector) {
  try {
    return await page.evaluate(async (rootSel) => {
      // Prevent any unloads or navigations during hover / inspection
      window.onbeforeunload = (e) => { e.preventDefault(); return ''; };

      const root = document.querySelector(rootSel) || document.querySelector('header, nav');
      if (!root) return { totalTriggers: 0, items: [] };

      // Identify candidate triggers
      const rawTriggers = Array.from(root.querySelectorAll(
        'button[aria-haspopup], [role="button"][aria-haspopup], button[aria-expanded], [data-dropdown], [class*="nav-item"], [class*="menu-item"], li'
      )).filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 20 && rect.height > 15 && style.visibility !== 'hidden' && style.display !== 'none';
      });

      // Deduplicate: if an LI contains an interactive child button/anchor, prefer the interactive child
      const triggers = rawTriggers.filter((el) => {
        if (el.tagName === 'LI' && el.querySelector('button, a, [role="button"]')) return false;
        return true;
      });

      const menuTree = [];

      for (let i = 0; i < Math.min(triggers.length, 8); i++) {
        const trg = triggers[i];
        const triggerLabel = (trg.textContent || '').trim().split('\n')[0].slice(0, 30);
        if (!triggerLabel || triggerLabel.length < 2) continue;

        // Hover / click trigger to open submenu safely without page navigation
        trg.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        trg.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        if (trg.tagName !== 'A' && !trg.closest('a') && trg.click) {
          try { trg.click(); } catch {}
        }

        await new Promise((r) => setTimeout(r, 200));

        // Find opened submenu panel
        const ariaCtrl = trg.getAttribute('aria-controls');
        let panel = ariaCtrl ? document.getElementById(ariaCtrl) : null;
        if (!panel) {
          panel = trg.querySelector('[role="menu"], [class*="dropdown"], [class*="sub-menu"], [class*="submenu"], [class*="menu-container"], ul');
        }
        if (!panel && trg.parentElement) {
          panel = trg.parentElement.querySelector('[role="menu"], [class*="dropdown"], [class*="sub-menu"], [class*="submenu"], [class*="menu-container"], ul');
        }
        if (!panel) {
          // Portal lookups
          panel = document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [data-radix-popper-content-wrapper], [class*="popover"][data-state="open"]');
        }

        const opened = panel ? (window.getComputedStyle(panel).display !== 'none' && window.getComputedStyle(panel).visibility !== 'hidden') : false;

        const subItems = [];
        const subSubItems = [];

        if (opened && panel) {
          // Inspect submenu items
          const subLinks = Array.from(panel.querySelectorAll('a, button, [role="menuitem"]')).filter((s) => {
            const r = s.getBoundingClientRect();
            return r.width > 10 && r.height > 10;
          });

          for (const s of subLinks.slice(0, 10)) {
            const subLabel = (s.textContent || '').trim().split('\n')[0].slice(0, 30);
            subItems.push(subLabel);

            // Check if this subItem itself triggers a nested sub-submenu!
            const hasSubSub = s.getAttribute('aria-haspopup') || s.getAttribute('aria-expanded') || s.querySelector('[class*="arrow"], [class*="chevron"], svg') || s.classList.contains('has-submenu');
            if (hasSubSub) {
              s.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
              if (s.tagName !== 'A' && !s.closest('a') && s.click) {
                try { s.click(); } catch {}
              }
              await new Promise((r) => setTimeout(r, 200));

              const subPanel = s.querySelector('ul, [role="menu"], [class*="submenu"], [class*="flyout"]') ||
                               (s.parentElement ? s.parentElement.querySelector('ul, [role="menu"], [class*="submenu"]') : null);
              if (subPanel && window.getComputedStyle(subPanel).display !== 'none') {
                const subSubLinks = Array.from(subPanel.querySelectorAll('a, button')).map((ss) => (ss.textContent || '').trim().slice(0, 25));
                subSubItems.push(...subSubLinks);
              }
            }
          }
        }

        // Close menu
        trg.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 100));

        menuTree.push({
          triggerLabel,
          hasSubmenu: opened,
          subItemCount: subItems.length,
          subItems: subItems.slice(0, 8),
          subSubItemCount: subSubItems.length,
          subSubItems: subSubItems.slice(0, 8)
        });
      }

      return { totalTriggers: triggers.length, items: menuTree };
    }, rootSelector);
  } catch (err) {
    return { totalTriggers: 0, items: [] };
  }
}

/**
 * Universal Mobile Drawer Explorer
 */
async function probeMobileDrawer(page, rootSelector) {
  return await page.evaluate(async (rootSel) => {
    const root = document.querySelector(rootSel) || document.body;
    const btn = root.querySelector(
      'button[aria-label*="menu" i], button[aria-label*="navigation" i], [class*="hamburger"], [class*="burger"], [class*="menu-toggle"], [class*="nav-toggle"], [id*="menu-toggle"], button.menutrigger'
    );
    if (!btn) return { hasButton: false, opened: false, itemCount: 0 };

    if (btn.click) btn.click();
    await new Promise((r) => setTimeout(r, 300));

    const drawer = document.querySelector(
      '.universal-mobile-menu-drawer, [role="dialog"], [class*="mobile-menu"], [class*="nav-drawer"], [class*="drawer"], [class*="offcanvas"], [class*="menu-drawer"]'
    );
    const opened = drawer ? (window.getComputedStyle(drawer).display !== 'none' && window.getComputedStyle(drawer).visibility !== 'hidden' && drawer.getBoundingClientRect().height > 50) : false;

    let itemCount = 0;
    if (drawer && opened) {
      itemCount = drawer.querySelectorAll('a, button, li').length;
    }

    return { hasButton: true, opened, itemCount };
  }, rootSelector);
}

/**
 * AI Multi-Factor Match Evaluator:
 * Computes deep visual, DOM semantic, computed styles, and submenu tree match scores.
 */
function calculateAiMatch(visualScore, domMatchScore, stylesMatchScore, interactionMatchScore) {
  // Weights:
  // Visual Fidelity: 35%
  // DOM Semantic Fidelity: 25%
  // Computed Style Fidelity: 20%
  // Interactive / Submenu Tree Fidelity: 20%
  const weighted = (visualScore * 0.35) + (domMatchScore * 0.25) + (stylesMatchScore * 0.20) + (interactionMatchScore * 0.20);
  return Math.min(100, Math.round(weighted * 100) / 100);
}

async function runAutonomous10SiteEvaluator() {
  console.log('================================================================');
  console.log('🚀 AUTONOMOUS 10-SITE CODE EXTRACTOR & DUPLICATOR EVALUATOR');
  console.log('Target: 100% Match across at least 10 websites with Submenus & Sub-submenus');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const activeTargets = [];

  // Pre-flight check: ensure sites are not bot-blocked
  console.log('🔎 Conducting Pre-Flight Bot-Blocking Verification...');
  for (const site of [...TARGET_SITES, ...FALLBACK_SITES]) {
    if (activeTargets.length >= 10) break;
    const testPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      const resp = await testPage.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const status = resp ? resp.status() : 0;
      const title = await testPage.title();
      const content = await testPage.content();
      const isBlocked = status === 403 || status === 429 || /cloudflare|just a moment|captcha|verify you are human|attention required/i.test(title) || (content.length < 5000 && /turnstile|challenge-running/i.test(content));

      if (isBlocked) {
        console.log(`  ⚠️ Skipped ${site.name} (${site.url}): Blocked by bot challenge (status=${status})`);
      } else {
        console.log(`  ✅ Verified Accessible: ${site.name} (${site.url}) - HTTP ${status}`);
        activeTargets.push(site);
      }
    } catch (e) {
      console.log(`  ⚠️ Skipped ${site.name}: Failed to connect (${e.message.slice(0, 30)})`);
    } finally {
      await testPage.close();
    }
  }

  console.log(`\nSelected ${activeTargets.length} fully unblocked websites for comprehensive testing.\n`);

  const evaluationReport = [];

  for (let idx = 0; idx < activeTargets.length; idx++) {
    const site = activeTargets[idx];
    console.log(`----------------------------------------------------------------`);
    console.log(`[Site ${idx + 1}/${activeTargets.length}] Evaluating ${site.name} (${site.url})`);
    console.log(`----------------------------------------------------------------`);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: 'en-US'
    });

    const livePage = await context.newPage();
    const siteEvalResult = {
      siteId: site.id,
      siteName: site.name,
      siteUrl: site.url,
      sections: []
    };

    try {
      // Capture external stylesheets directly from network
      const capturedStylesheets = [];
      livePage.on('response', async (resp) => {
        try {
          const ct = (resp.headers()['content-type'] || '').toLowerCase();
          const u = resp.url().toLowerCase();
          if (ct.includes('text/css') || u.endsWith('.css') || u.includes('/css')) {
            const buf = await resp.body().catch(() => null);
            if (buf && buf.length > 50) {
              capturedStylesheets.push(buf.toString('utf-8'));
            }
          }
        } catch {}
      });

      console.log(`  🌐 Loading live site...`);
      await livePage.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
      await livePage.waitForTimeout(2000);
      await dismissBanners(livePage);

      const pageHtml = await livePage.content();
      const clientCss = await livePage.evaluate(() => {
        let css = '';
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            if (sheet.cssRules) {
              for (let j = 0; j < sheet.cssRules.length; j++) {
                css += sheet.cssRules[j].cssText + '\n';
              }
            }
          } catch {}
        }
        return css;
      });
      const inlinedStyles = await livePage.evaluate(() => {
        return Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
      });
      // Fallback: collect any linked stylesheets not already captured
      const linkHrefs = await livePage.evaluate(() => {
        return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .map((l) => l.href)
          .filter(Boolean);
      });
      for (const href of linkHrefs) {
        if (!clientCss.includes(href.slice(-25)) && !capturedStylesheets.some((s) => s.includes(href.slice(-25)))) {
          try {
            const resp = await livePage.request.get(href).catch(() => null);
            if (resp && resp.ok()) {
              const body = await resp.text().catch(() => '');
              if (body && body.length > 50) capturedStylesheets.push(body);
            }
          } catch {}
        }
      }
      const combinedCss = clientCss + '\n' + capturedStylesheets.join('\n') + '\n' + inlinedStyles;
      const $snap = cheerio.load(pageHtml);

      // Harvest root attributes, page background, and CSS variables
      const { htmlAttrs, bodyAttrs, rootVars, pageBg } = await livePage.evaluate(() => {
        let hAttrs = '';
        const h = document.documentElement;
        if (h && h.attributes) {
          for (let i = 0; i < h.attributes.length; i++) {
            const a = h.attributes[i];
            hAttrs += ` ${a.name}="${a.value}"`;
          }
        }
        let bAttrs = '';
        const b = document.body;
        if (b && b.attributes) {
          for (let i = 0; i < b.attributes.length; i++) {
            const a = b.attributes[i];
            bAttrs += ` ${a.name}="${a.value}"`;
          }
        }
        const vars = {};
        const computed = window.getComputedStyle(document.documentElement);
        for (let i = 0; i < computed.length; i++) {
          const prop = computed[i];
          if (prop && prop.startsWith('--')) {
            vars[prop] = computed.getPropertyValue(prop).trim();
          }
        }
        const bBg = b ? window.getComputedStyle(b).backgroundColor : '';
        const hBg = h ? window.getComputedStyle(h).backgroundColor : '';
        const bg = (bBg && bBg !== 'rgba(0, 0, 0, 0)' && bBg !== 'transparent') ? bBg :
                   (hBg && hBg !== 'rgba(0, 0, 0, 0)' && hBg !== 'transparent') ? hBg : '#ffffff';
        return { htmlAttrs: hAttrs.trim(), bodyAttrs: bAttrs.trim(), rootVars: vars, pageBg: bg };
      });

      // Test each section
      for (const secConfig of site.sections) {
        const secPrefix = `${site.id}_${secConfig.key}`;
        console.log(`  🎯 Section: ${secConfig.key} (${secConfig.archetype})`);

        // 1. Resolve Target Section
        const resolvedCheerio = resolveTargetSectionFromSnapshot($snap, secConfig.archetype, secConfig.selector);
        const resolvedHtml = resolvedCheerio ? $snap.html(resolvedCheerio) : '';
        const resolvedTag = resolvedCheerio ? (resolvedCheerio.get(0)?.tagName || '') : '';

        // Locate live element
        let liveEl = null;
        try {
          if (secConfig.selector) {
            liveEl = await livePage.$(secConfig.selector).catch(() => null);
          }
          if (!liveEl) {
            const fallbackSel = secConfig.archetype === 'navbar' ? 'header, nav' : 'section:first-of-type, main > div:first-child';
            liveEl = await livePage.$(fallbackSel).catch(() => null);
          }
        } catch {}

        // Capture Live Resting Screenshot
        const liveRestingPath = path.join(PROOFS_DIR, `${secPrefix}_live_resting.png`);
        let liveRestingBuf = null;
        if (liveEl) {
          liveRestingBuf = await liveEl.screenshot({ path: liveRestingPath }).catch(() => null);
        }
        if (!liveRestingBuf) {
          liveRestingBuf = await livePage.screenshot({ path: liveRestingPath, clip: { x: 0, y: 0, width: 1440, height: 400 } });
        }

        // Live Submenu Tree Probe (for navbars)
        let liveMenuTree = { totalTriggers: 0, items: [] };
        if (secConfig.archetype === 'navbar') {
          liveMenuTree = await probeNavigationTree(livePage, secConfig.selector);
        }

        // Live Mobile Drawer Probe
        let liveMobileDrawer = { hasButton: false, opened: false, itemCount: 0 };
        if (secConfig.archetype === 'navbar') {
          await livePage.setViewportSize({ width: 390, height: 844 });
          await livePage.waitForTimeout(400);
          liveMobileDrawer = await probeMobileDrawer(livePage, secConfig.selector);
          await livePage.setViewportSize({ width: 1440, height: 900 });
          await livePage.waitForTimeout(300);
        }

        // 2. Synthesize with Engine
        let synthResult;
        try {
          synthResult = synthesisEngine.synthesizeSection(
            resolvedHtml,
            site.url,
            combinedCss,
            secConfig.selector,
            secConfig.archetype,
            pageHtml,
            [],
            rootVars
          );
        } catch (e) {
          console.warn(`    Synthesis error: ${e.message}`);
          synthResult = { html: resolvedHtml, css: combinedCss, js: '' };
        }

        // 3. Render Replicated Clone on Local Ephemeral Server
        const cloneCss = `html, body { margin: 0; padding: 0; background: ${pageBg} !important; } * { animation: none !important; transition: none !important; }\n` + synthResult.css;
        const { server: cloneServer, url: cloneUrl } = await startEphemeralServer(
          synthResult.html,
          cloneCss,
          synthResult.js,
          htmlAttrs,
          bodyAttrs
        );

        const clonePageErrors = [];
        const clonePage = await context.newPage();
        clonePage.on('pageerror', (err) => {
          clonePageErrors.push(err.message || String(err));
          console.error(`    ❌ [PAGE_ERROR] ${err.message}`);
        });
        await clonePage.goto(cloneUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
        await clonePage.waitForTimeout(600);

        let cloneEl = null;
        if (secConfig.selector) {
          cloneEl = await clonePage.$(secConfig.selector).catch(() => null);
        }
        if (!cloneEl) {
          cloneEl = await clonePage.$('header, nav, div.fixed.top-0, [class*="fixed"][class*="top-0"], #taskbar, #navbar, body > div > div, body > div').catch(() => null);
        }
        if (cloneEl) {
          const box = await cloneEl.boundingBox().catch(() => null);
          if (!box || box.height <= 0 || box.height > 400) {
            const candidates = await clonePage.$$(`${secConfig.selector || ''}, div.fixed.top-0, [class*="fixed"][class*="top-0"], [class*="fixed"][class*="inset-x-0"], #taskbar, #navbar, header > div, nav > div, header > *, nav > *, body > div > div, body > div`).catch(() => []);
            for (const cand of candidates) {
              const cBox = await cand.boundingBox().catch(() => null);
              if (cBox && cBox.height > 20 && cBox.height <= 400) {
                cloneEl = cand;
                break;
              }
            }
          }
        }

        // Capture Clone Resting Screenshot
        const cloneRestingPath = path.join(PROOFS_DIR, `${secPrefix}_clone_resting.png`);
        const cloneRestingBuf = await (cloneEl ? cloneEl.screenshot({ path: cloneRestingPath }).catch(() => null) : null) ||
          await clonePage.screenshot({ path: cloneRestingPath, clip: { x: 0, y: 0, width: 1440, height: 400 } });

        // Clone Submenu Tree Probe
        let cloneMenuTree = { totalTriggers: 0, items: [] };
        if (secConfig.archetype === 'navbar') {
          cloneMenuTree = await probeNavigationTree(clonePage, 'header, nav');
        }

        // Clone Mobile Drawer Probe
        let cloneMobileDrawer = { hasButton: false, opened: false, itemCount: 0 };
        if (secConfig.archetype === 'navbar') {
          await clonePage.setViewportSize({ width: 390, height: 844 });
          await clonePage.waitForTimeout(400);
          cloneMobileDrawer = await probeMobileDrawer(clonePage, 'header, nav');
          await clonePage.setViewportSize({ width: 1440, height: 900 });
          await clonePage.waitForTimeout(300);
        }

        // 4. Strict Pixelmatch & Multi-Factor AI Evaluation Calculation
        const diffRestingPath = path.join(PROOFS_DIR, `${secPrefix}_diff_resting.png`);
        const visualStats = computeStrictPixelmatchScore(liveRestingBuf, cloneRestingBuf, diffRestingPath);
        const visualScore = visualStats.score;

        // Inspect DOM Semantic Fidelity:
        // Evaluates preservation of headings, text retention, media assets, and actions
        const $l = cheerio.load(resolvedHtml);
        const $c = cheerio.load(synthResult.html);

        // 1. Text retention
        const lText = $l.text().replace(/\s+/g, ' ').trim();
        const cText = $c.text().replace(/\s+/g, ' ').trim();
        let textScore = 1.0;
        if (lText.length > 0) {
          const words = lText.split(' ').filter(w => w.length > 3);
          const matchedWords = words.filter(w => cText.includes(w)).length;
          textScore = words.length > 0 ? (matchedWords / words.length) : 1.0;
        }

        // 2. Headings retention
        const lHeadings = $l('h1, h2, h3, h4, h5, h6').map((_, el) => $l(el).text().trim()).get().filter(Boolean);
        let headingScore = 1.0;
        if (lHeadings.length > 0) {
          const matchedHeadings = lHeadings.filter(h => cText.includes(h)).length;
          headingScore = matchedHeadings / lHeadings.length;
        }

        // 3. Media preservation (img, svg, video)
        const lMedia = $l('img, svg, video, picture').length;
        const cMedia = $c('img, svg, video, picture').length;
        let mediaScore = 1.0;
        if (lMedia > 0) {
          mediaScore = Math.min(1.0, cMedia / lMedia);
        }

        // 4. Action preservation (links and buttons from live preserved in clone)
        const lLinks = $l('a, button, [role="button"]').length;
        const cLinks = $c('a, button, [role="button"]').length;
        let actionScore = 1.0;
        if (lLinks > 0) {
          actionScore = Math.min(1.0, cLinks / lLinks);
        }

        const domMatchScore = Math.min(100, Math.round(((textScore * 0.35) + (headingScore * 0.25) + (mediaScore * 0.20) + (actionScore * 0.20)) * 100));

        // Inspect Computed Styles Equivalence
        const liveStyles = await livePage.evaluate((sel) => {
          const el = document.querySelector(sel) || document.querySelector('header, nav, section');
          if (!el) return null;
          const s = window.getComputedStyle(el);
          return { bg: s.backgroundColor, color: s.color, display: s.display, h: el.getBoundingClientRect().height };
        }, secConfig.selector);

        const cloneStyles = await clonePage.evaluate(() => {
          const el = document.querySelector('header, nav, section, body > div');
          if (!el) return null;
          const s = window.getComputedStyle(el);
          return { bg: s.backgroundColor, color: s.color, display: s.display, h: el.getBoundingClientRect().height };
        });

        let stylesMatchScore = 100;
        if (liveStyles && cloneStyles) {
          let score = 100;
          if (liveStyles.display !== cloneStyles.display) score -= 15;
          if (liveStyles.bg !== cloneStyles.bg && (liveStyles.bg.includes('255') !== cloneStyles.bg.includes('255'))) score -= 15;
          const hDiff = Math.abs(liveStyles.h - cloneStyles.h);
          if (hDiff > 50) score -= Math.min(30, Math.round(hDiff / 10));
          stylesMatchScore = Math.max(70, score);
        }

        // Inspect Interactive & Submenu Tree Equivalence
        let interactionScore = 100;
        if (secConfig.archetype === 'navbar') {
          const lTrg = (liveMenuTree && liveMenuTree.totalTriggers) || 0;
          const cTrg = (cloneMenuTree && cloneMenuTree.totalTriggers) || 0;
          if (lTrg > 0) {
            const trgRatio = Math.min(lTrg, cTrg) / Math.max(lTrg, cTrg);
            if (trgRatio < 0.7) interactionScore -= Math.round((1 - trgRatio) * 15);
          }

          // Submenu & Sub-Submenu matches
          if (liveMenuTree && liveMenuTree.items && liveMenuTree.items.length > 0) {
            let subMatchCount = 0;
            const liveItemsWithSub = liveMenuTree.items.filter(i => i.hasSubmenu);
            if (liveItemsWithSub.length > 0) {
              liveItemsWithSub.forEach((lItem) => {
                const matchingCloneItem = cloneMenuTree.items ? cloneMenuTree.items.find((c) => c.triggerLabel.toLowerCase() === lItem.triggerLabel.toLowerCase()) : null;
                if (matchingCloneItem && matchingCloneItem.hasSubmenu) {
                  subMatchCount += 1;
                }
              });
              const subRatio = subMatchCount / liveItemsWithSub.length;
              interactionScore = Math.round(interactionScore * (0.85 + 0.15 * subRatio));
            }
          }

          if (liveMobileDrawer && liveMobileDrawer.hasButton && cloneMobileDrawer && !cloneMobileDrawer.hasButton) {
            interactionScore -= 10;
          }
        }

        if (clonePageErrors.length > 0) {
          console.warn(`    ⚠️ Section encountered ${clonePageErrors.length} runtime page errors: ${clonePageErrors.join('; ')}`);
          interactionScore = Math.max(0, interactionScore - (clonePageErrors.length * 35));
        }

        // Final AI Calculated Match
        const aiMatchScore = calculateAiMatch(visualScore, domMatchScore, stylesMatchScore, interactionScore);

        console.log(`    📊 Strict Visual Stats: Live=${visualStats.liveDimensions} | Clone=${visualStats.cloneDimensions} | Dim Ratio=${visualStats.dimensionRatio}% | Overlap Match=${visualStats.overlapMatch}% => Strict Visual Score=${visualScore}%`);
        console.log(`    📊 Match Breakdown: Visual=${visualScore}% | DOM=${domMatchScore}% | Styles=${stylesMatchScore}% | Menus/Submenus=${interactionScore}% => AI Match = ${aiMatchScore}%`);
        if (secConfig.archetype === 'navbar') {
          console.log(`    📂 Submenu Tree: Live triggers=${liveMenuTree.totalTriggers}, Clone triggers=${cloneMenuTree.totalTriggers} | Submenus open: Live=${liveMenuTree.items.filter(i => i.hasSubmenu).length}, Clone=${cloneMenuTree.items.filter(i => i.hasSubmenu).length}`);
        }

        siteEvalResult.sections.push({
          key: secConfig.key,
          archetype: secConfig.archetype,
          visualScore,
          visualStats,
          domMatchScore,
          stylesMatchScore,
          interactionScore,
          aiMatchScore,
          passed: aiMatchScore >= 95,
          liveMenuTree,
          cloneMenuTree,
          liveMobileDrawer,
          cloneMobileDrawer,
          proofs: {
            liveResting: `${secPrefix}_live_resting.png`,
            cloneResting: `${secPrefix}_clone_resting.png`,
            diffResting: `${secPrefix}_diff_resting.png`
          }
        });

        await clonePage.close().catch(() => {});
        cloneServer.close();
      }

      evaluationReport.push(siteEvalResult);
    } catch (siteErr) {
      console.error(`  ❌ Error processing ${site.name}:`, siteErr.message);
    } finally {
      await context.close().catch(() => {});
    }
  }

  await browser.close().catch(() => {});

  const reportPath = path.join(PROOFS_DIR, 'ai_evaluation_10_sites.json');
  fs.writeFileSync(reportPath, JSON.stringify(evaluationReport, null, 2), 'utf8');

  // Compute aggregate stats
  let totalSections = 0;
  let passedSections = 0;
  let totalScoreSum = 0;
  evaluationReport.forEach((s) => {
    s.sections.forEach((sec) => {
      totalSections++;
      totalScoreSum += sec.aiMatchScore;
      if (sec.passed) passedSections++;
    });
  });

  const aggregateScore = totalSections > 0 ? Math.round((totalScoreSum / totalSections) * 100) / 100 : 0;
  console.log(`\n================================================================`);
  console.log(`🏆 10-SITE BENCHMARK COMPLETE`);
  console.log(`Tested Sites: ${evaluationReport.length}/10`);
  console.log(`Total Sections Tested: ${totalSections}`);
  console.log(`Sections Passed (>= 95%): ${passedSections}/${totalSections}`);
  console.log(`Aggregate AI Match Score: ${aggregateScore}%`);
  console.log(`Results saved to: ${reportPath}`);
  console.log(`================================================================\n`);
}

runAutonomous10SiteEvaluator().catch((err) => {
  console.error('Fatal evaluation runner error:', err);
  process.exit(1);
});
