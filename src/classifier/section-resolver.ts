import * as cheerio from 'cheerio';

/**
 * Universally resolves the target section container from an HTML snapshot or Cheerio tree.
 * Strictly applies zero-hardcoding heuristics based on semantic tags, layout hierarchy,
 * content prominence, and interactive indicators.
 */
export function resolveTargetSectionFromSnapshot(
  $snap: cheerio.CheerioAPI,
  targetArchetype?: string,
  sectionSelector?: string
): cheerio.Cheerio<any> | null {
  if (!$snap) return null;

  // 1. If an explicit sectionSelector is provided and is not a generic tag
  if (sectionSelector && sectionSelector.trim() && sectionSelector !== 'section' && sectionSelector !== 'div') {
    try {
      const explicit = $snap(sectionSelector);
      if (explicit.length > 0) {
        const first = explicit.first();
        const tag = (first.get(0) as any)?.tagName?.toLowerCase() || '';
        // If matched element is an inline/leaf node, ascend to enclosing section container
        if (['button', 'a', 'span', 'p', 'img', 'svg', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'input', 'li'].includes(tag)) {
          const enc = first.closest('section, article, [class*="section"], [class*="hero"], [class*="banner"], [role="region"], [data-rep-section]');
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
      'header, [role="banner"], nav:not(header nav):not(footer nav), [role="navigation"]:not(header [role="navigation"]), [class*="navbar"], [class*="site-header"]'
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
      if ($el.find('a, button').length >= 3) score += 25;
      if ($el.find('img, svg').length > 0) score += 15;
      if (cls.includes('header') || cls.includes('nav')) score += 15;

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
      if ($el.parents('header, nav, footer, [role="banner"], [role="contentinfo"]').length > 0) {
        continue;
      }
      if (tag === 'header' || tag === 'nav' || tag === 'footer') {
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
    const selMatch = $snap(sectionSelector).first();
    if (selMatch.length > 0) return selMatch;
  }

  const defSec = $snap('section, main > div, article').first();
  return defSec.length > 0 ? defSec : null;
}
