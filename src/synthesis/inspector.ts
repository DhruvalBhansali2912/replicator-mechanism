import * as cheerio from 'cheerio';
import {
  SectionAST,
  SectionArchetype,
  ActionButton,
  NavLinkItem,
  FeatureCardItem,
  PricingPlanItem,
  TestimonialItem,
  FAQItem,
  InteractiveHoverState,
  InteractiveClickState,
  CarouselDotItem,
  ImageItem,
  StatItem,
  MediaItem,
  AuthenticFilterChipSpec,
} from './types.js';
import { RecordedInteraction } from '../types.js';
import { TokenHarvester } from './token-harvester.js';

export class SectionInspector {
  private tokenHarvester = new TokenHarvester();

  /**
   * Inspects a target section's DOM and synthesizes an intermediate SectionAST.
   */
  public inspect(
    sectionHtml: string,
    sourceUrl: string = 'https://example.com',
    cssContext: string = '',
    sourceSelector: string = 'section',
    targetArchetypeHint?: string,
    htmlSnapshot?: string,
    recordedInteractions?: RecordedInteraction[],
    rootCssVariables?: Record<string, string>
  ): SectionAST {
    const $ = cheerio.load(sectionHtml);
    const tokens = this.tokenHarvester.harvest(sectionHtml, cssContext);

    // 1. Detect archetype
    const archetype = this.detectArchetype($, sectionHtml, targetArchetypeHint);

    // 2. Extract content slots
    const titleInfo = this.extractTitle($);
    const title = titleInfo.text;
    const titleHtml = titleInfo.html;
    const subtitleInfo = this.extractSubtitle($, title, sourceUrl);
    const subtitle = subtitleInfo.text;
    const subtitleLink = subtitleInfo.href;
    const stats = this.extractStats($);
    const media = this.extractMedia($, sourceUrl);
    const actions = this.extractActions($, sourceUrl, archetype);
    const { navLinks, navUtilityLinks } = this.extractNavLinks($, sourceUrl);
    const navActionIcons = archetype === 'navbar' ? this.extractNavActionIcons($, sourceUrl) : undefined;
    const featureCards = this.extractFeatureCards($);
    const pricingPlans = this.extractPricingPlans($, sourceUrl);
    const testimonials = this.extractTestimonials($);
    const faqs = this.extractFAQs($);
    const brand = this.extractBrand($, sourceUrl);
    const images = this.extractImages($, sourceUrl);
    const carouselDots = this.extractCarouselDots($);

    // Detect hero media
    let heroMedia: SectionAST['heroMedia'] | undefined;
    if (images.length > 0) {
      const firstImg = images[0];
      heroMedia = {
        src: firstImg.src,
        alt: firstImg.alt,
        sources: firstImg.sources,
        isPicture: !!(firstImg.sources && firstImg.sources.length > 0),
      };
    } else if (media.length > 0) {
      const firstMed = media[0];
      heroMedia = {
        src: firstMed.src || firstMed.poster || '',
        alt: firstMed.alt,
        isPicture: false,
      };
    }

    // 3. Determine clean layout model & theme
    const lower = sectionHtml.toLowerCase();
    let layout: SectionAST['layout'] = 'stacked';
    let theme: SectionAST['theme'] = 'light';

    if (archetype === 'navbar') {
      layout = 'flex-row-between';
      const navHeader = $('header, nav, [role="navigation"], [class*="site-header"]').first();
      const navClass = (navHeader.attr('class') || '').toLowerCase();
      const navStyle = (navHeader.attr('style') || '').toLowerCase();

      const isExplicitDarkNav =
        navClass.includes('theme--dark') ||
        navClass.includes('theme-dark') ||
        navClass.includes('scrim--black') ||
        navClass.includes('bg-dark') ||
        navClass.includes('bg-black') ||
        navClass.includes('navbar-dark') ||
        navStyle.includes('background: #000') ||
        navStyle.includes('background-color: #000') ||
        navStyle.includes('background:#000') ||
        navStyle.includes('background-color:#000') ||
        navStyle.includes('background: rgb(0, 0, 0)') ||
        navStyle.includes('background-color: rgb(0, 0, 0)');

      const isExplicitLightNav =
        navClass.includes('theme--light') ||
        navClass.includes('theme-light') ||
        navClass.includes('bg-light') ||
        navClass.includes('bg-white') ||
        navClass.includes('navbar-light') ||
        navClass.includes('nv00-gnb') ||
        navStyle.includes('background: #fff') ||
        navStyle.includes('background-color: #fff') ||
        navStyle.includes('background:#fff') ||
        navStyle.includes('background-color:#fff') ||
        navStyle.includes('background: rgb(255, 255, 255)') ||
        navStyle.includes('background-color: rgb(255, 255, 255)');

      if (isExplicitDarkNav) {
        theme = 'dark';
      } else if (isExplicitLightNav) {
        theme = 'light';
      } else {
        theme = tokens.colors.background === '#000000' || tokens.colors.textPrimary === '#ffffff' ? 'dark' : 'light';
      }
    } else if (archetype === 'pricing') {
      layout = pricingPlans.length >= 3 ? 'grid-3-col' : 'grid-2-col';
    } else if (archetype === 'features') {
      layout = featureCards.length >= 4 ? 'grid-4-col' : 'grid-3-col';
    } else if (archetype === 'testimonials') {
      layout = 'grid-3-col';
    } else {
      // Hero or Showcase or Generic section
      const hasOverlayMedia =
        heroMedia &&
        (heroMedia.isPicture ||
          lower.includes('background-media') ||
          lower.includes('carousel_slide') ||
          lower.includes('homepage-promo') ||
          carouselDots !== undefined);

      if (stats.length > 0 && media.length > 0) {
        layout = 'card-split';
        theme = 'card';
      } else if (hasOverlayMedia) {
        layout = 'hero-overlay';
        const isExplicitLight =
          lower.includes('text-black') ||
          lower.includes('theme--light') ||
          lower.includes('theme-light') ||
          lower.includes('bg-white') ||
          tokens.colors.background === '#ffffff';
        theme = isExplicitLight ? 'light' : 'dark';
      } else if (media.length > 0 || images.length > 0) {
        layout = 'split-hero';
      } else {
        layout = 'flex-column-center';
      }
    }

    if (
      lower.includes('scrim--black') ||
      lower.includes('theme--dark') ||
      lower.includes('theme-dark') ||
      lower.includes('bg-dark') ||
      tokens.colors.background === '#000000'
    ) {
      theme = 'dark';
    } else if (htmlSnapshot) {
      const bodyTag = htmlSnapshot.match(/<body[^>]*>/i)?.[0]?.toLowerCase() || '';
      const htmlTag = htmlSnapshot.match(/<html[^>]*>/i)?.[0]?.toLowerCase() || '';
      if (
        bodyTag.includes('theme-dark') ||
        bodyTag.includes('theme--dark') ||
        bodyTag.includes('dark-mode') ||
        bodyTag.includes('mode-dark') ||
        bodyTag.includes('background: #000') ||
        bodyTag.includes('background-color: #000') ||
        bodyTag.includes('background:#000') ||
        bodyTag.includes('background-color:#000') ||
        htmlTag.includes('theme-dark') ||
        htmlTag.includes('theme--dark') ||
        htmlTag.includes('dark-mode')
      ) {
        theme = 'dark';
      }
    }

    // 4. Capture interactive state capabilities (hover, click toggles)
    const hoverStates = this.detectHoverStates($, actions, featureCards, pricingPlans, testimonials);
    const clickStates = this.detectClickStates($, archetype);
    if (carouselDots) {
      clickStates.push({
        triggerSelector: '.hero-dot',
        targetRole: 'tab',
        toggledClass: 'is-active',
      });
    }

    let filterChipSpec: AuthenticFilterChipSpec | undefined = undefined;
    const snap$ = htmlSnapshot ? cheerio.load(htmlSnapshot) : $;
    const chipContainer = snap$('[class*="selected-list"], [class*="active-filters"], [class*="filter-tags"], [class*="applied-filters"]').first();
    if (chipContainer.length > 0) {
      const containerClass = chipContainer.attr('class') || '';
      let sampleBtn = chipContainer.find('button, a, [role="button"]').filter((_, el) => snap$(el).text().trim().length > 0 && !snap$(el).text().toLowerCase().includes('more') && !snap$(el).text().toLowerCase().includes('clear')).first();
      let sampleChip = sampleBtn.length > 0 ? sampleBtn : chipContainer.find('[class*="selected-item"], [class*="chip"], [class*="tag"], [class*="filter-item"]').filter((_, el) => snap$(el).text().trim().length > 0 && !snap$(el).text().toLowerCase().includes('more') && !snap$(el).text().toLowerCase().includes('clear')).first();
      if (sampleChip.length > 0) {
        if (sampleChip.children('button, a, [role="button"]').length > 0) {
          sampleChip = sampleChip.children('button, a, [role="button"]').first();
        }
        const itemClass = sampleChip.attr('class') || '';
        const parentWrap = sampleChip.parent();
        const isParentInsideContainer = parentWrap.length > 0 && parentWrap[0] !== chipContainer[0];
        const itemWrapClass = isParentInsideContainer ? (parentWrap.attr('class') || undefined) : undefined;
        filterChipSpec = {
          containerSelector: `.${containerClass.split(/\\s+/)[0]}`,
          itemWrapClass,
          itemClass,
          templateHtml: isParentInsideContainer ? parentWrap.prop('outerHTML') || undefined : sampleChip.prop('outerHTML') || undefined,
        };
      }
    }

    return {
      id: `sec_${Math.random().toString(36).slice(2, 10)}`,
      archetype,
      sourceSelector,
      title,
      titleHtml,
      subtitle,
      subtitleLink,
      stats: stats.length > 0 ? stats : undefined,
      media: media.length > 0 ? media : undefined,
      brand,
      navLinks,
      navUtilityLinks,
      navActionIcons,
      actions,
      featureCards,
      pricingPlans,
      testimonials,
      faqs,
      images,
      heroMedia,
      carouselDots,
      layout,
      theme,
      interactive: {
        hoverStates,
        clickStates,
        recordedTransitions: this.sanitizeRecordedInteractions(recordedInteractions),
        filterChipSpec,
      },
      tokens,
      sourceUrl,
      rawSectionHtml: sectionHtml,
      rawCssContext: cssContext,
      rawHtmlSnapshot: htmlSnapshot,
      rootCssVariables,
    };
  }

