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
          const isNavHeader = ast.archetype === 'navbar' || targetEl.is('header, nav, [role="banner"], [role="navigation"]');
          $.root().children().not(targetEl).each((_, sib) => {
            const $sib = $(sib);
            // Universal Header + Hero Fold Pairing Preservation:
            // If one element is a navigation header and the other is a hero section, preserve both!
            if (
              (targetEl.is('header, nav, [role="banner"], [role="navigation"]') && $sib.is('section, article, div, [class*="hero"], [class*="banner"]')) ||
              (targetEl.is('section, article, div, [class*="hero"], [class*="banner"]') && $sib.is('header, nav, [role="banner"], [role="navigation"]'))
            ) {
              return;
            }
            if (isNavHeader && (
              $sib.is('dialog, [role="dialog"], [data-testid*="drawer"], [data-testid*="modal"], [data-baseweb="drawer"], [data-baseweb="modal"], [aria-modal="true"], [class*="mega-menu"], [class*="header-panel"], [data-elementor-type="popup"], [class*="location-popup"], [id*="elementor-popup"], [class*="offcanvas"], [class*="off-canvas"], [class*="drawer"], [class*="sidebar"], [class*="mobile-menu"], [class*="site-menu"], [class*="nav-drawer"], [id*="mobile-menu"], [id*="sidebar"]') ||
              $sib.find('dialog, [role="dialog"], [data-testid*="drawer"], [data-baseweb="drawer"], [data-baseweb="modal"], [lang], nav, [role="menu"], [class*="nav-menu"], a').length > 0
            )) {
              // Preserve associated navigation dialogs, mega menus, and drawers
              return;
            }
            $sib.remove();
          });
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
    // Normalize SVG stroke-dashoffset and redundant 'none' transforms without destroying author visibility/opacity states.
    $('*').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style');
      if (style && (style.includes('stroke-dashoffset') || style.includes('translate: none') || style.includes('rotate: none') || style.includes('scale: none'))) {
        const isHiddenPanel = $el.is('dialog, [role="dialog"], [class*="modal"], [class*="menu-panel"], [class*="header-panel"]') ||
                              ($el.attr('aria-hidden') === 'true' && !$el.is('svg, path, span, div, img, a, button, p'));
        if (!isHiddenPanel) {
          let newStyle = style
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

    // Universal Cloned / Duplicate Slide Removal:
    // Modern slider libraries (Swiper, Slick, Glide, Splide, Owl) clone slides at runtime for infinite looping.
    // When the page snapshot is taken, both original and cloned slides are captured.
    // We must remove all duplicate/cloned slide DOM nodes so only unique slides remain without duplication.
    $('[class*="swiper-slide-duplicate"], [class*="slick-cloned"], [class*="duplicate-slide"], [class*="carousel-item-duplicate"], [class*="slide-clone"], [class*="clone-slide"], [data-slick-index^="-"]').remove();

    $('[class*="swiper-slide"], [class*="slick-slide"]').each((_, el) => {
      const $el = $(el);
      const c = $el.attr('class') || '';
      const cleaned = c.split(/\s+/).filter(cls => !cls.includes('duplicate') && !cls.includes('cloned')).join(' ');
      if (cleaned !== c) $el.attr('class', cleaned);
    });

    // Relocate non-slide tags (<style>, <script>, <template>, <noscript>) out of slider tracks to their parent container
    $('[class*="swiper-wrapper"], [class*="slick-track"], [class*="carousel-inner"], [class*="slides"]').each((_, track) => {
      const $track = $(track);
      $track.children('style, script, noscript, template').each((_, child) => {
        $track.parent().prepend(child);
      });
    });

    // Universal Carousel Track Initial Translation Normalization:
    // If a carousel or gallery track was captured mid-animation with an offscreen translation,
    // reset it to initial position (0px) so slide 0 is visible at resting state.
    $('[class*="track"], [class*="wrapper"], [class*="gallery-item-container"], [class*="gallery__container"], [class*="gallery-container"], [class*="slides"], [class*="carousel"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style');
      if (style && /transform\s*:\s*translate(?:3d|X)?\s*\(\s*-[1-9]\d+px/i.test(style)) {
        let newStyle = style.replace(/transform\s*:\s*translate3d\s*\([^)]+\)/gi, 'transform: translate3d(0px, 0px, 0px)')
                            .replace(/transform\s*:\s*translateX\s*\([^)]+\)/gi, 'transform: translateX(0px)')
                            .replace(/transform\s*:\s*matrix\s*\([^)]+\)/gi, 'transform: none');
        $el.attr('style', newStyle);
      }
    });

    // Universal Scroll & Parallax Resting State Normalization:
    // When elements are snapshotted mid-scroll, scroll-driven transforms
    // (e.g. `transform: matrix(1, 0, 0, 1, 0, -337.2)`) get frozen into inline styles,
    // pulling elements up/down and overlapping neighboring content at resting state.
    $('*').each((_, el) => {
      const tag = ((el as any).tagName || '').toLowerCase();
      if (['svg', 'path', 'g', 'polygon', 'circle', 'rect', 'ellipse', 'line'].includes(tag)) return;
      const $el = $(el);
      const style = $el.attr('style');
      if (!style) return;
      const isParallaxOrScroll = $el.closest('[data-component-list*="Parallax" i], [class*="parallax" i], [data-anim-scroll-group], [data-focus-expression], [data-scroll]').length > 0 ||
        /camera-stats|parallax/i.test($el.attr('class') || '');
      if (isParallaxOrScroll && /transform\s*:\s*(?:matrix\s*\(|translateY\s*\(-?[0-9.]+px\)|translate3d\s*\([^)]+,-?[1-9][0-9.]*px)/i.test(style)) {
        let newStyle = style.replace(/(?:^|;)\s*transform\s*:\s*(?:matrix|translateY|translate3d)\s*\([^)]+\)\s*(;|$)/gi, '$1').trim();
        newStyle = newStyle.replace(/^;+|;+$/g, '').trim();
        if (newStyle) $el.attr('style', newStyle);
        else $el.removeAttr('style');
      }
    });

    // Ensure stacked/fade gallery items preserve subgrid / natural grid layout:
    // If an item in a fade gallery had `display: block` frozen into its inline style,
    // strip `display: block` so that author CSS subgrid/grid rules apply cleanly.
    $('[class*="fade-gallery"], [class*="crossfade"], [data-component-list*="FadeGallery"]').find('[class*="gallery-item"], [class*="fade-item"], [role="tabpanel"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style');
      if (style && /display\s*:\s*block/i.test(style)) {
        let newStyle = style.replace(/(?:^|;)\s*display\s*:\s*block\s*(;|$)/gi, '$1').trim();
        newStyle = newStyle.replace(/^;+|;+$/g, '').trim();
        if (newStyle) $el.attr('style', newStyle);
        else $el.removeAttr('style');
      }
    });

    // Universal Navigation Resting State Class Normalization:
    // When elements are captured while a user hovers or interacts, sites dynamically attach
    // transient classes such as 'globalnav-with-flyout-open', 'globalnav-with-submenu-open', 'globalnav-item-flyout-open', 'menu-open', etc.
    // If left in place, author CSS hides primary navigation links at resting state (e.g. Apple hides .globalnav-link when .globalnav-with-flyout-open is present).
    $('[class*="globalnav"], nav, header, [role="navigation"], [role="banner"]').each((_, el) => {
      const $el = $(el);
      const currentClass = $el.attr('class');
      if (currentClass) {
        const cleanedClass = currentClass
          .split(/\s+/)
          .filter(cls => {
            if (!cls) return false;
            if (
              cls.includes('flyout-open') ||
              cls.includes('submenu-open') ||
              cls.includes('with-flyout') ||
              cls.includes('with-submenu') ||
              cls.includes('animating') ||
              cls.includes('flyout-closing') ||
              cls.endsWith('-open') ||
              cls === 'is-open' ||
              cls === 'menu-open' ||
              cls === 'nav-open'
            ) {
              return false;
            }
            return true;
          })
          .join(' ');
        if (cleanedClass !== currentClass) {
          $el.attr('class', cleanedClass);
        }
      }
    });

    // Also sanitize nested items inside globalnav (e.g. .globalnav-item-flyout-open)
    $('[class*="globalnav-item"]').each((_, el) => {
      const $el = $(el);
      const currentClass = $el.attr('class');
      if (currentClass && currentClass.includes('flyout-open')) {
        const cleaned = currentClass.split(/\s+/).filter(c => !c.includes('flyout-open')).join(' ');
        $el.attr('class', cleaned);
      }
    });

    // Universal Navigation Menu Initial State Normalization:
    // When capturing responsive sites, mobile drawer close animations frequently freeze inline styles
    // (such as visibility: hidden, width: 0px, negative margins, pointer-events: none) onto the primary menubar/nav container.
    // On desktop, these inline styles override author media queries, trap focus, or suppress the navigation bar.
    $('[role="menubar"], nav > ul, [class*="nav__menu"], [class*="navbar-nav"], [class*="nav-menu"], [class*="globalnav-list"], [class*="globalnav-item"], [class*="globalnav-link"], [class*="navItems"], ul, header, nav').each((_, el) => {
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
          .replace(/(^|;)\s*pointer-events\s*:\s*none\s*(;|$)/gi, '$1')
          .trim();
        if (!newStyle || newStyle === ';') {
          $el.removeAttr('style');
        } else {
          $el.attr('style', newStyle);
        }
      }
    });

    // Universal Interactive Resting State Normalization:
    // Modern focus-trap and accessible dropdown libraries (Base UI, Floating UI, Radix, Headless UI)
    // inject transient state attributes (data-popup-open, data-pressed, data-open, aria-expanded="true")
    // when a menu is opened. At resting state, all dropdowns and menus must start closed.
    $('[data-popup-open]').removeAttr('data-popup-open');
    $('[data-pressed]').removeAttr('data-pressed');
    $('[data-open]').removeAttr('data-open');
    $('[data-state="open"]').attr('data-state', 'closed');
    $('[aria-expanded="true"]').attr('aria-expanded', 'false');

    // Companion popups, dropdown panels, and floating positioners must start closed / hidden in resting state
    $('[class*="popup"], [class*="positioner"]').each((_, el) => {
      const $el = $(el);
      const cls = ($el.attr('class') || '').toLowerCase();
      if (!cls.includes('toast') && !cls.includes('banner')) {
        $el.removeAttr('data-open');
        if (!$el.hasClass('is-open')) {
          $el.attr('data-state', 'closed');
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

    // Promote authentic fallback pictures and images from noscript
    $('noscript').each((_, el) => {
      const noscriptHtml = $(el).html() || '';
      if (noscriptHtml.includes('<img') || noscriptHtml.includes('<picture')) {
        try {
          const $no = cheerio.load(noscriptHtml);
          const realPic = $no('picture').first();
          const realImg = $no('img').first();
          const realSrc = realImg.attr('src') || realImg.attr('data-src') || realImg.attr('data-original');
          const realSrcset = realImg.attr('srcset') || realImg.attr('data-srcset');

          let prev = $(el).prev('picture, img');
          if (prev.length === 0) {
            prev = $(el).parent().find('picture, img').first();
          }
          if (prev.length > 0) {
            const hasPlaceholderSource = prev.is('picture') && prev.find('source[srcset*="data:image/gif"], source[srcset*="base64"], source[data-empty]').length > 0;
            const targetImg = prev.is('img') ? prev : prev.find('img').first();
            const currSrc = targetImg.attr('src') || '';
            const isPlaceholder = !currSrc || currSrc.startsWith('data:image/gif') || currSrc.startsWith('data:image/svg') || currSrc.includes('placeholder') || hasPlaceholderSource;
            if (isPlaceholder) {
              if (prev.is('picture') && realPic.length > 0) {
                // Transfer any existing classes and id
                const prevClass = prev.attr('class') || '';
                const realClass = realPic.attr('class') || '';
                const mergedClasses = Array.from(new Set(`${realClass} ${prevClass}`.split(/\s+/).filter(Boolean))).join(' ');
                realPic.attr('class', mergedClasses);
                const prevId = prev.attr('id');
                if (prevId && !realPic.attr('id')) {
                  realPic.attr('id', prevId);
                }
                prev.replaceWith(realPic);
              } else {
                if (realSrc) targetImg.attr('src', realSrc);
                if (realSrcset) targetImg.attr('srcset', realSrcset);
              }
            }
          }
        } catch (_) {}
      }
    });

    $('img').each((_, el) => {
      let src = $(el).attr('src');
      if (!src || src.startsWith('data:') || src.trim() === '' || src.includes('placeholder')) {
        const lazySrc =
          $(el).attr('data-src') ||
          $(el).attr('data-desktop-src') ||
          $(el).attr('data-original') ||
          $(el).attr('data-lazy-src') ||
          $(el).attr('data-mobile-src') ||
          $(el).attr('data-origin-src') ||
          $(el).attr('data-img-src');
        if (lazySrc) {
          src = lazySrc;
        }
      }
      if (src && !src.startsWith('data:')) {
        $(el).attr('src', resolveUrl(src));
      } else if (!src || src.trim() === '') {
        $(el).attr('src', 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E');
      }
      const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
      if (srcset) {
        $(el).attr('srcset', resolveSrcset(srcset));
      }
      $(el).attr('referrerpolicy', 'no-referrer');

      // Universally ensure all carousel, slider, gallery, and showcase images are loaded eagerly with async decoding
      const isInsideCarousel = $(el).closest('[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="gallery"], [class*="slide"], [class*="track"], [class*="hero"], [aria-roledescription="carousel"], [role="region"]').length > 0;
      if (isInsideCarousel) {
        $(el).attr('loading', 'eager');
        $(el).attr('decoding', 'async');
      }
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

    $('noscript').remove();

    $('source').each((_, el) => {
      const src = $(el).attr('src');
      if (src) $(el).attr('src', resolveUrl(src));
      let srcset = $(el).attr('srcset');
      const dataSrcset = $(el).attr('data-srcset');

      const isPlaceholder = $(el).is('[data-empty]') ||
        !srcset ||
        srcset.includes('data:image/gif;base64,R0lGODlh') ||
        srcset.includes('data:image/svg+xml;base64,') ||
        srcset.trim() === '';

      if (isPlaceholder) {
        if (dataSrcset && !dataSrcset.includes('data:image/gif;base64,R0lGODlh')) {
          $(el).attr('srcset', resolveSrcset(dataSrcset));
          $(el).removeAttr('data-empty');
        } else {
          const parentPic = $(el).parent('picture');
          const otherValidSources = parentPic.find('source').filter((_, s) => {
            if (s === el) return false;
            const sSet = $(s).attr('srcset') || $(s).attr('data-srcset') || '';
            return Boolean(sSet && !sSet.includes('data:image/gif;base64,R0lGODlh') && !sSet.includes('data:image/svg+xml;base64,'));
          });
          if (otherValidSources.length > 0) {
            $(el).remove();
            return;
          }
          const siblingImg = parentPic.find('img').first();
          const realImgSrc = siblingImg.attr('src') || siblingImg.attr('data-src') || siblingImg.attr('data-original');
          if (realImgSrc && !realImgSrc.includes('data:image/gif;base64,R0lGODlh')) {
            $(el).attr('srcset', resolveUrl(realImgSrc));
            $(el).removeAttr('data-empty');
          } else {
            $(el).remove();
            return;
          }
        }
      } else {
        $(el).attr('srcset', resolveSrcset(srcset));
      }
    });

    $('video, audio').each((_, el) => {
      let src = $(el).attr('src');
      if (src) $(el).attr('src', resolveUrl(src));
      const poster = $(el).attr('poster');
      if (poster) $(el).attr('poster', resolveUrl(poster));
      $(el).attr('playsinline', '');

      if ($(el).is('video')) {
        const basepath = $(el).attr('data-inline-media-basepath');
        if (basepath && !src && $(el).find('source').length === 0) {
          const resolvedBase = resolveUrl(basepath);
          $(el).append(`\n  <source src="${resolvedBase}large.mp4" media="(min-width: 1069px)" type="video/mp4">`);
          $(el).append(`\n  <source src="${resolvedBase}medium.mp4" media="(min-width: 735px)" type="video/mp4">`);
          $(el).append(`\n  <source src="${resolvedBase}small.mp4" type="video/mp4">\n`);
          $(el).attr('src', `${resolvedBase}large.mp4`);
          src = `${resolvedBase}large.mp4`;
        }

        const isInlineAnimation =
          $(el).attr('data-inline-media-basepath') !== undefined ||
          $(el).attr('data-inline-media-play-kf') !== undefined ||
          $(el).attr('role') === 'img' ||
          $(el).closest('[class*="inline-media"]').length > 0;

        if (isInlineAnimation) {
          $(el).attr('muted', '');
          $(el).attr('playsinline', '');
          $(el).attr('preload', 'auto');
          $(el).attr('autoplay', '');
          $(el).attr('loop', '');
        } else if ($(el).attr('autoplay') !== undefined) {
          $(el).attr('autoplay', '');
          $(el).attr('muted', '');
          $(el).attr('playsinline', '');
          $(el).attr('preload', 'auto');
          $(el).attr('loop', '');
        }
      }

      // Also resolve child <source> elements inside video/audio
      $(el).find('source').each((_, s) => {
        const sSrc = $(s).attr('src');
        if (sSrc) $(s).attr('src', resolveUrl(sSrc));
      });
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

    // Universal 3D Viewer, Product Tour & WebGL Model Fallback Normalization
    $('[class*="viewer--loading"], .viewer--loading').each((_, el) => {
      $(el).removeClass('viewer--loading').addClass('viewer--loaded');
    });
    $('.loader, .loader-background, [class*="viewer"] [class*="loader"], .product-viewer-canvas.entice').remove();
    $('.product-viewer-media-gallery, [class*="product-viewer-media-gallery"]').each((_, el) => {
      $(el).css({ opacity: '1', visibility: 'visible', display: 'block' });
      $(el).removeAttr('hidden');
    });
    $('.control-item-label, .control-item-open, [class*="control-item-label"]').each((_, el) => {
      $(el).css({ opacity: '1', visibility: 'visible' });
    });

    // 4. Ensure universal mobile toggle and curtain/backdrop exist for navbars
    const rawLower = (ast.rawSectionHtml || '').toLowerCase();
    const isNavigationSection =
      ast.archetype === 'navbar' ||
      rawLower.includes('<nav') ||
      rawLower.includes('<header') ||
      rawLower.includes('mega-menu') ||
      rawLower.includes('site-header') ||
      rawLower.includes('masthead') ||
      rawLower.includes('menu-button') ||
      rawLower.includes('data-menu-toggle') ||
      rawLower.includes('role="navigation"') ||
      (ast.archetype !== 'features' && ast.archetype !== 'footer' && $('header:not(.section-header):not([class*="section-header"]):not([class*="section_header"])').length > 0);

    if (isNavigationSection) {
      const hasExistingMenuBtn = $(
        'button[class*="menutrigger"], button[class*="hamburger"], [class*="hamburger"], [class*="burger"], [class*="nav-toggle"], [class*="menu-toggle"], [class*="menu-button"], [data-menu-toggle], [data-interaction-click-trigger], button[aria-label*="menu" i], button[aria-label*="nav" i], button[aria-controls*="nav" i], button[aria-controls*="menu" i], [class*="menu-btn"], [id*="menu-open"], [id*="menu-toggle"], [class*="openButton" i], [class*="open-button" i], [aria-label*="navigation" i], [class*="icon-bar"], .hdrmobmenu, #nav-container, div[class*="button"][tabindex], [role="button"][class*="menu"], [class*="menu_icon"], [class*="menu-icon"], [class*="menu-trigger"], [class*="menu_trigger"]'
      ).length > 0;

      const hasNavLinks = $(
        'nav a, [role="navigation"] a, [class*="nav-item"] a, [class*="menu-item"] a, [class*="nav-link"], [class*="nav-list"] a, [class*="menu-list"] a, [class*="navbar"] a'
      ).length > 0;

      if (!hasExistingMenuBtn && hasNavLinks) {
        // 1. Inject Menu button into header end navigation or header bar
        const endGroup = $(
          'ol.tds-align--end, ul.tds-align--end, [class*="align--end"], [class*="nav-end"], [class*="navbar-end"], [class*="header-end"], [class*="nav-right"], [class*="header-right"], [class*="header-actions"]'
        ).first();

        const toggleBtnHtml = `
<li class="universal-nav-toggle-item">
  <button class="universal-nav-toggle mobile-menu-btn" aria-label="Toggle navigation" type="button" aria-expanded="false">
    <span class="nav-toggle-icon">☰</span>
    <span class="nav-toggle-label">Menu</span>
  </button>
</li>`;

        if (endGroup.length > 0 && endGroup.is('ol, ul')) {
          endGroup.append(toggleBtnHtml);
        } else {
          const headerEl = $(
            'header.tds-site-header, header:not(.section-header), nav, [class*="site-header"], [class*="masthead"], .main-section'
          ).first();
          if (headerEl.length > 0) {
            headerEl.append(`
<div class="universal-nav-toggle-wrapper">
  <button class="universal-nav-toggle mobile-menu-btn" aria-label="Toggle navigation" type="button" aria-expanded="false">
    <span class="nav-toggle-icon">☰</span>
    <span class="nav-toggle-label">Menu</span>
  </button>
</div>`);
          }
        }
      }

      // 2. Synthesize universal mobile menu drawer
      const hasExistingDrawer = $(
        '.universal-mobile-menu-drawer, [class*="mobile-nav-drawer"], [class*="mobile-menu"]:not(.dx-mega-menu), [class*="menu-drawer"], [class*="nav-drawer"], nav.hamburger-menu, [class*="hamburger-menu"], [class*="content-drawer"]'
      ).length > 0;

      if (!hasExistingDrawer) {
        const drawerListItems: string[] = [];
        const seenLabels = new Set<string>();

        $('header [class*="align--center"] > li, header nav > ul > li, header ul.navbar-nav > li, header [class*="align--end"] > li, nav > ul > li, .trending-bar-section a').each((_, el) => {
          const btn = $(el).is('a, button') ? $(el) : $(el).find('button, a').first();
          const text = (btn.text().trim() || btn.attr('title') || btn.attr('aria-label') || '').trim();
          const id = btn.attr('id') || '';
          const href = btn.attr('href');
          if (!text || seenLabels.has(text.toLowerCase()) || text.toLowerCase() === 'menu' || text.toLowerCase().includes('skip')) return;
          seenLabels.add(text.toLowerCase());

          const isLink = href && href !== '#' && !href.startsWith('javascript:');
          if (isLink) {
            drawerListItems.push(`
    <li class="universal-mobile-menu-item">
      <a href="${href}" class="universal-mobile-menu-link" ${id ? `id="mob-${id}" data-target-id="${id}"` : ''}>
        <span>${text}</span>
        <span class="universal-mobile-menu-arrow">→</span>
      </a>
    </li>`);
          } else {
            drawerListItems.push(`
    <li class="universal-mobile-menu-item">
      <button type="button" class="universal-mobile-menu-btn" ${id ? `id="mob-${id}" data-target-id="${id}"` : ''}>
        <span>${text}</span>
        <span class="universal-mobile-menu-arrow">→</span>
      </button>
    </li>`);
          }
        });

        // Harvest from rawHtmlSnapshot if current markup had no links
        if (drawerListItems.length === 0 && (ast as any).rawHtmlSnapshot) {
          try {
            const $snap = cheerio.load((ast as any).rawHtmlSnapshot);
            $snap('nav.hamburger-menu a, [class*="hamburger-menu"] a, .trending-bar-section a, header a, nav a').each((_, a) => {
              const $a = $snap(a);
              const text = $a.text().trim();
              const href = $a.attr('href') || '#';
              if (!text || text.length < 2 || text.length > 30 || seenLabels.has(text.toLowerCase()) || text.toLowerCase() === 'menu' || text.toLowerCase().includes('skip')) return;
              seenLabels.add(text.toLowerCase());
              drawerListItems.push(`
    <li class="universal-mobile-menu-item">
      <a href="${href}" class="universal-mobile-menu-link">
        <span>${text}</span>
        <span class="universal-mobile-menu-arrow">→</span>
      </a>
    </li>`);
            });
          } catch (_) {}
        }

        // Supply clean authentic default categories if still empty
        if (drawerListItems.length === 0) {
          const defaults = ['Business', 'Tech', 'Markets', 'Strategy', 'Economy', 'Finance', 'Retail', 'Careers', 'Life', 'Subscribe'];
          defaults.forEach((cat) => {
            drawerListItems.push(`
    <li class="universal-mobile-menu-item">
      <a href="#" class="universal-mobile-menu-link">
        <span>${cat}</span>
        <span class="universal-mobile-menu-arrow">→</span>
      </a>
    </li>`);
          });
        }

        if (drawerListItems.length > 0) {
            const mobileDrawerHtml = `
<div class="universal-mobile-menu-drawer" aria-hidden="true" style="display: none;">
  <div class="universal-mobile-drawer-header">
    <button type="button" class="universal-mobile-drawer-back" style="display: none;" aria-label="Back">← Back</button>
    <span class="universal-mobile-drawer-title">Menu</span>
    <button type="button" class="universal-mobile-drawer-close" aria-label="Close menu">✕</button>
  </div>
  <div class="universal-mobile-drawer-body">
    <ul class="universal-mobile-menu-list">
${drawerListItems.join('\n')}
    </ul>
    <div class="universal-mobile-subpanel-container" style="display: none;"></div>
  </div>
</div>`;
            const bodyEl = $('body');
            if (bodyEl.length > 0) {
              bodyEl.append(mobileDrawerHtml);
            } else {
              $.root().append(mobileDrawerHtml);
            }

            const mobileNavInlineCss = `
<style id="universal-mobile-nav-css">
/* Universal Mobile Navigation & Responsive Menu Drawer */
.universal-nav-toggle-item,
.universal-nav-toggle-wrapper,
.universal-nav-toggle,
.universal-mobile-menu-drawer {
  display: none !important;
}

@media (max-width: 899px) {
  .tds-align--center,
  [class*="align--center"],
  ol.tds-site-nav-items.tds-align--center,
  .dx-nav-item-group.tds-align--center {
    display: none !important;
  }
  .universal-nav-toggle-item {
    display: inline-flex !important;
    align-items: center !important;
    list-style: none !important;
  }
  .universal-nav-toggle-wrapper {
    display: flex !important;
    align-items: center !important;
  }
  .universal-nav-toggle {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    padding: 6px 14px !important;
    background: rgba(0, 0, 0, 0.08) !important;
    color: inherit !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    font-family: inherit !important;
    border: none !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    line-height: 1.2 !important;
    min-height: 32px !important;
    transition: background 0.2s ease, opacity 0.2s ease !important;
    z-index: 100 !important;
  }
  .universal-nav-toggle:hover {
    background: rgba(0, 0, 0, 0.14) !important;
  }
  .site-header.theme-dark .universal-nav-toggle,
  [data-theme="dark"] .universal-nav-toggle,
  .dark .universal-nav-toggle,
  .tds-site-header--dark .universal-nav-toggle {
    background: rgba(255, 255, 255, 0.16) !important;
    color: #ffffff !important;
  }
  .universal-mobile-menu-drawer.is-open {
    display: flex !important;
  }
  .universal-mobile-menu-drawer {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    height: 100dvh !important;
    background-color: #ffffff !important;
    color: #171a20 !important;
    z-index: 2147483647 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
    padding: 0 !important;
    margin: 0 !important;
    flex-direction: column !important;
    font-family: inherit !important;
    -webkit-overflow-scrolling: touch !important;
  }
  .site-header.theme-dark .universal-mobile-menu-drawer,
  [data-theme="dark"] .universal-mobile-menu-drawer,
  .dark .universal-mobile-menu-drawer,
  .tds-site-header--dark .universal-mobile-menu-drawer {
    background-color: #111111 !important;
    color: #f4f4f4 !important;
  }
  .universal-mobile-drawer-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 16px 24px !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
    position: sticky !important;
    top: 0 !important;
    background: inherit !important;
    z-index: 10 !important;
  }
  .site-header.theme-dark .universal-mobile-drawer-header,
  [data-theme="dark"] .universal-mobile-drawer-header,
  .dark .universal-mobile-drawer-header,
  .tds-site-header--dark .universal-mobile-drawer-header {
    border-bottom-color: rgba(255, 255, 255, 0.1) !important;
  }
  .universal-mobile-drawer-title {
    font-size: 18px !important;
    font-weight: 600 !important;
    letter-spacing: -0.01em !important;
    color: inherit !important;
  }
  .universal-mobile-drawer-close {
    background: rgba(0, 0, 0, 0.06) !important;
    border: none !important;
    border-radius: 50% !important;
    width: 36px !important;
    height: 36px !important;
    font-size: 16px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: inherit !important;
  }
  .universal-mobile-drawer-back {
    background: none !important;
    border: none !important;
    color: inherit !important;
    font-size: 15px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    padding: 6px 10px !important;
    border-radius: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    position: relative !important;
    z-index: 100 !important;
    pointer-events: auto !important;
  }
  .universal-mobile-drawer-body {
    padding: 16px 0 !important;
    flex: 1 !important;
  }
  .universal-mobile-menu-list {
    list-style: none !important;
    margin: 0 !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }
  .universal-mobile-menu-item {
    list-style: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.04) !important;
  }
  .universal-mobile-menu-btn,
  .universal-mobile-menu-link {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    width: 100% !important;
    padding: 16px 24px !important;
    font-size: 16px !important;
    font-weight: 500 !important;
    color: inherit !important;
    text-decoration: none !important;
    background: none !important;
    border: none !important;
    text-align: left !important;
    cursor: pointer !important;
    box-sizing: border-box !important;
    font-family: inherit !important;
  }
  .universal-mobile-menu-arrow {
    font-size: 18px !important;
    opacity: 0.5 !important;
  }
  .universal-mobile-subpanel-container {
    padding: 20px 24px !important;
    box-sizing: border-box !important;
  }
  .universal-mobile-subpanel-container [class*="panel-content"],
  .universal-mobile-subpanel-container [class*="link-groups"] {
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
    width: 100% !important;
  }
  .universal-mobile-subpanel-container a,
  .universal-mobile-subpanel-container button {
    color: inherit !important;
    font-size: 15px !important;
    text-decoration: none !important;
  }
}

@media (min-width: 900px) {
  .universal-nav-toggle-item,
  .universal-nav-toggle-wrapper,
  .universal-nav-toggle,
  .universal-mobile-menu-drawer {
    display: none !important;
  }
}
</style>`;
            if ($('head').length > 0 && $('#universal-mobile-nav-css').length === 0) {
              $('head').append(mobileNavInlineCss);
            }
          }
        }



      // Universal Mutual Exclusion for Dual Responsive Header Containers (e.g. mobile bar + desktop bar inside header)
      $('header, nav, [class*="site-header"]').each((_, hdr) => {
        const $hdr = $(hdr);
        const children = $hdr.children();
        if (children.length >= 2) {
          const c0 = children.eq(0);
          const c1 = children.eq(1);
          const c0Cls = (c0.attr('class') || '').toLowerCase();
          const c1Cls = (c1.attr('class') || '').toLowerCase();

          const c0IsMobile = /xl:hidden|lg:hidden|md:hidden|sm:hidden|mobile/i.test(c0Cls);
          const c1IsDesktop = /xl:flex|lg:flex|md:flex|desktop|hidden xl:flex|hidden lg:flex/i.test(c1Cls);

          const c1IsMobile = /xl:hidden|lg:hidden|md:hidden|sm:hidden|mobile/i.test(c1Cls);
          const c0IsDesktop = /xl:flex|lg:flex|md:flex|desktop|hidden xl:flex|hidden lg:flex/i.test(c0Cls);

          if (c0IsMobile && c1IsDesktop) {
            c0.attr('data-viewport-variant', 'mobile');
            c1.attr('data-viewport-variant', 'desktop');
          } else if (c1IsMobile && c0IsDesktop) {
            c1.attr('data-viewport-variant', 'mobile');
            c0.attr('data-viewport-variant', 'desktop');
          }
        }
      });

      // Strip unrelated popups, reviews, cookie banners, and floating dialogs that leaked into navigation DOM
      $('section.popup, div.popup, [class*="popup--alert"], [class*="bottom-sheet"], [class*="confirm-popup"], [class*="sns-share"], [class*="review-contents"], .mini-cart-popup, [class*="fab__confirm"]').remove();
      $('[class*="ot-pc-"], [id*="ot-pc-"], [id*="ot-lst-"], [class*="ot-sdk"], [id*="onetrust"], [class*="onetrust"], [class*="cookie-law"], [id*="ot-fltr"], [class*="ot-close"], [id*="close-pc-btn"], [class*="cookie-banner"], [class*="cookie-consent"], [class*="cookie-notice"], [id*="cookie-banner"], [id*="cookie-consent"], [id*="cookie-notice"]').each((_, el) => {
        const topBlock = $(el).parents('header > div, nav > div, section > div, body > div').last();
        if (topBlock.length > 0 && !topBlock.is('[class*="header-main"], [class*="nav-main"], [class*="navbar"], [class*="header__"], [class*="menu"]')) {
          topBlock.remove();
        } else {
          $(el).remove();
        }
      });

      // Normalize all SVGs so icons never inflate to screen width, but preserve brand/logo dimensions
      $('svg').each((_, el) => {
        const $svg = $(el);
        const isLogo = $svg.is('.logo, [class*="logo"], [class*="brand"], [id*="logo"], [id*="brand"]') ||
                       $svg.closest('[class*="logo"], [class*="brand"], [id*="logo"], [id*="brand"], [class*="header__logo"], [class*="nav__logo"]').length > 0;

        if (isLogo) {
          const w = $svg.attr('width');
          const h = $svg.attr('height');
          const vb = $svg.attr('viewBox');
          if (vb) {
            const parts = vb.trim().split(/[\s,]+/).map(Number);
            if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
              const aspect = parts[2] / parts[3];
              if (h && (!w || w === '100%')) {
                const computedW = Math.round(parseFloat(h) * aspect);
                $svg.attr('width', String(computedW));
              } else if (w && (!h || h === '100%')) {
                const computedH = Math.round(parseFloat(w) / aspect);
                $svg.attr('height', String(computedH));
              } else if ((!w || w === '100%') && (!h || h === '100%')) {
                const targetH = Math.min(parts[3], 32);
                const targetW = Math.round(targetH * aspect);
                $svg.attr('width', String(targetW));
                $svg.attr('height', String(targetH));
              }
            }
          }
          return;
        }

        const vb = $svg.attr('viewBox');
        const w = $svg.attr('width');
        const h = $svg.attr('height');
        if (!w || !h || w === '100%' || h === '100%') {
          if (vb) {
            const parts = vb.trim().split(/[\s,]+/).map(Number);
            if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
              const aspect = parts[2] / parts[3];
              if (h && (!w || w === '100%')) {
                const computedW = Math.round(parseFloat(h) * aspect);
                $svg.attr('width', String(computedW));
              } else if (w && (!h || h === '100%')) {
                const computedH = Math.round(parseFloat(w) / aspect);
                $svg.attr('height', String(computedH));
              } else {
                const isIcon = $svg.closest('a, button, li, [class*="icon"], [class*="item"]').length > 0;
                const targetW = isIcon ? Math.min(parts[2], 24) : parts[2];
                const targetH = isIcon ? Math.min(parts[3], 24) : parts[3];
                $svg.attr('width', String(targetW));
                $svg.attr('height', String(targetH));
              }
            }
          } else {
            $svg.attr('width', '24');
            $svg.attr('height', '24');
          }
        }
      });

      // Ensure any dialog panels / megamenu panels / search overlays start closed cleanly by default
      $('dialog, [role="dialog"], [aria-modal="true"], [class*="menu-panel"], [class*="header-panel"], [class*="modal"], [class*="gnb-search"], [class*="search-layer"], [class*="search-overlay"]').removeAttr('open').attr('aria-hidden', 'true');
      $('*').each((_, el) => {
        const cls = $(el).attr('class');
        if (cls) {
          const updated = cls
            .split(/\s+/)
            .filter((c) => !c.match(/^(active|is-active|open|is-open|show|is-show|expanded|is-expanded|current|is-current)$/i) && !c.match(/--(show|active|open|expanded|current)$/i))
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
      $('.staggered-start').removeClass('staggered-start').addClass('staggered-end');
    }

    // Restore animated/fade-in content elements that were snapshotted in hidden state (opacity: 0)
    $('[style*="opacity: 0"], [style*="opacity:0"]').each((_, el) => {
      const $el = $(el);
      const hasContent = $el.find('h1, h2, h3, h4, h5, h6, p, button, a, img, picture').length > 0 ||
        $el.is('[class*="hero"], [class*="banner"], [class*="poster"], [class*="item"], [class*="slide"], [class*="column"]');
      if (hasContent) {
        const style = $el.attr('style') || '';
        const clean = style.replace(/(?:^|;)\s*opacity\s*:\s*0\s*;?/gi, '').trim();
        if (clean) $el.attr('style', clean);
        else $el.removeAttr('style');
      }
    });

    // Ensure all staggered items inside staggered-end containers have initial opacity and transform restored
    $('.staggered-end [data-staggered-item], [data-component-list*="StaggeredFadeIn"] [data-staggered-item]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const clean = style.replace(/(?:^|;)\s*opacity\s*:\s*0\s*;?/gi, '').replace(/(?:^|;)\s*transform\s*:[^;]+;?/gi, '').trim();
      if (clean) $(el).attr('style', clean);
      else $(el).removeAttr('style');
    });

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

      if (gatheredSymbols.length > 0) {
        $.root().prepend(`\n<svg xmlns="http://www.w3.org/2000/svg" style="display:none;" aria-hidden="true">\n${gatheredSymbols.join('\n')}\n</svg>\n`);
      }
    }

    // Attach headlessui portal roots and floating menus if present in snapshot
    if (ast.rawHtmlSnapshot) {
      try {
        const $snap = cheerio.load(ast.rawHtmlSnapshot);
        const portalRoots = $snap('#headlessui-portal-root, [id*="portal-root"], [data-headlessui-portal]');
        if (portalRoots.length > 0 && $('#headlessui-portal-root').length === 0) {
          const portalHtml = $snap.html(portalRoots);
          if (portalHtml) {
            $.root().append(`\n${portalHtml}\n`);
          }
        }
      } catch {}
    }

    // Ensure modal dialogs are closed at rest if aria-hidden is true or they are interactive modals
    $('dialog[aria-hidden="true"], dialog[class*="modal"], dialog[data-shoptimizermodal-id]').removeAttr('open');

    // 5. Ensure top element has semantic landmark and id
    let result = '';
    const rootEl = $.root().children().first();
    const firstTag = rootEl.prop('tagName')?.toLowerCase();
    const hasLandmark = [
      'header', 'nav', 'section', 'footer', 'article', 'main',
      'sticky-header', 'site-header', 'custom-header', 'app-header'
    ].includes(firstTag || '') ||
      (rootEl.attr('class') || '').includes('header-wrapper') ||
      rootEl.find('> header, > nav').length > 0;

    if (!hasLandmark) {
      const wrapperTag = ast.archetype === 'footer' ? 'footer' : ast.archetype === 'navbar' ? 'header' : 'section';
      const hasExistingHeaderTag = $.html().includes('<header') || $.html().includes('class="site-header"');
      let originalLandmarkClasses = '';
      if (ast.rawHtmlSnapshot) {
        try {
          const $snap = cheerio.load(ast.rawHtmlSnapshot);
          const snapLandmark = $snap(wrapperTag).first();
          if (snapLandmark.length > 0) {
            originalLandmarkClasses = (snapLandmark.attr('class') || '').trim();
          }
        } catch {}
      }
      const archetypeClasses = ast.archetype === 'footer'
        ? 'site-footer page-footer'
        : ast.archetype === 'navbar'
        ? (hasExistingHeaderTag ? 'authentic-navbar header-nav' : 'site-header shared-header header-nav')
        : 'site-section page-section';
      const darkCls = ast.theme === 'dark' ? ' dark' : '';
      const combinedClasses = `${originalLandmarkClasses ? originalLandmarkClasses + ' ' : ''}authentic-section ${ast.archetype}-section ${archetypeClasses}${darkCls}`.trim();
      result = `<${wrapperTag} class="${combinedClasses}" id="${ast.id}" data-theme="${ast.theme || 'light'}">\n${$.html().trim()}\n</${wrapperTag}>`;
    } else {
      if (!rootEl.attr('id')) {
        rootEl.attr('id', ast.id);
      }
      if (ast.theme === 'dark' && (rootEl.hasClass('dark') || rootEl.attr('data-theme') === 'dark' || (rootEl.attr('class') || '').toLowerCase().includes('dark'))) {
        rootEl.attr('data-theme', 'dark');
      }
      result = $.html().trim();
    }

    const needsAuthenticCurtain = rawLower.includes('curtain') || rawLower.includes('backdrop');
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
