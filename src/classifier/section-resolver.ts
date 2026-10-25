import * as cheerio from 'cheerio';

/**
 * Universally resolves the target section container from an HTML snapshot or Cheerio tree.
 * Strictly applies zero-hardcoding heuristics based on semantic tags, layout hierarchy,
 * content prominence, and interactive indicators.
 */
export function resolveTargetSectionFromSnapshot(
  snapshotOrHtml: cheerio.CheerioAPI | string,
  targetArchetype?: string,
  sectionSelector?: string
): cheerio.Cheerio<any> | null {
  if (!snapshotOrHtml) return null;
  const $snap: cheerio.CheerioAPI = typeof snapshotOrHtml === 'string'
    ? cheerio.load(snapshotOrHtml)
    : snapshotOrHtml;

  // 1. If an explicit sectionSelector is provided and is not a generic tag
  if (sectionSelector && sectionSelector.trim() && sectionSelector !== 'section' && sectionSelector !== 'div') {
    try {
      const explicit = $snap(sectionSelector).not('html, body');
      if (explicit.length > 0) {
        const first = explicit.first();
        const tag = (first.get(0) as any)?.tagName?.toLowerCase() || '';

        // If the element is an explicit semantic header/footer/nav landmark:
        if (tag === 'header' || tag === 'footer' || tag === 'nav' || first.attr('role') === 'banner' || first.attr('role') === 'contentinfo') {
          // Ascend to 1:1 dedicated component wrappers before reaching body/main
          // (e.g. <div class="visitor-nav-v2-holder"><div class="ma-scope_visitor-v2"><div class="nav-v2"><header>...)
          let componentRoot = first;
          let p = first.parent();
          while (p && p.length > 0) {
            const pEl = p.get(0);
            const pTag = (pEl?.tagName || '').toLowerCase();
            const pCls = (p.attr('class') || '').toLowerCase();
            const pId = (p.attr('id') || '').toLowerCase();
            if (['html', 'body', 'main', 'article', 'section'].includes(pTag)) break;
            if (pCls.includes('page-wrapper') || pCls.includes('layout-wrapper') || pCls.includes('site-wrapper')) break;

            const nonScriptChildren = p.children().not('script, style, noscript');
            const isDedicatedWrapper = nonScriptChildren.length <= 2 &&
              (pCls.includes('nav') || pCls.includes('header') || pCls.includes('scope') || pCls.includes('holder') || pId.includes('nav') || pId.includes('header') || pCls.includes('bar'));

            if (isDedicatedWrapper) {
              componentRoot = p;
              p = p.parent();
            } else {
              break;
            }
          }
          return componentRoot;
        }

        const isLeafTag = ['button', 'a', 'span', 'p', 'img', 'svg', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'input', 'li', 'label', 'strong', 'em', 'small', 'b', 'i'].includes(tag);
        const innerHtmlLen = (first.html() || '').length;

        // If first is an explicit semantic section or article, preserve it directly!
        if (tag === 'section' || tag === 'article') {
          return first;
        }

        // If first is nested inside an actual semantic <section> or <article> on the page,
        // ascend to that enclosing section so headings, tabs, and companion controls are never truncated!
        const enclosingSection = first.closest('section, article');
        if (enclosingSection.length > 0) {
          const secTag = (enclosingSection.get(0) as any)?.tagName?.toLowerCase() || '';
          const secId = (enclosingSection.attr('id') || '').toLowerCase();
          const secCls = (enclosingSection.attr('class') || '').toLowerCase();
          const isSecShell = secTag === 'body' || secTag === 'main' ||
            ['root', 'app', '__next', '__nuxt', 'content', 'main'].includes(secId) ||
            secCls.includes('page-wrapper') || secCls.includes('main-wrapper') || secCls.includes('site-wrapper');
          if (!isSecShell) {
            return enclosingSection;
          }
        }

        // If user targeted a subnav/link inside a header container, ascend to the enclosing header container
        if (targetArchetype === 'navbar' || first.is('nav, [class*="nav"], [role="navigation"]')) {
          const headerAncestors = first.parents('header, [role="banner"], [class*="Header"], [class*="site-header"], [class*="header"], [class*="navbar"]').filter((_, el) => {
            const t = el.tagName.toLowerCase();
            const c = ($snap(el).attr('class') || '').toLowerCase();
            if (t === 'body' || t === 'html' || t === 'main') return false;
            if (c.includes('page-wrapper') || c.includes('layout-wrapper') || c.includes('shell') || c.includes('article') || c.includes('dialog')) return false;
            return true;
          });
          if (headerAncestors.length > 0) {
            return $snap(headerAncestors.last());
          }
        }

        // If user specifically targeted a standalone container/widget not inside a section tag, preserve it
        if (!isLeafTag && (first.children().length > 1 || innerHtmlLen > 200)) {
          return first;
        }

        // Universal section ancestor resolution for leaf/micro nodes:
        // Ascend to the NEAREST (closest) enclosing section/container, never the outermost page wrapper!
        const sectionSel = 'section, article, header, footer, [role="region"], [role="banner"], [role="contentinfo"], [class*="section"], [class*="hero"], [class*="banner"], [class*="slider"], [class*="carousel"], [class*="feature"], [class*="Header"], [class*="header"], [class*="navbar"], [id*="section"], [id*="hero"], [id*="banner"], [id*="feature"], [id*="header"], [id*="Header"], [data-rep-section]';

        const ancestors = first.parents(sectionSel).filter((_, el) => {
          const t = el.tagName.toLowerCase();
          const i = ($snap(el).attr('id') || '').toLowerCase();
          const c = ($snap(el).attr('class') || '').toLowerCase();
          if (t === 'body' || t === 'html' || t === 'main') return false;
          if (i === 'root' || i === '__next' || i === 'app' || i === '__nuxt' || i === 'content' || i === 'main') return false;
          if (
            c.includes('page-wrapper') ||
            c.includes('main-wrapper') ||
            c.includes('layout-wrapper') ||
            c.includes('section-wrap') ||
            c.includes('all-sections') ||
            c.includes('site-main') ||
            c.includes('page-content') ||
            c.includes('entry-content') ||
            c.includes('site-content') ||
            c.includes('content-area') ||
            c.includes('columns') ||
            c.includes('app-container')
          ) return false;
          return true;
        });

        if (ancestors.length > 0) {
          // Nearest enclosing section container is the first in cheerio parents() array
          return $snap(ancestors.first());
        }

        // If matched element is an inline/leaf node and had no explicit section ancestor, ascend to nearest container
        if (isLeafTag) {
          const enc = first.closest('div, section, article');
          if (enc.length > 0) return enc;
        }

        return first;
      }
    } catch {}
  }

  const isNav = targetArchetype === 'navbar';
  const isHero = targetArchetype === 'hero';

  // 2. Navigation Header Resolution
  if (isNav) {
    const navCandidates = $snap(
      'header, [role="banner"], [class*="location-header"], [class*="site-header"], [class*="header-top"], [class*="header-wrapper"], [class*="header_wrapper"], [class*="navbar"], nav:not(header nav):not(footer nav), [role="navigation"]:not(header [role="navigation"])'
    );
    let bestNav: cheerio.Cheerio<any> | null = null;
    let bestNavScore = -1;

    navCandidates.each((_, el) => {
      const $el = $snap(el);
      const tag = el.tagName.toLowerCase();
      const cls = ($el.attr('class') || '').toLowerCase();
      const style = ($el.attr('style') || '').toLowerCase();

      // Reject hidden headers
      if (
        style.includes('display: none') ||
        style.includes('display:none') ||
        style.includes('visibility: hidden') ||
        cls.includes('hidden') ||
        cls.includes('d-none')
      ) {
        return;
      }

      let score = 10;
      if (tag === 'header') score += 25;
      if ($el.attr('role') === 'banner') score += 20;
      if (cls.includes('header')) score += 30;
      if (cls.includes('nav')) score += 15;
      if ($el.find('a, button').length >= 1) score += 20;
      if ($el.find('img, svg').length > 0) score += 15;
      // Header containing a hamburger, menu toggle, or bars icon
      if ($el.find('[class*="burger"], [class*="hamburger"], [class*="menu"], [class*="toggle"], .fa-bars, [data-action="toggle-nav"]').length > 0) {
        score += 35;
      }
      // Top-level containers (direct child of body or main layout shell) get priority
      if ($el.parent().is('body, main, #__next, #root, #app, [class*="page-wrapper"]')) {
        score += 20;
      }
      // Elements inside a popup, modal, or offcanvas dialog are companion drawers, NOT the primary header
      if ($el.closest('[data-elementor-type="popup"], [class*="popup"], [class*="dialog"], [role="dialog"], [class*="offcanvas"]').length > 0) {
        score -= 50;
      }

      if (score > bestNavScore) {
        bestNavScore = score;
        bestNav = $el;
      }
    });

    if (bestNav) {
      // Check if header is enclosed in a wrapper containing associated mega menus
      const parentWrapper = (bestNav as cheerio.Cheerio<any>).closest(
        '#mega-menu, .mega-menu, [class*="site-header-wrapper"], [class*="header-wrapper"], [class*="header_wrapper"]'
      );
      if (parentWrapper.length > 0 && parentWrapper.find('dialog, [class*="mega-menu-panel"], [class*="header-panel"]').length > 0) {
        return parentWrapper;
      }
      return bestNav;
    }

    const fallbackNav = $snap('header, nav, [role="banner"]').first();
    if (fallbackNav.length > 0) return fallbackNav;
  }

  // 3. Robust Universal Hero Resolution
  if (isHero) {
    const candidateList: cheerio.Cheerio<any>[] = [];

    // Priority A: Elements stamped with data-rep-section from page extractor
    $snap('[data-rep-section]').each((_, el) => {
      const $el = $snap(el);
      const tag = el.tagName.toLowerCase();
      if (tag !== 'header' && tag !== 'nav' && tag !== 'footer') {
        candidateList.push($el);
      }
    });

    // Priority B: Class/ID matches for hero, banner, masthead, slider
    $snap(
      '[class*="hero"], [id*="hero"], [class*="banner"], [id*="banner"], [class*="masthead"], [class*="jumbotron"], [class*="showcase"], [class*="intro"]'
    ).each((_, el) => {
      candidateList.push($snap(el));
    });

    // Priority C: Top-level semantic sections
    $snap('main > section, [role="main"] > section, body > section, section:not(header section):not(footer section)').each((_, el) => {
      candidateList.push($snap(el));
    });

    // Priority D: Top-level builder rows / slider containers
    $snap('main > div[class*="row"], main > div[class*="section"], [class*="main-content"] > div[class*="row"]').each((_, el) => {
      candidateList.push($snap(el));
    });

    let bestHero: cheerio.Cheerio<any> | null = null;
    let highestScore = -Infinity;

    for (const $el of candidateList) {
      const el = $el.get(0);
      if (!el) continue;
      const tag = el.tagName.toLowerCase();
      const cls = ($el.attr('class') || '').toLowerCase();
      const id = ($el.attr('id') || '').toLowerCase();
      const style = ($el.attr('style') || '').toLowerCase();

      // Disqualifiers:
      // A. Inside header, nav, footer
      const isHeroNamed = cls.includes('hero') || id.includes('hero');
      if ($el.parents('nav, footer, [role="contentinfo"]').length > 0) {
        continue;
      }
      if ($el.parents('header, [role="banner"]').length > 0 && !isHeroNamed) {
        continue;
      }
      if ((tag === 'header' && !isHeroNamed) || tag === 'nav' || tag === 'footer') {
        continue;
      }

      // B. Hidden or mobile-only elements on desktop
      if (
        style.includes('display: none') ||
        style.includes('display:none') ||
        style.includes('visibility: hidden') ||
        cls.includes('hidden-xl') ||
        cls.includes('mgz-hidden-xl') ||
        cls.includes('mgz-hidden-lg') ||
        cls.includes('sr-only') ||
        cls.includes('visually-hidden') ||
        cls.includes('d-none') ||
        cls.includes('hide') ||
        cls.includes('modal') ||
        cls.includes('popup') ||
        cls.includes('toast')
      ) {
        continue;
      }

      // C. Utility / alert / message containers
      if (
        cls.includes('messages') ||
        cls.includes('cookie') ||
        cls.includes('notice') ||
        cls.includes('alert') ||
        cls.includes('skip') ||
        id.includes('cookie') ||
        id.includes('notice') ||
        id.includes('alert')
      ) {
        continue;
      }

      // D. Full-page wrapper shell
      if (
        tag === 'main' || tag === 'body' ||
        id === 'root' || id === '__next' || id === 'app' ||
        cls.includes('page-wrapper') || cls.includes('columns') || cls.includes('main-wrapper')
      ) {
        continue;
      }

      // E. Meaningful content requirement
      const text = $el.text().trim();
      const hasMedia = $el.find('img, video, picture, canvas, svg').length > 0;
      if (!hasMedia && text.length < 15) {
        continue;
      }

      // Calculate score
      let score = 0;

      // Class / Role signals
      if (cls.includes('hero') || id.includes('hero')) score += 60;
      if (cls.includes('banner') || id.includes('banner')) score += 40;
      if (cls.includes('home_banner') || cls.includes('slider') || cls.includes('carousel')) score += 35;
      if (cls.includes('masthead') || cls.includes('intro')) score += 30;
      if (tag === 'section') score += 15;

      // Media presence (crucial for modern heroes)
      if ($el.find('img, picture, video').length > 0) score += 30;
      if ($el.find('picture source').length > 0) score += 15;

      // Typography
      if ($el.find('h1').length > 0) score += 35;
      else if ($el.find('h2').length > 0) score += 20;

      // Call to action
      if ($el.find('button, a[class*="btn"], a[class*="button"], [role="button"]').length > 0) score += 20;

      // Position bias (earlier in DOM is better for hero)
      const dataSec = $el.attr('data-rep-section');
      if (dataSec !== undefined) {
        const secNum = parseInt(dataSec, 10);
        if (secNum === 0 || secNum === 1) score += 40;
        else if (secNum === 2) score += 20;
        else score -= secNum * 5;
      }

      // Penalize giant article bodies / text dumps (> 8000 chars)
      if (text.length > 8000) score -= 40;

      if (score > highestScore) {
        highestScore = score;
        bestHero = $el;
      }
    }

    if (bestHero && highestScore > 0) {
      return bestHero;
    }

    // Fallback: first non-header section or container with media and buttons
    const fallback = $snap('section:not(header section):not(footer section), main > div').filter((_, el) => {
      const $el = $snap(el);
      const cls = ($el.attr('class') || '').toLowerCase();
      return (
        !cls.includes('message') &&
        !cls.includes('cookie') &&
        !cls.includes('alert') &&
        ($el.text().trim().length > 20 || $el.find('img, video').length > 0)
      );
    }).first();

    if (fallback.length > 0) return fallback;
  }

  // 4. Default / Generic Section
  if (sectionSelector) {
    try {
      const selMatch = $snap(sectionSelector).first();
      if (selMatch.length > 0) return selMatch;
    } catch (_) {}
  }

  const defSec = $snap('section, main > div, article').first();
  return defSec.length > 0 ? defSec : null;
}

