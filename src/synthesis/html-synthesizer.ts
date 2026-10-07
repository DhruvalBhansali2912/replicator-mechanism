import * as cheerio from 'cheerio';
import { SectionAST } from './types.js';

export class HtmlSynthesizer {
  /**
   * Synthesizes 100% clean, semantic, modern HTML5 from a SectionAST.
   */
  public synthesize(ast: SectionAST): string {
    if (ast.rawSectionHtml && this.hasAuthenticMarkup(ast)) {
      return this.synthesizeAuthenticHtml(ast);
    }
    if (ast.archetype === 'navbar') {
      return this.synthesizeNavbar(ast);
    }
    if (ast.layout === 'card-split') {
      return this.synthesizeCardSplit(ast);
    }
    switch (ast.archetype) {
      case 'hero':
        return this.synthesizeHero(ast);
      case 'features':
        return this.synthesizeFeatures(ast);
      case 'pricing':
        return this.synthesizePricing(ast);
      case 'testimonials':
        return this.synthesizeTestimonials(ast);
      case 'faq':
        return this.synthesizeFAQ(ast);
      case 'footer':
        return this.synthesizeFooter(ast);
      default:
        return this.synthesizeGeneric(ast);
    }
  }

  private synthesizeCardSplit(ast: SectionAST): string {
    const actions = (ast.actions || []).map(
      (act, i) => `<a href="${this.escapeAttr(act.href)}" class="btn-pill ${i === 0 ? 'btn-dark' : 'btn-light'}">${this.escapeText(act.text)}</a>`
    ).join('\n            ');

    let statsHtml = '';
    if (ast.stats && ast.stats.length > 0) {
      statsHtml = `
        <div class="stats-group">
          ${ast.stats.map((s) => `
          <div class="stat-item">
            <div class="stat-value">${this.escapeText(s.value)}</div>
            <div class="stat-label">${this.escapeText(s.label)}</div>
          </div>`).join('')}
        </div>`;
    }

    let mediaHtml = '';
    const video = ast.media?.find((m) => m.type === 'video');
    const picture = ast.media?.find((m) => m.type === 'picture');
    const image = ast.media?.find((m) => m.type === 'image') || ast.images?.[0];

    if (video) {
      mediaHtml = `
        <div class="showcase-media-container video-container">
          <video src="${this.escapeAttr(video.src)}" ${video.poster ? `poster="${this.escapeAttr(video.poster)}"` : ''} autoplay muted loop playsinline controls class="showcase-video"></video>
        </div>`;
    } else if (picture && picture.sources && picture.sources.length > 0) {
      mediaHtml = `
        <div class="showcase-media-container image-container">
          <picture>
            ${picture.sources.map((s) => `<source srcset="${this.escapeAttr(s.srcset || s.src || '')}"${s.media ? ` media="${this.escapeAttr(s.media)}"` : ''}>`).join('\n            ')}
            <img src="${this.escapeAttr(picture.src)}" alt="${this.escapeAttr(picture.alt || ast.title || 'Showcase media')}" class="showcase-img" />
          </picture>
        </div>`;
    } else if (image) {
      mediaHtml = `
        <div class="showcase-media-container image-container">
          <img src="${this.escapeAttr(image.src)}" alt="${this.escapeAttr(image.alt || ast.title || 'Showcase media')}" class="showcase-img" />
        </div>`;
    }

    const titleContent = ast.titleHtml || (ast.title ? this.escapeText(ast.title) : 'Feature Showcase');

    return `
<section class="showcase-section" id="${ast.id}">
  <div class="container showcase-container">
    <div class="showcase-card">
      <div class="showcase-content">
        <h2 class="showcase-title">${titleContent}</h2>
        ${ast.subtitle ? `<p class="showcase-subtitle">${this.escapeText(ast.subtitle)}</p>` : ''}
        ${statsHtml}
        ${actions ? `<div class="showcase-actions">${actions}</div>` : ''}
      </div>
      <div class="showcase-media">
        ${mediaHtml}
      </div>
    </div>
  </div>
</section>
`.trim();
  }

