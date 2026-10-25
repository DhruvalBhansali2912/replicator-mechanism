import * as cheerio from 'cheerio';
import { SectionClassifier } from '../classifier/section-classifier.js';
import { SectionArchetype } from '../types.js';

export interface SegmentedSection {
  id: string;
  index: number;
  selector: string;
  tagName: string;
  archetype: SectionArchetype;
  confidence: number;
  html: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface VisualSegmentationResult {
  sections: SegmentedSection[];
  totalSections: number;
}

export class VisualSegmentationWorker {
  public static readonly workerName = 'VisualSegmentationWorker';
  private classifier = new SectionClassifier();

  public async execute(html: string, sourceUrl?: string): Promise<VisualSegmentationResult> {
    const $ = cheerio.load(html);
    const candidateNodes: { selector: string; tagName: string; html: string; rect: any }[] = [];
    const candidateElements: any[] = [];
    const seenElements = new Set<any>();

    // Handle SPA Multi-Main Route Prerendering (e.g. Nuxt, Next.js, Vue where archive/about/home are all in DOM)
    let activeMain: cheerio.Cheerio<any> = $('main').first();
    if ($('main').length > 1) {
      const urlPath = (sourceUrl || '').split('?')[0].replace(/\/+$/, '').split('/').pop() || '';
      if (!urlPath || urlPath === 'index' || urlPath === 'home') {
        const homeMain = $('main[class*="home"], main[class*="index"], main[id*="home"], main[id*="index"]').first();
        if (homeMain.length > 0) activeMain = homeMain;
      } else {
        const slugMain = $('main[class*="' + urlPath + '"], main[id*="' + urlPath + '"]').first();
        if (slugMain.length > 0) activeMain = slugMain;
      }
      $('main').not(activeMain as any).each((_, inactiveEl) => {
        $(inactiveEl).attr('data-inactive-spa-main', 'true');
      });
    }

    const getUniqueSelector = (el: any): string => {
      const $el = $(el);
      const id = $el.attr('id');
      if (id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
        return `#${id}`;
      }
      const dataBlock = $el.attr('data-block-id') || $el.attr('data-section') || $el.attr('data-testid');
      if (dataBlock && !dataBlock.includes('"') && !dataBlock.includes('\n')) {
        if ($el.attr('data-block-id')) return `[data-block-id="${$el.attr('data-block-id')}"]`;
        if ($el.attr('data-section')) return `[data-section="${$el.attr('data-section')}"]`;
        if ($el.attr('data-testid')) return `[data-testid="${$el.attr('data-testid')}"]`;
      }
      const rawTag = (el as any).tagName ? (el as any).tagName.toLowerCase() : 'section';
      const tag = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(rawTag) ? rawTag : 'section';
      const parent = $el.parent();
      const pEl = parent.length > 0 ? (parent.get(0) as any) : null;
      if (pEl && pEl.tagName && pEl.tagName.toLowerCase() !== 'html') {
        const siblings = parent.children(tag);
        const idx = siblings.index(el) + 1;
        const pRawTag = pEl.tagName.toLowerCase();
        const pTag = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(pRawTag) ? pRawTag : 'div';
        const pId = parent.attr('id');
        const parentSel = pId && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(pId) ? `#${pId}` : (pTag === 'body' ? 'body' : pTag);
        return siblings.length > 1 ? `${parentSel} > ${tag}:nth-of-type(${idx})` : `${parentSel} > ${tag}`;
      }
      return tag;
    };

    const addCandidate = (el: any, sel?: string) => {
      if (!el || seenElements.has(el)) return;
      const $el = $(el);
      const tag = (el as any).tagName ? (el as any).tagName.toLowerCase() : 'section';
      const cls = ($el.attr('class') || '').toLowerCase();
      const id = ($el.attr('id') || '').toLowerCase();

      // Skip full page wrappers or inactive SPA subroutes
      if (
        tag === 'body' || tag === 'html' ||
        id === 'root' || id === '__next' || id === 'app' ||
        cls.includes('page-wrapper') || cls.includes('columns') || cls.includes('main-wrapper') ||
        $el.parents('[data-inactive-spa-main="true"]').length > 0
      ) {
        return;
      }

      // Exclude off-canvas menus, mobile drawers, preloaders, curtains, popups, cookie banners
      if (
        id.includes('site-menu') || id.includes('mobile-nav') || id.includes('mobile-menu') || id.includes('drawer') || id.includes('offcanvas') || id.includes('off-canvas') ||
        cls.includes('site-menu') || cls.includes('mobile-nav') || cls.includes('mobile-menu') || cls.includes('drawer') || cls.includes('offcanvas') || cls.includes('off-canvas') ||
        cls.includes('preloader') || cls.includes('curtain') || cls.includes('loader') || cls.includes('intro-overlay') || cls.includes('cookie') || cls.includes('alert-message') || cls.includes('toast') || cls.includes('popup')
      ) {
        return;
      }

      // A flow section must be a structural block element, not inline elements or list items
      if (['a', 'span', 'p', 'li', 'button', 'input', 'label', 'i', 'svg', 'img'].includes(tag)) {
        return;
      }

      // Never segment elements inside header, nav, or footer as separate flow sections
      if ($el.parents('header, nav, footer, [role="banner"], [role="contentinfo"]').length > 0) {
        return;
      }

      // Filter out utility overlays, cookies, dialogs/modals, or empty alerts
      const text = $el.text()?.trim() || '';
      const mediaCount = $el.find('img, video, picture, svg, canvas').length;
      if (text.length < 15 && mediaCount === 0) return;
      if (tag === 'dialog' || $el.attr('role') === 'dialog' || $el.attr('aria-modal') === 'true' || cls.includes('modal') || (cls.includes('dialog') && !cls.includes('catalogue')) || cls.includes('gnb-search') || cls.includes('search-layer')) return;

      // Container check: If an element is a wrapper enclosing semantic sections, articles, or a footer,
      // never add the monolithic container; allow its granular child sections to be segmented individually!
      if (tag !== 'footer' && $el.find('footer, [role="contentinfo"]').length > 0) {
        return;
      }
      if (tag !== 'section' && tag !== 'article') {
        const hasInnerSections = $el.find('section, article').length > 0;
        const hasMultipleBlockChildren = $el.children('[data-section], [data-block], [class*="section-"]').length > 1;
        if (hasInnerSections || hasMultipleBlockChildren) {
          return;
        }
      } else if (tag === 'section' && $el.find('section').length > 0) {
        // Nested sections: prefer leaf sections over outer container sections
        return;
      }

      // Mutual exclusion: Never extract both a parent and its descendant child!
      for (const existing of candidateElements) {
        if ($(existing).find(el).length > 0) {
          // el is already inside an existing section candidate -> reject el
          return;
        }
        if ($el.find(existing).length > 0) {
          // An existing section candidate is already inside el -> reject el (prefer more granular section)
          return;
        }
      }

      const elHtml = $.html(el) || '';
      if (elHtml.trim().length > 30) {
        seenElements.add(el);
        candidateElements.push(el);
        const resolvedSel = sel || getUniqueSelector(el);
        candidateNodes.push({
          selector: resolvedSel,
          tagName: tag,
          html: elHtml,
          rect: { x: 0, y: candidateNodes.length * 400, width: 1440, height: 400 },
        });
      }
    };

    // 1. Headers / Banners / Navigation Landmarks (exclude card headers inside sections)
    let headerAdded = false;
    $('header:not(section header):not(article header):not(li header):not(footer header), [role="banner"], .page-header, [class*="site-header"], nav:not(header nav):not(footer nav):not(section nav), [role="navigation"]:not(header [role="navigation"]):not(footer [role="navigation"]):not(section [role="navigation"])').each((_, el) => {
      if (headerAdded) return;
      const countBefore = candidateNodes.length;
      addCandidate(el);
      if (candidateNodes.length > countBefore) {
        headerAdded = true;
      }
    });

    // 2. Main content rows and sections
    // Detect builder / layout rows and semantic sections across platforms (AEM, Next.js, Webflow, Shopify, WordPress, standard HTML5)
    if (activeMain && activeMain.length > 0) {
      activeMain.children('section, article, [class*="gallery"], [class*="hero"], [class*="showcase"], [class*="portfolio"], [class*="project"], [class*="work"], [class*="storytelling"], [class*="about"]').each((_, el) => {
        addCandidate(el);
      });
    }

    const majorRows = $('main > [data-block-id], [data-block-id], [data-block], [data-section], main [class*="element-row"], [class*="builder"] > [class*="row"], [class*="builder"] > div, main > section, main > article, main > div > section, main > div > div > section, body > section, body > article, [class*="site-section"], [id*="content"] > section, [class*="content"] > section, section:not(header section):not(footer section):not(nav section), article:not(header article):not(footer article):not(nav article)');
    if (majorRows.length >= 2) {
      majorRows.each((_, el) => {
        const hasParentRow = $(el).parents().toArray().some((p) => majorRows.toArray().includes(p));
        if (!hasParentRow) {
          addCandidate(el);
        }
      });
    } else {
      // Fallback standard landmark selectors
      const targetSelectors = [
        'main > section',
        'main > article',
        'main > div',
        'body > section',
        'body > article',
        'body > div > section',
        '[role="main"] > section',
        '[role="main"] > article',
        '[role="main"] > div',
        '#content section',
        '[id*="content"] section',
      ];
      for (const sel of targetSelectors) {
        $(sel).each((_, el) => addCandidate(el));
      }
    }

    // 3. Footers
    let footerAdded = false;
    $('footer, [role="contentinfo"], .page-footer, [class*="site-footer"]').each((_, el) => {
      const countBefore = candidateNodes.length;
      addCandidate(el);
      if (candidateNodes.length > countBefore) {
        footerAdded = true;
      }
    });

    // 4. Extreme Fallback: If no distinct sections discovered, look inside SPA root containers or body
    if (candidateNodes.length === 0) {
      const spaRoots = $('#root, #app, #__next, .page-wrapper, .main-wrapper');
      if (spaRoots.length > 0) {
        spaRoots.first().children().each((_, el) => {
          addCandidate(el);
        });
      }
      if (candidateNodes.length === 0) {
        $('body > *').each((_, el) => {
          addCandidate(el);
        });
      }
    }

    const sections: SegmentedSection[] = candidateNodes.map((item, index) => {
      const sectionId = `sec_${index + 1}`;
      const classification = this.classifier.classify({
        id: sectionId,
        index,
        totalSections: candidateNodes.length,
        selector: item.selector,
        tagName: item.tagName,
        rect: item.rect,
        html: item.html,
      });

      return {
        id: sectionId,
        index,
        selector: item.selector,
        tagName: item.tagName,
        archetype: classification.archetype,
        confidence: classification.confidence,
        html: item.html,
        rect: item.rect,
      };
    });

    return {
      sections,
      totalSections: sections.length,
    };
  }
}
