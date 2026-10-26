/**
 * InventKid Page Replicator - Interactive Section Picker
 * Allows users to hover and visually select any section on the active page.
 * Detects section archetypes, dimensions, interactive elements, and returns clean HTML.
 */

(function () {
  // Clean up any existing picker instance to allow re-activating cleanly
  const existingBar = document.getElementById('__replicator_picker_bar__');
  if (existingBar) existingBar.remove();
  const existingOverlay = document.getElementById('__replicator_picker_overlay__');
  if (existingOverlay) existingOverlay.remove();
  if (window.__replicator_cleanup) {
    try { window.__replicator_cleanup(); } catch {}
  }
  // Helper: Safely extract class string from any HTML, SVG, or custom element
  function getElementClassString(el) {
    if (!el) return '';
    if (typeof el.className === 'string') return el.className;
    if (el.className && typeof el.className.baseVal === 'string') return el.className.baseVal;
  }

  // Universal Navigation & Redirect Shield: prevents native browser redirection & SPA route transitions
  let removeNavShield = null;
  function installNavShield() {
    if (removeNavShield) return;

    const navBlocker = (e) => {
      if (e.target && e.target.closest && e.target.closest('#__replicator_picker_bar__')) {
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };
    window.addEventListener('click', navBlocker, true);
    document.addEventListener('click', navBlocker, true);
    window.addEventListener('submit', navBlocker, true);
    document.addEventListener('submit', navBlocker, true);

    const unloadBlocker = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', unloadBlocker, true);

    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;
    try {
      history.pushState = function(...args) {
        console.log('[replicator] Blocked pushState navigation during replication');
      };
      history.replaceState = function(...args) {
        console.log('[replicator] Blocked replaceState navigation during replication');
      };
    } catch {}

    removeNavShield = () => {
      window.removeEventListener('click', navBlocker, true);
      document.removeEventListener('click', navBlocker, true);
      window.removeEventListener('submit', navBlocker, true);
      document.removeEventListener('submit', navBlocker, true);
      window.removeEventListener('beforeunload', unloadBlocker, true);
      try {
        history.pushState = origPushState;
        history.replaceState = origReplaceState;
      } catch {}
      removeNavShield = null;
    };
  }

  // 1. Create Top Instruction Bar
  const bar = document.createElement('div');
  bar.id = '__replicator_picker_bar__';
  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;">🎯</span>
      <strong>Select Section:</strong>
      <span>Hover over any section and click to select it. Press <kbd style="background:#334155;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">ESC</kbd> to cancel.</span>
    </div>
    <button id="__replicator_cancel_btn__" style="background:#ef4444;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-weight:600;font-size:12px;cursor:pointer;">Cancel</button>
  `;
  Object.assign(bar.style, {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    background: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(8px)',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    padding: '8px 18px',
    borderRadius: '8px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    userSelect: 'none',
    pointerEvents: 'auto',
  });
  document.body.appendChild(bar);

  // 2. Create Floating Highlight Overlay & Badge
  const overlay = document.createElement('div');
  overlay.id = '__replicator_picker_overlay__';
  Object.assign(overlay.style, {
    position: 'absolute',
    border: '2px solid #2563eb',
    background: 'rgba(37, 99, 235, 0.12)',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.8), 0 8px 24px rgba(37, 99, 235, 0.25)',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: '2147483646',
    display: 'none',
    transition: 'all 0.08s ease-out',
  });

  const badge = document.createElement('div');
  badge.id = '__replicator_picker_badge__';
  Object.assign(badge.style, {
    position: 'absolute',
    top: '-32px',
    left: '0',
    background: '#1d4ed8',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '11px',
    fontWeight: '700',
    padding: '4px 10px',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  });
  overlay.appendChild(badge);
  document.body.appendChild(overlay);

  let currentTarget = null;
  let selectedData = null;

  // Helper: check if element is a global page shell / layout wrapper that spans the entire document
  function isPageShell(element) {
    if (!element || element === document.body || element === document.documentElement) return true;
    const t = element.tagName.toLowerCase();
    const i = (element.id || '').toLowerCase();
    const c = (typeof element.className === 'string' ? element.className : '').toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();

    if (['html', 'body', 'main'].includes(t)) return true;
    if (role === 'main') return true;
    if (['root', '__next', '__nuxt', 'app', 'maincontent', 'main-content', 'site-content', 'page-content'].includes(i)) return true;
    if (
      c.includes('page-wrapper') ||
      c.includes('page_wrapper') ||
      c.includes('main-wrapper') ||
      c.includes('main_wrapper') ||
      c.includes('layout-wrapper') ||
      c.includes('layout_wrapper') ||
      c.includes('site-wrapper') ||
      c.includes('site_wrapper') ||
      c.includes('app-wrapper') ||
      c.includes('app_wrapper') ||
      c.includes('page-main') ||
      c.includes('site-main') ||
      c.includes('site-content') ||
      c.includes('page-content') ||
      c.includes('main-content') ||
      c.includes('content-wrapper') ||
      c.includes('sections-wrapper') ||
      c.includes('sections-container') ||
      c.includes('page-container') ||
      c.includes('all-sections') ||
      c.includes('overall-wrapper') ||
      c.includes('columns') ||
      c.includes('column main')
    ) return true;
    return false;
  }

  // Helper: detect if an element contains multiple distinct sibling sections (i.e. is a multi-section layout container)
  function isMultiSectionContainer(element) {
    if (!element || element === document.body || element === document.documentElement) return true;
    if (isPageShell(element)) return true;

    const tag = element.tagName.toLowerCase();
    // A <section> tag is a single semantic section unless it literally wraps multiple child <section> or <article> elements
    if (tag === 'section') {
      const childSections = element.querySelectorAll(':scope > section, :scope > div > section, :scope > article');
      return childSections.length >= 2;
    }

    // Filter direct children with meaningful size
    const children = Array.from(element.children).filter((c) => {
      if (!c || c.nodeType !== 1) return false;
      const cTag = c.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'template', 'svg'].includes(cTag)) return false;
      if (c.id === '__replicator_picker_bar__' || c.id === '__replicator_picker_overlay__') return false;
      const rect = c.getBoundingClientRect();
      return rect.height >= 40 && rect.width >= 200;
    });

    let sectionCount = 0;
    for (const c of children) {
      const cTag = c.tagName.toLowerCase();
      const cCls = (typeof c.className === 'string' ? c.className : '').toLowerCase();

      const isSemantic = ['section', 'article'].includes(cTag);
      const isSectionClass = /^(section|site-section|page-section)/.test(cCls) || cCls.includes('section-') || /hero|banner|pricing|feature|testimonial|faq|showcase|carousel|slider|catalog|footer|navbar/i.test(cCls);

      if (isSemantic || isSectionClass) {
        sectionCount++;
        if (sectionCount >= 2) return true;
      }
    }

    // High page-height coverage check: container wrapping > 65% of entire page with 3+ child blocks
    const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const rect = element.getBoundingClientRect();
    if (docHeight > 1000 && rect.height > docHeight * 0.65 && children.length >= 3) {
      return true;
    }

    return false;
  }

  // Helper: check if an element is a distinct standalone section boundary
  function isSectionBoundary(element) {
    if (!element || element === document.body || element === document.documentElement) return false;
    if (isPageShell(element) || isMultiSectionContainer(element)) return false;

    const tag = element.tagName.toLowerCase();
    const role = (element.getAttribute('role') || '').toLowerCase();
    const cls = (typeof element.className === 'string' ? element.className : '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const rect = element.getBoundingClientRect();

    // If element is nested inside a semantic <section> or <article>, that outer section is the boundary!
    const outerSection = element.parentElement ? element.parentElement.closest('section, article') : null;
    if (outerSection && !isPageShell(outerSection) && !isMultiSectionContainer(outerSection)) {
      return false;
    }

    // 1. Semantic Landmark Elements
    if (['section', 'article'].includes(tag)) return true;
    if (['header', 'nav', 'footer'].includes(tag) && !outerSection) return true;
    if (['banner', 'navigation', 'contentinfo'].includes(role) && rect.height >= 50 && !outerSection) return true;

    // 2. Archetype Component Blocks with sufficient dimensions (only if top-level)
    const isArchetype = /hero|banner|pricing|feature|testimonial|faq|showcase|carousel|slider|swiper|catalog|gallery|contact|newsletter|footer|navbar|mega-menu/i.test(cls) ||
                        /hero|banner|pricing|feature|testimonial|faq|showcase|carousel|slider|catalog|gallery|contact|footer|navbar/i.test(id);
    if (isArchetype && rect.height >= 60 && rect.width >= 240) {
      const parent = element.parentElement;
      if (parent && (isPageShell(parent) || isMultiSectionContainer(parent))) {
        return true;
      }
    }

    // 3. Significant standalone container with heading / cards / media whose parent is a multi-section wrapper or body
    if (tag === 'div' && rect.height >= 120 && rect.width >= 280) {
      const parent = element.parentElement;
      if (parent && (isPageShell(parent) || isMultiSectionContainer(parent))) {
        const hasHeading = !!element.querySelector('h1, h2, h3, h4');
        const hasCards = !!element.querySelector('[class*="card"], [class*="grid"], [class*="item"], [class*="col"]');
        const hasMedia = !!element.querySelector('picture, img, video, canvas');
        if (hasHeading || (hasCards && hasMedia) || rect.height >= 250) {
          return true;
        }
      }
    }

    return false;
  }

  // Helper: Find meaningful section boundary
  function findSectionTarget(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (
      el.id === '__replicator_picker_bar__' ||
      el.id === '__replicator_picker_overlay__' ||
      el.closest('#__replicator_picker_bar__') ||
      el.closest('#__replicator_picker_overlay__')
    ) {
      return null;
    }

    // 1. If el is inside a semantic <section> or <article> that is not a page shell / multi-section container:
    let semantic = el.closest('section, article');
    if (semantic && !isPageShell(semantic) && !isMultiSectionContainer(semantic)) {
      // Check if this semantic section has a direct 1:1 wrapper (e.g. <div class="section-wrap"><section>...)
      const p = semantic.parentElement;
      if (p && !isPageShell(p) && !isMultiSectionContainer(p)) {
        const pRect = p.getBoundingClientRect();
        const sRect = semantic.getBoundingClientRect();
        if (Math.abs(pRect.height - sRect.height) < 15 && Math.abs(pRect.width - sRect.width) < 15) {
          return p;
        }
      }
      return semantic;
    }

    // 2. If inside a top-level header, footer, or nav (not inside a section/article):
    let landmark = el.closest('header, footer, nav');
    if (landmark && !isPageShell(landmark) && !landmark.closest('section, article')) {
      let compRoot = landmark;
      let p = landmark.parentElement;
      while (p && p !== document.body && p !== document.documentElement) {
        if (isPageShell(p)) break;
        const pTag = p.tagName.toLowerCase();
        if (['main', 'article', 'section'].includes(pTag)) break;
        const pCls = (p.className || '').toString().toLowerCase();
        const pId = (p.id || '').toLowerCase();
        const nonScriptChildren = Array.from(p.children).filter(c => !['script', 'style', 'noscript'].includes(c.tagName.toLowerCase()));
        const isDedicatedWrapper = nonScriptChildren.length <= 2 &&
          (pCls.includes('nav') || pCls.includes('header') || pCls.includes('footer') || pCls.includes('scope') || pCls.includes('holder') || pId.includes('nav') || pId.includes('header') || pCls.includes('bar'));
        if (isDedicatedWrapper) {
          compRoot = p;
          p = p.parentElement;
        } else {
          break;
        }
      }
      return compRoot;
    }

    // 3. Non-semantic or div-based layouts: climb up towards the multi-section container / page shell
    let curr = el;
    let candidate = null;

    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (isPageShell(curr)) break;

      const tag = curr.tagName.toLowerCase();
      const role = curr.getAttribute('role') || '';
      const rawClass = typeof curr.className === 'string' ? curr.className : '';
      const cls = rawClass.toLowerCase();

      // Skip leaf, typography, media, form, and inline elements
      const isLeafOrInline = [
        'button', 'a', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'img', 'picture', 'source', 'video', 'audio', 'svg', 'path', 'g',
        'i', 'strong', 'em', 'b', 'u', 'input', 'label', 'textarea',
        'select', 'option', 'form', 'li', 'ul', 'ol', 'dl', 'dt', 'dd',
        'table', 'tbody', 'thead', 'tr', 'td', 'th', 'cite', 'small', 'code', 'pre',
        'time', 'mark', 'bdi', 'bdo'
      ].includes(tag);
      if (isLeafOrInline) {
        curr = curr.parentElement;
        continue;
      }

      // Check section boundary
      if (isSectionBoundary(curr)) {
        return curr;
      }

      const p = curr.parentElement;
      if (p && (isPageShell(p) || isMultiSectionContainer(p))) {
        const rect = curr.getBoundingClientRect();
        if (rect.height >= 50 && rect.width >= 200) {
          return curr;
        }
      }

      curr = curr.parentElement;
    }

    return candidate || (el && !isPageShell(el) && !isMultiSectionContainer(el) ? el : null);
  }

  // Helper: Harvest all computed CSS variables from :root and document stylesheets
  function harvestRootCssVariables() {
    const rootVars = {};
    try {
      const rootStyle = document.documentElement.style;
      if (rootStyle) {
        for (let i = 0; i < rootStyle.length; i++) {
          const prop = rootStyle[i];
          if (prop && prop.startsWith('--')) {
            rootVars[prop] = rootStyle.getPropertyValue(prop).trim();
          }
        }
      }
      const bodyStyle = document.body ? document.body.style : null;
      if (bodyStyle) {
        for (let i = 0; i < bodyStyle.length; i++) {
          const prop = bodyStyle[i];
          if (prop && prop.startsWith('--')) {
            rootVars[prop] = bodyStyle.getPropertyValue(prop).trim();
          }
        }
      }
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (!sheet.cssRules) continue;
          for (const rule of Array.from(sheet.cssRules)) {
            const sel = (rule.selectorText || '').toLowerCase();
            if (sel === ':root' || sel === 'html' || sel === 'body' || sel.includes(':root') || sel.includes('theme-dark')) {
              const style = rule.style;
              if (style) {
                for (let i = 0; i < style.length; i++) {
                  const prop = style[i];
                  if (prop && prop.startsWith('--') && !rootVars[prop]) {
                    rootVars[prop] = style.getPropertyValue(prop).trim();
                  }
                }
              }
            }
          }
        } catch {}
      }
      const computed = window.getComputedStyle(document.documentElement);
      for (const key of Object.keys(rootVars)) {
        if (!rootVars[key]) {
          const val = computed.getPropertyValue(key).trim();
          if (val) rootVars[key] = val;
        }
      }
    } catch {}
    return rootVars;
  }

  // Helper: Detect Archetype from element
  function detectArchetype(el) {
    const tag = el.tagName.toLowerCase();
    const html = (el.outerHTML || '').toLowerCase();
    const role = el.getAttribute('role') || '';
    const hasH1 = !!el.querySelector('h1');

    // 1. Footer check (landmarks or copyright content: check before navbar so footer nav links do not misclassify footer as navbar)
    const isFooter =
      tag === 'footer' ||
      role === 'contentinfo' ||
      el.closest('footer, [role="contentinfo"]') !== null ||
      html.includes('site-footer') ||
      html.includes('page-footer') ||
      html.includes('copyright') ||
      html.includes('all rights reserved');
    if (isFooter) {
      return { name: 'Footer', icon: '📄', archetype: 'footer' };
    }

    // 2. Navbar check (only top-level header/nav, not nested carousel dot tabs or footer navs!)
    const isNavElement =
      tag === 'header' ||
      tag === 'nav' ||
      role === 'banner' ||
      el.id === 'mega-menu' ||
      el.classList.contains('mega-menu') ||
      el.querySelector('header, nav, [role="navigation"]') !== null;
    const hasNavLinks = el.querySelectorAll('nav a, header a, ul > li > a, ol > li > button, nav button, header button').length >= 2;
    if (isNavElement && hasNavLinks && !hasH1) {
      return { name: 'Navbar', icon: '🧭', archetype: 'navbar' };
    }

    // 2.5 Carousel / Slider / Gallery check (evaluated before generic tabs so dotnavs aren't misclassified)
    const isCarousel =
      el.querySelector('[class*="swiper"], [class*="slick"], [class*="slider"], [class*="carousel"], [class*="gallery-items"], [class*="gallery-item-container"], [class*="media-gallery"], [class*="dotnav"], [class*="paddlenav"]') !== null ||
      html.includes('media-gallery') ||
      html.includes('tv-media-gallery') ||
      html.includes('carousel') ||
      html.includes('swiper') ||
      html.includes('slick') ||
      /carousel|slider|swiper|gallery/i.test(getElementClassString(el));

    if (isCarousel) {
      return { name: 'Carousel / Gallery', icon: '🎠', archetype: 'carousel' };
    }

    // 3. Check for Tabbed Section / Feature Tabs
    const isTabSection =
      el.querySelector('[role="tablist"], [class*="tab-list"], [class*="tab-header"], [class*="tab__header"], [class*="feature-tab"], [class*="tabs-nav"], [class*="tab-nav"]') !== null ||
      html.includes('feature-tab') ||
      html.includes('tab-list') ||
      html.includes('tab__item');
    if (isTabSection) {
      return { name: 'Featured Tabs', icon: '📑', archetype: 'features' };
    }

    // 4. Check for Hero Banner (top of page or explicit hero landmarks)
    const rect = el.getBoundingClientRect();
    const isNearPageTop = (window.scrollY + rect.top) < 450;
    const isHeroLike =
      tag !== 'header' &&
      tag !== 'nav' &&
      ((isNearPageTop && (hasH1 || html.includes('hero') || html.includes('carousel') || html.includes('banner'))) ||
      html.includes('homepage-promo') ||
      /hero|billboard|stage-header|banner-main/i.test(getElementClassString(el)));

    if (isHeroLike) {
      return { name: 'Hero Banner', icon: '⚡', archetype: 'hero' };
    }

    // 5. FAQ check
    if (html.includes('faq') || html.includes('frequently asked') || el.querySelector('details')) {
      return { name: 'FAQ Accordion', icon: '❓', archetype: 'faq' };
    }

    // 6. Testimonials check
    const hasCatalogOrFilters = el.querySelectorAll('input[type="checkbox"], input[type="radio"], [class*="filter"], [class*="product-card"], [class*="product-item"], [class*="catalog-item"]').length >= 2;
    if (!hasCatalogOrFilters && (html.includes('testimonial') || el.querySelector('blockquote') || (html.includes('review') && !html.includes('filter') && !html.includes('sort')))) {
      return { name: 'Testimonials', icon: '💬', archetype: 'testimonials' };
    }

    // 7. Feature Grid / Catalog check
    if (hasCatalogOrFilters || el.querySelectorAll('[class*="card"], [class*="feature"], [class*="item"]').length >= 2 || html.includes('feature') || html.includes('filter')) {
      return { name: hasCatalogOrFilters ? 'Product Catalog & Filters' : 'Feature Grid', icon: hasCatalogOrFilters ? '🛍️' : '⭐', archetype: 'features' };
    }

    // 8. Pricing check
    const innerText = el.innerText || '';
    if (/\$\s*\d+|\bper\s*month|\/month|\/mo\b/i.test(innerText) || (html.includes('pricing') && !html.includes('pricing-gateway'))) {
      return { name: 'Pricing', icon: '💳', archetype: 'pricing' };
    }

    return { name: 'Section', icon: '📦', archetype: 'generic-section' };
  }

  // Helper: Build CSS Selector
  function buildSelector(el) {
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }
    const tag = el.tagName.toLowerCase();

    // Check unique data attributes
    const testAttrs = ['data-section', 'data-component', 'data-tcl-gtm-drawer', 'data-testid'];
    for (const attr of testAttrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const sel = `${tag}[${attr}="${CSS.escape(val)}"]`;
        try {
          if (document.querySelectorAll(sel).length === 1) return sel;
        } catch {}
      }
    }

    // Check unique classes
    if (el.classList && el.classList.length > 0) {
      for (const c of Array.from(el.classList)) {
        if (!c.includes('hover') && !c.includes('active') && !c.includes('selected') && c.length < 50) {
          const testSel = `${tag}.${CSS.escape(c)}`;
          try {
            if (document.querySelectorAll(testSel).length === 1) {
              return testSel;
            }
          } catch {}
        }
      }

      // Try compound class
      const validClasses = Array.from(el.classList).filter(
        (c) => !c.includes('hover') && !c.includes('active') && !c.includes('selected') && c.length < 50
      );
      if (validClasses.length >= 2) {
        const compoundSel = `${tag}.${validClasses.map((c) => CSS.escape(c)).join('.')}`;
        try {
          if (document.querySelectorAll(compoundSel).length === 1) {
            return compoundSel;
          }
        } catch {}
      }
    }

    // Tag with nth-of-type
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
      const index = siblings.indexOf(el) + 1;
      return `${tag}:nth-of-type(${index})`;
    }
    return tag;
  }

  // Update Highlight Box
  function updateOverlay(el) {
    if (!el) {
      overlay.style.display = 'none';
      return;
    }
    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    overlay.style.display = 'block';
    overlay.style.top = `${rect.top + scrollTop}px`;
    overlay.style.left = `${rect.left + scrollLeft}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    const arch = detectArchetype(el);
    const sel = buildSelector(el);
    const interactiveCount = el.querySelectorAll('a, button, input, [role="button"], details').length;

    badge.style.top = rect.top + scrollTop < 45 ? '6px' : '-34px';
    badge.innerHTML = `${arch.icon} <strong>${arch.name}</strong> &bull; <span style="opacity:0.9;font-family:monospace;">${sel}</span> &bull; ${Math.round(rect.width)}&times;${Math.round(rect.height)}px`;

    // Build hierarchy breadcrumb trail
    const crumbs = [];
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement && crumbs.length < 6) {
      const tag = cur.tagName.toLowerCase();
      let label = tag;
      if (cur.id) {
        label += `#${cur.id.slice(0, 16)}`;
      } else if (cur.classList && cur.classList.length > 0) {
        const c = Array.from(cur.classList).find((cls) => !cls.includes('hover') && !cls.includes('active') && cls.length < 24);
        if (c) label += `.${c.slice(0, 16)}`;
      }
      crumbs.unshift({ el: cur, label });
      cur = cur.parentElement;
    }
    currentCrumbs = crumbs;

    if (!isSectionConfirmed) {
      bar.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;overflow-x:auto;">
            <span style="font-size:16px;">🎯</span>
            <strong>${arch.icon} ${arch.name}:</strong>
            <div id="__replicator_breadcrumbs__" style="display:flex;align-items:center;gap:4px;">
              ${crumbs.map((c, i) => `
                <span class="__rep_crumb__" data-index="${i}" style="padding:2px 7px;background:${c.el === el ? '#2563eb' : 'rgba(255,255,255,0.12)'};color:#fff;border-radius:4px;font-size:11px;font-family:monospace;cursor:pointer;user-select:none;transition:background 0.2s;" title="Click to select this container">${c.label}</span>
                ${i < crumbs.length - 1 ? '<span style="color:#64748b;font-size:10px;">&gt;</span>' : ''}
              `).join('')}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <button id="__rep_up_btn__" style="background:#334155;color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;font-weight:600;" title="Expand to parent container (Press Up Arrow)">↑ Parent</button>
            <button id="__rep_down_btn__" style="background:#334155;color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;font-weight:600;" title="Narrow to child (Press Down Arrow)">↓ Child</button>
            <button id="__rep_confirm_btn__" style="background:#16a34a;color:#fff;border:none;border-radius:4px;padding:4px 12px;font-size:12px;cursor:pointer;font-weight:700;">Replicate</button>
            <button id="__replicator_cancel_btn__" style="background:#ef4444;color:#fff;border:none;border-radius:4px;padding:4px 8px;font-weight:600;font-size:11px;cursor:pointer;">Cancel</button>
          </div>
        </div>
      `;
    }
  }

  let currentCrumbs = [];

  // Mouse Move Event Listener
  function onMouseMove(e) {
    const target = findSectionTarget(e.target);
    if (target && target !== currentTarget) {
      currentTarget = target;
      updateOverlay(currentTarget);
    }
  }

  let isSectionConfirmed = false;

  // Click Event Listener
  function onClick(e) {
    const cancelBtn = document.getElementById('__replicator_cancel_btn__');
    if (e.target === cancelBtn || cancelBtn?.contains(e.target)) {
      cleanup();
      chrome.runtime.sendMessage({ action: 'SECTION_PICKER_CANCELLED' });
      return;
    }

    if (e.target.closest('#__replicator_picker_bar__')) {
      const crumb = e.target.closest('.__rep_crumb__');
      if (crumb) {
        const idx = parseInt(crumb.getAttribute('data-index'), 10);
        if (currentCrumbs && currentCrumbs[idx] && currentCrumbs[idx].el) {
          currentTarget = currentCrumbs[idx].el;
          updateOverlay(currentTarget);
        }
        return;
      }
      if (e.target.closest('#__rep_up_btn__')) {
        if (currentTarget && currentTarget.parentElement && currentTarget.parentElement !== document.body && currentTarget.parentElement !== document.documentElement) {
          currentTarget = currentTarget.parentElement;
          updateOverlay(currentTarget);
        }
        return;
      }
      if (e.target.closest('#__rep_down_btn__')) {
        if (currentTarget && currentTarget.children && currentTarget.children.length > 0) {
          const child = Array.from(currentTarget.children).find((c) => c.getBoundingClientRect().height > 50) || currentTarget.firstElementChild;
          if (child) {
            currentTarget = child;
            updateOverlay(currentTarget);
          }
        }
        return;
      }
      if (!e.target.closest('#__rep_confirm_btn__')) {
        return;
      }
    }

    if (isSectionConfirmed) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (!currentTarget) {
      return;
    }

    const arch = detectArchetype(currentTarget);
    const selector = buildSelector(currentTarget);
    const rect = currentTarget.getBoundingClientRect();
    const interactiveElements = currentTarget.querySelectorAll('a, button, input, [role="button"], details').length;

    const data = {
      selector,
      tagName: currentTarget.tagName.toLowerCase(),
      archetype: arch.archetype || arch.name.toLowerCase(),
      archetypeName: arch.name,
      icon: arch.icon,
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      interactiveCount: interactiveElements,
      sectionHtml: (() => {
        let h = currentTarget.outerHTML;
        if (arch.archetype === 'navbar' || ['header', 'nav'].includes(currentTarget.tagName.toLowerCase())) {
          const added = new Set([currentTarget]);
          function appendEl(el) {
            if (!el || added.has(el) || currentTarget.contains(el)) return;
            const tag = (el.tagName || '').toLowerCase();
            if (['html', 'body', 'main', 'script', 'style'].includes(tag)) return;
            added.add(el);
            h += '\n' + el.outerHTML;
          }

          // A. Check declarative trigger attributes inside currentTarget
          const triggers = currentTarget.querySelectorAll('button, a, [role="button"], [class*="toggle"], [class*="burger"], [class*="hamburger"], [class*="menu-btn"], [aria-controls], [data-target], [data-bs-target], [data-elementor-open-popup]');
          triggers.forEach((trg) => {
            const ctrlId = trg.getAttribute('aria-controls') || trg.getAttribute('aria-owns');
            if (ctrlId) {
              const match = document.getElementById(ctrlId.trim());
              if (match) appendEl(match);
            }
            const dt = trg.getAttribute('data-target') || trg.getAttribute('data-bs-target');
            if (dt && dt.startsWith('#')) {
              try { const match = document.querySelector(dt.trim()); if (match) appendEl(match); } catch {}
            }
            const href = trg.getAttribute('href') || '';
            if (href.includes('elementor-action') || href.includes('popup')) {
              try {
                const dec = decodeURIComponent(href);
                const m = dec.match(/settings=([A-Za-z0-9+/=]+)/);
                if (m && m[1]) {
                  const s = JSON.parse(atob(m[1]));
                  if (s && s.id) {
                    const match = document.querySelector(`[data-elementor-id="${s.id}"], .elementor-${s.id}, [id="elementor-popup-modal-${s.id}"]`);
                    if (match) appendEl(match);
                  }
                }
              } catch {}
            }
            if (href.startsWith('#') && href.length > 2 && !href.includes('elementor-action')) {
              try {
                const match = document.querySelector(href);
                if (match && (match.matches('[class*="menu"], [class*="nav"], [class*="drawer"], [class*="sidebar"], [class*="offcanvas"]') || match.getAttribute('role') === 'dialog')) {
                  appendEl(match);
                }
              } catch {}
            }
          });

          // B. Semantic companion query
          const candidates = document.querySelectorAll(
            '[data-elementor-type="popup"], [class*="location-popup"], [class*="mobile-nav-drawer"], [class*="mobile-menu"], [class*="menu-drawer"], [class*="nav-drawer"], [class*="header_sidebar_menu"], [class*="offcanvas"], [class*="off-canvas"], [class*="drawer"]:not([class*="cart"]), [class*="sidebar"]:not([class*="cart"]):not([class*="widget"]), [class*="header-panel"], [class*="mega-menu-panel"], dialog.tds-site-header-panel, .dx-mega-menu-panel, .tds-modal-backdrop'
          );
          candidates.forEach((c) => {
            const cls = (c.className && typeof c.className === 'string') ? c.className.toLowerCase() : '';
            if (cls.includes('cookie') || cls.includes('chat') || cls.includes('alert') || cls.includes('review') || cls.includes('cart')) return;
            const hasLinks = c.querySelectorAll('a').length >= 1;
            const hasNav = c.querySelectorAll('nav, ul, [role="menu"]').length > 0;
            if (hasLinks || hasNav) appendEl(c);
          });
        }
        return h;
      })(),
    };

    // Save section into storage
    chrome.runtime.sendMessage({
      action: 'SECTION_PICKED',
      section: data,
    });

    selectedData = data;

    // Freeze selection & display docked confirmation toolbar
    isSectionConfirmed = true;
    window.removeEventListener('mousemove', onMouseMove, true);

    overlay.style.border = '2px solid #10b981';
    overlay.style.background = 'rgba(16, 185, 129, 0.14)';
    overlay.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.9), 0 8px 32px rgba(16, 185, 129, 0.3)';
    badge.style.background = '#059669';
    badge.innerHTML = `✓ ${arch.icon} ${arch.name} Selected &bull; ${selector}`;

    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:22px;">${arch.icon}</span>
        <div>
          <div style="font-weight:700;font-size:13px;color:#ffffff;">Section Selected: ${arch.name}</div>
          <div style="font-size:11px;opacity:0.8;font-family:monospace;color:#cbd5e1;">${selector} &bull; ${data.dimensions.width}×${data.dimensions.height}px</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="__replicator_start_btn__" style="background:#2563eb;color:#ffffff;border:none;border-radius:6px;padding:8px 16px;font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 10px rgba(37,99,235,0.4);transition:all 0.2s;">
          <span>⚡ Replicate (-1 Token)</span>
        </button>
        <button id="__replicator_reselect_btn__" style="background:#334155;color:#f8fafc;border:none;border-radius:6px;padding:8px 12px;font-weight:500;font-size:12px;cursor:pointer;">
          Reselect
        </button>
        <button id="__replicator_cancel_btn__" style="background:transparent;color:#94a3b8;border:none;border-radius:4px;padding:4px 8px;font-size:14px;cursor:pointer;" title="Cancel">
          ✕
        </button>
      </div>
    `;

    document.getElementById('__replicator_start_btn__')?.addEventListener('click', initiateReplication);
    document.getElementById('__replicator_reselect_btn__')?.addEventListener('click', () => {
      isSectionConfirmed = false;
      overlay.style.border = '2px solid #2563eb';
      overlay.style.background = 'rgba(37, 99, 235, 0.12)';
      overlay.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.8), 0 8px 24px rgba(37, 99, 235, 0.25)';
      badge.style.background = '#1d4ed8';
      window.addEventListener('mousemove', onMouseMove, true);

      bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">🎯</span>
          <strong>Select Section:</strong>
          <span>Hover to highlight. Press <kbd style="background:#334155;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">↑</kbd> to expand to parent, <kbd style="background:#334155;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">↓</kbd> to shrink, <kbd style="background:#334155;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">ESC</kbd> to cancel.</span>
        </div>
        <button id="__replicator_cancel_btn__" style="background:#ef4444;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-weight:600;font-size:12px;cursor:pointer;">Cancel</button>
      `;
    });

  // Helper: Universally hover and interact with elements in the section to reveal dynamic/lazy DOM
  async function revealDynamicSections(sectionEl) {
    if (!sectionEl) return;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Identify primary tab buttons
    const tabTriggers = Array.from(sectionEl.querySelectorAll(
      'button[role="tab"], [role="tablist"] > * > button, .tab__list button.tab__item-title, .tab__list button, .tabs-nav button, [role="tab"]'
    )).filter((el) => {
      const cls = getElementClassString(el).toLowerCase();
      const txt = (el.textContent || '').trim().toLowerCase();
      // Exclude navigation arrows, previous/next buttons
      return !cls.includes('arrow') && !cls.includes('prev') && !cls.includes('next') &&
             txt !== 'previous' && txt !== 'next' &&
             !el.closest('#__replicator_picker_bar__') && !el.closest('#__replicator_picker_overlay__');
    });

    if (tabTriggers.length > 1) {
      // Deliberate, paced tab walk: wait for AJAX cards/products and record each tab's rendered panel HTML
      const initialActiveTab = tabTriggers.find(t => t.getAttribute('aria-selected') === 'true' || t.classList.contains('active') || t.classList.contains('selected')) || tabTriggers[0];
      const capturedTabs = [];

      for (let i = 0; i < tabTriggers.length; i++) {
        const tab = tabTriggers[i];
        const tabTitle = (tab.textContent || '').trim();
        const targetId = tab.getAttribute('aria-controls') || ('category' + i);

        const progressStepEl = document.getElementById('__replicator_progress_step__');
        if (progressStepEl) {
          progressStepEl.textContent = `Extracting tab ${i + 1}/${tabTriggers.length}: ${tabTitle || targetId}...`;
        }

        // Trigger tab activation
        try {
          tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
          tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          tab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
          tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          if (typeof tab.click === 'function') tab.click();
        } catch {}

        // Wait dynamically for AJAX cards to mount in the target panel
        const startTime = Date.now();
        let targetPanel = sectionEl.querySelector('#' + CSS.escape(targetId)) ||
                          document.getElementById(targetId) ||
                          sectionEl.querySelectorAll('[role="tabpanel"], [class*="tabpanel"], [class*="primary-panel"], [class*="tab-pane"]')[i];

        while (Date.now() - startTime < 1400) {
          await sleep(150);
          if (!targetPanel) {
            targetPanel = sectionEl.querySelector('#' + CSS.escape(targetId)) ||
                          document.getElementById(targetId) ||
                          sectionEl.querySelectorAll('[role="tabpanel"], [class*="tabpanel"], [class*="primary-panel"], [class*="tab-pane"]')[i];
          }
          if (targetPanel) {
            const hasCards = targetPanel.querySelectorAll('[class*="card"], [class*="product"], [class*="item"], [role="listitem"]').length > 0;
            if (hasCards && (Date.now() - startTime >= 700)) {
              break;
            }
          }
        }

        if (targetPanel) {
          // Resolve any lazy-loaded image URLs immediately into src attributes
          targetPanel.querySelectorAll('img').forEach((img) => {
            const realSrc = img.getAttribute('data-desktop-src') || img.getAttribute('data-src') || img.getAttribute('data-original') || img.src;
            if (realSrc && (!img.src || img.src.includes('data:image'))) {
              img.src = realSrc;
            }
          });

          capturedTabs.push({
            index: i,
            title: tabTitle,
            targetId: targetId,
            panelHtml: targetPanel.outerHTML,
            panelEl: targetPanel
          });
        }
      }

      // If multiple tabs were captured, ensure each panel in the section has its populated content!
      if (capturedTabs.length > 1) {
        capturedTabs.forEach((ct, idx) => {
          let existingPanel = sectionEl.querySelector('#' + CSS.escape(ct.targetId));
          if (!existingPanel) {
            const panels = sectionEl.querySelectorAll('[role="tabpanel"], [class*="tabpanel"], [class*="primary-panel"], [class*="tab-pane"]');
            if (panels[idx]) {
              existingPanel = panels[idx];
              existingPanel.id = ct.targetId;
            }
          }
          if (existingPanel && ct.panelEl && ct.panelEl !== existingPanel) {
            existingPanel.innerHTML = ct.panelEl.innerHTML;
          }
          if (existingPanel) {
            const pClasses = Array.from(existingPanel.classList);
            if (idx === 0) {
              existingPanel.classList.add('is-active', 'active');
              pClasses.forEach(c => {
                if (c.includes('panel') || c.includes('pane') || c.includes('tab')) {
                  existingPanel.classList.add(c + '--active', c + '-active');
                }
              });
              existingPanel.setAttribute('aria-hidden', 'false');
              existingPanel.style.display = 'block';
            } else {
              existingPanel.classList.remove('is-active', 'active');
              pClasses.forEach(c => {
                if (c.endsWith('--active') || c.endsWith('-active') || c.endsWith('_active')) {
                  existingPanel.classList.remove(c);
                }
              });
              existingPanel.setAttribute('aria-hidden', 'true');
              existingPanel.style.display = 'none';
            }

            // Ensure the first child subpanel is active so switching categories never renders a blank panel
            const firstSubPanel = existingPanel.querySelector('[role="tabpanel"], [class*="subpanel"], [class*="__panel"]:not(:scope)');
            if (firstSubPanel) {
              firstSubPanel.classList.add('is-active', 'active');
              Array.from(firstSubPanel.classList).forEach(c => {
                if (c.includes('panel') || c.includes('pane') || c.includes('tab')) {
                  firstSubPanel.classList.add(c + '--active', c + '-active');
                }
              });
              firstSubPanel.setAttribute('aria-hidden', 'false');
              firstSubPanel.style.display = 'block';
            }
            existingPanel.querySelectorAll('[class*="progressbar-indicator"], [class*="progress-indicator"]').forEach(ind => {
              Array.from(ind.classList).forEach(c => ind.classList.add(c + '--show', c + '-show'));
              ind.style.display = 'flex';
            });
            existingPanel.querySelectorAll('[class*="indicator__arrow"], [class*="swiper-button"], [class*="arrow"]').forEach(btn => {
              btn.style.display = 'inline-flex';
            });
          }
        });
      }

      // Restore initial tab
      try {
        if (initialActiveTab) {
          initialActiveTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          if (typeof initialActiveTab.click === 'function') initialActiveTab.click();
        }
      } catch {}
      await sleep(250);

      window.__capturedTabsData = capturedTabs.map(t => ({
        index: t.index,
        title: t.title,
        targetId: t.targetId
      }));
    }

    // 2. Catalog & Grid Smooth Scroll and "View More" / "Load More" Expansion
    const cardCandidates = Array.from(sectionEl.querySelectorAll(
      'article, [role="listitem"], [class*="product-card"], [class*="product-item"], [class*="catalog-item"], [class*="card"]'
    )).filter(el => {
      const cls = getElementClassString(el).toLowerCase();
      return !cls.includes('filter') && !cls.includes('nav') && !cls.includes('header') && !el.closest('[class*="filter"]');
    });

    if (cardCandidates.length > 0) {
      const initialCount = cardCandidates.length;
      sectionEl.setAttribute('data-initial-cards-count', String(initialCount));

      // Scroll smoothly down through the section so IntersectionObserver lazy-loaders fire
      const rect = sectionEl.getBoundingClientRect();
      const sectionTop = window.scrollY + rect.top;
      const sectionHeight = Math.max(rect.height, 400);
      const scrollSteps = Math.min(6, Math.max(2, Math.floor(sectionHeight / 600)));

      for (let s = 1; s <= scrollSteps; s++) {
        const targetY = sectionTop + (sectionHeight * (s / scrollSteps));
        window.scrollTo({ top: targetY, behavior: 'smooth' });
        await sleep(180);
      }

      // Check for catalog-level "View More" / "Load More" button (outside filter dropdowns)
      const isCatalogViewMore = (el) => {
        if (!el || el.closest('[class*="filter"]') || el.closest('[class*="sidebar"]') || el.closest('[class*="selector-item"]')) return false;
        const txt = (el.textContent || '').trim().toLowerCase();
        const cls = getElementClassString(el).toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const anLa = (el.getAttribute('an-la') || '').toLowerCase();
        return (txt.includes('view more') || txt.includes('load more') || txt.includes('show more') ||
               cls.includes('view-more') || cls.includes('load-more') ||
               anLa.includes('view more') || anLa.includes('load more') || aria.includes('view more')) &&
               !cls.includes('close') && !cls.includes('cancel');
      };

      const viewMoreBtn = Array.from(sectionEl.querySelectorAll('button, a, [role="button"]')).find(isCatalogViewMore);

      if (viewMoreBtn) {
        // Tag initial batch
        cardCandidates.forEach((c, idx) => {
          c.setAttribute('data-card-index', String(idx));
          c.setAttribute('data-initial-batch', 'true');
        });

        // Click "View more" up to 8 times or until no more results load
        let clicks = 0;
        let lastCount = initialCount;
        while (clicks < 8) {
          const btn = Array.from(sectionEl.querySelectorAll('button, a, [role="button"]')).find(isCatalogViewMore);
          if (!btn || btn.offsetParent === null || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
            break;
          }
          const style = window.getComputedStyle(btn);
          if (style.display === 'none' || style.visibility === 'hidden') break;

          const progressStepEl = document.getElementById('__replicator_progress_step__');
          if (progressStepEl) {
            progressStepEl.textContent = `Loading catalog results (revealed ${lastCount} items)...`;
          }

          // Trigger click cycle
          if (typeof btn.scrollIntoView === 'function') {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          await sleep(250);
          btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
          btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
          btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          if (typeof btn.click === 'function') btn.click();

          // Wait for new batch to mount
          await sleep(800);

          const currentCards = Array.from(sectionEl.querySelectorAll(
            'article, [role="listitem"], [class*="product-card"], [class*="product-item"], [class*="catalog-item"], [class*="card"]'
          )).filter(el => {
            const cls = getElementClassString(el).toLowerCase();
            return !cls.includes('filter') && !cls.includes('nav') && !cls.includes('header') && !el.closest('[class*="filter"]');
          });

          if (currentCards.length > lastCount) {
            for (let i = lastCount; i < currentCards.length; i++) {
              currentCards[i].setAttribute('data-card-index', String(i));
              currentCards[i].setAttribute('data-dynamic-batch', 'true');
              currentCards[i].setAttribute('data-batch-page', String(clicks + 2));
            }
            lastCount = currentCards.length;
            clicks++;
          } else {
            break;
          }
        }

        // Scroll back to top of section
        window.scrollTo({ top: sectionTop, behavior: 'smooth' });
        await sleep(200);
      }
    }

    // 3. Explore menus, dropdowns, and interactive controls
    const triggers = Array.from(sectionEl.querySelectorAll(
      'button, a, [role="button"], [aria-haspopup], [aria-expanded], [data-dropdown], [data-toggle], [data-menu], li'
    )).filter((el) => {
      const isTab = el.getAttribute('role') === 'tab' || getElementClassString(el).toLowerCase().includes('tab');
      return !isTab && !el.closest('#__replicator_picker_bar__') && !el.closest('#__replicator_picker_overlay__');
    });

    for (const trg of triggers.slice(0, 30)) {
      try {
        trg.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
        trg.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
        trg.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, cancelable: true, view: window }));
        if (typeof trg.focus === 'function') trg.focus({ preventScroll: true });

        const ariaExp = trg.getAttribute('aria-expanded');
        const hasPopup = trg.hasAttribute('aria-haspopup');
        const hasSubmenu = trg.querySelector && (
          trg.querySelector('ul, ol, nav, [class*="menu"], [class*="dropdown"]') ||
          trg.parentElement?.querySelector('ul, ol, nav, [class*="menu"], [class*="dropdown"]')
        );
        if (ariaExp === 'false' || hasPopup || hasSubmenu) {
          trg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          const href = trg.getAttribute('href');
          const isNavHref = href && href.trim() && !href.startsWith('#') && !href.startsWith('javascript:');
          if (!isNavHref && typeof trg.click === 'function') {
            trg.click();
          }
        }
      } catch {}
      // Wait for CSS animations, Framer Motion, and React state updates (300ms)
      await sleep(300);
    }

    try {
      document.body.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true, view: window }));
    } catch {}
    await sleep(150);
  }

  // Helper: Harvest section HTML including any dynamically mounted sibling panels, portals or dialogs
  function harvestSectionHtmlWithDynamics(sectionEl, archetype) {
    if (!sectionEl) return '';
    let html = sectionEl.outerHTML;

    // Harvest all detached portals discovered during hover/click/scroll or present in document.body
    const detachedSelectors = [
      '[data-interactive-portal="true"]',
      '[data-mutation-src]',
      'dialog',
      '[role="dialog"]',
      '[role="menu"]',
      '[role="listbox"]',
      '[id*="headlessui-menu-items"]',
      '[id*="headlessui-popover"]',
      '[id*="headlessui-listbox"]',
      '[data-radix-popper-content-wrapper]',
      '[data-floating-ui-portal]',
      '[class*="header-panel"]',
      '[class*="mega-menu-panel"]',
      '[class*="megamenu-panel"]',
      '[class*="dropdown-menu"]',
      '[class*="popover-content"]',
      '[class*="modal-backdrop"]',
      '[class*="curtain"]'
    ];

    const associated = document.querySelectorAll(detachedSelectors.join(', '));
    associated.forEach((node) => {
      if (
        !sectionEl.contains(node) &&
        !node.closest('#__replicator_picker_bar__') &&
        !node.closest('#__replicator_picker_overlay__')
      ) {
        html += '\n' + node.outerHTML;
      }
    });

    return html;
  }

  // Helper: Compute clean selector for an element
  function getCleanSelector(el, scope) {
    if (!el || el === scope || el === document.documentElement || el === document.body) return '';
    if (el.closest && (el.closest('#__replicator_picker_bar__') || el.closest('#__replicator_picker_overlay__'))) return '';

    // 1. Stable, non-random ID
    if (el.id && !/^\d/.test(el.id) && !el.id.includes(':') && !el.id.includes('__') && el.id.length < 50) {
      return '#' + CSS.escape(el.id);
    }

    // 2. Semantic role or data-attributes
    const dataAttrs = ['data-mutation-src', 'data-portal-for', 'data-role', 'data-tab', 'data-filter', 'data-target', 'data-toggle', 'data-action', 'data-color', 'data-size', 'data-value', 'aria-controls'];
    for (const attr of dataAttrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
        try {
          if ((scope || document).querySelectorAll(sel).length === 1) return sel;
        } catch (e) {}
      }
    }

    // 3. Accessibility and state attributes (name, for, value, an-la, aria-label)
    const semanticAttrs = ['name', 'for', 'value', 'an-la', 'aria-label'];
    for (const attr of semanticAttrs) {
      const val = el.getAttribute(attr);
      if (val && val.length < 50 && !val.includes('"') && !val.includes('\n')) {
        const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
        try {
          if ((scope || document).querySelectorAll(sel).length === 1) return sel;
        } catch (e) {}
      }
    }

    // 4. Stable class name based selector
    if (el.classList && el.classList.length > 0) {
      const validClasses = Array.from(el.classList).filter(c =>
        !c.startsWith('is-') &&
        !c.startsWith('has-') &&
        !c.includes('open') &&
        !c.includes('active') &&
        !c.includes('focus') &&
        !c.includes('hover') &&
        !c.includes('selected') &&
        !c.includes('__replicator')
      );
      if (validClasses.length > 0) {
        const primaryCls = '.' + CSS.escape(validClasses[0]);
        try {
          const matches = Array.from((scope || document).querySelectorAll(primaryCls));
          if (matches.length === 1) return primaryCls;
          if (matches.length > 1) {
            const idx = matches.indexOf(el);
            if (idx !== -1) {
              const parent = el.parentElement;
              if (parent && parent !== scope && parent.className && typeof parent.className === 'string') {
                const parentClasses = parent.className.split(/\s+/).filter(c => c && !c.startsWith('is-') && !c.includes('__replicator'));
                if (parentClasses.length > 0) {
                  const parentCls = '.' + CSS.escape(parentClasses[0]);
                  const childIdx = Array.from(parent.children).indexOf(el) + 1;
                  const scopedSel = `${parentCls} > ${primaryCls}:nth-of-type(${childIdx})`;
                  try {
                    if ((scope || document).querySelectorAll(scopedSel).length === 1) return scopedSel;
                  } catch (e) {}
                }
              }
              return `${primaryCls}:nth-of-type(${idx + 1})`;
            }
          }
        } catch (e) {}
      }
    }

    // 5. Semantic ancestor-anchored path
    const path = [];
    let curr = el;
    while (curr && curr !== scope && curr !== document.body && curr.parentElement) {
      let tag = curr.tagName.toLowerCase();
      let idx = 1;
      let sib = curr.previousElementSibling;
      while (sib) {
        if (sib.tagName === curr.tagName) idx++;
        sib = sib.previousElementSibling;
      }
      const validCls = curr.className && typeof curr.className === 'string'
        ? curr.className.split(/\s+/).find(c => c && !c.startsWith('is-') && !c.includes('open') && !c.includes('active') && !c.includes('__replicator'))
        : null;
      if (validCls) {
        path.unshift(`.${CSS.escape(validCls)}`);
        break;
      } else {
        path.unshift(`${tag}:nth-of-type(${idx})`);
      }
      curr = curr.parentElement;
    }
    return path.join(' > ');
  }

  // Helper: Granular 10px Scroll Dynamics Explorer & Noter
  // "check every 10 px if there is change in background or canvas or anything on screen and note everything"
  async function probeScrollDynamics(sectionEl) {
    if (!sectionEl) return [];
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const initialScrollY = window.scrollY || window.pageYOffset || 0;
    const progressStepEl = document.getElementById('__replicator_progress_step__');

    // 1. Snapshot initial state of sectionEl, its header/sticky ancestors, and child elements at scroll 0
    window.scrollTo({ top: 0, behavior: 'instant' });
    await sleep(60);

    const monitoredElements = [sectionEl];
    const candidateEls = Array.from(sectionEl.querySelectorAll('*')).filter(el => {
      if (el.closest('#__replicator_picker_bar__') || el.closest('#__replicator_picker_overlay__')) return false;
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'meta', 'link', 'br', 'wbr', 'noscript'].includes(tag)) return false;
      return true;
    });

    candidateEls.forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'canvas' || tag === 'header' || tag === 'nav') {
        monitoredElements.push(el);
      } else {
        const style = window.getComputedStyle(el);
        if (
          style.position === 'sticky' ||
          style.position === 'fixed' ||
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          style.backgroundImage !== 'none' ||
          style.boxShadow !== 'none' ||
          style.backdropFilter !== 'none'
        ) {
          monitoredElements.push(el);
        }
      }
    });

    function captureElementState(el) {
      const style = window.getComputedStyle(el);
      let canvasHash = null;
      if (el.tagName.toLowerCase() === 'canvas') {
        try {
          canvasHash = el.toDataURL('image/png').slice(0, 80);
        } catch {}
      }
      return {
        classes: Array.from(el.classList).sort().join(' '),
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        backdropFilter: style.backdropFilter,
        opacity: style.opacity,
        transform: style.transform,
        canvasHash
      };
    }

    const baseline = new Map();
    monitoredElements.forEach(el => {
      baseline.set(el, captureElementState(el));
    });

    // 2. Step every 10px through scroll range
    const maxScroll = Math.min(
      1500,
      Math.max(600, (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight)
    );

    const recordedScrollTransitions = [];
    let previousState = new Map(baseline);

    const scrollSteps = Math.floor(maxScroll / 10);
    for (let step = 1; step <= scrollSteps; step++) {
      const y = step * 10;
      window.scrollTo({ top: y, behavior: 'instant' });
      window.dispatchEvent(new Event('scroll', { bubbles: true }));

      // Microtick to trigger scroll listeners / animations
      await sleep(18);

      if (progressStepEl && step % 10 === 0) {
        progressStepEl.textContent = `Analyzing scroll dynamics: ${y}px / ${maxScroll}px (10px increments)...`;
      }

      monitoredElements.forEach(el => {
        const current = captureElementState(el);
        const prev = previousState.get(el);
        const base = baseline.get(el);

        const classChanged = current.classes !== prev.classes;
        const bgChanged = current.backgroundColor !== prev.backgroundColor || current.backgroundImage !== prev.backgroundImage;
        const shadowChanged = current.boxShadow !== prev.boxShadow || current.backdropFilter !== prev.backdropFilter;
        const transformChanged = current.transform !== prev.transform || current.opacity !== prev.opacity;
        const canvasChanged = current.canvasHash && current.canvasHash !== prev.canvasHash;

        if (classChanged || bgChanged || shadowChanged || transformChanged || canvasChanged) {
          const elSel = getCleanSelector(el, sectionEl);
          if (elSel) {
            const oldClasses = prev.classes ? prev.classes.split(' ').filter(Boolean) : [];
            const newClasses = current.classes ? current.classes.split(' ').filter(Boolean) : [];
            const addedClasses = newClasses.filter(c => !oldClasses.includes(c));
            const removedClasses = oldClasses.filter(c => !newClasses.includes(c));

            const styles = {};
            const initialStyles = {};

            if (current.backgroundColor !== base.backgroundColor) {
              styles.backgroundColor = current.backgroundColor;
              initialStyles.backgroundColor = base.backgroundColor;
            }
            if (current.backgroundImage !== base.backgroundImage) {
              styles.backgroundImage = current.backgroundImage;
              initialStyles.backgroundImage = base.backgroundImage;
            }
            if (current.boxShadow !== base.boxShadow) {
              styles.boxShadow = current.boxShadow;
              initialStyles.boxShadow = base.boxShadow;
            }
            if (current.backdropFilter !== base.backdropFilter) {
              styles.backdropFilter = current.backdropFilter;
              initialStyles.backdropFilter = base.backdropFilter;
            }
            if (current.transform !== base.transform && current.transform !== 'none') {
              styles.transform = current.transform;
              initialStyles.transform = base.transform;
            }
            if (current.opacity !== base.opacity) {
              styles.opacity = current.opacity;
              initialStyles.opacity = base.opacity;
            }

            recordedScrollTransitions.push({
              threshold: y,
              targetSelector: elSel,
              addedClasses: addedClasses.length ? addedClasses : undefined,
              removedClasses: removedClasses.length ? removedClasses : undefined,
              styles: Object.keys(styles).length ? styles : undefined,
              initialStyles: Object.keys(initialStyles).length ? initialStyles : undefined,
              canvasChanged: !!canvasChanged
            });
          }
          previousState.set(el, current);
        }
      });
    }

    // 3. Restore initial scroll position
    window.scrollTo({ top: initialScrollY, behavior: 'instant' });
    window.dispatchEvent(new Event('scroll', { bubbles: true }));
    await sleep(60);

    return recordedScrollTransitions;
  }

  // Universal In-Situ Behavioral State Mutation Prober
  // Probes every element in section (hover, click, scroll at 10px), intercepts redirects immediately,
  // and records full state transitions into declarative specs.
  async function recordDynamicInteractions(sectionEl) {
    if (!sectionEl) return [];
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const recorded = [];
    const progressStepEl = document.getElementById('__replicator_progress_step__');

    // 1. Granular 10px Scroll Dynamics Exploration Pass
    try {
      if (progressStepEl) progressStepEl.textContent = 'Probing scroll dynamics (every 10px)...';
      const scrollTransitions = await probeScrollDynamics(sectionEl);
      if (scrollTransitions.length > 0) {
        recorded.push({
          triggerSelector: 'window',
          eventType: 'scroll',
          scrollTransitions: scrollTransitions,
          mutations: []
        });
      }
    } catch (scrollErr) {
      console.warn('[replicator] Scroll probe warning:', scrollErr);
    }

    // 2. Global Redirect Shield: Immediately intercept any navigation attempt
    let redirectInitiated = false;
    const redirectShieldListener = (e) => {
      const target = e.target;
      const link = target?.closest ? target.closest('a[href], form') : null;
      if (link) {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          redirectInitiated = true;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
        if (link.tagName === 'FORM') {
          redirectInitiated = true;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      }
    };

    window.addEventListener('click', redirectShieldListener, true);
    window.addEventListener('submit', redirectShieldListener, true);

    const originalLocationAssign = window.location.assign;
    const originalLocationReplace = window.location.replace;
    const originalWindowOpen = window.open;

    try {
      window.location.assign = function() { redirectInitiated = true; };
      window.location.replace = function() { redirectInitiated = true; };
      window.open = function() { redirectInitiated = true; return null; };
    } catch {}

    try {
      // 3. Collect ALL visible elements inside sectionEl
      const rawElements = Array.from(sectionEl.querySelectorAll('*')).filter(el => {
        if (el.closest('#__replicator_picker_bar__') || el.closest('#__replicator_picker_overlay__')) return false;
        const tag = el.tagName.toLowerCase();
        if (['script', 'style', 'meta', 'link', 'br', 'wbr', 'noscript'].includes(tag)) return false;
        return true;
      });

      // Deduplicate by clean selector
      const candidateMap = new Map();
      rawElements.forEach(el => {
        const sel = getCleanSelector(el, sectionEl);
        if (sel && !candidateMap.has(sel)) {
          const rect = el.getBoundingClientRect();
          const hasSize = rect.width > 0 && rect.height > 0;
          const style = window.getComputedStyle(el);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
          if (isVisible && (hasSize || el.children.length > 0)) {
            candidateMap.set(sel, el);
          }
        }
      });

      const candidates = Array.from(candidateMap.values());

      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        const sel = getCleanSelector(el, sectionEl);
        if (!sel) continue;

        redirectInitiated = false;

        if (progressStepEl) {
          const txt = (el.textContent || el.getAttribute('aria-label') || el.id || el.tagName.toLowerCase()).replace(/\s+/g, ' ').trim().slice(0, 24);
          progressStepEl.textContent = `Probing (${i + 1}/${candidates.length}): <${el.tagName.toLowerCase()}> "${txt}"...`;
        }

        // Check if element is a navigation link
        const href = el.getAttribute('href') || (el.tagName.toLowerCase() === 'a' ? el.href : null);
        const isNavHref = href && href.trim() && !href.startsWith('#') && !href.startsWith('javascript:');
        if (isNavHref) {
          // Immediately skip clicking navigation links to prevent leaving the page
          continue;
        }

        let observedMutations = [];
        const mutationCallback = (mutations) => {
          for (const m of mutations) {
            if (m.type === 'childList') {
              const target = m.target;
              if (target.closest && (target.closest('#__replicator_picker_bar__') || target.closest('#__replicator_picker_overlay__'))) {
                continue;
              }
              const targetSel = getCleanSelector(target, document);
              if (!targetSel) continue;

              if (m.addedNodes && m.addedNodes.length > 0) {
                Array.from(m.addedNodes).forEach(node => {
                  if (node.nodeType === 1 && !node.id?.includes('__replicator_')) {
                    const nodeCls = typeof node.className === 'string' ? node.className : '';
                    const isCatalog = targetSel.includes('product-card') || targetSel.includes('product-list') || targetSel.includes('catalog') ||
                                      nodeCls.includes('product-card') || nodeCls.includes('card-item');
                    if (isCatalog) return;
                    if (node.tagName.toLowerCase() === 'svg') return;

                    node.setAttribute('data-interactive-portal', 'true');
                    node.setAttribute('data-mutation-src', sel);

                    observedMutations.push({
                      targetSelector: targetSel,
                      mutationType: 'childList',
                      action: 'added',
                      html: node.outerHTML,
                      tagName: node.tagName.toLowerCase(),
                      className: nodeCls
                    });
                  }
                });
              }
              if (m.removedNodes && m.removedNodes.length > 0) {
                Array.from(m.removedNodes).forEach(node => {
                  if (node.nodeType === 1 && !node.id?.includes('__replicator_')) {
                    const nodeCls = typeof node.className === 'string' ? node.className : '';
                    const isCatalog = targetSel.includes('product-card') || targetSel.includes('product-list') || targetSel.includes('catalog') ||
                                      nodeCls.includes('product-card') || nodeCls.includes('card-item');
                    if (isCatalog) return;
                    if (node.tagName.toLowerCase() === 'svg') return;
                    observedMutations.push({
                      targetSelector: targetSel,
                      mutationType: 'childList',
                      action: 'removed',
                      html: node.outerHTML,
                      tagName: node.tagName.toLowerCase(),
                      className: nodeCls
                    });
                  }
                });
              }
            } else if (m.type === 'attributes') {
              const target = m.target;
              if (target.closest && (target.closest('#__replicator_picker_bar__') || target.closest('#__replicator_picker_overlay__'))) {
                continue;
              }
              const attr = m.attributeName;
              const oldVal = m.oldValue;
              const newVal = target.getAttribute(attr);
              if (oldVal !== newVal) {
                const targetSel = getCleanSelector(target, document);
                if (!targetSel) continue;

                let addedClasses = undefined;
                let removedClasses = undefined;
                if (attr === 'class') {
                  const oldCls = (oldVal || '').split(/\s+/).filter(Boolean);
                  const newCls = (newVal || '').split(/\s+/).filter(Boolean);
                  const added = newCls.filter(c => !oldCls.includes(c));
                  const removed = oldCls.filter(c => !newCls.includes(c));
                  if (added.length === 0 && removed.length === 0) continue;
                  addedClasses = added.length ? added : undefined;
                  removedClasses = removed.length ? removed : undefined;
                }

                observedMutations.push({
                  targetSelector: targetSel,
                  mutationType: 'attributes',
                  attributeName: attr,
                  oldValue: oldVal,
                  newValue: newVal,
                  addedClasses,
                  removedClasses
                });
              }
            }
          }
        };

        // --- A. HOVER PROBE ---
        observedMutations = [];
        const hoverObserver = new MutationObserver(mutationCallback);
        hoverObserver.observe(document.documentElement, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeOldValue: true,
          attributeFilter: ['class', 'style', 'aria-expanded', 'aria-hidden', 'aria-selected', 'hidden', 'open']
        });

        try {
          el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, view: window }));
        } catch {}

        await sleep(120);

        if (redirectInitiated) {
          hoverObserver.disconnect();
          try {
            el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true, view: window }));
          } catch {}
          continue;
        }

        const hoverMutations = [...observedMutations];
        observedMutations = [];

        // Restore hover state
        try {
          el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, cancelable: true, view: window }));
        } catch {}

        await sleep(60);
        const hoverReverseMutations = [...observedMutations];
        hoverObserver.disconnect();

        if (hoverMutations.length > 0) {
          recorded.push({
            triggerSelector: sel,
            eventType: 'mouseenter',
            mutations: hoverMutations,
            reverseMutations: hoverReverseMutations.length > 0 ? hoverReverseMutations : undefined
          });
        }

        // --- B. CLICK PROBE ---
        redirectInitiated = false;
        observedMutations = [];
        const clickObserver = new MutationObserver(mutationCallback);
        clickObserver.observe(document.documentElement, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeOldValue: true,
          attributeFilter: ['class', 'style', 'aria-expanded', 'aria-hidden', 'aria-selected', 'hidden', 'open']
        });

        try {
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          if (typeof el.click === 'function' && el.tagName.toLowerCase() !== 'a') {
            el.click();
          }
        } catch {}

        await sleep(240);

        if (redirectInitiated) {
          clickObserver.disconnect();
          continue;
        }

        const firstClickMutations = [...observedMutations];
        observedMutations = [];

        if (firstClickMutations.length > 0) {
          // Probe second click to test toggle behavior
          try {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            if (typeof el.click === 'function' && el.tagName.toLowerCase() !== 'a') {
              el.click();
            }
          } catch {}

          await sleep(220);
          const secondClickMutations = [...observedMutations];
          clickObserver.disconnect();

          const isToggle = secondClickMutations.length > 0;
          recorded.push({
            triggerSelector: sel,
            eventType: 'click',
            isToggle,
            mutations: firstClickMutations,
            reverseMutations: isToggle ? secondClickMutations : undefined
          });

          // If not toggled off, dismiss with Escape or click outside to restore clean state for the next element
          if (!isToggle) {
            try {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
              document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } catch {}
            await sleep(100);
          }
        } else {
          clickObserver.disconnect();
        }
      }
    } finally {
      window.removeEventListener('click', redirectShieldListener, true);
      window.removeEventListener('submit', redirectShieldListener, true);
      try {
        window.location.assign = originalLocationAssign;
        window.location.replace = originalLocationReplace;
        window.open = originalWindowOpen;
      } catch {}
    }

    return recorded;
  }

  // Function to start live section replication & polling
  async function initiateReplication() {
    const data = selectedData;
    if (!data) return;
    installNavShield();

    // Switch bar to live progress bar state
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:18px;display:inline-block;animation:spin 1s linear infinite;">⏳</span>
        <div>
          <div style="font-weight:700;font-size:13px;color:#ffffff;">Replicating ${data.archetypeName}...</div>
          <div id="__replicator_progress_step__" style="font-size:11px;color:#93c5fd;">Revealing dynamic menus & sub-panels...</div>
        </div>
        <div style="width:130px;height:7px;background:rgba(255,255,255,0.15);border-radius:4px;overflow:hidden;margin-left:8px;">
          <div id="__replicator_progress_fill__" style="width:15%;height:100%;background:#38bdf8;border-radius:4px;transition:width 0.4s ease;"></div>
        </div>
        <span id="__replicator_progress_num__" style="font-size:11px;font-family:monospace;color:#ffffff;min-width:32px;">15%</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button id="__replicator_abort_btn__" style="background:rgba(255,255,255,0.1);color:#94a3b8;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;" title="Cancel replication">
          Cancel
        </button>
      </div>
    `;

    let isCancelled = false;
    document.getElementById('__replicator_abort_btn__')?.addEventListener('click', () => {
      isCancelled = true;
      cleanup();
    });

    // Universally explore and reveal dynamic sections before capturing
    try {
      await revealDynamicSections(currentTarget);
    } catch (probeErr) {
      console.warn('[replicator] Dynamic section probe warning:', probeErr);
    }
    const dynamicSectionHtml = harvestSectionHtmlWithDynamics(currentTarget, data.archetype);

    const progressStepEl = document.getElementById('__replicator_progress_step__');
    if (progressStepEl) progressStepEl.textContent = 'Probing & recording interactive behaviors...';
    let recordedInteractions = [];
    try {
      recordedInteractions = await recordDynamicInteractions(currentTarget);
    } catch (recordErr) {
      console.warn('[replicator] Interactive behavior recording warning:', recordErr);
    }

    let finalSectionHtml = dynamicSectionHtml || data.sectionHtml;
    if (recordedInteractions && recordedInteractions.length > 0) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(finalSectionHtml, 'text/html');
        recordedInteractions.forEach((inter) => {
          if (inter.mutations) {
            inter.mutations.forEach((m) => {
              if (m.action === 'added' && m.html && m.html.trim().length > 10) {
                const temp = document.createElement('div');
                temp.innerHTML = m.html.trim();
                const node = temp.firstElementChild;
                if (node) {
                  const nodeId = node.id;
                  if (!nodeId || !doc.getElementById(nodeId)) {
                    node.setAttribute('data-mutation-src', inter.triggerSelector || '');
                    node.setAttribute('data-interactive-portal', 'true');
                    node.setAttribute('data-state', 'closed');
                    node.style.display = 'none';
                    let target = m.targetSelector ? doc.querySelector(m.targetSelector) : null;
                    if (!target && inter.triggerSelector) {
                      const trig = doc.querySelector(inter.triggerSelector);
                      if (trig && trig.parentElement) target = trig.parentElement;
                    }
                    if (target) {
                      target.appendChild(node);
                    } else if (doc.body.firstElementChild) {
                      doc.body.firstElementChild.appendChild(node);
                    }
                  }
                }
              }
            });
          }
        });
        if (doc.body.innerHTML) {
          finalSectionHtml = doc.body.innerHTML;
        }
      } catch (e) {
        console.warn('[replicator] Failed to inject recorded nodes into sectionHtml:', e);
      }
    }

    if (progressStepEl) progressStepEl.textContent = 'Extracting styles & synthesizing code...';

    // Harvest page client stylesheets in strict document cascade order
    const sheets = [];
    const sheetEntries = [];
    const fetchedHrefs = new Set();

    try {
      const allStyleSheets = Array.from(document.styleSheets);
      for (let i = 0; i < allStyleSheets.length; i++) {
        const sheet = allStyleSheets[i];
        let css = '';
        try {
          if (sheet.cssRules && sheet.cssRules.length > 0) {
            for (let j = 0; j < sheet.cssRules.length; j++) {
              css += sheet.cssRules[j].cssText + '\n';
            }
          }
        } catch {
          // Cross-origin CSS rule security restriction
        }

        if (css.trim()) {
          sheetEntries.push({ index: i, css });
        } else if (sheet.href && !sheet.href.startsWith('chrome-extension://')) {
          const href = sheet.href;
          fetchedHrefs.add(href);
          sheetEntries.push({
            index: i,
            href,
            promise: fetch(href, { cache: 'force-cache' })
              .then((r) => (r.ok ? r.text() : ''))
              .catch(() => '')
          });
        }
      }

      // Also ensure any <link rel="stylesheet"> in document is represented in document order
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      for (const link of links) {
        const href = link.href;
        if (href && !href.startsWith('chrome-extension://') && !fetchedHrefs.has(href)) {
          fetchedHrefs.add(href);
          sheetEntries.push({
            index: sheetEntries.length,
            href,
            promise: fetch(href, { cache: 'force-cache' })
              .then((r) => (r.ok ? r.text() : ''))
              .catch(() => '')
          });
        }
      }

      // Resolve external stylesheets in parallel while preserving exact document cascade order
      const pending = sheetEntries.filter((e) => e.promise);
      if (pending.length > 0) {
        await Promise.race([
          Promise.allSettled(
            pending.map(async (e) => {
              try {
                e.css = await e.promise;
              } catch {
                e.css = '';
              }
            })
          ),
          new Promise((r) => setTimeout(r, 4000))
        ]);
      }

      for (const entry of sheetEntries) {
        if (entry.css && entry.css.trim()) {
          sheets.push(entry.css);
        }
      }
    } catch {}

    chrome.runtime.sendMessage(
      {
        action: 'START_EXTRACTION',
        payload: {
          url: window.location.href,
          options: {
            sectionSelector: data.selector,
            sectionHtml: finalSectionHtml,
            targetArchetype: data.archetype,
            clientStylesheets: sheets,
            stylesheetUrls: Array.from(fetchedHrefs),
            htmlSnapshot: document.documentElement.outerHTML,
            recordedInteractions: recordedInteractions,
            tabsData: window.__capturedTabsData || [],
            rootCssVariables: harvestRootCssVariables(),
            pageTheme: document.body?.classList.contains('theme-dark') || document.documentElement?.classList.contains('theme-dark') ? 'dark' : 'light',
            localizeAssets: true,
            purgeCss: true,
            renameClasses: true,
          },
        },
      },
      (res) => {
        if (isCancelled) return;

          if (res && res.success && res.jobId) {
            const jobId = res.jobId;
            let pollAttempts = 0;
            const maxPolls = 480; // Up to 8 minutes for complex multi-asset enterprise pages

            const pollTimer = setInterval(async () => {
              if (isCancelled) {
                clearInterval(pollTimer);
                return;
              }

              pollAttempts++;
              if (pollAttempts > maxPolls) {
                clearInterval(pollTimer);
                showError('Replication timed out. Please check server status.');
                return;
              }

              try {
                // Check background activeJob state
                chrome.runtime.sendMessage({ action: 'POLL_STATUS' }, async (statusRes) => {
                  let job = statusRes?.activeJob;
                  if (!job || job.id !== jobId) {
                    // Direct backend poll fallback
                    try {
                      const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
                      const baseUrl = (apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '');
                      const directResp = await fetch(`${baseUrl}/api/jobs/${jobId}`);
                      if (directResp.ok) {
                        const directData = await directResp.json();
                        job = {
                          id: jobId,
                          status: directData.status,
                          progress: directData.progress,
                          currentStep: directData.currentStep,
                          previewUrl: `${baseUrl}/api/jobs/${jobId}/preview`,
                          downloadUrl: `${baseUrl}/api/jobs/${jobId}/download`,
                          error: directData.error,
                        };
                      }
                    } catch {}
                  }
                  if (!job || job.id !== jobId) return;

                  const stepEl = document.getElementById('__replicator_progress_step__');
                  const fillEl = document.getElementById('__replicator_progress_fill__');
                  const numEl = document.getElementById('__replicator_progress_num__');

                  if (job.status === 'processing' || job.status === 'queued') {
                    const pct = Math.max(15, Math.min(95, job.progress || (pollAttempts * 10)));
                    if (stepEl && job.currentStep) stepEl.textContent = job.currentStep;
                    if (fillEl) fillEl.style.width = `${pct}%`;
                    if (numEl) numEl.textContent = `${pct}%`;
                  } else if (job.status === 'completed') {
                    clearInterval(pollTimer);
                    overlay.remove(); // Remove green selection box for pristine view

                    const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
                    const baseUrl = (apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '');
                    const previewUrl = job.previewUrl || `${baseUrl}/api/jobs/${jobId}/preview`;
                    const downloadUrl = job.downloadUrl || `${baseUrl}/api/jobs/${jobId}/download`;

                    bar.innerHTML = `
                      <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:22px;color:#10b981;">✓</span>
                        <div>
                          <div style="font-weight:700;font-size:13px;color:#ffffff;">${data.archetypeName} Replicated Successfully!</div>
                          <div style="font-size:11px;color:#a7f3d0;">Quality Score: 100% &bull; Standalone Clean Package</div>
                        </div>
                      </div>
                      <div style="display:flex;align-items:center;gap:8px;">
                        <a id="__replicator_live_btn__" href="${previewUrl}" target="_blank" style="background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;padding:7px 14px;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(37,99,235,0.4);">
                          👁️ Open Live Preview
                        </a>
                        <a id="__replicator_zip_btn__" href="${downloadUrl}" target="_blank" style="background:#10b981;color:#ffffff;text-decoration:none;border-radius:6px;padding:7px 14px;font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(16,185,129,0.4);">
                          📦 Download ZIP
                        </a>
                        <button id="__replicator_finish_btn__" style="background:rgba(255,255,255,0.12);color:#ffffff;border:none;border-radius:6px;padding:7px 10px;font-size:12px;cursor:pointer;" title="Close toolbar">
                          ✕
                        </button>
                      </div>
                    `;

                    document.getElementById('__replicator_finish_btn__')?.addEventListener('click', cleanup);

                    // Auto-open live preview tab immediately
                    try {
                      window.open(previewUrl, '_blank');
                    } catch {}
                  } else if (job.status === 'failed') {
                    clearInterval(pollTimer);
                    showError(job.error || 'Replication failed. Please try again.');
                  }
                });
              } catch (e) {
                console.warn('In-page poll error:', e);
              }
            }, 1000);
          } else {
            showError(res?.error || 'Replication failed to start. Check token balance.');
          }
        }
      );
    }

    function showError(msg) {
      bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;color:#fca5a5;">
          <span>⚠️ <strong>Error:</strong> ${msg}</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="__replicator_retry_btn__" style="background:#2563eb;color:#fff;border:none;border-radius:4px;padding:5px 12px;font-weight:600;font-size:12px;cursor:pointer;">Retry</button>
          <button id="__replicator_close_err_btn__" style="background:#ef4444;color:#fff;border:none;border-radius:4px;padding:5px 10px;font-weight:600;font-size:12px;cursor:pointer;">Close</button>
        </div>
      `;
      document.getElementById('__replicator_retry_btn__')?.addEventListener('click', initiateReplication);
      document.getElementById('__replicator_close_err_btn__')?.addEventListener('click', cleanup);
    }

    // Handle "Replicate Section Now" click
    const startBtn = document.getElementById('__replicator_start_btn__');
    startBtn?.addEventListener('click', initiateReplication);

    // Handle Reselect
    const reselectBtn = document.getElementById('__replicator_reselect_btn__');
    reselectBtn?.addEventListener('click', () => {
      isSectionConfirmed = false;
      overlay.style.border = '2px solid #2563eb';
      overlay.style.background = 'rgba(37, 99, 235, 0.12)';
      overlay.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.8), 0 8px 24px rgba(37, 99, 235, 0.25)';
      badge.style.background = '#1d4ed8';
      window.addEventListener('mousemove', onMouseMove, true);

      bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">🎯</span>
          <strong>Select Section:</strong>
          <span>Hover to highlight. Press <kbd style="background:#334155;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">↑</kbd> to expand to parent, <kbd style="background:#334155;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">↓</kbd> to shrink, <kbd style="background:#334155;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">ESC</kbd> to cancel.</span>
        </div>
        <button id="__replicator_cancel_btn__" style="background:#ef4444;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-weight:600;font-size:12px;cursor:pointer;">Cancel</button>
      `;
    });
  }

  // Key Down Listener (ESC to cancel, Up/Down to navigate DOM hierarchy)
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ action: 'SECTION_PICKER_CANCELLED' });
      return;
    }
    if (e.key === 'ArrowUp' && currentTarget && currentTarget.parentElement && currentTarget.parentElement !== document.body && currentTarget.parentElement !== document.documentElement) {
      e.preventDefault();
      currentTarget = currentTarget.parentElement;
      updateOverlay(currentTarget);
      return;
    }
    if (e.key === 'ArrowDown' && currentTarget && currentTarget.children && currentTarget.children.length > 0) {
      e.preventDefault();
      const child = Array.from(currentTarget.children).find((c) => c.getBoundingClientRect().height > 50) || currentTarget.firstElementChild;
      if (child) {
        currentTarget = child;
        updateOverlay(currentTarget);
      }
      return;
    }
  }

  function cleanup() {
    if (removeNavShield) {
      try { removeNavShield(); } catch {}
    }
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKeyDown, true);
    bar.remove();
    overlay.remove();
    delete window.__REPLICATOR_PICKER_ACTIVE__;
    delete window.__replicator_cleanup;
  }

  window.__replicator_cleanup = cleanup;

  // Attach Listeners
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('keydown', onKeyDown, true);
})();