  private synthesizeNavbar(ast: SectionAST): string {
    const brand = ast.brand || { name: 'Brand', href: '/' };

    // 1. Top Utility Bar (Support, For Business, Help, etc.)
    let utilityBarHtml = '';
    if (ast.navUtilityLinks && ast.navUtilityLinks.length > 0) {
      const utilityItems = ast.navUtilityLinks
        .map((u) => `<a href="${this.escapeAttr(u.href)}" class="navbar-utility-link">${this.escapeText(u.text)}</a>`)
        .join('\n          ');
      utilityBarHtml = `
  <div class="navbar-utility-bar">
    <div class="container navbar-utility-container">
      <div class="navbar-utility-links">
        ${utilityItems}
      </div>
    </div>
  </div>`;
    }

    // 2. Main Nav Menu Items & Megamenu Panels
    const links = (ast.navLinks || []).map((link) => {
      if (link.hasDropdown && link.dropdownItems && link.dropdownItems.length > 0) {
        const hasImages = link.dropdownItems.some((d) => !!d.imageUrl);
        if (hasImages) {
          // Dynamic Product Showcase Megamenu Grid with split visual & text links
          const visualItems = link.dropdownItems.filter((d) => !!d.imageUrl);
          const textOnlyItems = link.dropdownItems.filter((d) => !d.imageUrl);

          const productCards = visualItems
            .map((item) => {
              return `
                <a href="${this.escapeAttr(item.href)}" class="megamenu-product-card" role="menuitem">
                  <div class="megamenu-card-media"><img src="${this.escapeAttr(item.imageUrl!)}" alt="${this.escapeAttr(item.text)}" class="megamenu-card-img" loading="eager" decoding="async" referrerpolicy="no-referrer" /></div>
                  <span class="megamenu-card-title">${this.escapeText(item.text)}</span>
                </a>`;
            })
            .join('\n                ');

          const quickLinksHtml = textOnlyItems.length > 0 ? `
                <div class="megamenu-quick-links">
                  <ul class="megamenu-links-list">
                    ${textOnlyItems.map(item => `
                    <li class="megamenu-link-item">
                      <a href="${this.escapeAttr(item.href)}" class="megamenu-text-link" role="menuitem">${this.escapeText(item.text)}</a>
                    </li>`).join('')}
                  </ul>
                </div>` : '';

          return `<li class="nav-item has-dropdown has-megamenu">
            <a href="${this.escapeAttr(link.href)}" class="nav-link" aria-haspopup="true" aria-expanded="false">${this.escapeText(link.text)}</a>
            <div class="nav-megamenu-panel" role="menu">
              <div class="container megamenu-panel-inner megamenu-split-layout">
                <div class="megamenu-product-grid">
                  ${productCards}
                </div>
                ${quickLinksHtml}
              </div>
            </div>
          </li>`;
        } else {
          // Standard Clean Dropdown Flyout
          const dropdownList = link.dropdownItems
            .map(
              (item) =>
                `<li class="dropdown-item"><a href="${this.escapeAttr(item.href)}" class="dropdown-link" role="menuitem">${this.escapeText(item.text)}</a></li>`
            )
            .join('\n              ');

          return `<li class="nav-item has-dropdown">
            <a href="${this.escapeAttr(link.href)}" class="nav-link" aria-haspopup="true" aria-expanded="false">${this.escapeText(link.text)}</a>
            <div class="nav-dropdown-menu" role="menu">
              <ul class="dropdown-links">
                ${dropdownList}
              </ul>
            </div>
          </li>`;
        }
      }
      return `<li class="nav-item"><a href="${this.escapeAttr(link.href)}" class="nav-link">${this.escapeText(link.text)}</a></li>`;
    }).join('\n        ');

    // 3. Action Icons (Search, Cart, User/Account, Locale)
    let actionIconsHtml = '';
    if (ast.navActionIcons && ast.navActionIcons.length > 0) {
      actionIconsHtml = ast.navActionIcons.map(
        (icon) => `<a href="${this.escapeAttr(icon.href || '#')}" class="nav-action-icon" aria-label="${this.escapeAttr(icon.label || icon.name)}">${icon.iconSvg}</a>`
      ).join('\n        ');
    }

    const actions = (ast.actions || []).map(
      (act) => `<a href="${this.escapeAttr(act.href)}" class="btn btn-${act.variant}">${this.escapeText(act.text)}</a>`
    ).join('\n        ');

    // 4. Brand Content (SVG wordmark / Logo img / Text)
    let brandContent = '';
    if (brand.logoSvg) {
      brandContent = `<span class="brand-logo-svg" aria-label="${this.escapeAttr(brand.name)}">${brand.logoSvg}</span>`;
    } else if (brand.logoUrl) {
      brandContent = `<img src="${this.escapeAttr(brand.logoUrl)}" alt="${this.escapeAttr(brand.name)}" class="brand-logo" />`;
    } else {
      brandContent = `<span class="brand-name">${this.escapeText(brand.name)}</span>`;
    }

    const themeClass = ast.theme === 'dark' ? ' theme-dark' : '';

    return `
<header class="site-header${themeClass}" id="${ast.id}" data-theme="${ast.theme || 'light'}">
  ${utilityBarHtml}
  <div class="container navbar-container">
    <nav class="navbar" aria-label="Main Navigation">
      <a href="${this.escapeAttr(brand.href)}" class="navbar-brand">
        ${brandContent}
      </a>

      <ul class="nav-menu">
        ${links}
      </ul>

      <div class="nav-actions">
        ${actionIconsHtml}
        ${actions}
      </div>

      <button class="mobile-menu-toggle universal-nav-toggle" aria-label="Toggle menu" aria-expanded="false">
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
      </button>
    </nav>

    <div class="mobile-nav-drawer" aria-hidden="true">
      <div class="mobile-nav-inner">
        <ul class="mobile-nav-menu">
          ${(ast.navLinks || []).map((link) => {
            if (link.dropdownItems && link.dropdownItems.length > 0) {
              const subItems = link.dropdownItems.slice(0, 10).map(
                (sub) => `<li class="mobile-sub-item"><a href="${this.escapeAttr(sub.href)}" class="mobile-sub-link">${this.escapeText(sub.text)}</a></li>`
              ).join('\n            ');
              return `<li class="mobile-nav-item has-mobile-submenu">
                <button class="mobile-nav-accordion-btn" aria-expanded="false">
                  <span>${this.escapeText(link.text)}</span>
                  <span class="accordion-arrow">›</span>
                </button>
                <ul class="mobile-sub-menu">
                  ${subItems}
                </ul>
              </li>`;
            }
            return `<li class="mobile-nav-item"><a href="${this.escapeAttr(link.href)}" class="mobile-nav-link">${this.escapeText(link.text)}</a></li>`;
          }).join('\n        ')}
          ${(ast.navUtilityLinks || []).map((u) => `<li class="mobile-nav-item mobile-nav-utility"><a href="${this.escapeAttr(u.href)}" class="mobile-nav-link">${this.escapeText(u.text)}</a></li>`).join('\n        ')}
        </ul>
        <div class="mobile-nav-footer">
          <div class="mobile-nav-actions">
            ${actionIconsHtml}
            ${actions}
          </div>
        </div>
      </div>
    </div>
  </div>
</header>
`.trim();
  }