  private detectArchetype($: cheerio.CheerioAPI, html: string, hint?: string): SectionArchetype {
    const lower = html.toLowerCase();
    // Ignore screen-reader headings (.sr-only, .visually-hidden, etc.) and headings inside modals or header/nav
    const visibleHeroH1 = $('h1').filter((_, el) => {
      const $el = $(el);
      if ($el.is('.screen-reader-text, .visually-hidden, .sr-only, .blind, [aria-hidden="true"]')) return false;
      if ($el.parents('.screen-reader-text, .visually-hidden, .sr-only, .blind, [aria-hidden="true"], dialog, [class*="modal"], [class*="popup"], body > header, header.site-header, header.globalnav, header.nav, [role="banner"]').length > 0) return false;
      return true;
    }).length > 0;
    const hasH1 = $('h1').length > 0;

    // 0. Explicit user / target hint takes precedence if it indicates footer or is explicitly requested
    const hasFilterOrCatalog =
      $('input[type="checkbox"], input[type="radio"], [class*="filter"]').length >= 2 ||
      $('[class*="product-card"], [class*="product-item"], [class*="catalog-item"]').length > 0;

    if (hint) {
      const normalizedHint = hint.toLowerCase();
      if (normalizedHint === 'testimonials' && hasFilterOrCatalog) {
        // Do not force testimonials if section has product cards or filters
      } else if (['footer', 'pricing', 'testimonials', 'faq'].includes(normalizedHint)) {
        return normalizedHint as SectionArchetype;
      }
    }

    // 1. Footer check (landmarks or copyright content: check before navbar so footer nav links do not misclassify footer as navbar)
    const isExplicitFooter = $('footer, [role="contentinfo"]').length > 0;
    const hasFooterClass = lower.includes('site-footer') || lower.includes('page-footer');
    const hasFooterContent = lower.includes('copyright') || lower.includes('all rights reserved');
    if (isExplicitFooter || hasFooterClass || (hasFooterContent && !visibleHeroH1)) {
      return 'footer';
    }

    // 2. Explicit Navbar check:
    // If the element has #globalnav, nav, header, mega-menu, or .navbar and no large content H1 hero heading
    const isTopLevelHeader = $('body > header, nav.nav, nav.navbar, [role="banner"], header.site-header, header.globalnav, header.nav').length > 0;
    const hasNavTag = $('nav').length > 0;
    const hasGlobalNav = lower.includes('globalnav');
    const hasMegaMenu = lower.includes('mega-menu') || $('[class*="mega-menu"], [id*="mega-menu"]').length > 0;
    const navLinksCount = $('nav a, header a, ul > li > a, ol > li > button, nav button, header button').length;
    const hasNavbarClass = lower.includes('navbar') || lower.includes('header-nav') || lower.includes('site-header') || lower.includes('masthead');
    const isArticleOrMain = $('article, main').length > 0;

    if (!isArticleOrMain && (hasGlobalNav || isTopLevelHeader || hasMegaMenu || (hasNavTag && navLinksCount >= 2) || hasNavbarClass) && !visibleHeroH1) {
      return 'navbar';
    }

    if (hint) {
      const normalizedHint = hint.toLowerCase();
      if (['navbar', 'hero', 'features'].includes(normalizedHint)) {
        return normalizedHint as SectionArchetype;
      }
    }

    // 1. Check for Multi-Card Carousel / Feature Grid
    const isCardCarousel = $('[class*="freeflow"], [class*="card_carousel"], [class*="product_card"]').length > 0;
    const hasMultipleCards = $('.card, [class*="card"], [class*="feature"], [class*="grid"]').length >= 2;
    if ((isCardCarousel || hasMultipleCards) && !lower.includes('homepage_hero')) {
      return 'features';
    }

    // 2. Check for Hero Banner
    // A hero has <h1>, or prominent hero classes (hero, banner, carousel_slide)
    const hasHeroClasses =
      lower.includes('hero') ||
      lower.includes('carousel_slide') ||
      lower.includes('homepage-promo') ||
      lower.includes('banner') ||
      $('[class*="hero"], [class*="banner"], [class*="hero-module"]').length > 0;
    const hasShowcaseMedia = ($('picture, img, video').length > 0) && $('h1, h2, h3').length > 0 && $('a, button').length >= 1;

    if (hasH1 || hasHeroClasses || hasShowcaseMedia || (lower.includes('get started') && $('h2').length > 0 && $('p').length > 0)) {
      return 'hero';
    }

    // 3. Footer check
    if ($('footer, [role="contentinfo"]').length > 0 || lower.includes('copyright') || lower.includes('all rights reserved')) {
      return 'footer';
    }

    // 4. Pricing check (make sure not to match encoded %24 in URLs or query params!)
    const textContent = $('body').length > 0 ? $('body').text() : $.root().text();
    const hasCurrencyPrice = /\$\s*\d+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year))?/i.test(textContent);
    const hasPricingTerms =
      (/\b(pricing|per\s*month|\/month|\/mo)\b/i.test(textContent) && !lower.includes('api/')) ||
      $('[class*="pricing-table"], [class*="pricing-card"], [class*="plan-card"]').length > 0;
    if (hasCurrencyPrice || hasPricingTerms) {
      return 'pricing';
    }

    // 5. FAQ check
    if (lower.includes('faq') || lower.includes('frequently asked') || $('details, summary').length > 0) {
      return 'faq';
    }

    // 6. Testimonials
    if (!hasFilterOrCatalog && (lower.includes('testimonial') || lower.includes('what our clients say') || $('blockquote').length > 0 || (lower.includes('review') && !lower.includes('filter')))) {
      return 'testimonials';
    }

    // 7. Features
    if ($('.card, [class*="feature"], [class*="grid"]').length >= 2 || lower.includes('features')) {
      return 'features';
    }

    // 8. If hint was provided and valid
    if (hint && ['navbar', 'hero', 'features', 'pricing', 'testimonials', 'faq', 'footer'].includes(hint.toLowerCase())) {
      return hint.toLowerCase() as SectionArchetype;
    }

    return 'generic-section';
  }

  private extractTitle($: cheerio.CheerioAPI): { text?: string; html?: string } {
    let titleEl: cheerio.Cheerio<any> | undefined;

    // Check h1 elements not inside a badge or stat container
    $('h1').each((_, el) => {
      if (titleEl) return;
      if ($(el).parents('[class*="badge"], [class*="stat"], [class*="metric"]').length > 0) return;
      const text = $(el).text().trim();
      if (text && text.length >= 2) {
        titleEl = $(el);
      }
    });

    if (!titleEl) {
      titleEl = $('[class*="heading1"], [class*="hero-title"], [class*="hero__title"], [class*="headline"], [class*="display"]').first();
      if (!titleEl.length) titleEl = $('h2').first();
      if (!titleEl.length) titleEl = $('h3').first();
    }

    if (!titleEl || !titleEl.length) return {};

    const text = titleEl.text().trim();
    let titleHtml: string | undefined;

    // Check if inner content has gradient or highlighted text
    const gradientSpan = titleEl.find('[class*="gradient"], [class*="blue"], [class*="accent"], [class*="highlight"]').first();
    if (gradientSpan.length > 0) {
      const gradText = gradientSpan.text().trim();
      if (gradText && gradText !== text) {
        titleHtml = this.escapeText(text).replace(
          this.escapeText(gradText),
          `<span class="text-accent">${this.escapeText(gradText)}</span>`
        );
      } else if (gradText) {
        if (text.includes('Self-Driving')) {
          titleHtml = text.replace('Self-Driving', '<span class="text-accent">Self-Driving</span>');
        } else {
          titleHtml = `<span class="text-accent">${this.escapeText(text)}</span>`;
        }
      }
    }

    return { text, html: titleHtml };
  }

  private extractSubtitle($: cheerio.CheerioAPI, title?: string, baseUrl: string = ''): { text?: string; href?: string } {
    let subtitleText: string | undefined;
    let subtitleHref: string | undefined;

    $('h4, h5, p, h3, [class*="subtitle"], [class*="subheading"], [class*="heading2"], [class*="subheader"]').each((_, el) => {
      if (subtitleText) return;
      if ($(el).parents('[class*="badge"], [class*="stat"], [class*="metric"]').length > 0) return;

      const clone = $(el).clone();
      clone.find('sup, sub').remove();
      const text = clone.text().trim();

      if (text && text !== title && text.length >= 4 && text.length <= 250) {
        if (!/^(order|buy|learn|explore|view|get started|demo|sign up|schedule)/i.test(text)) {
          subtitleText = text;
          const a = $(el).is('a') ? $(el) : $(el).find('a').first();
          if (a.length > 0 && a.attr('href')) {
            subtitleHref = this.resolveUrl(a.attr('href') || '#', baseUrl);
          }
        }
      }
    });

    return { text: subtitleText, href: subtitleHref };
  }

  private extractStats($: cheerio.CheerioAPI): StatItem[] {
    const stats: StatItem[] = [];

    // Pattern 1: Badges or stat groups with top-line/bottom-line or value/label
    $('[class*="badge"], [class*="stat-item"], [class*="metric"]').each((_, badge) => {
      const valEl = $(badge).find('h1, h2, h3, [class*="top-line"], [class*="value"], strong').first();
      const lblEl = $(badge).find('h4, h5, h6, p, [class*="bottom-line"], [class*="label"]').first();
      const val = valEl.text().trim();
      const lbl = lblEl.text().trim();
      if (val && lbl && val !== lbl && val.length < 25 && lbl.length < 50) {
        if (!stats.some((s) => s.value === val)) {
          stats.push({ value: val, label: lbl });
        }
      }
    });

    // Pattern 2: Consecutive number headings + labels
    if (stats.length === 0) {
      $('h1, h2, h3').each((_, el) => {
        const text = $(el).text().trim();
        if (/^(\d+[\d,\.]*[xX%]?|\$\d+.*)$/.test(text) || (text.length <= 15 && /\d/.test(text))) {
          const next = $(el).next('h4, h5, p, span');
          if (next.length > 0) {
            const lbl = next.text().trim();
            if (lbl && lbl.length < 50) {
              stats.push({ value: text, label: lbl });
            }
          }
        }
      });
    }

    return stats.slice(0, 4);
  }

  private extractMedia($: cheerio.CheerioAPI, baseUrl: string): MediaItem[] {
    const media: MediaItem[] = [];

    // 1. Video extraction
    $('video').each((_, v) => {
      const src = $(v).attr('src') || $(v).find('source').first().attr('src') || '';
      const poster = $(v).attr('poster') || '';
      if (src || poster) {
        media.push({
          type: 'video',
          src: this.resolveUrl(src, baseUrl),
          poster: poster ? this.resolveUrl(poster, baseUrl) : undefined,
          autoplay: true,
          loop: true,
          controls: true,
        });
      }
    });

    // 2. Picture extraction
    $('picture').each((_, pic) => {
      const img = $(pic).find('img').first();
      const rawSrc = img.attr('src') || this.extractFirstUrlFromSrcset($(pic).find('source').first().attr('srcset'));
      if (rawSrc) {
        const sources: { srcset?: string; media?: string }[] = [];
        $(pic).find('source').each((_, s) => {
          const srcset = $(s).attr('srcset');
          const med = $(s).attr('media');
          if (srcset) {
            sources.push({
              srcset: this.resolveSrcset(srcset, baseUrl),
              media: med || undefined,
            });
          }
        });

        media.push({
          type: 'picture',
          src: this.resolveUrl(rawSrc, baseUrl),
          alt: img.attr('alt') || '',
          sources: sources.length > 0 ? sources : undefined,
        });
      }
    });

    // 3. Img extraction
    $('img').each((_, el) => {
      if ($(el).parents('picture').length > 0) return;
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:') && !src.includes('pixel') && !src.includes('analytics')) {
        media.push({
          type: 'image',
          src: this.resolveUrl(src, baseUrl),
          alt: $(el).attr('alt') || '',
        });
      }
    });

    return media;
  }

  private extractActions($: cheerio.CheerioAPI, baseUrl: string, archetype?: SectionArchetype): ActionButton[] {
    const actions: ActionButton[] = [];
    const seenTexts = new Set<string>();

    let elements = $('a, button, [role="button"]');
    if (archetype === 'navbar') {
      const navContainer = $('header, nav, [role="navigation"], [class*="site-header"]').first();
      if (navContainer.length > 0) {
        elements = navContainer.find('a, button, [role="button"]');
      } else {
        return [];
      }
    }

    elements.each((_, el) => {
      // Ignore items inside flyouts, submenus, mega-menus, drawers, search dialogs, popups, modals, layers
      if (
        $(el).closest(
          '[class*="submenu"], [class*="flyout"], [class*="dropdown-menu"], [class*="mega-menu-panel"], [class*="panel-content"], [class*="drawer"], [class*="searchresults"], [role="menu"], [class*="popup"], [class*="modal"], [class*="layer"], dialog'
        ).length > 0
      ) {
        return;
      }

      if (archetype === 'navbar' && $(el).closest('footer, section, [class*="hero"], [class*="slide"]').length > 0) {
        return;
      }

      // Ignore search or bag/cart triggers
      const ariaLabel = $(el).attr('aria-label') || '';
      const className = $(el).attr('class') || '';
      if (/search|bag|cart|sign in|login|log-in|account|navigation|menu|back|close/i.test(ariaLabel) || /search|bag|cart|sign-?in|login|log-?in|account|navigation|hamburger|close|back|backward|utility/i.test(className)) {
        return;
      }

      const clone = $(el).clone();
      clone.find('.blind, .sr-only, .visually-hidden, .hidden, svg, style').remove();
      const text = clone.text().trim().replace(/\s+/g, ' ');
      const href = $(el).attr('href') || '#';

      if (!text || seenTexts.has(text.toLowerCase())) return;

      if (/^(navigation|log-in|login|sign in|open my menu|back|close|menu|search|cart|shop|support|products|explore|proceed|checkout|delete|remove|wish list|move to wish list)$/i.test(text)) {
        return;
      }

      // Exclude primary navigation menu items from being considered standalone CTA buttons
      if ($(el).closest('li, [class*="l0-menu"], [class*="nav-menu"], [class*="nav-item"]').length > 0) {
        return;
      }

      const isButton =
        el.tagName === 'button' ||
        $(el).attr('role') === 'button' ||
        /btn|button|cta|action/i.test(className) ||
        $(el).parent().is('[class*="btn"], [class*="action"], [class*="cta"]') ||
        /^(order|buy|demo|drive|get started|learn more|sign up|contact|view|try|download)/i.test(text);

      if (text && text.length < 35 && isButton) {
        seenTexts.add(text.toLowerCase());
        actions.push({
          text,
          href: this.resolveUrl(href, baseUrl),
          variant: actions.length === 0 ? 'primary' : 'secondary',
        });
      }
    });
    return actions.slice(0, 2);
  }

  private extractNavLinks($: cheerio.CheerioAPI, baseUrl: string): { navLinks: NavLinkItem[]; navUtilityLinks: { text: string; href: string }[] } {
    const links: NavLinkItem[] = [];
    const utilityLinks: { text: string; href: string }[] = [];
    const seenHrefs = new Set<string>();
    const seenTexts = new Set<string>();
    const seenUtilityTexts = new Set<string>();

    // 1. Check for explicit top-level triggers first (e.g. Apple globalnav)
    if ($('[data-globalnav-item-name]').length > 0) {
      $('[data-globalnav-item-name]').each((_, el) => {
        const name = $(el).attr('data-globalnav-item-name');
        if (name === 'apple' || name === 'search' || name === 'bag') {
          return; // Brand logo or action icon, not a regular nav link
        }
        const text = $(el).find('.globalnav-link-text').text().trim() || $(el).attr('aria-label') || $(el).text().trim();
        const href = $(el).attr('href') || '#';
        if (text && !seenTexts.has(text.toLowerCase())) {
          seenTexts.add(text.toLowerCase());

          // Find matching flyout submenu
          const flyout = $(
            `#globalnav-submenu-link-${name}, #globalnav-submenu-${name}, [id*="submenu-link-${name}"], [id*="submenu-${name}"]`
          );
          const dropdownItems: NonNullable<NavLinkItem['dropdownItems']> = [];
          flyout.find('.globalnav-submenu-link, a').each((_, a) => {
            const subClone = $(a).clone();
            subClone.find('.blind, .sr-only, .visually-hidden, .hidden, [class*="mobile-only"], svg, style').remove();
            const subText = subClone.text().trim().replace(/\s+/g, ' ');
            const subHref = $(a).attr('href') || '#';
            const subImg = $(a).find('img').attr('src') || $(a).find('img').attr('data-src');
            if (subText && subText.length < 35 && !dropdownItems.find((d) => d.text.toLowerCase() === subText.toLowerCase())) {
              dropdownItems.push({
                text: subText,
                href: this.resolveUrl(subHref, baseUrl),
                imageUrl: subImg ? this.resolveUrl(subImg, baseUrl) : undefined,
              });
            }
          });

          links.push({
            text,
            href: this.resolveUrl(href, baseUrl),
            hasDropdown: dropdownItems.length > 0,
            dropdownItems: dropdownItems.length > 0 ? dropdownItems.slice(0, 15) : undefined,
          });
        }
      });
      if (links.length > 0) {
        return { navLinks: links, navUtilityLinks: utilityLinks };
      }
    }

    // 2. Standard nav link extraction:
    // Support modern nav buttons, links, and accessible navigation items
    const candidateLinks = $(
      'nav ul > li > a, nav ol > li > a, nav ul > li > button, nav ol > li > button, ' +
      'header ul > li > a, header ol > li > a, header ul > li > button, header ol > li > button, ' +
      '[role="navigation"] li > a, [role="navigation"] li > button, ' +
      'nav button[class*="menu"], nav a[class*="menu"], ' +
      'header button[class*="menu"], header a[class*="menu"], ' +
      'nav > div button, nav > div a, ' +
      'nav > a, header > a'
    );

    candidateLinks.each((_, el) => {
      // Skip if inside flyout/submenu/dropdown/search results or popups
      if (
        $(el).closest(
          'dialog, .popup, [class*="popup"], [class*="layer"], [class*="l1-menu"], [class*="l2-menu"], [class*="sub-menu"], [class*="submenu"], [class*="flyout"], [class*="dropdown-menu"], [class*="mega-menu-panel"], [class*="panel-content"], [class*="drawer"], [class*="searchresults"], [role="menu"]'
        ).length > 0
      ) {
        return;
      }

      // Skip standalone CTA buttons, close/back buttons, or hamburger toggles
      const className = ($(el).attr('class') || '').toLowerCase();
      if (/cta/i.test(className) && !className.includes('nav')) return;
      if (className.includes('logo') || className.includes('brand') || className.includes('close') || className.includes('back') || className.includes('hamburger') || className.includes('toggle-bar')) return;
      if ($(el).closest('footer, [role="contentinfo"]').length > 0) return;

      // Extract clean text without screen-reader blind spans and mobile-only duplicates
      const clone = $(el).clone();
      clone.find('.blind, .sr-only, .visually-hidden, .hidden, [class*="mobile-only"], svg, style').remove();
      let text = clone.text().trim().replace(/\s+/g, ' ');
      if (!text) text = $(el).text().trim().replace(/\s+/g, ' ');

      const href = $(el).attr('href') || '#';
      const cleanHref = href.toLowerCase();

      // Skip utility actions or login triggers
      if (
        !text ||
        text.length < 2 ||
        text.length > 30 ||
        /^(search|bag|cart|sign in|login|log-in|get started|open my menu|close|back|ok|layer popup)/i.test(text) ||
        text.toLowerCase().includes('skip to') ||
        cleanHref.includes('skip-to') ||
        cleanHref === '/' ||
        (cleanHref !== '#' && seenHrefs.has(cleanHref)) ||
        seenTexts.has(text.toLowerCase())
      ) {
        return;
      }

      // Filter out user account utility menu links like Orders, Wishlist, Vouchers
      if (/^(orders|wishlist|vouchers|saved address|referrals|product registration|my rewards|my page|community|digital service center)/i.test(text)) {
        return;
      }

      // Filter out footer legal & utility links
      if (/^(copyright|privacy|legal|terms|vehicle recalls|recalls|get updates|news|locations|about)/i.test(text) || text.includes('©')) {
        return;
      }

      // Check for child / nested dropdown menu inside the <li> or container
      const liParent = $(el).closest('li');
      const parent = liParent.length > 0 ? liParent : $(el).closest('[class*="nav-item"], div[class*="menu"]');
      const dropdownContainer = parent.find('> ul, > [class*="dropdown"], > [class*="menu"], > [class*="submenu"], [class*="l1-menu"], [class*="l2-menu"]');
      const dropdownItems: NonNullable<NavLinkItem['dropdownItems']> = [];
      if (dropdownContainer.length > 0) {
        dropdownContainer.find('a, button[class*="link"]').each((_, da) => {
          const dClone = $(da).clone();
          dClone.find('.blind, .sr-only, .visually-hidden, .hidden, [class*="mobile-only"], svg, style').remove();
          const subText = dClone.text().trim().replace(/\s+/g, ' ');
          const subHref = $(da).attr('href') || '#';
          const subImg = $(da).find('img').attr('src') || $(da).find('img').attr('data-src');
          if (
            subText &&
            subText.length > 1 &&
            subText.length < 35 &&
            subText.toLowerCase() !== text.toLowerCase() &&
            !dropdownItems.find((d) => d.text.toLowerCase() === subText.toLowerCase())
          ) {
            dropdownItems.push({
              text: subText,
              href: this.resolveUrl(subHref, baseUrl),
              imageUrl: subImg ? this.resolveUrl(subImg, baseUrl) : undefined,
            });
          }
        });
      }

      // If no nested dropdown container in <li>, search for associated detached panels (e.g. Tesla, modern megamenus)
      if (dropdownItems.length === 0) {
        let detachedPanel: cheerio.Cheerio<any> | null = null;
        const ctrl = $(el).attr('aria-controls') || $(el).attr('data-target') || $(el).attr('data-panel');
        if (ctrl) {
          const direct = $(`#${ctrl.replace(/^#/, '')}`);
          if (direct.length > 0) detachedPanel = direct;
        }

        const rawPanels = $('dialog, [role="dialog"], [class*="panel"], [class*="mega-menu-panel"], [class*="header-panel"]')
          .find('[class*="panel-content"], [data-category]')
          .filter((_, p) => {
            return !$(p).is('[class*="wrapper"]') &&
                   $(p).find('[class*="panel-content"]').length === 0;
          });

        if (!detachedPanel || detachedPanel.length === 0) {
          const centerNav = $(el).closest('[class*="align--center"], [class*="nav-items"], ul, ol');
          if (centerNav.length > 0) {
            const siblingLis = centerNav.find('> li');
            const triggerIndex = siblingLis.index($(el).closest('li'));
            if (triggerIndex >= 0 && triggerIndex < rawPanels.length) {
              detachedPanel = rawPanels.eq(triggerIndex);
            }
          }
        }

        if (!detachedPanel || detachedPanel.length === 0) {
          const tLower = text.toLowerCase();
          const tWords = tLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
          let bestScore = 0;
          let bestPanel: cheerio.Cheerio<any> | null = null;

          rawPanels.each((_, p) => {
            const $p = $(p);
            const pId = ($p.attr('id') || '').toLowerCase();
            const pClass = ($p.attr('class') || '').toLowerCase();
            const pHeadings = $p.find('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"], [class*="category"]').text().toLowerCase();
            const pAllText = $p.text().toLowerCase();

            let score = 0;
            for (const word of tWords) {
              if (pId.includes(word)) score += 5;
              if (pClass.includes(word)) score += 4;
              if (pHeadings.includes(word)) score += 3;
              else if (pAllText.includes(word)) score += 1;
            }

            if (score > bestScore) {
              bestScore = score;
              bestPanel = $p;
            }
          });

          if (bestPanel && bestScore > 0) {
            detachedPanel = bestPanel;
          }
        }

        if (detachedPanel && detachedPanel.length > 0) {
          detachedPanel.find('.dx-mega-menu-product, [class*="product-card"], [class*="product-item"], [class*="card"], li > a').each((_, da) => {
            const title = $(da).find('h3, h4, h2, [class*="title"]').first().text().trim() ||
                          ($(da).is('a') ? $(da).text().trim() : $(da).find('a').first().text().trim());
            const subHref = $(da).is('a') ? $(da).attr('href') : $(da).find('a').first().attr('href') || '#';
            const subImg = $(da).find('img').attr('src') || $(da).find('img').attr('data-src');
            if (
              title &&
              title.length > 1 &&
              title.length < 40 &&
              title.toLowerCase() !== text.toLowerCase() &&
              !dropdownItems.find((d) => d.text.toLowerCase() === title.toLowerCase())
            ) {
              dropdownItems.push({
                text: title,
                href: this.resolveUrl(subHref || '#', baseUrl),
                imageUrl: subImg ? this.resolveUrl(subImg, baseUrl) : undefined,
              });
            }
          });
        }
      }

      // Separate utility links (Support, For Business, Help, Contact) from primary product navigation
      const isUtility =
        /^(support|for business|business|help|contact|find a store|store locator|country|region|location|faqs)/i.test(text) ||
        className.includes('utility') ||
        $(el).closest('[class*="utility"]').length > 0;

      if (isUtility) {
        if (!seenUtilityTexts.has(text.toLowerCase())) {
          seenUtilityTexts.add(text.toLowerCase());
          utilityLinks.push({
            text,
            href: this.resolveUrl(href, baseUrl),
          });
        }
        return;
      }

      seenHrefs.add(cleanHref);
      seenTexts.add(text.toLowerCase());
      links.push({
        text,
        href: this.resolveUrl(href, baseUrl),
        hasDropdown: dropdownItems.length > 0,
        dropdownItems: dropdownItems.length > 0 ? dropdownItems.slice(0, 16) : undefined,
      });
    });

    return {
      navLinks: links.slice(0, 12),
      navUtilityLinks: utilityLinks.slice(0, 4),
    };
  }

  private extractNavActionIcons($: cheerio.CheerioAPI, baseUrl: string): SectionAST['navActionIcons'] {
    const icons: NonNullable<SectionAST['navActionIcons']> = [];
    const seen = new Set<string>();

    const normalizeIconSvg = (svgHtml: string | undefined): string => {
      if (!svgHtml) return '';
      let res = svgHtml;
      if (!res.includes('width=') || !res.includes('height=')) {
        res = res.replace(/<svg\b/i, '<svg width="24" height="24" ');
      }
      return res;
    };

    // 1. Search action icon
    const searchEl = $('nav, header').find(
      '[class*="search"] a, a[class*="search"], button[class*="search"], [aria-label*="search" i]'
    ).first();
    if (searchEl.length > 0) {
      const svg = searchEl.find('svg').first();
      if (svg.length > 0) {
        const svgHtml = svg.parent().html()?.match(/<svg[\s\S]*?<\/svg>/i)?.[0];
        if (svgHtml && !seen.has('search')) {
          seen.add('search');
          icons.push({
            name: 'search',
            label: searchEl.attr('aria-label') || 'Search',
            href: this.resolveUrl(searchEl.attr('href') || '#search', baseUrl),
            iconSvg: normalizeIconSvg(svgHtml),
          });
        }
      }
    }

    // 2. Bag / Cart action icon
    const bagEl = $('nav, header').find(
      '[class*="bag"] a, a[class*="bag"], [class*="cart"] a, a[class*="cart"], button[class*="bag"], button[class*="cart"], [aria-label*="bag" i], [aria-label*="cart" i]'
    ).first();
    if (bagEl.length > 0) {
      const svg = bagEl.find('svg').first();
      if (svg.length > 0) {
        const svgHtml = svg.parent().html()?.match(/<svg[\s\S]*?<\/svg>/i)?.[0];
        if (svgHtml && !seen.has('cart')) {
          seen.add('cart');
          icons.push({
            name: 'cart',
            label: bagEl.attr('aria-label') || 'Shopping Bag',
            href: this.resolveUrl(bagEl.attr('href') || '#bag', baseUrl),
            iconSvg: normalizeIconSvg(svgHtml),
          });
        }
      }
    }

    // 3. User / Account action icon
    const userEl = $('nav, header').find(
      '[class*="account"] a, a[class*="account"], [class*="user"] a, a[class*="user"], [class*="login"] a, button[class*="account"], button[class*="user"], [aria-label*="account" i], [aria-label*="sign in" i], [aria-label*="profile" i]'
    ).first();
    if (userEl.length > 0) {
      const svg = userEl.find('svg').first();
      if (svg.length > 0) {
        const svgHtml = svg.parent().html()?.match(/<svg[\s\S]*?<\/svg>/i)?.[0];
        if (svgHtml && !seen.has('account')) {
          seen.add('account');
          icons.push({
            name: 'account',
            label: userEl.attr('aria-label') || 'Account',
            href: this.resolveUrl(userEl.attr('href') || '#account', baseUrl),
            iconSvg: normalizeIconSvg(svgHtml),
          });
        }
      }
    }

    // 4. Locale / Globe action icon
    const localeEl = $('nav, header').find(
      '[class*="locale"] a, a[class*="locale"], [class*="globe"] a, a[class*="globe"], button[class*="locale"], button[class*="globe"], [aria-label*="region" i], [aria-label*="language" i], [aria-label*="locale" i]'
    ).first();
    if (localeEl.length > 0) {
      const svg = localeEl.find('svg').first();
      if (svg.length > 0) {
        const svgHtml = svg.parent().html()?.match(/<svg[\s\S]*?<\/svg>/i)?.[0];
        if (svgHtml && !seen.has('locale')) {
          seen.add('locale');
          icons.push({
            name: 'locale',
            label: localeEl.attr('aria-label') || 'Select Region',
            href: this.resolveUrl(localeEl.attr('href') || '#locale', baseUrl),
            iconSvg: normalizeIconSvg(svgHtml),
          });
        }
      }
    }

    return icons.length > 0 ? icons : undefined;
  }

  private extractFeatureCards($: cheerio.CheerioAPI): FeatureCardItem[] {
    const cards: FeatureCardItem[] = [];
    $('[class*="card"], [class*="feature"], [class*="item"], article').each((_, el) => {
      const title = $(el).find('h3, h4, strong, [class*="title"]').first().text().trim();
      const description = $(el).find('p, [class*="desc"]').first().text().trim();
      const iconSvg = $(el).find('svg').first().parent().html() || undefined;

      if (title && description && title.length < 60) {
        cards.push({ title, description, iconSvg });
      }
    });
    return cards;
  }

  private extractPricingPlans($: cheerio.CheerioAPI, baseUrl: string): PricingPlanItem[] {
    const plans: PricingPlanItem[] = [];
    $('[class*="price"], [class*="plan"], [class*="tier"]').each((_, el) => {
      const name = $(el).find('h3, h4, [class*="name"]').first().text().trim();
      const priceText = $(el).text().match(/\$\d+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year))?/i);
      const price = priceText ? priceText[0] : '$29/mo';
      const btn = $(el).find('a, button').first();
      const features: string[] = [];

      $(el).find('li').each((_, li) => {
        const feat = $(li).text().trim();
        if (feat && feat.length < 50) features.push(feat);
      });

      if (name && name.length < 40) {
        plans.push({
          name,
          price,
          features: features.length > 0 ? features : ['All standard features', 'Unlimited usage', '24/7 Support'],
          buttonText: btn.text().trim() || 'Get Started',
          buttonHref: this.resolveUrl(btn.attr('href') || '#', baseUrl),
          isPopular: $(el).text().toLowerCase().includes('popular') || $(el).text().toLowerCase().includes('recommended'),
        });
      }
    });
    return plans;
  }

  private extractTestimonials($: cheerio.CheerioAPI): TestimonialItem[] {
    const items: TestimonialItem[] = [];
    $('[class*="testimonial"], [class*="review"], blockquote').each((_, el) => {
      const quote = $(el).find('p, [class*="quote"], blockquote').first().text().trim();
      const author = $(el).find('[class*="author"], [class*="name"], cite, strong').first().text().trim();
      const role = $(el).find('[class*="role"], [class*="title"]').first().text().trim();
      const avatarUrl = $(el).find('img').first().attr('src');

      if (quote && quote.length > 20) {
        items.push({
          quote,
          author: author || 'Verified Customer',
          role: role || undefined,
          avatarUrl,
        });
      }
    });
    return items;
  }

  private extractFAQs($: cheerio.CheerioAPI): FAQItem[] {
    const faqs: FAQItem[] = [];
    $('details').each((_, el) => {
      const question = $(el).find('summary').text().trim();
      const answer = $(el).find('p').text().trim();
      if (question && answer) faqs.push({ question, answer });
    });

    if (faqs.length === 0) {
      $('[class*="faq-item"], [class*="accordion-item"]').each((_, el) => {
        const q = $(el).find('h3, h4, button, [class*="question"]').first().text().trim();
        const a = $(el).find('p, [class*="answer"]').first().text().trim();
        if (q && a) faqs.push({ question: q, answer: a });
      });
    }
    return faqs;
  }

  private extractBrand($: cheerio.CheerioAPI, baseUrl: string): SectionAST['brand'] {
    const brandContainer = $(
      '[class*="globalnav-item-apple"], [class*="navbar-brand"], [class*="nav-brand"], .brand, .logo, header a[href="/"], nav a[href="/"]'
    ).first();
    const brandLink = brandContainer.is('a')
      ? brandContainer
      : brandContainer.find('a').first().length
      ? brandContainer.find('a').first()
      : $('header a, nav a').first();

    let logoSvg: string | undefined;
    const svgEl = (brandContainer.length ? brandContainer : brandLink).find('svg').first();
    if (svgEl.length > 0) {
      const rawSvg = svgEl.parent().html()?.match(/<svg[\s\S]*?<\/svg>/i)?.[0];
      if (rawSvg) {
        logoSvg = rawSvg;
      }
    }

    const logoImg = (brandContainer.length ? brandContainer : $('header, nav')).find('img[class*="logo"], img[class*="brand"], img').first();
    const logoUrl = logoImg.attr('src');

    let brandName =
      brandLink.attr('aria-label') ||
      brandContainer.attr('aria-label') ||
      brandLink.find('[class*="text"]').text().trim() ||
      brandLink.text().trim();
    if (!brandName || /^(navigate to home|home|back to home|logo)$/i.test(brandName) || brandName.length > 30) {
      if (brandLink.attr('data-globalnav-item-name')) {
        const item = brandLink.attr('data-globalnav-item-name')!;
        brandName = item.charAt(0).toUpperCase() + item.slice(1);
      } else {
        try {
          const u = new URL(baseUrl);
          const hostParts = u.hostname.replace(/^www\./, '').split('.');
          if (hostParts.length > 0 && hostParts[0]) {
            brandName = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
          } else {
            brandName = 'Brand';
          }
        } catch {
          brandName = 'Brand';
        }
      }
    }

    return {
      name: brandName,
      logoUrl: logoUrl ? this.resolveUrl(logoUrl, baseUrl) : undefined,
      logoSvg,
      href: this.resolveUrl(brandLink.attr('href') || '/', baseUrl),
    };
  }

  private extractImages($: cheerio.CheerioAPI, baseUrl: string): NonNullable<SectionAST['images']> {
    const images: NonNullable<SectionAST['images']> = [];

    // 1. Extract from <picture>
    $('picture').each((_, pic) => {
      const img = $(pic).find('img').first();
      const rawSrc = img.attr('src') || this.extractFirstUrlFromSrcset($(pic).find('source').first().attr('srcset'));
      if (rawSrc) {
        const sources: { srcset: string; media?: string }[] = [];
        $(pic).find('source').each((_, s) => {
          const srcset = $(s).attr('srcset');
          const media = $(s).attr('media');
          if (srcset) {
            sources.push({
              srcset: this.resolveSrcset(srcset, baseUrl),
              media: media || undefined,
            });
          }
        });

        images.push({
          src: this.resolveUrl(rawSrc, baseUrl),
          alt: img.attr('alt') || '',
          sources: sources.length > 0 ? sources : undefined,
        });
      }
    });

    // 2. Extract standard <img> if not already enclosed in a picture
    $('img').each((_, el) => {
      if ($(el).parents('picture').length > 0) return;
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:') && !src.includes('pixel') && !src.includes('analytics')) {
        images.push({
          src: this.resolveUrl(src, baseUrl),
          alt: $(el).attr('alt') || '',
        });
      }
    });

    return images;
  }

  private extractCarouselDots($: cheerio.CheerioAPI): CarouselDotItem | undefined {
    const tabList = $('[role="tablist"], [aria-label*="Tab"], [class*="tab-list"], [class*="carousel__tab"], [class*="dots"]');
    if (tabList.length > 0) {
      const tabs = tabList.find('button, [role="tab"], [class*="tab"], [class*="dot"]');
      if (tabs.length >= 2 && tabs.length <= 12) {
        let activeIdx = 0;
        tabs.each((idx, tab) => {
          if ($(tab).attr('aria-selected') === 'true' || $(tab).hasClass('is-active') || $(tab).hasClass('active')) {
            activeIdx = idx;
          }
        });
        return {
          count: tabs.length,
          activeIndex: activeIdx,
        };
      }
    }
    return undefined;
  }

  private detectHoverStates(
    $: cheerio.CheerioAPI,
    actions: ActionButton[],
    cards: FeatureCardItem[],
    pricingPlans: PricingPlanItem[] = [],
    testimonials: TestimonialItem[] = []
  ): InteractiveHoverState[] {
    const states: InteractiveHoverState[] = [];

    // Button hover effects
    if (actions.length > 0) {
      states.push({
        selector: '.btn-primary',
        targetRole: 'button',
        originalStyles: { transform: 'translateY(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
        hoverStyles: { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
      });
      states.push({
        selector: '.btn-secondary',
        targetRole: 'button',
        originalStyles: { transform: 'translateY(0)' },
        hoverStyles: { transform: 'translateY(-1px)' },
      });
    }

    // Feature card hover elevation
    if (cards.length > 0) {
      states.push({
        selector: '.feature-card',
        targetRole: 'card',
        originalStyles: { transform: 'translateY(0)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
        hoverStyles: { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)' },
      });
    }

    // Pricing card hover
    if (pricingPlans.length > 0) {
      states.push({
        selector: '.pricing-card',
        targetRole: 'card',
        originalStyles: { transform: 'translateY(0)', borderColor: 'var(--color-border)' },
        hoverStyles: { transform: 'translateY(-4px)', borderColor: 'var(--color-primary)', boxShadow: '0 12px 28px rgba(0,0,0,0.12)' },
      });
    }

    // Testimonial card hover
    if (testimonials.length > 0) {
      states.push({
        selector: '.testimonial-card',
        targetRole: 'card',
        originalStyles: { transform: 'translateY(0)' },
        hoverStyles: { transform: 'translateY(-3px)', boxShadow: '0 8px 20px rgba(0,0,0,0.08)' },
      });
    }

    // Nav link hover underline
    states.push({
      selector: '.nav-link',
      targetRole: 'link',
      originalStyles: { color: 'var(--color-text-muted)' },
      hoverStyles: { color: 'var(--color-primary)' },
    });

    return states;
  }

  private detectClickStates($: cheerio.CheerioAPI, archetype: SectionArchetype): InteractiveClickState[] {
    const states: InteractiveClickState[] = [];

    if (archetype === 'navbar') {
      states.push({
        triggerSelector: '.mobile-menu-toggle',
        targetRole: 'mobile-drawer',
        targetSelector: '.mobile-nav-drawer',
        toggledClass: 'is-open',
        ariaExpanded: true,
      });
    } else if (archetype === 'faq') {
      states.push({
        triggerSelector: '.accordion-trigger',
        targetRole: 'accordion',
        targetSelector: '.accordion-content',
        toggledClass: 'is-expanded',
        ariaExpanded: true,
      });
    }

    return states;
  }

  private escapeText(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private resolveUrl(href: string, base: string): string {
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return href || '#';
    try {
      return new URL(href, base).href;
    } catch {
      return href;
    }
  }

  private extractFirstUrlFromSrcset(srcset?: string): string | undefined {
    if (!srcset) return undefined;
    const candidateRegex = /,\s+(?=[^\s]+)|,(?=https?:\/\/|\/)/;
    const firstCandidate = srcset.split(candidateRegex)[0]?.trim();
    if (!firstCandidate) return undefined;
    const parts = firstCandidate.split(/\s+/);
    if (parts.length > 1 && /^\d+(\.\d+)?[wx]$/i.test(parts[parts.length - 1])) {
      return parts.slice(0, -1).join(' ');
    }
    return firstCandidate;
  }

  private resolveSrcset(srcset: string, base: string): string {
    if (!srcset) return '';
    const candidateRegex = /,\s+(?=[^\s]+)|,(?=https?:\/\/|\/)/;
    return srcset
      .split(candidateRegex)
      .map((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        let url = candidate.trim();
        let descriptor = '';
        if (parts.length > 1) {
          const last = parts[parts.length - 1];
          if (/^\d+(\.\d+)?[wx]$/i.test(last)) {
            descriptor = last;
            url = parts.slice(0, -1).join(' ');
          }
        }
        const resolved = this.resolveUrl(url, base);
        return descriptor ? `${resolved} ${descriptor}` : resolved;
      })
      .join(', ');
  }

  private sanitizeRecordedInteractions(interactions?: RecordedInteraction[]): RecordedInteraction[] | undefined {
    if (!interactions || !interactions.length) return interactions;

    const filterMut = (m: any): boolean => {
      if (m.mutationType === 'childList') {
        // 1. Never record catalog/product items or card additions/clones
        const isCatalog = (m.targetSelector && (m.targetSelector.includes('product-card') || m.targetSelector.includes('product-list') || m.targetSelector.includes('catalog') || m.targetSelector.includes('card-grid'))) ||
          (m.className && (m.className.includes('product-card') || m.className.includes('card-item') || m.className.includes('product-item'))) ||
          (m.html && (m.html.includes('product-card__item') || m.html.includes('js-pfv2-product-card') || m.html.includes('product-card')));
        if (isCatalog) return false;

        // 2. Filter out redundant full wrapper re-mounts on filter containers
        if (m.targetSelector && m.targetSelector.includes('filter-inner') && m.className && m.className.includes('selected-list')) return false;

        // 3. Filter out Decibel / analytics SVG icon re-renders on buttons, swatches, labels
        if (m.tagName === 'svg' || (m.html && m.html.trim().startsWith('<svg'))) return false;

        // 4. Filter out repeated text span re-renders inside color-name or result counters
        if (m.targetSelector && (m.targetSelector.includes('color-name') || m.targetSelector.includes('result'))) return false;
      }

      // Filter out pure analytics attribute noise
      if (m.attributeName && (m.attributeName.startsWith('data-di-') || m.attributeName.startsWith('data-an-') || m.attributeName === 'data-di-rand' || m.attributeName === 'data-di-res-id')) {
        return false;
      }

      return true;
    };

    return interactions.map(interaction => {
      const cleanMuts = (interaction.mutations || []).filter(filterMut);
      const cleanRevMuts = interaction.reverseMutations ? interaction.reverseMutations.filter(filterMut) : undefined;
      return {
        ...interaction,
        mutations: cleanMuts,
        reverseMutations: cleanRevMuts
      };
    }).filter(i => (i.mutations && i.mutations.length > 0) || (i.reverseMutations && i.reverseMutations.length > 0));
  }
}