/**
 * Universally captures companion off-canvas drawers, modal menus, and detached slide-out panels
 * that belong to the resolved section (e.g. mobile menus, hamburger drawers, Elementor popups).
 */
export function enrichSectionWithCompanions(
  targetHtml: string,
  $snap: cheerio.CheerioAPI,
  targetArchetype?: string,
  sourceSelector?: string
): string {
  if (!targetHtml || !$snap) return targetHtml;

  const isNav =
    targetArchetype === 'navbar' ||
    (sourceSelector && (sourceSelector.includes('nav') || sourceSelector.includes('header') || sourceSelector.includes('masthead'))) ||
    targetHtml.includes('<header') ||
    targetHtml.includes('<nav') ||
    targetHtml.includes('masthead') ||
    targetHtml.includes('site-header') ||
    targetHtml.includes('location-header') ||
    targetHtml.includes('menu-button') ||
    targetHtml.includes('data-menu-toggle') ||
    targetHtml.includes('hamburger');

  const isLoader =
    (sourceSelector && (sourceSelector.includes('loader') || sourceSelector.includes('preloader') || sourceSelector.includes('splash'))) ||
    targetHtml.includes('class="loader') ||
    targetHtml.includes('class=\'loader') ||
    targetHtml.includes('preloader') ||
    targetHtml.includes('splash');

  const isHero =
    targetArchetype === 'hero' ||
    (sourceSelector && (sourceSelector.includes('hero') || sourceSelector.includes('banner') || sourceSelector.includes('intro'))) ||
    targetHtml.includes('hero') ||
    targetHtml.includes('intro');

  const hasBgCanvasInSnap = $snap('#gl, #webgl, .webgl, [class*="webgl"], [class*="canvas-container"], [id*="canvas-container"]').length > 0;

  if (!isNav && !isLoader && !(isHero && hasBgCanvasInSnap)) return targetHtml;

  try {
    const $target = cheerio.load(targetHtml);
    const addedOuterHtmls = new Set<string>();
    const addedIds = new Set<string>();

    function addCompanion(el: any) {
      if (!el) return;
      // If el is an internal element inside an off-canvas or companion container, climb to the container root
      const containerParent = $snap(el).closest('nav.hamburger-menu, [class*="hamburger-menu"], [class*="drawer"], [role="dialog"], [class*="popup"]');
      if (containerParent.length > 0 && !containerParent.is('html, body, main, section.main-section, header')) {
        el = containerParent.get(0);
      }

      const $el = $snap(el);
      const outer = $snap.html($el);
      const id = ($el.attr('id') || '').trim();
      if (!outer) return;
      if (id && (addedIds.has(id) || targetHtml.includes(`id="${id}"`) || targetHtml.includes(`id='${id}'`) || $target(`[id="${id}"]`).length > 0)) return;
      if (addedOuterHtmls.has(outer) || targetHtml.includes(outer)) return;

      // If el is an internal descendant of any element in targetHtml, do not duplicate it
      if (sourceSelector) {
        try {
          const snapRoot = $snap(sourceSelector).first();
          if (snapRoot.length > 0 && (snapRoot.is(el) || snapRoot.find(el).length > 0)) {
            return;
          }
        } catch (_) {}
      }

      // Check if el is already inside target nav or header
      try {
        const snapNav = $snap('nav, header').filter((_, n) => targetHtml.includes($snap(n).attr('id') || '___never___') || targetHtml.includes($snap(n).attr('class') || '___never___')).first();
        if (snapNav.length > 0 && (snapNav.is(el) || snapNav.find(el).length > 0)) {
          return;
        }
      } catch (_) {}

      // Safety check: do not append full page wrappers or root containers
      const tag = (el.tagName || '').toLowerCase();
      const cls = ($el.attr('class') || '').toLowerCase();
      if (['html', 'body', 'main', 'head', 'script', 'style'].includes(tag)) return;
      if (['root', 'app', '__next', '__nuxt', 'maincontent'].includes(id.toLowerCase())) return;
      if (
        cls.includes('page-wrapper') ||
        cls.includes('main-wrapper') ||
        cls.includes('site-wrapper') ||
        cls.includes('layout-wrapper') ||
        cls.includes('main-canvas') ||
        cls.includes('canvas-main') ||
        cls.includes('page__shell') ||
        cls.includes('site-shell') ||
        cls.includes('dialog-off-canvas-main-canvas')
      ) return;

      // An off-canvas or companion drawer must NEVER enclose the primary page content (<main>, primary page footer, <article>)
      const isLoaderTarget = (sourceSelector || '').includes('loader') || (sourceSelector || '').includes('preloader') || $target('.loader, [class*="preloader"]').length > 0;
      if (!isLoaderTarget && (
        $el.is('main, article') ||
        $el.find('main, article').length > 0 ||
        $el.find('footer:not([class*="menu"]):not([class*="drawer"]):not([class*="panel"]):not([class*="popup"]):not([class*="modal"]):not([class*="dialog"])').length > 0 ||
        ($el.is('footer') && !cls.includes('menu') && !cls.includes('drawer'))
      )) return;

      // Sanitize companion to resting closed state
      const $clone = cheerio.load(outer, { xmlMode: false }, false);
      $clone.root().children().each((_, ch) => {
        const $ch = $clone(ch);
        $ch.removeAttr('data-open');
        $ch.removeAttr('inert');
        if ($ch.attr('data-state') === 'open') $ch.attr('data-state', 'closed');
        if ($ch.attr('aria-expanded') === 'true') $ch.attr('aria-expanded', 'false');
      });
      const sanitizedOuter = $clone.html() || outer;

      if (id) addedIds.add(id);
      addedOuterHtmls.add(outer);
      addedOuterHtmls.add(sanitizedOuter);
      const isBg = $el.is('#gl, #webgl, .webgl, [class*="webgl"], [class*="canvas-container"], [id*="canvas-container"]') || $el.find('canvas').length > 0;
      if (isBg) {
        targetHtml = sanitizedOuter + '\n' + targetHtml;
      } else {
        targetHtml += '\n' + sanitizedOuter;
      }
    }

    // 1. Declarative Target Inspection:
    // Look at all buttons, links, toggles, icons inside targetHtml
    $target(
      'button, a, [role="button"], [class*="toggle"], [class*="burger"], [class*="hamburger"], [class*="menu-btn"], [class*="menu-button"], [data-menu-toggle], [data-interaction-click-trigger], [class*="icon"], [aria-controls], [data-target], [data-bs-target], [data-elementor-open-popup]'
    ).each((_, trg) => {
      const $trg = $target(trg);
      const ariaCtrl = $trg.attr('aria-controls');
      const ariaOwns = $trg.attr('aria-owns');
      const dataTarget = $trg.attr('data-target') || $trg.attr('data-bs-target');
      const href = $trg.attr('href') || '';
      const elemPopup = $trg.attr('data-elementor-open-popup') || $trg.attr('data-popup-id');
      const clickTrigger = $trg.attr('data-interaction-click-trigger') || '';

      // 0. Interaction trigger (e.g. data-interaction-click-trigger="hamburger-menu")
      if (clickTrigger.includes('hamburger') || clickTrigger.includes('menu')) {
        const hMenu = $snap('nav.hamburger-menu, [class*="hamburger-menu"], [class*="content-drawer"]').first();
        if (hMenu.length > 0) addCompanion(hMenu.get(0));
      }

      // A. aria-controls & aria-owns
      [ariaCtrl, ariaOwns].forEach((id) => {
        if (id && id.trim()) {
          const cleanId = id.trim();
          const match = $snap('[id="' + cleanId + '"]');
          if (match.length > 0) addCompanion(match.get(0));
        }
      });

      // B. data-target / data-bs-target
      if (dataTarget && dataTarget.trim() && dataTarget.startsWith('#')) {
        const cleanTarget = dataTarget.trim().slice(1);
        const match = $snap('[id="' + cleanTarget + '"]');
        if (match.length > 0) addCompanion(match.get(0));
      }

      // B2. Universal Trigger-to-Portal linkage (from live MutationObserver probe)
      const trgId = $trg.attr('id');
      if (trgId) {
        const portal = $snap(`[data-portal-for="${trgId}"]`);
        if (portal.length > 0) addCompanion(portal.get(0));
      }

      // B3. Tooltip / Popover anchor IDs (e.g. data-tooltip-anchor-id)
      const tooltipAnchor = $trg.attr('data-tooltip-anchor-id') || $trg.attr('data-anchor-id') || $trg.attr('data-popover-target') || $trg.attr('data-dropdown-toggle');
      if (tooltipAnchor && tooltipAnchor.trim()) {
        const cleanAnchor = tooltipAnchor.trim().replace(/^#/, '');
        const match = $snap('[id="' + cleanAnchor + '"]');
        if (match.length > 0) addCompanion(match.get(0));
      }

      // C. Elementor action popup links: #elementor-action:action=popup:open&settings=...
      if (href && (href.includes('elementor-action') || href.includes('popup'))) {
        try {
          const decoded = decodeURIComponent(href);
          const m = decoded.match(/settings=([A-Za-z0-9+/=]+)/);
          if (m && m[1]) {
            const jsonStr = Buffer.from(m[1], 'base64').toString('utf8');
            const parsed = JSON.parse(jsonStr);
            if (parsed && parsed.id) {
              const popup = $snap(`[data-elementor-id="${parsed.id}"], .elementor-${parsed.id}, [id="elementor-popup-modal-${parsed.id}"]`);
              if (popup.length > 0) addCompanion(popup.get(0));
            }
          }
        } catch {}
      }

      // D. Direct data-elementor-open-popup
      if (elemPopup && elemPopup.trim()) {
        const popup = $snap(`[data-elementor-id="${elemPopup.trim()}"], .elementor-${elemPopup.trim()}, [id="elementor-popup-modal-${elemPopup.trim()}"]`);
        if (popup.length > 0) addCompanion(popup.get(0));
      }

      // E. Plain hash links pointing to dialogs/drawers: href="#site-navigation", href="#mobile-menu", etc.
      if (href && href.startsWith('#') && href.length > 2 && !href.includes('elementor-action')) {
        const hashTarget = href.slice(1);
        if (hashTarget !== 'content' && hashTarget !== 'top' && hashTarget !== 'main') {
          const match = $snap('[id="' + hashTarget + '"]');
          if (match.length > 0) {
            const mCls = (match.attr('class') || '').toLowerCase();
            const mId = (match.attr('id') || '').toLowerCase();
            const mRole = (match.attr('role') || '').toLowerCase();
            if (
              mCls.includes('menu') || mCls.includes('nav') || mCls.includes('drawer') || mCls.includes('sidebar') || mCls.includes('offcanvas') ||
              mId.includes('menu') || mId.includes('nav') || mId.includes('drawer') || mId.includes('sidebar') || mId.includes('offcanvas') ||
              mRole === 'dialog' || mRole === 'navigation'
            ) {
              addCompanion(match.get(0));
            }
          }
        }
      }
    });

    // 2. Semantic Companion Search:
    // If target section has a hamburger/menu toggle OR user targeted a navbar, scan for detached navigation drawers
    const hasMenuIndicator =
      $target(
        '[class*="burger"], [class*="hamburger"], [class*="menu-toggle"], [class*="nav-toggle"], [class*="menu-button"], [data-menu-toggle], [data-interaction-click-trigger], [aria-label*="menu" i], [aria-label*="navigation" i], [title*="menu" i], [class*="icon-bars"], .fa-bars, [data-action="toggle-nav"], a[href*="popup"], button[class*="menutrigger"]'
      ).length > 0;

    if (hasMenuIndicator || isNav) {
      const companionSelectors = [
        '[data-elementor-type="popup"]',
        '[class*="location-popup"]',
        '[id*="elementor-popup"]',
        'nav[class*="popup"]',
        '[class*="popup"]:not([class*="cookie"]):not([class*="cart"]):not([class*="modal"]):not([class*="toast"]):not([class*="alert"])',
        'nav.hamburger-menu',
        '[class*="hamburger-menu"]',
        '[class*="hamburger_menu"]',
        '[class*="content-drawer"]',
        '[class*="drawer-menu"]',
        '[class*="mobile-nav-drawer"]',
        '[class*="mobile-menu"]',
        '[class*="menu-drawer"]',
        '[class*="nav-drawer"]',
        '[class*="header_sidebar_menu"]',
        '[class*="offcanvas"]:not([class*="main-canvas"]):not([class*="canvas-main"])',
        '[class*="off-canvas"]:not([class*="main-canvas"]):not([class*="canvas-main"])',
        '[class*="drawer"]:not([class*="cart"]):not([class*="product"]):not([class*="pw"]):not([class*="paywall"])',
        '[class*="sidebar"]:not([class*="cart"]):not([class*="widget"]):not([class*="filter"])',
        '[class*="side-nav"]',
        '[class*="site-menu"]',
        '[class*="header-panel"]',
        '[class*="mega-menu-panel"]',
        '[role="dialog"]:not([class*="search"]):not([class*="video"]):not([class*="cookie"]):not([class*="login"])',
        '[data-interactive-portal="true"]',
        '#nav-content',
        '#mobile-menu'
      ];

      $snap(companionSelectors.join(', ')).each((_, el) => {
        const $el = $snap(el);
        const cls = ($el.attr('class') || '').toLowerCase();
        const id = ($el.attr('id') || '').toLowerCase();

        // Reject utility / non-navigation popups
        if (
          cls.includes('cookie') || cls.includes('consent') || cls.includes('gdpr') ||
          cls.includes('pw') || cls.includes('paywall') ||
          cls.includes('newsletter') || cls.includes('toast') || cls.includes('alert') ||
          cls.includes('chat') || cls.includes('review') || cls.includes('feedback') ||
          cls.includes('login') || cls.includes('cart') || cls.includes('filter') ||
          id.includes('cookie') || id.includes('consent') || id.includes('cart') || id.includes('paywall')
        ) {
          return;
        }

        // Must have meaningful interactive menu content: at least 1 nav, or at least 2 a links
        const linkCount = $el.find('a').length;
        const hasNavOrList = $el.find('nav, ul, [role="menu"]').length > 0;
        if (linkCount >= 2 || (linkCount >= 1 && hasNavOrList)) {
          addCompanion(el);
        }
      });
    }

    // 3. Preloader / Splash Screen Enrichment:
    // If target section is an intro loader/splash overlay, companion the underlying primary hero/main section behind it!
    const hasLoader =
      $target('.loader, [class*="preloader"], [class*="splash-screen"], [class*="intro-screen"]').length > 0;

    if (hasLoader) {
      const heroOrSection = $snap(
        '[class*="storytelling"], [class*="hero-storytelling"], section.hero-1, section[class*="hero-"], main > [class*="hero"], main > section, section[class*="hero"], [class*="hero-section"], section'
      )
        .not('.loader, [class*="preloader"], [class*="splash"]')
        .first();
      if (heroOrSection.length > 0) {
        addCompanion(heroOrSection.get(0));
      }
    }

    // 4. Fixed & Ambient Background WebGL / Canvas Container Enrichment:
    // If page has a fixed full-screen canvas container (e.g. #gl, .webgl, #canvas-container) that acts
    // as an ambient 3D / particle background, companion it for standalone hero sections (NEVER inside navbars).
    if (!isNav) {
      const bgCanvasSelector = '#gl, #webgl, .webgl, [class*="webgl"], [class*="canvas-container"], [id*="canvas-container"], [class*="ambient-canvas"], [class*="background-canvas"]';
      $snap(bgCanvasSelector).each((_, el) => {
        const $el = $snap(el);
        const hasCanvas = $el.find('canvas').length > 0 || $el.find('img.rep-canvas-replacement, img[class*="canvas-replacement"]').length > 0;
        if (hasCanvas) {
          const cls = ($el.attr('class') || '').toLowerCase();
          const id = ($el.attr('id') || '').toLowerCase();
          // Avoid tiny button canvases, sound viz, or offcanvas menus
          if (!cls.includes('button') && !cls.includes('offcanvas') && !cls.includes('icon') && !cls.includes('btn') && !cls.includes('sound')) {
            addCompanion(el);
          }
        }
      });
    }
  } catch {}

  return targetHtml;
}