  private synthesizeHero(ast: SectionAST): string {
    const actions = (ast.actions || []).map(
      (act) => `<a href="${this.escapeAttr(act.href)}" class="btn btn-${act.variant}">${this.escapeText(act.text)}</a>`
    ).join('\n            ');

    // Handle Hero Overlay Layout (Full-bleed media with centered headers and bottom CTA/dots)
    if (ast.layout === 'hero-overlay' && (ast.heroMedia || (ast.images && ast.images.length > 0))) {
      let bgMediaHtml = '';
      if (ast.images && ast.images.length > 1) {
        const slidesHtml = ast.images
          .map((img, i) => {
            let inner = '';
            if (img.sources && img.sources.length > 0) {
              const sources = img.sources
                .map((s) => `<source srcset="${this.escapeAttr(s.srcset)}"${s.media ? ` media="${this.escapeAttr(s.media)}"` : ''}>`)
                .join('\n          ');
              inner = `<picture>${sources}<img src="${this.escapeAttr(img.src)}" alt="${this.escapeAttr(img.alt || ast.title || 'Slide ' + (i + 1))}" class="hero-bg-img" /></picture>`;
            } else {
              inner = `<img src="${this.escapeAttr(img.src)}" alt="${this.escapeAttr(img.alt || ast.title || 'Slide ' + (i + 1))}" class="hero-bg-img" />`;
            }
            return `    <div class="hero-slide${i === 0 ? ' is-active' : ''}" data-slide="${i}">\n      ${inner}\n    </div>`;
          })
          .join('\n');
        bgMediaHtml = `\n  <div class="hero-slides">\n${slidesHtml}\n  </div>`;
      } else if (ast.heroMedia && ast.heroMedia.sources && ast.heroMedia.sources.length > 0) {
        const sources = ast.heroMedia.sources
          .map(
            (s) =>
              `<source srcset="${this.escapeAttr(s.srcset)}"${s.media ? ` media="${this.escapeAttr(s.media)}"` : ''}>`
          )
          .join('\n      ');
        bgMediaHtml = `
  <div class="hero-background-media">
    <picture>
      ${sources}
      <img src="${this.escapeAttr(ast.heroMedia.src)}" alt="${this.escapeAttr(ast.heroMedia.alt || ast.title || 'Hero showcase')}" class="hero-bg-img" />
    </picture>
  </div>`;
      } else if (ast.heroMedia) {
        bgMediaHtml = `
  <div class="hero-background-media">
    <img src="${this.escapeAttr(ast.heroMedia.src)}" alt="${this.escapeAttr(ast.heroMedia.alt || ast.title || 'Hero showcase')}" class="hero-bg-img" />
  </div>`;
      }

      let subtitleHtml = '';
      if (ast.subtitle) {
        if (ast.subtitleLink) {
          subtitleHtml = `<p class="hero-subtitle"><a href="${this.escapeAttr(ast.subtitleLink)}" class="hero-subtitle-link">${this.escapeText(ast.subtitle)}</a></p>`;
        } else {
          subtitleHtml = `<p class="hero-subtitle">${this.escapeText(ast.subtitle)}</p>`;
        }
      }

      const dotCount = ast.carouselDots?.count || (ast.images && ast.images.length > 1 ? ast.images.length : 0);
      const activeDotIdx = ast.carouselDots?.activeIndex || 0;
      let dotsHtml = '';
      if (dotCount > 1) {
        const dotsList = Array.from({ length: dotCount })
          .map(
            (_, i) =>
              `<button class="hero-dot${i === activeDotIdx ? ' is-active' : ''}" role="tab" aria-selected="${i === activeDotIdx ? 'true' : 'false'}" aria-label="Slide ${i + 1}" data-target="${i}"></button>`
          )
          .join('\n        ');
        dotsHtml = `
      <div class="hero-dots" role="tablist" aria-label="Slide indicators">
        ${dotsList}
      </div>`;
      }

      const themeClass = ast.theme === 'dark' ? ' theme-dark' : ' theme-light';
      return `
<section class="hero-section hero-overlay${themeClass}" id="${ast.id}">
  ${bgMediaHtml}
  <div class="hero-overlay-scrim"></div>
  <div class="container hero-container hero-container-overlay">
    <div class="hero-header-group">
      ${ast.titleHtml ? `<h1 class="hero-title">${ast.titleHtml}</h1>` : ast.title ? `<h1 class="hero-title">${this.escapeText(ast.title)}</h1>` : ''}
      ${subtitleHtml}
    </div>
    <div class="hero-bottom-group">
      ${actions ? `<div class="hero-actions hero-actions-overlay">${actions}</div>` : ''}
      ${dotsHtml}
    </div>
  </div>
</section>
`.trim();
    }

    // Default Split / Standard Hero
    const image = ast.images?.[0];

    return `
<section class="hero-section" id="${ast.id}">
  <div class="container hero-container">
    <div class="hero-content">
      ${ast.title ? `<h1 class="hero-title">${this.escapeText(ast.title)}</h1>` : ''}
      ${ast.subtitle ? `<p class="hero-subtitle">${this.escapeText(ast.subtitle)}</p>` : ''}
      ${actions ? `<div class="hero-actions">${actions}</div>` : ''}
    </div>
    ${image ? `
    <div class="hero-media">
      <img src="${this.escapeAttr(image.src)}" alt="${this.escapeAttr(image.alt || ast.title || 'Hero image')}" class="hero-image" loading="lazy" />
    </div>` : ''}
  </div>
</section>
`.trim();
  }

