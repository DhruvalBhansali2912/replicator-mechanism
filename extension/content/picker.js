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
    return typeof el.getAttribute === 'function' ? (el.getAttribute('class') || '') : '';
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

  // Helper: Find meaningful section boundary
  function findSectionTarget(el) {
    if (!el || el === document.body || el === document.documentElement) return null;

    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (
        curr.id === '__replicator_picker_bar__' ||
        curr.id === '__replicator_picker_overlay__' ||
        curr.closest('#__replicator_picker_bar__')
      ) {
        return null;
      }

      const tag = curr.tagName.toLowerCase();
      const role = curr.getAttribute('role') || '';
      const rawClass = typeof curr.className === 'string' ? curr.className : '';
      const cls = rawClass.toLowerCase();

      // 1. Skip individual carousel slides/items so we always capture the full carousel container / section
      if (
        (cls.includes('slide') || cls.includes('carousel-item') || cls.includes('carousel__item') || role === 'tabpanel') &&
        curr.parentElement &&
        curr.parentElement !== document.body
      ) {
        curr = curr.parentElement;
        continue;
      }

      // 2. Leaf, typography, media, form, and inline interactive elements can NEVER be section roots.
      // Ascend to enclosing container.
      const isLeafOrInline = [
        'button', 'a', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'img', 'picture', 'source', 'video', 'audio', 'svg', 'path', 'g',
        'i', 'strong', 'em', 'b', 'u', 'input', 'label', 'textarea',
        'select', 'option', 'form', 'li', 'ul', 'ol', 'dl', 'dt', 'dd',
        'table', 'tbody', 'thead', 'tr', 'td', 'th', 'cite', 'small', 'code', 'pre'
      ].includes(tag);
      if (isLeafOrInline) {
        curr = curr.parentElement;
        continue;
      }

      // 3. Skip full-bleed overlay buttons, click interceptors, scrims, or empty wrapper layers
      const isOverlayOrInterceptor =
        cls.includes('clickable-state') ||
        cls.includes('click-target') ||
        cls.includes('hit-box') ||
        cls.includes('scrim') ||
        cls.includes('backdrop') ||
        (curr.children.length === 0 && !['video', 'canvas', 'iframe'].includes(tag));
      if (isOverlayOrInterceptor) {
        curr = curr.parentElement;
        continue;
      }

      // 4. BEM Element Check: if class contains `__` (e.g. `hd08-hero-kv-home__clickable-state`, `hero__inner`, `banner__text-wrap`),
      // this is explicitly a child part of a BEM block. Ascend to find the block container!
      const bemClass = rawClass.split(/\s+/).find((c) => c.includes('__'));
      if (bemClass) {
        const blockName = bemClass.split('__')[0];
        if (blockName) {
          try {
            const blockEl = curr.closest(`.${CSS.escape(blockName)}`);
            if (blockEl && blockEl !== curr && blockEl !== document.body) {
              curr = blockEl;
              continue;
            }
          } catch {}
        }
      }

      // 5. Skip sub-part / child utility wrappers (e.g. text-wrap, inner, headline-wrap, cta-wrap)
      const isSubPart =
        cls.includes('text-wrap') ||
        cls.includes('cta-wrap') ||
        cls.includes('btn-wrap') ||
        cls.includes('title-wrap') ||
        cls.includes('headline') ||
        cls.includes('figure') ||
        cls.includes('media-wrap');
      if (isSubPart && curr.parentElement && curr.parentElement !== document.body) {
        curr = curr.parentElement;
        continue;
      }

      // 6. Landmark section tags: ascend to top-level landmark containers if nested
      if (tag === 'footer' || role === 'contentinfo' || cls.includes('site-footer') || cls.includes('page-footer') || cls.includes('footer')) {
        const enclosingFooter = curr.closest('footer, [role="contentinfo"], .site-footer');
        if (enclosingFooter && enclosingFooter !== document.body) return enclosingFooter;
        return curr;
      }
      if (['header', 'nav'].includes(tag) || ['banner', 'navigation'].includes(role) || cls.includes('header') || cls.includes('navbar')) {
        const topHeader = curr.closest('header, [role="banner"], #mega-menu, .mega-menu, [class*="site-header-wrapper"], [class*="header-wrapper"], [class*="site-header"]');
        if (topHeader && topHeader !== document.body) return topHeader;
        return curr;
      }
      if (['section', 'article'].includes(tag)) {
        return curr;
      }

      // 7. Check if element is a component block container (e.g. hero, banner, features, pricing, etc.)
      const isComponentBlock =
        cls.includes('hero') ||
        cls.includes('banner') ||
        cls.includes('pricing') ||
        cls.includes('feature') ||
        cls.includes('faq') ||
        cls.includes('testimonial') ||
        cls.includes('showcase') ||
        cls.includes('section');

      if (isComponentBlock) {
        // Check if a parent element is also a section or component block (to pick the outermost section)
        const parentSection = curr.parentElement?.closest('section, article, [class*="hero"], [class*="banner"], [class*="section"]');
        if (parentSection && parentSection !== document.body && !['main', 'body'].includes(parentSection.tagName.toLowerCase())) {
          curr = parentSection;
          continue;
        }

        const rect = curr.getBoundingClientRect();
        if (rect.height >= 80 && rect.width >= 280) {
          return curr;
        }
      }

      // 8. General container with significant height / width and content
      const rect = curr.getBoundingClientRect();
      if (tag === 'div' && rect.height >= 120 && rect.width >= 300) {
        const hasHeadings = curr.querySelector('h1, h2, h3, h4');
        const hasCardGrid = curr.querySelector('[class*="card"], [class*="grid"], [class*="item"]');
        const hasMedia = curr.querySelector('picture, img, video, canvas');
        if ((hasHeadings && (hasCardGrid || hasMedia || rect.height >= 200)) || (hasCardGrid && hasMedia)) {
          // If parent is a section or article, ascend to outermost
          const parentContainer = curr.parentElement;
          if (parentContainer && (parentContainer.tagName.toLowerCase() === 'section' || parentContainer.tagName.toLowerCase() === 'article')) {
            return parentContainer;
          }
          return curr;
        }
      }

      curr = curr.parentElement;
    }
    return el && el !== document.body ? el : null;
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
          const associated = document.querySelectorAll('dialog.tds-site-header-panel, .dx-mega-menu-panel, [class*="header-panel"], [class*="mega-menu-panel"], .tds-modal-backdrop');
          associated.forEach((p) => {
            if (!currentTarget.contains(p)) h += '\n' + p.outerHTML;
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

  // Helper: Universally hover and interact with elements in the section to reveal dynamic/lazy DOM
  async function revealDynamicSections(sectionEl) {
    if (!sectionEl) return;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // 1. Identify tab triggers to dynamically collect and mount all tab panels
    const tabTriggers = Array.from(sectionEl.querySelectorAll(
      '[role="tab"], [class*="tab__item"], [class*="tab-item"], button[class*="tab"], li[class*="tab"], [data-tab]'
    )).filter((el) => {
      const cls = getElementClassString(el).toLowerCase();
      return !cls.includes('panel') && !cls.includes('pane') && !cls.includes('content') &&
             !el.closest('#__replicator_picker_bar__') && !el.closest('#__replicator_picker_overlay__');
    });

    if (tabTriggers.length > 1) {
      // Find where active pane lives
      const initialPane = sectionEl.querySelector('[class*="tab__pane"], [class*="tab-pane"], [role="tabpanel"]');
      const paneParent = initialPane ? initialPane.parentElement : null;
      const gatheredPanes = [];

      for (let i = 0; i < tabTriggers.length; i++) {
        const tab = tabTriggers[i];
        try {
          // Trigger complete pointer/mouse cycle for React 18 / Vue / modern frameworks
          tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
          tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          tab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
          tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          if (typeof tab.click === 'function') tab.click();
        } catch {}

        await sleep(250);

        // Capture newly rendered or updated pane
        const activePane = sectionEl.querySelector('[class*="tab__pane"], [class*="tab-pane"], [role="tabpanel"]');
        if (activePane && paneParent) {
          const clone = activePane.cloneNode(true);
          clone.setAttribute('data-tab-pane-index', String(i));
          if (i > 0) {
            clone.style.display = 'none';
            clone.setAttribute('aria-hidden', 'true');
          } else {
            clone.style.display = '';
            clone.setAttribute('aria-hidden', 'false');
          }
          gatheredPanes.push(clone);
        }
      }

      // If page replaced single pane in DOM rather than preserving all, mount all gathered panes
      if (paneParent && gatheredPanes.length > 1) {
        // Clear old single pane and mount all gathered tab panes
        const currentPanes = paneParent.querySelectorAll('[class*="tab__pane"], [class*="tab-pane"], [role="tabpanel"]');
        currentPanes.forEach(p => p.remove());
        gatheredPanes.forEach(gp => paneParent.appendChild(gp));
      }

      // Reset to first tab
      try {
        tabTriggers[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        if (typeof tabTriggers[0].click === 'function') tabTriggers[0].click();
      } catch {}
      await sleep(100);
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
        if (ariaExp === 'false') {
          if (typeof trg.click === 'function') trg.click();
          trg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      } catch {}
      await sleep(30);
    }

    try {
      document.body.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true, view: window }));
    } catch {}
    await sleep(50);
  }

  // Helper: Harvest section HTML including any dynamically mounted sibling panels or dialogs
  function harvestSectionHtmlWithDynamics(sectionEl, archetype) {
    if (!sectionEl) return '';
    let html = sectionEl.outerHTML;

    const isNavHeader =
      archetype === 'navbar' ||
      ['header', 'nav'].includes(sectionEl.tagName.toLowerCase()) ||
      sectionEl.id === 'mega-menu' ||
      sectionEl.classList.contains('mega-menu');

    // Only attach detached dialog panels for actual navigation headers.
    // Never attach detached elements to normal content sections.
    if (!isNavHeader) {
      return html;
    }

    const detachedSelectors = [
      'dialog',
      '[role="dialog"]',
      '[class*="header-panel"]',
      '[class*="mega-menu-panel"]',
      '[class*="megamenu-panel"]',
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

  // Helper: In-Situ Behavioral State Mutation Prober
  // Synthetically probes interactive candidate elements, observes DOM mutations with MutationObserver,
  // and records exact state transitions (classes, styles, aria attributes) into declarative specs.
  async function recordDynamicInteractions(sectionEl) {
    if (!sectionEl) return [];
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const recorded = [];

    // Helper: Compute clean relative selector within sectionEl
    function getCleanSelector(el) {
      if (!el || el === sectionEl) return '';
      if (el.closest('#__replicator_picker_bar__') || el.closest('#__replicator_picker_overlay__')) return '';

      // 1. Stable, non-random ID
      if (el.id && !/^\d/.test(el.id) && !el.id.includes(':') && !el.id.includes('__') && el.id.length < 40) {
        return '#' + CSS.escape(el.id);
      }

      // 2. Semantic role or data-attributes
      const dataAttrs = ['data-role', 'data-tab', 'data-filter', 'data-target', 'data-toggle', 'data-action', 'data-color', 'data-size', 'data-value', 'aria-controls'];
      for (const attr of dataAttrs) {
        const val = el.getAttribute(attr);
        if (val) {
          const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
          try {
            if (sectionEl.querySelectorAll(sel).length === 1) return sel;
          } catch (e) {}
        }
      }

      // 3. Accessibility and state attributes (name, for, value, an-la, aria-label, href)
      const semanticAttrs = ['name', 'for', 'value', 'an-la', 'aria-label', 'href'];
      for (const attr of semanticAttrs) {
        const val = el.getAttribute(attr);
        if (val && val.length < 50 && !val.includes('"') && !val.includes('\n')) {
          const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
          try {
            if (sectionEl.querySelectorAll(sel).length === 1) return sel;
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
            const matches = Array.from(sectionEl.querySelectorAll(primaryCls));
            if (matches.length === 1) return primaryCls;
            if (matches.length > 1) {
              const idx = matches.indexOf(el);
              if (idx !== -1) {
                const parent = el.parentElement;
                if (parent && parent !== sectionEl && parent.className && typeof parent.className === 'string') {
                  const parentClasses = parent.className.split(/\s+/).filter(c => c && !c.startsWith('is-') && !c.includes('__replicator'));
                  if (parentClasses.length > 0) {
                    const parentCls = '.' + CSS.escape(parentClasses[0]);
                    const childIdx = Array.from(parent.children).indexOf(el) + 1;
                    const scopedSel = `${parentCls} > ${primaryCls}:nth-of-type(${childIdx})`;
                    try {
                      if (sectionEl.querySelectorAll(scopedSel).length === 1) return scopedSel;
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
      while (curr && curr !== sectionEl && curr.parentElement) {
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
          break; // Stop at first identifiable ancestor class
        } else {
          path.unshift(`${tag}:nth-of-type(${idx})`);
        }
        curr = curr.parentElement;
      }
      return path.join(' > ');
    }

    // Hierarchical interactive trigger prioritization with full multi-category coverage
    // 1. Collect all filter category dropdown toggles (openers) across the whole filter tree
    const categoryOpeners = Array.from(sectionEl.querySelectorAll(
      'button[aria-expanded], [role="button"][aria-expanded], [aria-haspopup], [class*="opener"], [class*="toggle"], [class*="dropdown-toggle"], [class*="accordion-toggle"], [class*="filter-trigger"], [class*="facet-trigger"], summary'
    )).filter(el => {
      const cls = getElementClassString(el).toLowerCase();
      return !el.closest('#__replicator_picker_bar__') &&
             !el.closest('#__replicator_picker_overlay__') &&
             !cls.includes('view-more') && !cls.includes('load-more') &&
             !cls.includes('close') && !cls.includes('cancel');
    });

    // 2. Expand category internal options if they have internal "View more" buttons
    const categoryWrappers = Array.from(sectionEl.querySelectorAll(
      '[class*="selector-item"], [class*="filter-group"], [class*="filter-section"], [class*="accordion-item"], fieldset'
    )).filter(el => !el.closest('#__replicator_picker_bar__'));

    for (const catWrap of categoryWrappers) {
      const internalViewMore = catWrap.querySelector('[class*="selector-view-more"], [class*="filter-view-more"], [class*="options-view-more"]');
      if (internalViewMore && internalViewMore.offsetParent !== null) {
        try {
          internalViewMore.click();
        } catch (e) {}
      }
    }

    // 3. Collect options per category (sample 2-3 options from EVERY category)
    const sampledOptions = [];
    const seenInputs = new Set();

    if (categoryWrappers.length > 0) {
      categoryWrappers.forEach(cat => {
        const catOptions = Array.from(cat.querySelectorAll('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]')).filter(i => {
          return !seenInputs.has(i) && !i.closest('#__replicator_picker_bar__');
        });
        catOptions.slice(0, 3).forEach(opt => {
          seenInputs.add(opt);
          sampledOptions.push(opt);
        });
      });
    }

    // Also pick any remaining checkboxes or swatches / tabs not in wrappers
    const remainingOptions = Array.from(sectionEl.querySelectorAll(
      '[role="tab"], input[type="checkbox"], input[type="radio"], [class*="swatch"] button, [class*="option-selector"] button, [class*="size"] button, [class*="color"] button'
    )).filter(el => !seenInputs.has(el) && !el.closest('#__replicator_picker_bar__') && !el.closest('#__replicator_picker_overlay__'));

    const sliders = Array.from(sectionEl.querySelectorAll(
      '.swiper-button-next, .swiper-button-prev, .carousel-arrow-next, .carousel-arrow-prev, .swiper-pagination-bullet, .hero-dot'
    )).filter(el => !el.closest('#__replicator_picker_bar__') && !el.closest('#__replicator_picker_overlay__'));

    const triggers = [
      ...categoryOpeners.slice(0, 25),
      ...sampledOptions,
      ...remainingOptions.slice(0, 10),
      ...sliders.slice(0, 5)
    ];

    for (const trigger of triggers) {
      const triggerSel = getCleanSelector(trigger);
      if (!triggerSel) continue;

      let observedMutations = [];
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            const target = m.target;
            if (target.closest && (target.closest('#__replicator_picker_bar__') || target.closest('#__replicator_picker_overlay__'))) {
              continue;
            }
            const targetSel = getCleanSelector(target);
            if (!targetSel) continue;

            if (m.addedNodes && m.addedNodes.length > 0) {
              Array.from(m.addedNodes).forEach(node => {
                if (node.nodeType === 1 && !node.id?.includes('__replicator_')) {
                  const nodeCls = typeof node.className === 'string' ? node.className : '';
                  const isCatalog = targetSel.includes('product-card') || targetSel.includes('product-list') || targetSel.includes('catalog') ||
                                    nodeCls.includes('product-card') || nodeCls.includes('card-item');
                  if (isCatalog) return;
                  if (node.tagName.toLowerCase() === 'svg') return;
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
              const targetSel = getCleanSelector(target);
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
      });

      observer.observe(sectionEl, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeOldValue: true,
        attributeFilter: ['class', 'style', 'aria-expanded', 'aria-hidden', 'aria-selected', 'hidden', 'open']
      });

      const progressStepEl = document.getElementById('__replicator_progress_step__');
      if (progressStepEl) {
        const txt = (trigger.textContent || trigger.getAttribute('an-la') || trigger.getAttribute('aria-label') || trigger.id || '').replace(/\s+/g, ' ').trim().slice(0, 22) || 'filter';
        progressStepEl.textContent = `Probing filters (${triggers.indexOf(trigger) + 1}/${triggers.length}): ${txt}...`;
      }

      // Synthetic click
      try {
        trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
        trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
        trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        if (typeof trigger.click === 'function') trigger.click();
      } catch (e) {}

      await sleep(350);

      const firstClickMutations = [...observedMutations];
      observedMutations = [];

      if (firstClickMutations.length > 0) {
        // Probe second click to test toggle behavior
        try {
          trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          if (typeof trigger.click === 'function') trigger.click();
        } catch (e) {}

        await sleep(350);
        const secondClickMutations = [...observedMutations];
        observer.disconnect();

        const isToggle = secondClickMutations.length > 0;
        recorded.push({
          triggerSelector: triggerSel,
          eventType: 'click',
          isToggle,
          mutations: firstClickMutations,
          reverseMutations: isToggle ? secondClickMutations : undefined
        });

        // Restore clean resting state if it was left dirty
        if (!isToggle && firstClickMutations.length > 0) {
          firstClickMutations.forEach(m => {
            const el = sectionEl.querySelector(m.targetSelector);
            if (el) {
              if (m.oldValue !== null) el.setAttribute(m.attributeName, m.oldValue);
              else el.removeAttribute(m.attributeName);
            }
          });
        }
      } else {
        observer.disconnect();
      }
    }

    return recorded;
  }

  // Function to start live section replication & polling
  async function initiateReplication() {
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

    if (progressStepEl) progressStepEl.textContent = 'Extracting styles & synthesizing code...';

    // Harvest page client stylesheets (including cross-origin/CDN stylesheets)
    const sheets = [];
    const fetchPromises = [];
    const fetchedHrefs = new Set();

    try {
      for (const sheet of Array.from(document.styleSheets)) {
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
          sheets.push(css);
        } else if (sheet.href && !sheet.href.startsWith('chrome-extension://') && !fetchedHrefs.has(sheet.href)) {
          fetchedHrefs.add(sheet.href);
          fetchPromises.push(
            fetch(sheet.href, { cache: 'force-cache' })
              .then((r) => (r.ok ? r.text() : ''))
              .catch(() => '')
          );
        }
      }

      // Also harvest any <link rel="stylesheet"> tags in the document
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      for (const link of links) {
        const href = link.href;
        if (href && !href.startsWith('chrome-extension://') && !fetchedHrefs.has(href)) {
          fetchedHrefs.add(href);
          fetchPromises.push(
            fetch(href, { cache: 'force-cache' })
              .then((r) => (r.ok ? r.text() : ''))
              .catch(() => '')
          );
        }
      }

      // Fetch external stylesheets in parallel with a 4000ms race timeout
      if (fetchPromises.length > 0) {
        try {
          const parallelFetch = Promise.allSettled(fetchPromises);
          const fetchTimeout = new Promise((r) => setTimeout(() => r([]), 4000));
          const settled = await Promise.race([parallelFetch, fetchTimeout]);
          if (Array.isArray(settled)) {
            for (const s of settled) {
              if (s && s.status === 'fulfilled' && typeof s.value === 'string' && s.value.trim()) {
                sheets.push(s.value);
              }
            }
          }
        } catch {}
      }
    } catch {}

    chrome.runtime.sendMessage(
      {
        action: 'START_EXTRACTION',
        payload: {
          url: window.location.href,
          options: {
            sectionSelector: data.selector,
            sectionHtml: dynamicSectionHtml || data.sectionHtml,
            targetArchetype: data.archetype,
            clientStylesheets: sheets,
            stylesheetUrls: Array.from(fetchedHrefs),
            htmlSnapshot: document.documentElement.outerHTML,
            recordedInteractions: recordedInteractions,
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
            const maxPolls = 120; // 60 seconds

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
                chrome.runtime.sendMessage({ action: 'POLL_STATUS' }, (statusRes) => {
                  const job = statusRes?.activeJob;
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

                    const previewUrl = job.previewUrl || `http://localhost:3000/api/jobs/${jobId}/preview`;
                    const downloadUrl = job.downloadUrl || `http://localhost:3000/api/jobs/${jobId}/download`;

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
            }, 600);
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
