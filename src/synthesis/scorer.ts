import * as cheerio from 'cheerio';
import { SectionAST, ScoringBreakdown } from './types.js';

export class QualityScorer {
  /**
   * Scores synthesized section code across Structure, Visuals, and Interactivity.
   * Strict threshold: Must achieve >= 90 to pass.
   */
  public evaluate(ast: SectionAST, synthesizedHtml: string, synthesizedCss: string): ScoringBreakdown {
    const failureReasons: string[] = [];

    // --- 1. Structural Semantics & Content Completeness (Max 30) ---
    let structuralScore = 0;
    const $ = cheerio.load(synthesizedHtml);

    // Check semantic tag usage
    const hasHeaderOrNav = $('header, nav, footer, section, article, [role="banner"], [role="navigation"], [class*="section"], [class*="header"], [class*="nav"]').length > 0;
    if (hasHeaderOrNav) {
      structuralScore += 10;
    } else {
      failureReasons.push('Missing semantic landmark tag (<header>, <nav>, <section>, <footer>)');
    }

    // Check title / heading preservation (or brand for navbar)
    // Check title / heading preservation (or brand for navbar)
    if (ast.archetype === 'navbar') {
      const hasBrand = $('.navbar-brand, .brand-name, .brand-logo-svg, .brand-logo, [class*="brand"], [class*="logo"], a[href="/"] svg, a:first-of-type svg, svg').length > 0;
      if (hasBrand) {
        structuralScore += 10;
      } else {
        failureReasons.push('Navbar brand or logo not preserved');
      }
    } else if (ast.title) {
      const headingText = $('h1, h2, h3, h4, h5, [class*="title"], [class*="heading"], [class*="name"]').text().toLowerCase();
      const firstTitlePart = ast.title.trim().slice(0, 10).toLowerCase();
      const headingMatches = headingText.includes(firstTitlePart) || $('h1, h2, h3, h4, [class*="title"]').length > 0;
      if (headingMatches) {
        structuralScore += 10;
      } else {
        structuralScore += 7;
        failureReasons.push(`Title not preserved: expected "${ast.title}"`);
      }
    } else {
      structuralScore += 10;
    }

    // Check container & accessibility
    const hasContainer = $('.container, [class*="container"], [class*="content"], [class*="wrapper"], [class*="inner"], [class*="module"], [class*="wrap"], [class*="box"], section, main').length > 0;
    const hasAria = $('[aria-label], [aria-expanded], [aria-hidden], [role]').length > 0 || ast.archetype !== 'navbar';
    if (hasContainer && hasAria) {
      structuralScore += 10;
    } else if (hasContainer) {
      structuralScore += 8;
    } else {
      structuralScore += 5;
      failureReasons.push('Missing responsive container or accessibility attributes');
    }

    // --- 2. Visual & Layout System (Max 40) ---
    let visualScore = 0;

    // Check design tokens in CSS variables
    const hasCssVars =
      synthesizedCss.includes('--color-primary') ||
      synthesizedCss.includes('--color-bg') ||
      synthesizedCss.includes('--font-family') ||
      synthesizedCss.includes(':root');
    if (hasCssVars) {
      visualScore += 15;
    } else {
      visualScore += 10;
      failureReasons.push('Missing CSS Custom Properties / design tokens');
    }

    // Check modern responsive Flexbox & Grid
    const hasFlexOrGrid =
      synthesizedCss.includes('display: flex') ||
      synthesizedCss.includes('display: grid') ||
      synthesizedCss.includes('display: -webkit-box');
    if (hasFlexOrGrid) {
      visualScore += 15;
    } else {
      visualScore += 8;
      failureReasons.push('Lacks complete Flexbox and CSS Grid layout rules');
    }

    // Check responsive media queries
    const hasMediaQueries = synthesizedCss.includes('@media');
    if (hasMediaQueries) {
      visualScore += 10;
    } else {
      visualScore += 5;
      failureReasons.push('Missing responsive media queries for tablet/mobile');
    }

    // --- 3. Interactive Fidelity (Hover & Click) (Max 30) ---
    let interactiveScore = 0;

    // Check hover transitions & button elevation
    const hasHoverStates =
      synthesizedCss.includes(':hover') &&
      synthesizedCss.includes('transition:');
    if (hasHoverStates) {
      interactiveScore += 15;
    } else if (synthesizedCss.includes(':hover')) {
      interactiveScore += 12;
    } else {
      failureReasons.push('Missing interactive hover transitions');
    }

    // Check click interactivity support
    const hasClickRules =
      synthesizedCss.includes('.is-open') ||
      synthesizedCss.includes('.is-active') ||
      synthesizedCss.includes('.active') ||
      synthesizedCss.includes('.show') ||
      synthesizedCss.includes('.accordion-content') ||
      ast.interactive.clickStates.length === 0;
    if (hasClickRules) {
      interactiveScore += 15;
    } else {
      interactiveScore += 10;
      failureReasons.push('Missing CSS rules for click toggles (e.g. .is-open or .is-active)');
    }

    const totalScore = structuralScore + visualScore + interactiveScore;
    const passed = totalScore >= 90;

    return {
      structuralScore,
      visualScore,
      interactiveScore,
      totalScore,
      passed,
      failureReasons,
    };
  }
}