  private synthesizeFeatures(ast: SectionAST): string {
    const cards = (ast.featureCards || []).map((card) => `
      <article class="feature-card">
        ${card.iconSvg ? `<div class="feature-icon">${card.iconSvg}</div>` : ''}
        <h3 class="feature-title">${this.escapeText(card.title)}</h3>
        <p class="feature-desc">${this.escapeText(card.description)}</p>
      </article>
    `).join('\n      ');

    return `
<section class="features-section" id="${ast.id}">
  <div class="container">
    <div class="section-header">
      ${ast.title ? `<h2 class="section-title">${this.escapeText(ast.title)}</h2>` : ''}
      ${ast.subtitle ? `<p class="section-subtitle">${this.escapeText(ast.subtitle)}</p>` : ''}
    </div>
    <div class="features-grid">
      ${cards}
    </div>
  </div>
</section>
`.trim();
  }

  private synthesizePricing(ast: SectionAST): string {
    const plans = (ast.pricingPlans || []).map((plan) => `
      <div class="pricing-card ${plan.isPopular ? 'pricing-card--popular' : ''}">
        ${plan.isPopular ? '<span class="pricing-badge">Most Popular</span>' : ''}
        <h3 class="pricing-plan-name">${this.escapeText(plan.name)}</h3>
        <div class="pricing-price-wrapper">
          <span class="pricing-price">${this.escapeText(plan.price)}</span>
        </div>
        <ul class="pricing-features-list">
          ${plan.features.map((f) => `<li class="pricing-feature-item"><span class="check-icon">✓</span> ${this.escapeText(f)}</li>`).join('\n          ')}
        </ul>
        <a href="${this.escapeAttr(plan.buttonHref)}" class="btn btn-${plan.isPopular ? 'primary' : 'outline'} full-width">
          ${this.escapeText(plan.buttonText)}
        </a>
      </div>
    `).join('\n      ');

    return `
<section class="pricing-section" id="${ast.id}">
  <div class="container">
    <div class="section-header">
      ${ast.title ? `<h2 class="section-title">${this.escapeText(ast.title)}</h2>` : ''}
      ${ast.subtitle ? `<p class="section-subtitle">${this.escapeText(ast.subtitle)}</p>` : ''}
    </div>
    <div class="pricing-grid">
      ${plans}
    </div>
  </div>
</section>
`.trim();
  }

  private synthesizeTestimonials(ast: SectionAST): string {
    const items = (ast.testimonials || []).map((t) => `
      <blockquote class="testimonial-card">
        <p class="testimonial-quote">“${this.escapeText(t.quote)}”</p>
        <footer class="testimonial-author-wrapper">
          ${t.avatarUrl ? `<img src="${this.escapeAttr(t.avatarUrl)}" alt="${this.escapeAttr(t.author)}" class="testimonial-avatar" />` : ''}
          <div>
            <cite class="testimonial-author">${this.escapeText(t.author)}</cite>
            ${t.role ? `<span class="testimonial-role">${this.escapeText(t.role)}</span>` : ''}
          </div>
        </footer>
      </blockquote>
    `).join('\n      ');

    return `
<section class="testimonials-section" id="${ast.id}">
  <div class="container">
    <div class="section-header">
      ${ast.title ? `<h2 class="section-title">${this.escapeText(ast.title)}</h2>` : ''}
      ${ast.subtitle ? `<p class="section-subtitle">${this.escapeText(ast.subtitle)}</p>` : ''}
    </div>
    <div class="testimonials-grid">
      ${items}
    </div>
  </div>
</section>
`.trim();
  }

  private synthesizeFAQ(ast: SectionAST): string {
    const items = (ast.faqs || []).map((faq, idx) => `
      <div class="accordion-item" data-accordion-index="${idx}">
        <button class="accordion-trigger" aria-expanded="false">
          <span class="accordion-question">${this.escapeText(faq.question)}</span>
          <span class="accordion-icon">+</span>
        </button>
        <div class="accordion-content" aria-hidden="true">
          <p class="accordion-answer">${this.escapeText(faq.answer)}</p>
        </div>
      </div>
    `).join('\n      ');

    return `
<section class="faq-section" id="${ast.id}">
  <div class="container faq-container">
    <div class="section-header">
      ${ast.title ? `<h2 class="section-title">${this.escapeText(ast.title)}</h2>` : ''}
      ${ast.subtitle ? `<p class="section-subtitle">${this.escapeText(ast.subtitle)}</p>` : ''}
    </div>
    <div class="faq-accordion">
      ${items}
    </div>
  </div>
</section>
`.trim();
  }

