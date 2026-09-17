import * as cheerio from 'cheerio';
import { SectionArchetype, SectionMetadata } from '../types.js';
import { MASTER_ARCHETYPES } from './archetypes.js';

interface SectionRawContext {
  id: string; // "s1", "s2", etc.
  index: number;
  totalSections: number;
  selector: string;
  tagName: string;
  rect: { x: number; y: number; width: number; height: number };
  html: string;
}

export class SectionClassifier {
  public classify(ctx: SectionRawContext): SectionMetadata {
    const $ = cheerio.load(ctx.html);
    const rootElement = $.root().children().first();
    const classAttr = rootElement.attr('class') || '';
    const idAttr = rootElement.attr('id') || '';
    const roleAttr = rootElement.attr('role') || '';
    const fullText = $.text().toLowerCase();
    const innerHtml = ctx.html.toLowerCase();

    // Determine position tier: 'top' | 'middle' | 'bottom'
    let positionTier: 'top' | 'middle' | 'bottom' = 'middle';
    if (ctx.index === 0 || (ctx.rect.y < 300 && ctx.index <= 1)) {
      positionTier = 'top';
    } else if (ctx.index === ctx.totalSections - 1 || ctx.index >= ctx.totalSections - 2) {
      positionTier = 'bottom';
    }

    // Heuristics extracted from DOM
    const hasNavTag = $('nav').length > 0 || ctx.tagName === 'nav';
    const hasHeaderTag = $('header').length > 0 || ctx.tagName === 'header';
    const hasFooterTag = $('footer').length > 0 || ctx.tagName === 'footer';
    const hasForm = $('form').length > 0;
    const inputCount = $('input, textarea, select').length;
    const buttonCount = $('button, a[role="button"], a.btn, a.button').length;
    const linkCount = $('a').length;
    const imgCount = $('img, svg, picture').length;
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const cardLikeElements = $(
      '[class*="card"], [class*="item"], [class*="col"], [class*="grid"] > div, [class*="features"] > div'
    ).length;

    let bestArchetype: SectionArchetype = 'content';
    let highestScore = -1;
    let bestMatchedReasons: string[] = [];

    for (const rule of MASTER_ARCHETYPES) {
      let score = 0;
      const reasons: string[] = [];

      // 1. Explicit HTML tags / Roles
      if (rule.preferredTags?.includes(ctx.tagName)) {
        score += 25;
        reasons.push(`Tagged as <${ctx.tagName}>`);
      }
      if (rule.rolePatterns?.includes(roleAttr.toLowerCase())) {
        score += 25;
        reasons.push(`Role attribute matches '${roleAttr}'`);
      }

      // Special case: <nav> or <header> tags inside section
      if (rule.archetype === 'navbar' && (hasNavTag || hasHeaderTag)) {
        score += 35;
        reasons.push('Contains <nav> or <header> element');
      }
      if (rule.archetype === 'footer' && hasFooterTag) {
        score += 40;
        reasons.push('Contains <footer> element');
      }

      // 2. Class & ID attribute matches
      for (const pattern of rule.classPatterns) {
        if (pattern.test(classAttr) || pattern.test(innerHtml)) {
          score += 20;
          reasons.push(`Class pattern matched: ${pattern.source}`);
          break;
        }
      }
      for (const pattern of rule.idPatterns) {
        if (pattern.test(idAttr)) {
          score += 25;
          reasons.push(`ID matched: ${pattern.source}`);
          break;
        }
      }

      // 3. Keyword presence in text content
      let keywordHits = 0;
      for (const kw of rule.keywords) {
        if (fullText.includes(kw.toLowerCase())) {
          keywordHits++;
        }
      }
      if (keywordHits > 0) {
        const keywordScore = Math.min(keywordHits * 8, 30);
        score += keywordScore;
        reasons.push(`${keywordHits} archetype keywords detected`);
      }

      // 4. Position Bias
      if (rule.positionBias) {
        if (rule.positionBias === positionTier) {
          score += 20;
          reasons.push(`Position fits '${positionTier}' tier`);
        } else if (
          (rule.positionBias === 'top' && positionTier === 'bottom') ||
          (rule.positionBias === 'bottom' && positionTier === 'top')
        ) {
          score -= 30; // Strongly penalize navbar at the bottom or footer at the top
        }
      }

      // 5. Archetype-specific structural heuristics
      if (rule.archetype === 'navbar') {
        if (positionTier === 'top' && linkCount >= 3 && ctx.rect.height < 250) {
          score += 30;
          reasons.push('Top horizontal bar with multiple links');
        }
      } else if (rule.archetype === 'hero') {
        if (positionTier === 'top' && (h1Count > 0 || (h2Count > 0 && ctx.index <= 1))) {
          score += 30;
          reasons.push('Top primary headline (H1/H2) with high prominence');
        }
        if (buttonCount > 0 && imgCount > 0 && positionTier === 'top') {
          score += 15;
          reasons.push('Combines CTA button with visual media');
        }
      } else if (rule.archetype === 'pricing') {
        if (fullText.includes('$') || fullText.includes('€') || fullText.includes('/mo') || fullText.includes('month')) {
          score += 40;
          reasons.push('Currency or billing period patterns present');
        }
      } else if (rule.archetype === 'testimonials') {
        if (
          $('blockquote').length > 0 ||
          $('[class*="avatar"], [class*="author"], [class*="rating"], [class*="quote"]').length > 0
        ) {
          score += 30;
          reasons.push('Quote, avatar, or review rating elements present');
        }
      } else if (rule.archetype === 'contact') {
        if (hasForm || (inputCount >= 2 && buttonCount >= 1)) {
          score += 35;
          reasons.push('Form inputs with submission button detected');
        }
      } else if (rule.archetype === 'faq') {
        if ($('details, summary').length > 0 || fullText.includes('frequently asked')) {
          score += 40;
          reasons.push('FAQ accordion tags or title detected');
        }
      } else if (rule.archetype === 'carousel') {
        if (
          $('[class*="swiper"], [class*="slick"], [class*="slide"], [class*="carousel"]').length > 0 ||
          $('[class*="arrow"], [class*="indicator"], [class*="pagination"]').length > 0
        ) {
          score += 35;
          reasons.push('Slider / carousel controls detected');
        }
      } else if (rule.archetype === 'features' || rule.archetype === 'card-grid') {
        if (cardLikeElements >= 3) {
          score += 25;
          reasons.push(`${cardLikeElements} repetitive card/feature containers detected`);
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestArchetype = rule.archetype;
        bestMatchedReasons = reasons;
      }
    }

    // Default fallback: if top and not navbar, consider hero
    if (highestScore < 30) {
      if (positionTier === 'top' && ctx.index === 0) {
        bestArchetype = hasNavTag ? 'navbar' : 'hero';
        bestMatchedReasons = ['Defaulted based on top page position'];
      } else if (positionTier === 'bottom' && ctx.index === ctx.totalSections - 1) {
        bestArchetype = 'footer';
        bestMatchedReasons = ['Defaulted based on bottom page position'];
      } else {
        bestArchetype = 'content';
        bestMatchedReasons = ['General content section'];
      }
    }

    const confidence = Math.min(1.0, Math.max(0.2, highestScore / 100));

    return {
      id: ctx.id,
      name: `${ctx.id}-${bestArchetype}`,
      archetype: bestArchetype,
      confidence: parseFloat(confidence.toFixed(2)),
      matchedReasons: bestMatchedReasons,
      selector: ctx.selector,
      tagName: ctx.tagName,
      rect: ctx.rect,
      elementCount: $('*').length,
    };
  }
}