  private synthesizeFooter(ast: SectionAST): string {
    const links = (ast.navLinks || []).map(
      (link) => `<li><a href="${this.escapeAttr(link.href)}" class="footer-link">${this.escapeText(link.text)}</a></li>`
    ).join('\n            ');

    return `
<footer class="site-footer" id="${ast.id}">
  <div class="container footer-container">
    <div class="footer-brand">
      <span class="brand-name">${this.escapeText(ast.brand?.name || 'Brand')}</span>
      <p class="footer-desc">${this.escapeText(ast.subtitle || 'All rights reserved.')}</p>
    </div>
    ${links ? `
    <nav class="footer-nav">
      <ul class="footer-links">
        ${links}
      </ul>
    </nav>` : ''}
    <div class="footer-bottom">
      <p class="copyright">&copy; ${new Date().getFullYear()} ${this.escapeText(ast.brand?.name || 'Brand')}. All rights reserved.</p>
    </div>
  </div>
</footer>
`.trim();
  }

  private synthesizeGeneric(ast: SectionAST): string {
    return `
<section class="custom-section" id="${ast.id}">
  <div class="container">
    ${ast.title ? `<h2 class="section-title">${this.escapeText(ast.title)}</h2>` : ''}
    ${ast.subtitle ? `<p class="section-subtitle">${this.escapeText(ast.subtitle)}</p>` : ''}
    ${ast.actions?.length ? `
    <div class="section-actions">
      ${ast.actions.map((act) => `<a href="${this.escapeAttr(act.href)}" class="btn btn-${act.variant}">${this.escapeText(act.text)}</a>`).join(' ')}
    </div>` : ''}
  </div>
</section>
`.trim();
  }

  private hasAuthenticMarkup(ast: SectionAST): boolean {
    const raw = ast.rawSectionHtml;
    if (!raw || raw.trim().length < 80) return false;
    return true;
  }

  private synthesizeAuthenticHtml(ast: SectionAST): string {
    const raw = ast.rawSectionHtml || '';
    const $ = cheerio.load(raw, { xmlMode: false }, false);
    const sourceUrl = ast.sourceUrl || 'https://example.com';

    // 1. Remove all scripts (tracking, telemetry, and SSR hydration JSON scripts)
    $('script').remove();

    const firstTagCandidate = $.root().children().first().prop('tagName')?.toLowerCase();
    // 2. Remove hidden tracking iframes / pixels & leaked body modals/dialogs (preserve dialogs if this is a navigation header)
    $('iframe[src*="ad"], iframe[src*="track"], iframe[width="0"], iframe[height="0"]').remove();
    $('img').each((_, el) => {
      const src = $(el).attr('src') || '';
      const alt = $(el).attr('alt') || '';
      const w = $(el).attr('width');
      const h = $(el).attr('height');
      const isPixelDim = (w === '0' || w === '1') && (h === '0' || h === '1');
      const isKnownTracker = /(?:bat\.bing|facebook\.com\/tr|doubleclick|google-analytics|clarity\.ms|quantserve|scorecardresearch|pixel\.wp|analytics|telemetry|beacon)/i.test(src);
      const isNextOrResponsive = $(el).attr('data-nimg') !== undefined || $(el).hasClass('lazyload') || $(el).attr('loading') !== undefined;

      if (isKnownTracker || (isPixelDim && !isNextOrResponsive && !alt.trim() && !src.endsWith('.svg'))) {
        $(el).remove();
      } else if (isNextOrResponsive && isPixelDim) {
        $(el).removeAttr('width');
        $(el).removeAttr('height');
        const style = $(el).attr('style');
        if (style && style.includes('color:transparent')) {
          $(el).attr('style', style.replace(/color\s*:\s*transparent;?/gi, '').trim());
        }
      }
    });
    if (ast.archetype !== 'navbar' && !['header', 'nav'].includes(firstTagCandidate || '')) {
      $('dialog, [class*="modal"], [class*="mega-menu-panel"], [class*="header-panel"], [class*="announcement-banner"]').remove();
    } else {
      $('dialog[class*="chat"], [class*="chat-modal"], [class*="support-modal"]').remove();
    }

    // Isolate single section if multiple root siblings were captured (e.g. extension selecting a section but capturing trailing DOM)
    if ($.root().children().length > 1) {
      const rootSections = $.root().children('section, [data-section]');
      const isMultiSectionComponent = rootSections.length >= 2 && $.root().children().length <= 5;
      if (!isMultiSectionComponent) {
        let targetEl: cheerio.Cheerio<any> | null = null;
        if (ast.sourceSelector && ast.sourceSelector !== 'section') {
          try {
            const found = $(ast.sourceSelector);
            if (found.length > 0) {
              const rootChild = found.parents().addBack().filter((_, el) => el.parentNode === $.root().get(0)).first();
              targetEl = rootChild.length > 0 ? rootChild : found.first();
            }
          } catch {}
        }
        if (!targetEl || targetEl.length === 0) {
          const first = $.root().children().first();
          if (first.length > 0) {
            targetEl = first;
          }
        }
        if (targetEl && targetEl.length > 0) {
          $.root().children().not(targetEl).remove();
        }
      }
    }

    // Unwrap GSAP / ScrollTrigger pin-spacers so that static offline layout flows naturally without scroll spacers
    $('.pin-spacer').each((_, el) => {
      const $el = $(el);
      $el.replaceWith($el.children());
    });

    // Universal Dynamic Text Restoration:
    // Frameworks and animation libraries (GSAP ScrambleText, Typed.js, typewriter, data-text) store original text in data attributes
    // while leaving inner text empty awaiting animation.
    $('[data-original-text], [data-text], [data-typer], [data-words], [data-scramble]').each((_, el) => {
      const $el = $(el);
      const text = $el.attr('data-original-text') || $el.attr('data-text') || $el.attr('data-typer') || $el.attr('data-words') || $el.attr('data-scramble');
      if (text && text.trim()) {
        const emptySpan = $el.find('span, div, p').filter((_, c) => $(c).text().trim() === '').first();
        if (emptySpan.length > 0) {
          emptySpan.text(text.trim());
        } else if (!$el.text().trim()) {
          $el.text(text.trim());
        }
      }
    });

    // Universal Animation Initial State Normalization:
    // Scroll triggers often leave inline opacity: 0 and full stroke-dashoffset on text, SVG pointer paths, and hero visuals.
    $('*').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style');
      if (style && (style.includes('opacity') || style.includes('stroke-dashoffset'))) {
        const isHiddenPanel = $el.is('dialog, [role="dialog"], [class*="modal"], [class*="menu-panel"], [class*="header-panel"]') ||
                              ($el.attr('aria-hidden') === 'true' && !$el.is('svg, path, span, div, img, a, button, p'));
        if (!isHiddenPanel) {
          let newStyle = style
            .replace(/(^|;)\s*opacity\s*:\s*0(\.0+)?\s*(;|$)/gi, '$1')
            .replace(/(^|;)\s*stroke-dashoffset\s*:\s*[\d\.]+\s*(;|$)/gi, '$1stroke-dashoffset: 0;$2')
            .replace(/(^|;)\s*translate\s*:\s*none\s*(;|$)/gi, '$1')
            .replace(/(^|;)\s*rotate\s*:\s*none\s*(;|$)/gi, '$1')
            .replace(/(^|;)\s*scale\s*:\s*none\s*(;|$)/gi, '$1')
            .trim();
          if (newStyle !== style) {
            if (newStyle) {
              $el.attr('style', newStyle);
            } else {
              $el.removeAttr('style');
            }
          }
        }
      }
    });

    // Universal Navigation Menu Initial State Normalization:
    // When capturing responsive sites, mobile drawer close animations frequently freeze inline styles
    // (such as visibility: hidden, width: 0px, negative margins) onto the primary menubar/nav container.
    // On desktop, these inline styles override author media queries and suppress the navigation bar.
    $('[role="menubar"], nav > ul, [class*="nav__menu"], [class*="navbar-nav"], [class*="nav-menu"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style');
      if (style) {
        let newStyle = style
          .replace(/(^|;)\s*visibility\s*:\s*hidden\s*(;|$)/gi, '$1')
          .replace(/(^|;)\s*width\s*:\s*0(px)?\s*(;|$)/gi, '$1')
          .replace(/(^|;)\s*height\s*:\s*0(px)?\s*(;|$)/gi, '$1')
          .replace(/(^|;)\s*margin\s*:\s*[^;]*-[0-9]+[^;]*(;|$)/gi, '$1')
          .replace(/(^|;)\s*margin-left\s*:\s*-[0-9]+[^;]*(;|$)/gi, '$1')
          .replace(/(^|;)\s*margin-right\s*:\s*-[0-9]+[^;]*(;|$)/gi, '$1')
          .replace(/(^|;)\s*opacity\s*:\s*0(\.0+)?\s*(;|$)/gi, '$1')
          .trim();
        if (!newStyle || newStyle === ';') {
          $el.removeAttr('style');
        } else {
          $el.attr('style', newStyle);
        }
      }
    });

    // 3. Resolve all asset URLs against sourceUrl
    const resolveUrl = (rel: string | undefined): string => {
      if (!rel) return '';
      const trimmed = rel.trim();
      if (trimmed.startsWith('data:') || trimmed.startsWith('#') || trimmed.startsWith('javascript:')) return trimmed;
      try {
        return new URL(trimmed, sourceUrl).href;
      } catch {
        return trimmed;
      }
    };

    const resolveSrcset = (srcset: string | undefined): string => {
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
          const resolved = resolveUrl(url);
          return descriptor ? `${resolved} ${descriptor}` : resolved;
        })
        .join(', ');
    };

    $('img').each((_, el) => {
      let src = $(el).attr('src');
      if (!src || src.startsWith('data:') || src.trim() === '') {
        const lazySrc = $(el).attr('data-src') || $(el).attr('data-desktop-src') || $(el).attr('data-original') || $(el).attr('data-lazy-src') || $(el).attr('data-mobile-src');
        if (lazySrc) {
          src = lazySrc;
        }
      }
      if (src) $(el).attr('src', resolveUrl(src));
      const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
      if (srcset) {
        $(el).attr('srcset', resolveSrcset(srcset));
      }
      $(el).attr('referrerpolicy', 'no-referrer');
    });

    // Ensure all product cards / catalog items are marked active/visible initially
    $('[class*="product-card__item"], [class*="catalog-item"], [class*="grid-item"], [class*="result-card"]').each((_, el) => {
      const $el = $(el);
      const cls = ($el.attr('class') || '').split(/\s+/);
      cls.forEach((c) => {
        if (!c.includes('--')) {
          $el.addClass(`${c}--active`);
          $el.addClass(`${c}--visible`);
        }
      });
      $el.addClass('is-active active');
    });

    $('source').each((_, el) => {
      const src = $(el).attr('src');
      if (src) $(el).attr('src', resolveUrl(src));
      const srcset = $(el).attr('srcset');
      if (srcset) {
        $(el).attr('srcset', resolveSrcset(srcset));
      }
    });

    $('video, audio').each((_, el) => {
      const src = $(el).attr('src');
      if (src) $(el).attr('src', resolveUrl(src));
      const poster = $(el).attr('poster');
      if (poster) $(el).attr('poster', resolveUrl(poster));
      $(el).attr('playsinline', '');
      if ($(el).is('video') && $(el).attr('autoplay') !== undefined) {
        $(el).attr('muted', '');
      }
    });

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) $(el).attr('href', resolveUrl(href));
    });

    $('[style*="url("]').each((_, el) => {
      const style = $(el).attr('style');
      if (style) {
        const newStyle = style.replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, u) => {
          if (u.startsWith('data:') || u.startsWith('http://') || u.startsWith('https://')) return match;
          return `url("${resolveUrl(u)}")`;
        });
        if (newStyle !== style) {
          $(el).attr('style', newStyle);
        }
      }
    });

    // 4. Ensure universal mobile toggle and curtain/backdrop exist for navbars
    const rawLower = (ast.rawSectionHtml || '').toLowerCase();
    const isNavigationSection =
      ast.archetype === 'navbar' ||
      rawLower.includes('globalnav') ||
      rawLower.includes('<nav') ||
      rawLower.includes('<header') ||
      rawLower.includes('mega-menu') ||
      rawLower.includes('site-header');

    if (isNavigationSection) {
      const hasExistingMenuBtn = $(
        'button[class*="menutrigger"], button[class*="hamburger"], [class*="nav-toggle"], [class*="menu-toggle"], button[aria-label*="menu" i], button[aria-label*="nav" i], button[aria-controls*="nav" i], button[aria-controls*="menu" i], [class*="menu-btn"], [id*="menu-open"], [id*="menu-toggle"], [class*="openButton" i], [class*="open-button" i], [aria-label*="navigation" i]'
      ).length > 0;

      if (!hasExistingMenuBtn) {
        const toggleBtn = `
<div class="universal-nav-toggle-wrapper">
  <button class="universal-nav-toggle" aria-label="Toggle navigation" type="button" aria-expanded="false">
    <span class="nav-toggle-line"></span>
    <span class="nav-toggle-line"></span>
    <span class="nav-toggle-line"></span>
  </button>
</div>`;
        const headerEl = $('header, nav, [role="navigation"]').first();
        if (headerEl.length > 0) {
          headerEl.append(toggleBtn);
        } else {
          $.root().append(toggleBtn);
        }
      }



      // Strip unrelated popups, reviews, and floating dialogs that leaked into navigation DOM
      $('section.popup, div.popup, [class*="popup--alert"], [class*="bottom-sheet"], [class*="confirm-popup"], [class*="sns-share"], [class*="review-contents"], .mini-cart-popup, [class*="fab__confirm"]').remove();

      // Normalize all SVGs so icons never inflate to screen width, but preserve brand/logo dimensions
      $('svg').each((_, el) => {
        const $svg = $(el);
        const isLogo = $svg.is('.logo, [class*="logo"], [class*="brand"], [id*="logo"], [id*="brand"]') ||
                       $svg.closest('[class*="logo"], [class*="brand"], [id*="logo"], [id*="brand"], [class*="header__logo"], [class*="nav__logo"]').length > 0;

        if (isLogo) {
          $svg.removeAttr('width').removeAttr('height');
          const style = $svg.attr('style') || '';
          const cleanStyle = style.replace(/(?:^|;)\s*(?:width|height)\s*:\s*\d+px;?/gi, '').trim();
          if (cleanStyle) $svg.attr('style', cleanStyle);
          else $svg.removeAttr('style');
          return;
        }

        const vb = $svg.attr('viewBox');
        const w = $svg.attr('width');
        const h = $svg.attr('height');
        if (!w || !h || w === '100%' || h === '100%') {
          if (vb) {
            const parts = vb.trim().split(/[\s,]+/).map(Number);
            if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
              const isIcon = $svg.closest('a, button, li, [class*="icon"], [class*="item"]').length > 0;
              const targetW = isIcon ? Math.min(parts[2], 24) : parts[2];
              const targetH = isIcon ? Math.min(parts[3], 24) : parts[3];
              $svg.attr('width', String(targetW));
              $svg.attr('height', String(targetH));
              $svg.css('width', `${targetW}px`);
              $svg.css('height', `${targetH}px`);
            }
          } else {
            $svg.attr('width', '24');
            $svg.attr('height', '24');
            $svg.css('width', '24px');
            $svg.css('height', '24px');
          }
        }
      });

      // Ensure any dialog panels / megamenu panels start closed cleanly by default
      $('dialog, [role="dialog"], [class*="menu-panel"], [class*="header-panel"], [class*="modal"]').removeAttr('open').attr('aria-hidden', 'true');
      $('*').each((_, el) => {
        const cls = $(el).attr('class');
        if (cls) {
          const updated = cls
            .split(/\s+/)
            .filter((c) => !c.match(/^(active|is-active|open|is-open|show|is-show|expanded|is-expanded)$/i) && !c.match(/--(show|active|open|expanded)$/i))
            .join(' ');
          if (updated !== cls) {
            $(el).attr('class', updated);
          }
        }
      });
      $('button[aria-expanded], a[aria-expanded], summary[aria-expanded], [aria-haspopup][aria-expanded]').attr('aria-expanded', 'false');

      // Strip frozen inline display/visibility styles from submenus so they don't remain stuck open
      $('[class*="submenu"], [class*="dropdown-menu"], [class*="sub-menu"], [class*="flyout"]').each((_, el) => {
        const style = $(el).attr('style');
        if (style) {
          const cleanStyle = style
            .replace(/(^|;)\s*display\s*:\s*(?:block|flex|grid)\s*(;|$)/gi, '$1')
            .replace(/(^|;)\s*visibility\s*:\s*visible\s*(;|$)/gi, '$1')
            .replace(/(^|;)\s*opacity\s*:\s*1\s*(;|$)/gi, '$1')
            .trim();
          if (cleanStyle) {
            $(el).attr('style', cleanStyle);
          } else {
            $(el).removeAttr('style');
          }
        }
      });

      $('[class*="panel-content"]').removeClass('active is-active');
      $('[class*="backdrop"], [class*="curtain"], [class*="scrim"]').removeClass('is-active is-open open');
    }

    // Ensure referenced SVG symbols (e.g. accordion chevrons, icons, social icons) have definitions in DOM
    const missingSymbols = new Set<string>();
    $('use').each((_, el) => {
      const href = $(el).attr('href') || $(el).attr('xlink:href');
      if (href && href.startsWith('#')) {
        const symId = href.slice(1);
        if ($(`#${symId}`).length === 0) {
          missingSymbols.add(symId);
        }
      }
    });

    if (missingSymbols.size > 0) {
      const gatheredSymbols: string[] = [];
      if (ast.rawHtmlSnapshot) {
        try {
          const $snap = cheerio.load(ast.rawHtmlSnapshot);
          for (const symId of missingSymbols) {
            const symEl = $snap(`#${symId}`);
            if (symEl.length > 0) {
              gatheredSymbols.push($snap.html(symEl));
              missingSymbols.delete(symId);
            }
          }
        } catch {}
      }

      // Built-in SVG symbol fallbacks for common icons if still missing
      if (missingSymbols.has('open-down-regular')) {
        gatheredSymbols.push('<symbol viewBox="0 0 96 96" id="open-down-regular" xmlns="http://www.w3.org/2000/svg"><path d="M79.719 32.342l3.562 3.509L48 71.658 12.719 35.851l3.562-3.509L48 64.534z" fill="currentColor"></path></symbol>');
      }

      if (gatheredSymbols.length > 0) {
        $.root().prepend(`\n<svg xmlns="http://www.w3.org/2000/svg" style="display:none;" aria-hidden="true">\n${gatheredSymbols.join('\n')}\n</svg>\n`);
      }
    }

    // 5. Ensure top element has semantic landmark and id
    let result = '';
    const rootEl = $('*').first();
    const firstTag = rootEl.prop('tagName')?.toLowerCase();
    const isNavUnderNavbar = ast.archetype === 'navbar' && firstTag === 'nav';
    const hasLandmark = ['header', 'section', 'footer', 'article', 'main'].includes(firstTag || '') && !isNavUnderNavbar;

    if (!hasLandmark) {
      const wrapperTag = ast.archetype === 'footer' ? 'footer' : ast.archetype === 'navbar' ? 'header' : 'section';
      const archetypeClasses = ast.archetype === 'footer'
        ? 'site-footer page-footer'
        : ast.archetype === 'navbar'
        ? 'site-header shared-header header-nav'
        : '';
      result = `<${wrapperTag} class="section section-${ast.archetype} authentic-section ${ast.archetype}-section ${archetypeClasses}" id="${ast.id}" data-theme="${ast.theme || 'light'}">\n${$.html().trim()}\n</${wrapperTag}>`;
    } else {
      if (!rootEl.attr('id')) {
        rootEl.attr('id', ast.id);
      }
      rootEl.attr('data-theme', ast.theme || 'light');
      result = $.html().trim();
    }

    // Only inject nav-curtain if the authentic markup specifically relies on an Apple-style globalnav or curtain/backdrop
    const needsAuthenticCurtain = rawLower.includes('globalnav') || rawLower.includes('curtain') || rawLower.includes('backdrop');
    if (isNavigationSection && needsAuthenticCurtain && !result.includes('curtain') && !result.includes('backdrop')) {
      result += '\n<div class="nav-curtain"></div>';
    }

    return result;
  }

  private escapeText(text?: string): string {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeAttr(attr?: string): string {
    if (!attr) return '#';
    return attr.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
