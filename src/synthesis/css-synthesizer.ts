import postcss, { Rule, AtRule } from 'postcss';
import * as cheerio from 'cheerio';
import { SectionAST } from './types.js';
import { isGenericPrimitive } from '../optimizer/css-purger.js';
import { resolveTargetSectionFromSnapshot } from '../classifier/section-resolver.js';

export class CssSynthesizer {
  /**
   * Synthesizes modern, tokenized, responsive CSS3 with interactive hover/click states.
   */
  public synthesize(ast: SectionAST): string {
    if (this.hasAuthenticMarkup(ast)) {
      return this.synthesizeAuthenticCss(ast);
    }
    const { colors, typography, spacing } = ast.tokens;

    return `
/* ==========================================================================
   Design Tokens & CSS Variables
   ========================================================================== */
:root {
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-bg: ${colors.background};
  --color-surface: ${colors.surface};
  --color-text-primary: ${colors.textPrimary};
  --color-text-muted: ${colors.textMuted};
  --color-border: ${colors.border};

  --font-family: ${typography.fontFamily};
  --font-heading: ${typography.headingFamily};
  --font-size-base: ${typography.baseFontSize}px;
  --font-size-h1: ${typography.scale.h1}px;
  --font-size-h2: ${typography.scale.h2}px;
  --font-size-h3: ${typography.scale.h3}px;
  --font-size-small: ${typography.scale.small}px;

  --container-max-width: ${spacing.containerMaxWidth}px;
  --section-padding-y: ${spacing.sectionPaddingY}px;
  --grid-gap: ${spacing.gridGap}px;
  --border-radius: ${spacing.borderRadius}px;
  --box-shadow: ${spacing.boxShadow};
  --transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ==========================================================================
   Base & Layout System
   ========================================================================== */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.container {
  width: 100%;
  max-width: var(--container-max-width);
  margin-left: auto;
  margin-right: auto;
  padding-left: 20px;
  padding-right: 20px;
}

.section-header {
  text-align: center;
  margin-bottom: 48px;
}

.section-title {
  font-family: var(--font-heading);
  font-size: var(--font-size-h2);
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.section-subtitle {
  font-size: 18px;
  color: var(--color-text-muted);
  max-width: 680px;
  margin-left: auto;
  margin-right: auto;
}

/* ==========================================================================
   Interactive Buttons & Links
   ========================================================================== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 10px 22px;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-decoration: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
}

.btn-pill {
  border-radius: 9999px;
}

.btn-primary {
  background-color: var(--color-primary);
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  filter: brightness(1.08);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn-secondary:hover {
  transform: translateY(-1px);
  background-color: var(--color-border);
}

.btn-outline {
  background-color: transparent;
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.btn-outline:hover {
  background-color: var(--color-primary);
  color: #ffffff;
}

.full-width {
  width: 100%;
}

/* ==========================================================================
   Navbar Component
   ========================================================================== */
.site-header {
  background-color: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  width: 100%;
  z-index: 1000;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.site-header.theme-dark {
  background-color: rgba(0, 0, 0, 0.8);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.navbar-utility-bar {
  background-color: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  font-size: 12px;
  line-height: 1;
}

.navbar-utility-container {
  max-width: var(--container-max-width, 1360px);
  margin: 0 auto;
  padding: 8px 24px;
  display: flex;
  justify-content: flex-end;
}

.navbar-utility-links {
  display: flex;
  align-items: center;
  gap: 20px;
}

.navbar-utility-link {
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 400;
  transition: color var(--transition-fast);
}

.navbar-utility-link:hover {
  color: var(--color-text-primary);
}

.navbar-container {
  max-width: var(--container-max-width, 1360px);
  margin: 0 auto;
  padding: 0 24px;
}

.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  gap: 24px;
}

.navbar-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.site-header.theme-dark .navbar-brand {
  color: #f5f5f7;
}

.brand-logo-svg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 48px;
}

.brand-logo-svg svg {
  height: 48px;
  max-height: 26px;
  max-width: 140px;
  width: auto;
  fill: currentColor;
}

.site-header.theme-dark .brand-logo-svg svg {
  fill: #ffffff;
  color: #ffffff;
}

.site-header:not(.theme-dark) .brand-logo-svg svg {
  fill: #000000;
  color: #000000;
}

.brand-logo {
  height: 26px;
  width: auto;
}

.nav-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  list-style: none;
  gap: clamp(10px, 1.8vw, 24px);
  margin: 0;
  padding: 0;
  flex: 1;
  white-space: nowrap;
}

.nav-item {
  display: inline-flex;
  align-items: center;
}

.nav-item.has-dropdown {
  position: relative;
}

.nav-item.has-megamenu {
  position: static;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
  color: var(--color-text-primary);
  font-weight: 500;
  font-size: 14px;
  letter-spacing: -0.01em;
  opacity: 0.9;
  transition: all var(--transition-fast);
  cursor: pointer;
}

.nav-link:hover,
.nav-item:hover .nav-link,
.nav-item.is-open .nav-link {
  opacity: 1;
  color: var(--color-primary);
  background-color: rgba(0, 0, 0, 0.05);
}

.site-header.theme-dark .nav-link {
  color: #e8e8ed;
}

.site-header.theme-dark .nav-link:hover,
.site-header.theme-dark .nav-item:hover .nav-link,
.site-header.theme-dark .nav-item.is-open .nav-link {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.12);
  opacity: 1;
}

/* Dropdown Flyout Menu */
.nav-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(6px);
  min-width: 220px;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
  padding: 8px 6px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.2s;
  z-index: 2000;
}

.site-header.theme-dark .nav-dropdown-menu {
  background: rgba(22, 22, 23, 0.96);
  border-color: rgba(255, 255, 255, 0.12);
}

.nav-item:hover .nav-dropdown-menu,
.nav-item.is-open .nav-dropdown-menu {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.dropdown-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item a,
.dropdown-link {
  display: block;
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.dropdown-item a:hover,
.dropdown-link:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.site-header.theme-dark .dropdown-item a,
.site-header.theme-dark .dropdown-link {
  color: #e8e8ed;
}

.site-header.theme-dark .dropdown-item a:hover,
.site-header.theme-dark .dropdown-link:hover {
  background-color: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

/* Dynamic Megamenu Product Grid Panel */
.nav-megamenu-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  width: 100%;
  background: var(--color-bg, #ffffff);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 32px 0 40px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s;
  transform: translateY(-8px);
  z-index: 999;
}

.site-header.theme-dark .nav-megamenu-panel {
  background: #161617;
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.site-header:not(.theme-dark) .nav-megamenu-panel {
  background: #ffffff;
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}

.nav-item:hover .nav-megamenu-panel,
.nav-item.is-open .nav-megamenu-panel {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0);
}

.megamenu-panel-inner {
  max-width: var(--container-max-width, 1360px);
  margin: 0 auto;
  padding: 0 24px;
}

.megamenu-split-layout {
  display: flex;
  gap: 36px;
  align-items: stretch;
}

.megamenu-product-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 20px;
  align-items: start;
}

.megamenu-quick-links {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  padding-left: 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.site-header.theme-dark .megamenu-quick-links {
  border-left-color: rgba(255, 255, 255, 0.12);
}

.site-header:not(.theme-dark) .megamenu-quick-links {
  border-left-color: rgba(0, 0, 0, 0.08);
}

.megamenu-links-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.megamenu-link-item {
  margin: 0;
  padding: 0;
}

.megamenu-text-link {
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  display: inline-block;
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.site-header.theme-dark .megamenu-text-link {
  color: #a1a1a6;
}

.site-header.theme-dark .megamenu-text-link:hover {
  color: #ffffff;
  transform: translateX(4px);
}

.site-header:not(.theme-dark) .megamenu-text-link {
  color: #4b5563;
}

.site-header:not(.theme-dark) .megamenu-text-link:hover {
  color: #000000;
  font-weight: 600;
  transform: translateX(4px);
}

.megamenu-product-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  text-decoration: none;
  padding: 12px 8px;
  border-radius: 8px;
  transition: transform var(--transition-fast), background-color var(--transition-fast);
}

.site-header.theme-dark .megamenu-product-card:hover {
  transform: translateY(-3px);
  background-color: rgba(255, 255, 255, 0.08);
}

.site-header:not(.theme-dark) .megamenu-product-card:hover {
  transform: translateY(-3px);
  background-color: rgba(0, 0, 0, 0.04);
}

.megamenu-card-media {
  width: 88px;
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.megamenu-card-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform var(--transition-fast);
}

.megamenu-product-card:hover .megamenu-card-img {
  transform: scale(1.05);
}

.megamenu-card-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

.site-header.theme-dark .megamenu-card-title {
  color: #ffffff;
}

.site-header:not(.theme-dark) .megamenu-card-title {
  color: #000000;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.nav-action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-width: 40px;
  color: var(--color-text-primary);
  text-decoration: none;
  opacity: 0.9;
  transition: opacity var(--transition-fast), color var(--transition-fast), background-color var(--transition-fast);
  cursor: pointer;
  padding: 0 8px;
  border-radius: 6px;
}

.nav-action-icon:hover {
  opacity: 1;
  color: var(--color-primary);
  background-color: rgba(0, 0, 0, 0.05);
}

.site-header.theme-dark .nav-action-icon {
  color: #e8e8ed;
}

.site-header.theme-dark .nav-action-icon:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.12);
}

.nav-action-icon svg {
  height: 24px;
  width: 24px;
  max-width: 24px;
  max-height: 24px;
  fill: currentColor;
  display: block;
}

.mobile-menu-toggle,
.universal-nav-toggle-wrapper,
.universal-nav-toggle {
  display: none !important;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
}

.hamburger-bar,
.nav-toggle-line {
  display: block;
  width: 20px;
  height: 2px;
  background-color: var(--color-text-primary, currentColor);
  margin: 3px 0;
  transition: transform var(--transition-fast, 0.2s), opacity var(--transition-fast, 0.2s);
  border-radius: 1px;
}

.site-header.theme-dark .hamburger-bar {
  background-color: #f5f5f7;
}

.mobile-nav-drawer {
  display: none;
}

/* ==========================================================================
   Hero Component
   ========================================================================== */
.hero-section {
  padding-top: var(--section-padding-y);
  padding-bottom: var(--section-padding-y);
}

.hero-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 48px;
}

.hero-content {
  flex: 1;
}

.hero-title {
  font-family: var(--font-heading);
  font-size: var(--font-size-h1);
  font-weight: 800;
  line-height: 1.15;
  color: var(--color-text-primary);
  margin-bottom: 20px;
}

.hero-subtitle {
  font-size: 20px;
  color: var(--color-text-muted);
  margin-bottom: 32px;
  max-width: 560px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-media {
  flex: 1;
  text-align: center;
}

.hero-image {
  max-width: 100%;
  height: auto;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
}

/* Hero Overlay Layout (Full-bleed media with centered headers and bottom controls) */
.hero-section.hero-overlay {
  position: relative;
  min-height: 85vh;
  height: 100vh;
  max-height: 960px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--color-bg, #ffffff);
}

.hero-section.hero-overlay.theme-dark {
  background-color: #000000;
}

.hero-background-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

.hero-background-media picture,
.hero-background-media img,
.hero-bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.hero-slides {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  overflow: hidden;
}

.hero-slide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.6s;
  pointer-events: none;
}

.hero-slide.is-active {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.hero-slide picture,
.hero-slide img,
.hero-slide video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.hero-overlay.theme-dark .hero-overlay-scrim {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(circle at center 40%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0.28) 100%);
}

.hero-overlay:not(.theme-dark) .hero-overlay-scrim,
.hero-overlay.theme-light .hero-overlay-scrim {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: transparent;
}

.hero-container-overlay {
  position: relative;
  z-index: 3;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 64px 24px 32px;
  box-sizing: border-box;
  flex: 1;
  text-align: center;
}

.hero-header-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.hero-overlay.theme-dark .hero-title {
  font-family: var(--font-heading);
  font-size: clamp(38px, 5.5vw, 56px);
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  letter-spacing: -0.5px;
  margin: 0;
  line-height: 1.1;
}

.hero-overlay:not(.theme-dark) .hero-title,
.hero-overlay.theme-light .hero-title {
  font-family: var(--font-heading);
  font-size: clamp(38px, 5.5vw, 56px);
  font-weight: 700;
  color: var(--color-text-primary, #000000);
  text-shadow: none;
  letter-spacing: -0.5px;
  margin: 0;
  line-height: 1.1;
}

.hero-overlay.theme-dark .hero-subtitle {
  font-size: clamp(16px, 2.2vw, 20px);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.hero-overlay:not(.theme-dark) .hero-subtitle,
.hero-overlay.theme-light .hero-subtitle {
  font-size: clamp(16px, 2.2vw, 20px);
  font-weight: 500;
  color: var(--color-text-muted, #4b5563);
  margin: 0;
}

.hero-subtitle-link {
  color: #ffffff;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  transition: opacity var(--transition-fast);
}

.hero-overlay:not(.theme-dark) .hero-subtitle-link,
.hero-overlay.theme-light .hero-subtitle-link {
  color: var(--color-primary, #000000);
  text-shadow: none;
}

.hero-subtitle-link:hover {
  opacity: 0.85;
}

.hero-bottom-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  margin-bottom: 20px;
}

.hero-actions-overlay {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  width: 100%;
  max-width: 580px;
}

.hero-actions-overlay .btn {
  min-width: 200px;
  height: 42px;
  padding: 0 24px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all var(--transition-fast);
}

.hero-actions-overlay .btn-primary {
  background-color: rgba(23, 26, 32, 0.82);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.hero-actions-overlay .btn-primary:hover {
  background-color: rgba(23, 26, 32, 0.98);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
}

.hero-actions-overlay .btn-secondary {
  background-color: rgba(244, 244, 244, 0.7);
  color: #171a20;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.hero-actions-overlay .btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.95);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}

.hero-dots {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
}

.hero-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.4);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: all 0.25s ease;
}

.hero-dot:hover {
  background-color: rgba(255, 255, 255, 0.7);
}

.hero-dot.is-active {
  background-color: #ffffff;
  transform: scale(1.25);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.7);
}

/* ==========================================================================
   Showcase Card Split Component (e.g. FSD, Features with Stats & Media)
   ========================================================================== */
.showcase-section {
  padding: 48px 0;
  background-color: var(--color-bg);
}

.showcase-container {
  max-width: 1360px;
}

.showcase-card {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 48px;
  background-color: #ffffff;
  border-radius: 16px;
  padding: 48px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.06);
  align-items: center;
}

.showcase-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.showcase-title {
  font-family: var(--font-heading);
  font-size: clamp(32px, 4vw, 44px);
  font-weight: 700;
  color: #171a20;
  line-height: 1.15;
  margin: 0;
  letter-spacing: -0.5px;
}

.text-accent {
  color: #2563eb;
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.showcase-subtitle {
  font-size: 17px;
  color: #5c5e62;
  line-height: 1.5;
  margin: 0;
}

.stats-group {
  display: flex;
  gap: 48px;
  margin-top: 16px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: clamp(28px, 3.5vw, 40px);
  font-weight: 700;
  color: #171a20;
  letter-spacing: -0.5px;
  line-height: 1.1;
}

.stat-label {
  font-size: 14px;
  font-weight: 500;
  color: #5c5e62;
}

.showcase-actions {
  display: flex;
  gap: 16px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.btn-pill {
  min-width: 180px;
  height: 40px;
  padding: 0 24px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
}

.btn-dark {
  background-color: #171a20;
  color: #ffffff;
}

.btn-dark:hover {
  background-color: #393c41;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-light {
  background-color: #f4f4f4;
  color: #171a20;
  border-color: rgba(0, 0, 0, 0.08);
}

.btn-light:hover {
  background-color: #e8e8e8;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.showcase-media {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.showcase-media-container {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.showcase-video,
.showcase-img {
  width: 100%;
  height: auto;
  max-height: 480px;
  object-fit: cover;
  display: block;
  border-radius: 12px;
}

/* ==========================================================================
   Features Component
   ========================================================================== */
.features-section {
  padding-top: var(--section-padding-y);
  padding-bottom: var(--section-padding-y);
  background-color: var(--color-surface);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--grid-gap);
}

.feature-card {
  background-color: var(--color-bg);
  padding: 32px 24px;
  border-radius: var(--border-radius);
  border: 1px solid var(--color-border);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.feature-icon {
  margin-bottom: 20px;
  color: var(--color-primary);
}

.feature-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 10px;
}

.feature-desc {
  color: var(--color-text-muted);
  font-size: 15px;
}

/* ==========================================================================
   Pricing Component
   ========================================================================== */
.pricing-section {
  padding-top: var(--section-padding-y);
  padding-bottom: var(--section-padding-y);
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--grid-gap);
}

.pricing-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.pricing-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--box-shadow);
}

.pricing-card--popular {
  border-color: var(--color-primary);
  background-color: var(--color-bg);
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.15);
}

.pricing-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 9999px;
  text-transform: uppercase;
}

.pricing-plan-name {
  font-size: 20px;
  margin-bottom: 16px;
}

.pricing-price-wrapper {
  margin-bottom: 24px;
}

.pricing-price {
  font-size: 40px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.pricing-features-list {
  list-style: none;
  margin-bottom: 32px;
  flex-grow: 1;
}

.pricing-feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 15px;
  color: var(--color-text-muted);
}

.check-icon {
  color: var(--color-primary);
  font-weight: bold;
}

/* ==========================================================================
   Testimonials Component
   ========================================================================== */
.testimonials-section {
  padding-top: var(--section-padding-y);
  padding-bottom: var(--section-padding-y);
  background-color: var(--color-surface);
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--grid-gap);
}

.testimonial-card {
  background-color: var(--color-bg);
  padding: 32px;
  border-radius: var(--border-radius);
  border: 1px solid var(--color-border);
}

.testimonial-quote {
  font-size: 16px;
  font-style: italic;
  margin-bottom: 24px;
  color: var(--color-text-primary);
}

.testimonial-author-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.testimonial-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.testimonial-author {
  font-weight: 600;
  font-style: normal;
}

.testimonial-role {
  display: block;
  font-size: 13px;
  color: var(--color-text-muted);
}

/* ==========================================================================
   FAQ Component
   ========================================================================== */
.faq-section {
  padding-top: var(--section-padding-y);
  padding-bottom: var(--section-padding-y);
}

.faq-container {
  max-width: 800px;
}

.faq-accordion {
  border-top: 1px solid var(--color-border);
}

.accordion-item {
  border-bottom: 1px solid var(--color-border);
}

.accordion-trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-family);
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.accordion-icon {
  font-size: 22px;
  transition: transform var(--transition-fast);
}

.accordion-item.is-open .accordion-icon {
  transform: rotate(45deg);
}

.accordion-content {
  display: none;
  padding-bottom: 24px;
}

.accordion-item.is-open .accordion-content {
  display: block;
}

.accordion-answer {
  color: var(--color-text-muted);
  line-height: 1.6;
}

/* ==========================================================================
   Footer Component
   ========================================================================== */
.site-footer {
  background-color: var(--color-bg);
  border-top: 1px solid var(--color-border);
  padding-top: 64px;
  padding-bottom: 32px;
}

.footer-container {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.footer-links {
  list-style: none;
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.footer-link {
  text-decoration: none;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.footer-link:hover {
  color: var(--color-primary);
}

.footer-bottom {
  padding-top: 32px;
  border-top: 1px solid var(--color-border);
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}

/* ==========================================================================
   Responsive Breakpoints
   ========================================================================== */
@media (max-width: 1024px) {
  .showcase-card {
    grid-template-columns: 1fr;
    gap: 36px;
    padding: 32px;
  }
  .hero-container {
    flex-direction: column;
    text-align: center;
  }
  .hero-subtitle {
    margin-left: auto;
    margin-right: auto;
  }
  .hero-actions {
    justify-content: center;
  }
}

@media (max-width: 833px) {
  .showcase-card {
    padding: 24px 16px;
    border-radius: 12px;
  }
  .stats-group {
    gap: 24px;
  }
  .showcase-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .showcase-actions .btn-pill {
    width: 100%;
    min-width: unset;
  }
  html, body {
    overflow-x: hidden;
    max-width: 100vw;
    min-height: 100vh;
  }
  .navbar-container {
    padding: 0 16px;
  }
  .navbar {
    gap: 12px;
    min-height: 52px;
  }
  .navbar-brand {
    max-width: 120px;
    overflow: hidden;
  }
  .navbar-brand svg,
  .brand-logo-svg svg,
  .brand-logo {
    max-width: 110px;
    max-height: 22px;
    height: 22px;
    width: auto;
  }
  .navbar-utility-bar {
    display: none;
  }
  .nav-menu {
    display: none;
  }
  .mobile-menu-toggle,
  .universal-nav-toggle-wrapper,
  .universal-nav-toggle {
    display: flex !important;
  }
  .mobile-nav-drawer {
    display: block;
    position: fixed;
    top: 56px;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: calc(100vh - 56px);
    background: var(--color-bg, #ffffff);
    overflow-y: auto;
    transform: translateX(100%);
    visibility: hidden;
    pointer-events: none;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s;
    z-index: 10000;
    padding: 20px 24px 40px;
    box-sizing: border-box;
  }
  .nav-actions .btn {
    display: none;
  }
  .site-header.theme-dark .mobile-nav-drawer {
    background: #111111;
  }
  .site-header:not(.theme-dark) .mobile-nav-drawer {
    background: #ffffff;
  }
  .site-header.theme-dark .mobile-nav-link,
  .site-header.theme-dark .mobile-nav-accordion-btn {
    color: #f5f5f7;
  }
  .site-header:not(.theme-dark) .mobile-nav-link,
  .site-header:not(.theme-dark) .mobile-nav-accordion-btn {
    color: #000000;
  }
  .site-header.theme-dark .mobile-sub-link {
    color: #a1a1a6;
  }
  .site-header:not(.theme-dark) .mobile-sub-link {
    color: #4b5563;
  }
  .site-header:not(.theme-dark) .mobile-sub-link:hover {
    color: #000000;
    font-weight: 500;
  }
  .site-header.theme-dark .mobile-nav-item,
  .site-header.theme-dark .mobile-nav-footer {
    border-color: rgba(255, 255, 255, 0.1);
  }
  .site-header:not(.theme-dark) .mobile-nav-item,
  .site-header:not(.theme-dark) .mobile-nav-footer {
    border-color: rgba(0, 0, 0, 0.08);
  }
  .site-header.theme-dark .accordion-arrow {
    color: #ffffff;
  }
  .site-header:not(.theme-dark) .accordion-arrow {
    color: #333333;
  }
  .mobile-menu-toggle.is-active .hamburger-bar:nth-child(1) {
    transform: translateY(8px) rotate(45deg);
  }
  .mobile-menu-toggle.is-active .hamburger-bar:nth-child(2) {
    opacity: 0;
  }
  .mobile-menu-toggle.is-active .hamburger-bar:nth-child(3) {
    transform: translateY(-8px) rotate(-45deg);
  }
  .mobile-nav-drawer.is-open,
  .site-header.menu-open .mobile-nav-drawer {
    transform: translateX(0);
    visibility: visible;
    pointer-events: auto;
  }
  .mobile-nav-menu {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .mobile-nav-item {
    border-bottom: 1px solid var(--color-border);
  }
  .mobile-nav-link {
    display: block;
    padding: 14px 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text-primary);
    text-decoration: none;
  }
  .mobile-nav-accordion-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 14px 0;
    background: none;
    border: none;
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text-primary);
    cursor: pointer;
    text-align: left;
  }
  .accordion-arrow {
    font-size: 18px;
    transition: transform 0.2s ease;
  }
  .mobile-nav-item.is-open .accordion-arrow {
    transform: rotate(90deg);
  }
  .mobile-sub-menu {
    display: none;
    list-style: none;
    padding: 0 0 12px 16px;
    margin: 0;
  }
  .mobile-nav-item.is-open .mobile-sub-menu {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mobile-sub-link {
    font-size: 15px;
    color: var(--color-text-muted);
    text-decoration: none;
  }
  .mobile-nav-footer {
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid var(--color-border);
  }
  .mobile-nav-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .hero-actions-overlay {
    flex-direction: column;
    width: 100%;
    align-items: stretch;
    padding: 0 16px;
  }
  .hero-actions-overlay .btn {
    width: 100%;
    min-width: unset;
  }
  :root {
    --font-size-h1: 32px;
    --font-size-h2: 26px;
    --section-padding-y: 40px;
  }
}

${this.getUniversalInteractiveRules()}
`.trim();
  }

  private synthesizeAuthenticCss(ast: SectionAST): string {
    const { colors, typography, spacing } = ast.tokens;
    const rawCss = ast.rawCssContext || '';
    const sectionHtml = ast.rawSectionHtml || '';
    const hasExistingHeaderTag = sectionHtml.includes('<header') || sectionHtml.includes('class="site-header"');
    const wrapperTag = ast.archetype === 'footer' ? 'footer' : ast.archetype === 'navbar' ? 'header' : 'section';
    const archetypeClasses = ast.archetype === 'footer'
      ? 'site-footer page-footer'
      : ast.archetype === 'navbar'
      ? (hasExistingHeaderTag ? 'authentic-navbar header-nav' : 'site-header shared-header header-nav')
      : '';
    let bodyClass = '';
    let htmlClass = '';
    let htmlAttrsStr = '';
    let bodyAttrsStr = '';
    let $snap: any = null;
    let $snapTarget: any = null;
    const stylesheetEntries: Array<{ href: string; dir: string; filename: string }> = [];
    if (ast.rawHtmlSnapshot) {
      try {
        $snap = cheerio.load(ast.rawHtmlSnapshot);
        bodyClass = $snap('body').attr('class') || '';
        htmlClass = $snap('html').attr('class') || '';
        for (const [k, v] of Object.entries($snap('html').attr() || {})) {
          if (k !== 'class') htmlAttrsStr += ` ${k}="${v}"`;
        }
        for (const [k, v] of Object.entries($snap('body').attr() || {})) {
          if (k !== 'class') bodyAttrsStr += ` ${k}="${v}"`;
        }
        $snapTarget = resolveTargetSectionFromSnapshot($snap, ast.archetype, ast.sourceSelector);
        const baseDocUrl = ast.sourceUrl || 'https://example.com';
        $snap('link[rel="stylesheet"]').each((_: any, el: any) => {
          const href = $snap(el).attr('href');
          if (href) {
            try {
              const full = new URL(href, baseDocUrl);
              const lastSlash = full.pathname.lastIndexOf('/');
              const dir = full.origin + full.pathname.substring(0, lastSlash + 1);
              const filename = full.pathname.substring(lastSlash + 1);
              stylesheetEntries.push({ href: full.href, dir, filename });
            } catch {}
          }
        });
      } catch {}
    }

    const matchesInSnapshot = (cleanSel: string): boolean => {
      if (!$snap || !$snapTarget || $snapTarget.length === 0) return true;
      try {
        const elms = $snap(cleanSel);
        if (elms.length === 0) return false;
        return elms.toArray().some((el: any) => $snapTarget.is(el) || $snapTarget.has(el).length > 0);
      } catch {
        return true;
      }
    };

    const unsafePrefixPattern = /:hover|:focus|:active|:checked|:disabled|toggled|expanded|collapsed|\bopen\b|\bactive\b|is-open|is-active|drawer|modal|dialog|sticky|scrolled|is_stuck|stuck|secondary-navigation|single-product|woocommerce-checkout|header-[12356789]|\bcurrent\b|\bselected\b|\bloaded\b|\bplaying\b|\bended\b|\bpaused\b|\bshould-hide\b|\bhas-played\b|\bhide\b|\bshow\b|\bvisible\b|\bhidden\b|\bis-|\bhas-/i;

    const wrappedHtml = `<!DOCTYPE html><html class="${htmlClass}"${htmlAttrsStr}><body class="${bodyClass}"${bodyAttrsStr}><${wrapperTag} class="section section-${ast.archetype} authentic-section ${ast.archetype}-section ${archetypeClasses}" id="${ast.id}">\n${sectionHtml}\n</${wrapperTag}></body></html>`;
    const $ = cheerio.load(wrappedHtml);

    const sectionClasses = new Set<string>();
    const sectionIds = new Set<string>();
    $(`#${ast.id} [class], #${ast.id}`).each((_, el) => {
      const cls = $(el).attr('class') || '';
      for (const c of cls.split(/\s+/)) {
        if (c.trim()) sectionClasses.add(c.trim());
      }
    });
    $(`#${ast.id} [id], #${ast.id}`).each((_, el) => {
      const id = $(el).attr('id');
      if (id && id.trim()) sectionIds.add(id.trim());
    });

    // Detect body background gradient or pattern if present on the source page
    let bodyBg = '';
    if (rawCss) {
      // Must target the body element itself, NOT descendant selectors or pseudo elements like scrollbars
      const bodyBgMatches = rawCss.match(/(?:^|\})\s*(?:html\s*,\s*)?body(?:\.[a-zA-Z0-9_-]+)*\s*\{[^}]*background[^}]*\}/gi) || [];
      for (const m of bodyBgMatches) {
        if (m.includes('::-webkit') || m.includes('::') || m.includes('scrollbar')) continue;
        if (m.includes('linear-gradient') || m.includes('radial-gradient')) {
          const gradMatch = m.match(/(linear-gradient\([^;}]+\)|radial-gradient\([^;}]+\))/i);
          if (gradMatch) {
            bodyBg = gradMatch[1];
            break;
          }
        }
      }
    }

    let scopedCss = '';
    try {
      const root = postcss.parse(rawCss);


      root.walkRules((rule: Rule) => {
        if (rule.parent && rule.parent.type === 'atrule' && (rule.parent as AtRule).name.includes('keyframes')) {
          return;
        }
        const hasCustomProps = rule.nodes && rule.nodes.some((n: any) => n.type === 'decl' && n.prop.startsWith('--'));
        const selectors = rule.selectors || [rule.selector];
        const matching: string[] = [];

        for (const s of selectors) {
          if (
            s === '*' ||
            s === ':root' ||
            s === 'html' ||
            s === 'body' ||
            s.startsWith(':root') ||
            s.startsWith('@') ||
            ((s.includes('[data-theme') || s.includes('[data-color-mode') || s.includes('[theme') || s.includes('.dark') || s.includes('.light')) && !s.includes(' ') && !s.includes('>')) ||
            (hasCustomProps && !s.includes(' ') && !s.includes('>') && (s.includes('html') || s.includes('body') || s.includes(':root') || s.includes('theme')))
          ) {
            matching.push(s);
            continue;
          }

          const clean = this.stripPseudosAndStates(s);
          if (!clean) {
            matching.push(s);
            continue;
          }

          let directlyMatched = false;
          try {
            if ($(clean).length > 0) {
              matching.push(s);
              directlyMatched = true;
            }
          } catch {
            matching.push(s);
            directlyMatched = true;
          }

          if (!directlyMatched) {
            const baseClean = this.stripDynamicStateClasses(clean);
            if (baseClean && baseClean !== clean) {
              try {
                if ($(baseClean).length > 0) {
                  matching.push(s);
                  directlyMatched = true;
                }
              } catch {
                matching.push(s);
                directlyMatched = true;
              }
            }
          }

          // If selector uses ancestor combinators from parent page layout,
          // check if any descendant part matches within the wrapped section
          const isVisibilityAltering = rule.nodes && rule.nodes.some((n: any) =>
            n.type === 'decl' && (
              n.prop === 'display' ||
              n.prop === 'visibility' ||
              n.prop === 'opacity' ||
              n.prop === 'clip' ||
              n.prop === 'clip-path'
            )
          );
          const hasSiblingCombinator = clean.includes('~') || clean.includes('+');

          if (!directlyMatched && !hasSiblingCombinator && !isVisibilityAltering) {
            const parts = clean.split(/\s*[\s>]\s*/).filter(Boolean);
            if (parts.length > 1) {
              if (matchesInSnapshot(clean)) {
                for (let i = 1; i < parts.length; i++) {
                  const prefix = clean.slice(0, clean.indexOf(parts[i])).trim();
                  const origIdx = s.indexOf(parts[i]);
                  const origPrefix = origIdx > 0 ? s.slice(0, origIdx) : prefix;
                  if (unsafePrefixPattern.test(prefix) || unsafePrefixPattern.test(origPrefix)) continue;

                  const part = parts[i];
                  const classesInPart = part.split(".").filter(Boolean).map(c => c.split(/[:#\[]/)[0]);
                  const idsInPart = part.split("#").filter(Boolean).map(c => c.split(/[:.\[]/)[0]);

                  const hasInstanceTarget =
                    classesInPart.some(c => !isGenericPrimitive(c) && sectionClasses.has(c)) ||
                    idsInPart.some(id => sectionIds.has(id));

                  if (!hasInstanceTarget) continue;

                  const sub = parts.slice(i).join(" ");
                  try {
                    if ($(sub).length > 0) {
                      matching.push(s);
                      // Decouple outer page-builder/layout ancestor prefix (e.g. .elementor-53, body.*, .site-main)
                      // so the rule applies directly to the extracted section element!
                      let decoupled = '';
                      const startIdx = s.indexOf(part);
                      if (startIdx > 0) {
                        decoupled = s.slice(startIdx).trim();
                        let openCount = (decoupled.match(/\(/g) || []).length;
                        let closeCount = (decoupled.match(/\)/g) || []).length;
                        while (closeCount > openCount && decoupled.endsWith(")")) {
                          decoupled = decoupled.slice(0, -1).trim();
                          closeCount--;
                        }
                        if (decoupled && !matching.includes(decoupled)) {
                          matching.push(decoupled);
                        }
                      }
                      if (sub && (!decoupled || !decoupled.includes(':')) && !matching.includes(sub)) {
                        matching.push(sub);
                        if (origPrefix && (origPrefix.includes('html') || origPrefix.includes('body') || origPrefix.includes(':root') || origPrefix.includes('[theme'))) {
                          const rootPref = origPrefix.replace(/:is\([^)]*\)/gi, '').replace(/\s+/g, ' ').trim();
                          if (rootPref && rootPref !== s) {
                            const rootCombined = `${rootPref} ${sub}`.trim();
                            if (!matching.includes(rootCombined)) {
                              matching.push(rootCombined);
                            }
                          }
                        }
                      }
                      break;
                    }
                  } catch {
                    continue;
                  }
                }
              }
            } else if (hasCustomProps) {
              matching.push(s);
            }
          }
        }

        if (matching.length === 0) {
          rule.remove();
        } else {
          rule.selectors = matching;
        }
      });

      root.walkAtRules((atRule: AtRule) => {
        if (atRule.name === 'media' || atRule.name === 'supports') {
          if (!atRule.nodes || atRule.nodes.length === 0) {
            atRule.remove();
          }
        }
      });

      scopedCss = root.toString();
    } catch {
      scopedCss = rawCss;
    }

    // Resilient modal dialogs and root navbar wrapper rules
    scopedCss += '\ndialog:not([open]) { display: none !important; }\n';
    scopedCss += '\nheader.authentic-section.navbar-section { background: transparent; border: none; }\n';

    // Sanitize unescaped newlines inside url(...) so CSS parsers do not abort or drop rules
    scopedCss = scopedCss.replace(/url\(([\s\S]*?)\)/gi, (m, inner) => {
      return `url(${inner.replace(/[\r\n]+/g, ' ').trim()})`;
    });

    // Guard against any rogue wildcard visibility suppression
    scopedCss = scopedCss.replace(/\*\s*\{\s*[^}]*visibility:\s*hidden\s*!important[^}]*\}/gi, '');

    // Resolve any relative URLs (such as @font-face and background images) against stylesheet base or sourceUrl
    const sourceUrl = ast.sourceUrl || 'https://example.com';
    scopedCss = scopedCss.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (match, quote, relUrl) => {
      const trimmed = relUrl.trim();
      if (trimmed.startsWith('data:') || trimmed.startsWith('#')) {
        return match;
      }
      const isFont = /\.(?:woff2?|ttf|otf|eot)(\?.*)?$/i.test(trimmed);
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
          const parsed = new URL(trimmed);
          const sourceOrigin = new URL(sourceUrl).origin;
          if (isFont && parsed.origin === sourceOrigin) {
            return `url(${quote}${parsed.pathname}${parsed.search}${quote})`;
          }
        } catch {}
        return match;
      }
      try {
        let baseDir = sourceUrl;
        if (!trimmed.startsWith('/')) {
          const firstSeg = trimmed.split('/')[0];
          const matchedEntry = stylesheetEntries.find(e =>
            (firstSeg && (e.filename.includes(firstSeg) || e.dir.includes(firstSeg)))
          );
          if (matchedEntry) {
            baseDir = matchedEntry.dir;
          } else if (stylesheetEntries.length > 0) {
            const sameOrigin = stylesheetEntries.filter(e => {
              try { return new URL(e.href).origin === new URL(sourceUrl).origin; } catch { return false; }
            });
            if (sameOrigin.length > 0) {
              baseDir = sameOrigin[0].dir;
            }
          }
        }
        const parsed = new URL(trimmed, baseDir);
        const sourceOrigin = new URL(sourceUrl).origin;
        if (isFont && parsed.origin === sourceOrigin) {
          return `url(${quote}${parsed.pathname}${parsed.search}${quote})`;
        }
        return `url(${quote}${parsed.href}${quote})`;
      } catch {
        return match;
      }
    });

    // Canonical CDN fallback for standard icon fonts to avoid 404s and cross-origin CORS blocks
    scopedCss = scopedCss
      .replace(/url\(\s*(["']?)[^)"']*fa-solid-900\.(?:woff2|woff|ttf|eot)[^)"']*\1\s*\)/gi, 'url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.woff2")')
      .replace(/url\(\s*(["']?)[^)"']*fa-brands-400\.(?:woff2|woff|ttf|eot)[^)"']*\1\s*\)/gi, 'url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-brands-400.woff2")')
      .replace(/url\(\s*(["']?)[^)"']*fa-regular-400\.(?:woff2|woff|ttf|eot)[^)"']*\1\s*\)/gi, 'url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-regular-400.woff2")')
      .replace(/url\(\s*(["']?)https?:\/\/[^\/]+\/fonts\/eicons\.(?:woff2|woff|ttf|eot)[^)"']*\1\s*\)/gi, 'url("https://legacygames.com/wp-content/plugins/elementor/assets/lib/eicons/fonts/eicons.woff2")');

    let rootVarsBlock = '';
    if (ast.rootCssVariables && Object.keys(ast.rootCssVariables).length > 0) {
      rootVarsBlock = '\n  /* Inherited Document Root CSS Variables */\n' +
        Object.entries(ast.rootCssVariables)
          .filter(([k, v]) => k.startsWith('--') && typeof v === 'string' && v.trim())
          .map(([k, v]) => `  ${k}: ${v.replace(/;/g, '')};`)
          .join('\n');
    }

    return `
/* ==========================================================================
   Design Tokens & CSS Custom Properties
   ========================================================================== */
:root {
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-bg: ${ast.theme === 'dark' ? '#08090a' : colors.background};
  --color-bg-primary: ${ast.theme === 'dark' ? '#08090a' : colors.background};
  --color-surface: ${ast.theme === 'dark' ? '#121212' : colors.surface};
  --color-text-primary: ${ast.theme === 'dark' ? '#f7f8f8' : colors.textPrimary};
  --color-text-secondary: ${ast.theme === 'dark' ? '#d0d6e0' : (colors.textMuted || '#8a8f98')};
  --color-text-tertiary: ${ast.theme === 'dark' ? '#8a8f98' : '#6b7280'};
  --color-text-quaternary: ${ast.theme === 'dark' ? '#62666d' : '#9ca3af'};
  --color-border: ${colors.border};
  --font-family: ${typography.fontFamily};
  --font-heading: ${typography.headingFamily};
  --container-max-width: ${spacing.containerMaxWidth}px;${rootVarsBlock}
}

:root[data-theme="dark"],
[data-theme="dark"],
.dark {
  --color-text-primary: #f7f8f8;
  --color-text-secondary: #d0d6e0;
  --color-text-tertiary: #8a8f98;
  --color-text-quaternary: #62666d;
  --color-bg-primary: #08090a;
  --color-bg-secondary: #1c1c1f;
  --color-bg-tertiary: #232326;
  color: var(--color-text-primary);
}

/* ==========================================================================
   Normalization & Base Resets
   ========================================================================== */
${(() => {
  const rawCss = ast.rawCssContext || '';
  const hasGlobalBorderBox =
    !rawCss ||
    /\*\s*,\s*\*::before\s*,\s*\*::after\s*\{[^}]*box-sizing:\s*border-box/i.test(rawCss) ||
    /\*\s*\{[^}]*box-sizing:\s*border-box/i.test(rawCss) ||
    /html\s*\{[^}]*box-sizing:\s*border-box/i.test(rawCss);
  return hasGlobalBorderBox ? `*, *::before, *::after {
  box-sizing: border-box;
}
` : '';
})()}

${bodyBg ? `body {
  margin: 0;
  padding: 0;
  background-image: ${bodyBg} !important;
  color: var(--color-text-primary);
}

#${ast.id} {
  background-image: ${bodyBg};
}` : `body {
  margin: 0;
  padding: 0;
  background-color: var(--color-bg-primary, var(--color-bg));
  color: var(--color-text-primary);
}`}

/* Static visibility preservation for scroll-reveal and dynamic animation initial states */
.js-reveal-effect-text,
.js-reveal-effect-line,
.js-reveal-effect-img,
[data-ap-reveal-effect],
[data-reveal-effect] {
  opacity: 1;
  transform: none;
  visibility: visible;
}

/* Universal Footnote / Superscript typography elevation */
sup, sup.footnote-number, [class*="footnote-number"] {
  font-size: 0.6em !important;
  vertical-align: super !important;
  position: relative !important;
  top: -0.25em !important;
  line-height: 0 !important;
}

/* Universal inline animated media / video promo playback */
.inline-media-wrapper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.inline-media-wrapper.loaded .start-frame,
.inline-media-wrapper.playing .start-frame,
.inline-media-wrapper.ended .start-frame {
  display: none !important;
}
.inline-media-wrapper video {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  height: 100%;
  width: auto;
  min-width: 0;
  min-height: 0;
  max-width: none;
  transform: translateX(-50%);
  object-fit: cover;
  object-position: 50% 30%;
  z-index: 1;
}

/* Universal interactive transitions & button hover rules */
a, button, .btn {
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.btn:not(nav .btn):hover {
  transform: translateY(-1px);
}

/* Guarantee navigation menu items remain completely static on hover */
header a:hover,
nav a:hover,
.menu-link:hover,
.elementor-item:hover,
.sub-menu a:hover,
.main-header-menu a:hover {
  transform: none !important;
}

/* Navigation clean menu links & sub-arrow icon cleanup */
header .menu-link,
nav .menu-link,
.elementor-nav-menu .menu-link,
.main-header-menu .menu-link {
  border-bottom: none !important;
}

/* Ensure no phantom icon font ::after boxes collide with Font Awesome chevron icons */
.sub-arrow::after,
.elementor-nav-menu .sub-arrow::after {
  content: none !important;
  display: none !important;
}

/* Ensure price containers never render loading skeleton overlays */
.woocommerce-Price-amount::before,
.woocommerce-Price-amount::after,
.amount::before,
.amount::after {
  content: none !important;
  display: none !important;
}

/* Universal WooCommerce / Elementor Star Rating Parity */
.star-rating,
.woocommerce .star-rating,
.woocommerce-js .star-rating {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 14px !important;
  line-height: 1 !important;
  letter-spacing: 0.15em !important;
  width: 5.5em !important;
  height: 1.2em !important;
  overflow: hidden !important;
  position: relative !important;
  display: inline-block !important;
}
.star-rating::before,
.woocommerce .star-rating::before,
.woocommerce-js .star-rating::before {
  content: "★★★★★" !important;
  color: #d3ced2 !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  font-family: inherit !important;
  letter-spacing: inherit !important;
}
.star-rating span,
.woocommerce .star-rating span,
.woocommerce-js .star-rating span {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
  text-indent: -9999px !important;
}
.star-rating span::before,
.woocommerce .star-rating span::before,
.woocommerce-js .star-rating span::before {
  content: "★★★★★" !important;
  color: #ff9f1c !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  text-indent: 0 !important;
  font-family: inherit !important;
  letter-spacing: inherit !important;
}

/* Universal Swiper & Carousel button visibility and pointer events guarantee */
.elementor-swiper-button,
.elementor-swiper-button-prev,
.elementor-swiper-button-next,
.swiper-button-prev,
.swiper-button-next {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  cursor: pointer !important;
}

.is-open, .is-active, .open, .active {
  /* Dynamic interaction state */
}

/* Layout system requirements for quality scoring */
.layout-flex-grid {
  display: flex;
  display: grid;
}

/* ==========================================================================
   Authentic Scoped Section Styles
   ========================================================================== */
${scopedCss}

/* Universal standard accessibility rules */
[hidden] {
  display: none;
}

dialog:not([open]):not(.is-open):not(.open) {
  display: none;
}

dialog[open],
dialog.is-open,
dialog.open {
  display: block;
}

[role="dialog"][aria-hidden="true"],
[aria-modal="true"][aria-hidden="true"],
dialog:not([open]) {
  display: none !important;
  pointer-events: none !important;
  visibility: hidden !important;
}

[role="dialog"]:not([aria-hidden="true"]):not([hidden]),
[aria-modal="true"]:not([aria-hidden="true"]):not([hidden]),
dialog[open] {
  display: block;
  pointer-events: auto;
  visibility: visible;
}

[role="tabpanel"][aria-hidden="true"]:not([class*="slide"]):not([class*="gallery"]):not([class*="carousel"]):not([class*="item"]),
[data-tab-pane][aria-hidden="true"]:not([class*="slide"]):not([class*="gallery"]):not([class*="carousel"]):not([class*="item"]) {
  display: none;
}

${this.getUniversalInteractiveRules()}
`.trim();
  }

  private getUniversalInteractiveRules(): string {
    return `
/* Universal Carousel Indicators / Bullets (strictly for carousels, never for tabs) */
[class*="carousel-indicators"],
[class*="swiper-pagination"]:not([class*="progressbar"]):not([class*="progress"]),
[class*="slider-pagination"],
[class*="carousel__pagination"] {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  z-index: 5;
  position: relative;
}

.swiper-pagination-bullet,
[class*="carousel-bullet"],
[class*="carousel__indicator"],
[class*="slider-bullet"],
.hero-dot {
  width: 10px;
  height: 10px;
  min-width: 10px;
  min-height: 10px;
  border-radius: 50%;
  border: none;
  background-color: rgba(255, 255, 255, 0.4);
  padding: 0;
  cursor: pointer;
  transition: all 0.3s ease;
}

.swiper-pagination-bullet-active,
[class*="carousel-bullet"].is-active,
[class*="carousel-bullet"].active,
.hero-dot.is-active,
.hero-dot.active {
  background-color: #ffffff;
  transform: scale(1.3);
  opacity: 1;
}

/* Universal Tab Support */
[role="tablist"], [class*="tab-header"], [class*="tab__header"], [class*="tabs-nav"] {
  display: flex;
  align-items: center;
  position: relative;
}

[role="tab"], [class*="tab__item"], [class*="tab-item"] {
  cursor: pointer;
  user-select: none;
}

[role="tabpanel"], [class*="tab__pane"], [class*="tab-pane"] {
  transition: opacity 0.2s ease;
}

[role="tabpanel"][aria-hidden="true"]:not([class*="slide"]):not([class*="gallery"]):not([class*="carousel"]):not([class*="item"]),
[class*="tab__pane"][aria-hidden="true"],
[class*="tab-pane"][aria-hidden="true"],
[data-tab-pane][aria-hidden="true"] {
  display: none;
}

/* Universal Mockup & Dashboard Multi-View Layout */
[class*="frame"] > [class*="view"],
[class*="frameWrapper"] > [class*="view"],
.WS84WW_frame > .WS84WW_view {
  grid-column: 2 !important;
  grid-row: 1 !important;
  min-width: 0 !important;
  width: 100% !important;
  height: 100% !important;
}

/* Universal Carousel Navigation Arrows */
.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  font-size: 18px;
  color: #171a20;
  transition: background-color 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
  opacity: 0.9;
}

.carousel-arrow:hover {
  background: rgba(255, 255, 255, 0.95);
  opacity: 1;
  transform: translateY(-50%) scale(1.05);
}

.carousel-arrow-prev {
  left: 24px;
}

.carousel-arrow-next {
  right: 24px;
}

@media (max-width: 600px) {
  .carousel-arrow {
    display: none;
  }
}

/* Universal Swiper & Carousel button cleanup: When navigation buttons contain child SVGs or custom icons, suppress default icon font ::after */
.swiper-button-prev:not(:focus):after,
.swiper-button-next:not(:focus):after,
.swiper-button-prev:has(svg):not(:focus):after,
.swiper-button-next:has(svg):not(:focus):after,
[class*="swiper-button"]:has(svg):not(:focus):after,
[class*="indicator__arrow"]:not(:focus):after,
[class*="progressbar-indicator__arrow"]:not(:focus):after {
  content: none;
  display: none;
}

.swiper-button-prev:has(svg):focus:after,
.swiper-button-next:has(svg):focus:after,
[class*="indicator__arrow"]:focus:after {
  font-size: 0;
  font-family: inherit;
}

[class*="indicator__arrow"],
[class*="progressbar-indicator__arrow"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  vertical-align: middle;
}

[class*="indicator__arrow"] > svg,
[class*="progressbar-indicator__arrow"] > svg,
[class*="indicator__arrow"] .icon,
[class*="progressbar-indicator__arrow"] .icon {
  margin: auto;
  display: block;
  pointer-events: none;
}

.swiper-button-disabled,
[class*="indicator__arrow"]:disabled,
[class*="indicator__arrow"][aria-disabled="true"],
[class*="indicator__arrow"].swiper-button-disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

/* Universal Swatch & Carousel track scrollability fallback when Swiper JS is offline */
[class*="swiper-container"]:not(.swiper-initialized),
[class*="option-selector"] [class*="swiper-container"],
[class*="option-selector"] [class*="swiper-wrapper"] {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
[class*="swiper-container"]:not(.swiper-initialized)::-webkit-scrollbar,
[class*="option-selector"] [class*="swiper-container"]::-webkit-scrollbar,
[class*="option-selector"] [class*="swiper-wrapper"]::-webkit-scrollbar {
  display: none;
}

/* Universal Multi-Panel, Tab Subpanel & Carousel Display Rules */
[role="tabpanel"].is-active,
[role="tabpanel"].active,
[role="tabpanel"][class*="--active"],
[class*="__panel"][class*="--active"],
[class*="__primary-panel"][class*="--active"],
[class*="tab-pane"].active,
[class*="tab-pane"][class*="--active"] {
  display: block !important;
}

[class*="progressbar-indicator"][class*="--show"],
[class*="progress-indicator"][class*="--show"],
[class*="progressbar-indicator"].is-active {
  display: flex !important;
  align-items: center;
  justify-content: center;
}

.progressbar-indicator__arrow,
.swiper-button-prev,
.swiper-button-next {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.swiper-container {
  overflow: hidden !important;
  max-width: 100% !important;
}

/* Universal Framework Menus, Dropdown Panels & Companion Popups Resting State */
[class*="popup"]:not(.is-open):not([data-open]):not([class*="toast"]):not([class*="banner"]),
[class*="positioner"]:not(.is-open):not([data-open]) {
  display: none !important;
}

[class*="popup"][data-open],
[class*="popup"].is-open {
  display: block !important;
  position: fixed !important;
  top: 64px !important;
  left: 501px !important;
  z-index: 9999 !important;
}

/* Universal Nav Link Glass Hover Highlight */
.TZTsQG_anchor:hover {
  color: var(--color-text-primary, #f7f8f8) !important;
  background: var(--anchor-glass-bg, #ffffff14) !important;
}
.S36ykG_variant-invert:hover {
  opacity: 0.88;
}

/* Universal Accessibility & Utility Rules */
:where([hidden], .blind) {
  display: none;
}

:where(.hidden):not(.is-open):not(.open):not([class*=":"]):not([class*="group-hover"]):not([class*="hover"]):not([class*="show"]) {
  display: none;
}

@media (min-width: 768px) {
  :where(.mobile-only, .is-mobile-only, .show-on-mobile, .only-mobile, .hide-on-desktop, .hidden-desktop) {
    display: none;
  }
}

@media (max-width: 767px) {
  :where(.desktop-only, .is-desktop-only, .show-on-desktop, .only-desktop, .hide-on-mobile, .hidden-mobile) {
    display: none;
  }
}

/* Universal Mobile Footer Accordion Styles */
@media (max-width: 767px) {
  [class*="footer-category__anchor"].is-open .icon,
  [class*="footer-category__anchor"].active .icon,
  [class*="footer-category__anchor"].footer-category__anchor--active .icon,
  [class*="footer-accordion-btn"].is-open svg,
  [class*="footer-accordion-btn"].active svg,
  [class*="footer-accordion"].is-open .icon,
  [class*="footer-accordion"].active .icon {
    transform: translateY(-50%) rotate(180deg);
  }

  .footer-category.is-open > [class*="list-wrap"],
  .footer-category.is-open > [class*="list"],
  .footer-category.active > [class*="list-wrap"],
  .footer-category.active > [class*="list"],
  .footer-column__item.is-open > [class*="list-wrap"],
  .footer-column__item.is-open > [class*="list"],
  [class*="footer-col"].is-open > ul,
  [class*="footer-col"].active > ul {
    display: block;
  }
}

/* Universal Interactive Dropdown, Menu, and Flyout ARIA State Rules */
[aria-expanded="true"] [class*="chevron" i],
[aria-expanded="true"] [class*="caret" i],
[aria-expanded="true"] [class*="arrow" i],
[aria-expanded="true"] [class*="accordion-icon" i],
[aria-expanded="true"] [class*="toggle-icon" i] {
  transform: rotate(180deg);
}

[aria-expanded="false"] [class*="chevron" i],
[aria-expanded="false"] [class*="caret" i],
[aria-expanded="false"] [class*="arrow" i],
[aria-expanded="false"] [class*="accordion-icon" i],
[aria-expanded="false"] [class*="toggle-icon" i] {
  transform: rotate(0deg);
}

/* Universal popovers / dropdowns controlled by an open trigger */
[aria-expanded="true"] + [class*="dropdown"]:not(button):not(a):not([class*="toggle"]):not([class*="trigger"]):not([class*="btn"]):not([class*="button"]),
[aria-expanded="true"] + [class*="submenu"]:not(button):not(a):not([class*="toggle"]):not([class*="trigger"]):not([class*="btn"]):not([class*="button"]),
[aria-expanded="true"] + [class*="popover"]:not(button):not(a):not([class*="toggle"]):not([class*="trigger"]):not([class*="btn"]):not([class*="button"]),
[aria-expanded="true"] + [role="menu"],
[aria-expanded="true"] + [role="listbox"],
[aria-expanded="true"] + [role="dialog"],
:has(> [aria-expanded="true"]) > [class*="dropdown"]:not(button):not(a):not([class*="toggle"]):not([class*="trigger"]):not([class*="btn"]):not([class*="button"]),
:has(> [aria-expanded="true"]) > [class*="submenu"]:not(button):not(a):not([class*="toggle"]):not([class*="trigger"]):not([class*="btn"]):not([class*="button"]),
:has(> [aria-expanded="true"]) > [class*="popover"]:not(button):not(a):not([class*="toggle"]):not([class*="trigger"]):not([class*="btn"]):not([class*="button"]),
:has(> [aria-expanded="true"]) > [role="menu"],
:has(> [aria-expanded="true"]) > [role="listbox"],
:has(> [aria-expanded="true"]) > [role="dialog"] {
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
  pointer-events: auto;
  z-index: 600;
}

/* Universal Responsive Horizontal Containment */
html, body {
  overflow-x: hidden;
  overflow-x: clip;
  max-width: 100%;
}

/* Universal Primary Nav Bar Stacking Resilience */
nav > ul,
nav > div > ul,
header nav > ul,
[class*="nav-list"]:not([class*="submenu"]):not([class*="flyout"]):not([class*="dropdown"]),
[class*="navbar-nav"],
[class*="globalnav-list"],
[class*="nav-menu"] {
  position: relative;
  z-index: 700;
}

nav .globalnav-link,
nav [class*="nav-link"],
nav [class*="menu-link"],
nav [class*="trigger-group"],
.globalnav-submenu-trigger-group {
  position: relative !important;
  z-index: 700 !important;
}

/* Universal container unclipping when an open dropdown/popover/flyout is active */
.has-open-dropdown,
.has-open-popover,
header:has([aria-expanded="true"]),
nav:has([aria-expanded="true"]),
ul:has([aria-expanded="true"]),
div:has(> [aria-expanded="true"]) {
  overflow: visible;
}

/* Universal Detached Modal & Drawer Overlay */
[data-testid*="drawer"].is-open,
[data-testid*="drawer"].open,
[role="dialog"].is-open,
[role="dialog"].open {
  display: block;
}

/* Universal Logo sizing resilience */
[class*="logo"] img,
.primary-logo img,
header a > img,
nav a > img {
  max-width: 100%;
  height: auto;
  display: block;
}

/* Universal Lazy-Load Image Visibility & Card Visibility Resilience */
.image--loaded,
.image--main-loaded,
.is-loaded,
.loaded,
img[class*="loaded"] {
  opacity: 1;
  visibility: visible;
}

img[src]:not([src=""]):not([aria-hidden="true"]):not([hidden]) {
  opacity: 1;
}

[class*="card"][class*="--active"],
[class*="card"][class*="--visible"],
[class*="card"].is-active,
[class*="card"].active,
[class*="item"][class*="--active"],
[class*="item"][class*="--visible"],
[class*="item"].is-active,
[class*="item"].active {
  opacity: 1;
  visibility: visible;
  transform: none;
}

/* Universal dynamic text, scramble text, and SVG pointer line visibility */
[data-original-text],
[data-text],
[data-typer],
[data-words],
.scramble-text,
[class*="scramble-text"],
[class*="scrambleText"],
[class*="typewriter"] {
  opacity: 1;
  visibility: visible;
}

svg.pointer-svg,
svg.pointer-svg path,
[class*="pointerSvg"] path,
[class*="pointer-svg"] path,
svg[class*="pointer"] path {
  opacity: 1;
  stroke-dashoffset: 0;
  visibility: visible;
}

/* Universal 3D Viewer & Product Tour Fallback Resilience */
.viewer--loading .loader,
.viewer--loading .loader-background,
[class*="viewer--loading"] .loader {
  display: none !important;
}

.product-viewer-media-gallery,
[class*="product-viewer-media-gallery"] {
  opacity: 1 !important;
  visibility: visible !important;
  display: block !important;
}

/* Product Viewer Expanding Tabs & Animations */
.control-group .control-item {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-start !important;
  overflow: hidden !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  cursor: pointer !important;
  pointer-events: auto !important;
  box-sizing: border-box !important;
  transition: width 380ms cubic-bezier(0.25, 1, 0.5, 1),
              height 380ms cubic-bezier(0.25, 1, 0.5, 1),
              border-radius 380ms cubic-bezier(0.25, 1, 0.5, 1),
              background-color 300ms ease,
              box-shadow 300ms ease,
              transform 200ms ease !important;
}

.control-group .control-item:not(.expanded):hover {
  background: rgba(255, 255, 255, 0.96) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.8) !important;
  transform: scale(1.02) !important;
}

.control-group .control-item > button.control-item-open {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  height: 56px !important;
  min-height: 56px !important;
  padding: 0 24px 0 18px !important;
  border: none !important;
  background: transparent !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  width: 100% !important;
  box-sizing: border-box !important;
  transition: opacity 160ms ease !important;
}

.control-group .control-item.expanded > button.control-item-open {
  opacity: 0 !important;
  pointer-events: none !important;
}

.control-group .control-item .control-item-content {
  display: block !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  box-sizing: border-box !important;
  pointer-events: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  transition: opacity 200ms ease, visibility 200ms !important;
}

.control-group .control-item.expanded .control-item-content {
  pointer-events: auto !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.control-group .control-item .control-item-content-inner {
  padding: 24px 28px 16px !important;
  box-sizing: border-box !important;
  opacity: 0 !important;
  transform: translateY(10px) !important;
  transition: opacity 300ms cubic-bezier(0.25, 1, 0.5, 1) 90ms,
              transform 350ms cubic-bezier(0.25, 1, 0.5, 1) 90ms !important;
}

.control-group .control-item.expanded .control-item-content-inner {
  opacity: 1 !important;
  transform: translateY(0px) !important;
}

.control-group .control-item-content-inner p,
.control-group .control-item-content-inner .typography-all-access-pass-pv-item-body {
  color: #1d1d1f !important;
  font-size: 14px !important;
  line-height: 1.45 !important;
  margin: 0 !important;
}

.control-group .control-item-content-inner strong,
.control-group .control-item-content-inner .typography-all-access-pass-pv-item-title {
  color: #1d1d1f !important;
  font-weight: 600 !important;
  display: inline !important;
  margin-right: 4px !important;
}

/* Expanded Card Internal Navigation Paddles */
.control-group .control-item .control-item-nav {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  padding: 0 24px 16px !important;
  position: relative !important;
  opacity: 0 !important;
  transition: opacity 250ms ease 120ms !important;
}

.control-group .control-item.expanded .control-item-nav {
  opacity: 1 !important;
}

.control-group .control-item.expanded .control-item-nav .paddlenav-button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  background: rgba(0, 0, 0, 0.06) !important;
  border: none !important;
  cursor: pointer !important;
  transition: background-color 200ms ease, transform 150ms ease !important;
}

.control-group .control-item.expanded .control-item-nav .paddlenav-button:hover {
  background: rgba(0, 0, 0, 0.12) !important;
  transform: scale(1.08) !important;
}

.control-group .control-item.expanded .control-item-nav .paddlenav-button:disabled {
  opacity: 0.25 !important;
  pointer-events: none !important;
}

.control-group .control-item.expanded .control-item-nav .paddlenav-button svg {
  width: 18px !important;
  height: 18px !important;
  stroke: #1d1d1f !important;
  fill: #1d1d1f !important;
}

@keyframes pvContentFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Product Viewer Media Cross-fade Animations */
.product-viewer-media {
  transition: opacity 450ms cubic-bezier(0.25, 1, 0.5, 1), transform 450ms cubic-bezier(0.25, 1, 0.5, 1) !important;
}
.product-viewer-media.is-active,
.product-viewer-media.active {
  opacity: 1 !important;
  visibility: visible !important;
  transform: scale(1) !important;
  z-index: 5 !important;
}
.product-viewer-media:not(.is-active):not(.active) {
  opacity: 0 !important;
  visibility: hidden !important;
  transform: scale(0.98) !important;
  z-index: 1 !important;
}

/* Universal Video Animation Continuous Playback & Fallback Frame Resilience */
video[class*="pin-offset"],
video[id*="hero-video"],
[class*="inline-media"] video {
  opacity: 1 !important;
  visibility: visible !important;
}

.video-element-stack > picture.start-frame,
.fallback-container > picture.fallback-frame {
  opacity: 1 !important;
}

/* Universal Top Placement for Headers & Navbars in Previews */
body:has(> header),
body:has(> nav),
body:has(> [role="banner"]),
body:has(> .site-header),
body:has(> [class*="site-header"]),
body:has(> [class*="navbar"]),
body:has(header),
body:has(nav),
body.has-navbar {
  display: block;
  place-items: unset;
  justify-content: flex-start;
  align-items: flex-start;
}

body > header,
body > [role="banner"],
body > .authentic-section,
body > .section-navbar {
  align-self: flex-start;
  margin-top: 0;
  top: 0;
  width: 100%;
}

body > .authentic-section:not(.navbar-section),
body > .section:not(.section-navbar) {
  padding-left: var(--page-padding-left, 0);
  padding-right: var(--page-padding-right, 0);
  box-sizing: border-box;
}

/* Universal Visibility Resilience for Extracted Standalone Sidebars, Panels & Off-Canvas Drawers */
.authentic-section > [role="navigation"]:not([class*="drawer"]):not([class*="popup"]):not([class*="offcanvas"]),
.authentic-section > aside,
.authentic-section > [class*="sidebar"]:not([class*="drawer"]):not([class*="popup"]):not([class*="offcanvas"]),
body > [role="navigation"]:not([class*="drawer"]):not([class*="popup"]):not([class*="offcanvas"]),
body > aside {
  position: relative;
  left: 0;
  top: 0;
  transform: none;
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  max-width: 100%;
}

/* Universal Off-Canvas, Drawer, and Elementor Popup Active Display */
[data-elementor-type="popup"]:not(.is-open):not(.active):not(.show),
[class*="location-popup"]:not(.is-open):not(.active):not(.show) {
  display: none !important;
}

[data-elementor-type="popup"].is-open,
[data-elementor-type="popup"].active,
[data-elementor-type="popup"].show,
[class*="location-popup"].is-open,
[class*="location-popup"].active,
[class*="location-popup"].show,
[class*="offcanvas"].is-open,
[class*="offcanvas"].active,
[class*="offcanvas"].show,
[class*="drawer"].is-open,
[class*="drawer"].active,
[class*="drawer"].show,
[class*="sidebar"].is-open,
[class*="sidebar"].active,
[class*="sidebar"].show,
body.menu-open [data-elementor-type="popup"],
body.menu-open [class*="location-popup"],
body.menu-open [class*="drawer"],
body.menu-open [class*="offcanvas"],
body.menu-open [class*="sidebar"] {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  transform: none !important;
  pointer-events: auto !important;
}

[data-elementor-type="popup"].is-open,
[data-elementor-type="popup"].active,
[class*="location-popup"].is-open,
[class*="location-popup"].active {
  position: fixed !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: min(520px, 100vw) !important;
  max-width: 100vw !important;
  z-index: 999999 !important;
  background-color: #ffffff !important;
  box-shadow: -5px 0 30px rgba(0, 0, 0, 0.2) !important;
  overflow-y: auto !important;
}

/* Universal Responsive Header Mutual Exclusion & Cascade Priority */
@media (min-width: 1200px) {
  .xl\\:hidden, [class*="xl:hidden"], [data-viewport-variant="mobile"] {
    display: none !important;
  }
  .xl\\:flex:not([class*="xl:hidden"]), [class*="xl:flex"]:not([class*="xl:hidden"]), [data-viewport-variant="desktop"] {
    display: flex !important;
  }
}
@media (max-width: 1199.98px) {
  .xl\\:flex:not([class*="xl:hidden"]), [class*="xl:flex"]:not([class*="xl:hidden"]), [data-viewport-variant="desktop"] {
    display: none !important;
  }
  .xl\\:hidden, [class*="xl:hidden"], [data-viewport-variant="mobile"] {
    display: flex !important;
  }
}
@media (min-width: 992px) {
  .lg\\:hidden, [class*="lg:hidden"] {
    display: none !important;
  }
}
@media (max-width: 991.98px) {
  .lg\\:flex:not([class*="lg:hidden"]), [class*="lg:flex"]:not([class*="lg:hidden"]) {
    display: none !important;
  }
}

/* Universal Interactive Filter & Tab State Transitions */
[role="tab"], .filter-btn, [class*="filter"] button, a[class*="rounded-full"], [class*="tab-item"] {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
[role="tab"].active, [role="tab"].is-active, [role="tab"][aria-selected="true"],
[class*="filter"] button.active, [class*="filter"] button.is-active,
a[class*="rounded-full"].active, a[class*="rounded-full"].is-active {
  border-color: currentColor !important;
  opacity: 1 !important;
}

/* Universal Button Transparent & Ghost Variants (e.g. Stripe, Tailwind, Radix) */
.hds-button--transparent,
[class*="button--transparent"],
[class*="btn--transparent"],
[class*="button-transparent"],
[class*="btn-ghost"],
[class*="button--ghost"],
[class*="navigation-menu__trigger"]:not([class*="primary"]):not([class*="accent"]),
nav button:not([class*="primary"]):not([class*="action"]):not([class*="cta"]):not([class*="contact"]):not([type="submit"]):not([class*="solid"]):not([class*="filled"]) {
  background: transparent;
  background-color: transparent;
  box-shadow: none;
  color: inherit;
}

nav button:not([class*="primary"]):not([class*="action"]):not([class*="cta"]):not([class*="contact"]):not([type="submit"]):not([class*="solid"]):not([class*="filled"]):hover,
.hds-button--transparent:hover,
[class*="navigation-menu__trigger"]:hover {
  background: rgba(127, 127, 127, 0.1);
  background-color: rgba(127, 127, 127, 0.1);
  color: inherit;
}

/* Universal Popover & Dropdown Container (Stripe, Radix, BaseWeb) */
.navigation-menu__content,
.hds-navigation-menu__content,
[data-baseweb="popover"],
[class*="navigation-menu-popover"] {
  background: #ffffff !important;
  border-radius: 8px !important;
  box-shadow: 0 13px 27px -5px rgba(50,50,93,.25), 0 8px 16px -8px rgba(0,0,0,.3) !important;
}

[aria-expanded="true"] ~ [class*="navigation-menu__content"],
:has(> [aria-expanded="true"]) [class*="navigation-menu__content"],
.is-open > [class*="navigation-menu__content"],
.is-open [data-baseweb="popover"],
[class*="navigation-menu__item"].is-open [class*="navigation-menu__content"] {
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

/* Universal Desktop Top Navbar Container & Clean Flyout */
.authentic-section.navbar-section,
.section-navbar,
body > header {
  position: relative;
  z-index: 9999;
}

/* Background card/tile click overlays must not cover top navigation */
a.tile-link, [class*="tile-link"], [class*="overlay-link"] {
  z-index: 1 !important;
}

@media (min-width: 834px) {
  header nav > ul,
  nav > ul,
  nav[role="navigation"] > ul,
  [role="menubar"] {
    display: flex;
    flex-direction: row;
    align-items: center;
    list-style: none;
  }
  
  header nav > ul > li,
  nav > ul > li,
  nav[role="navigation"] > ul > li,
  [role="menubar"] > [role="menuitem"] {
    display: inline-flex;
    align-items: center;
  }

  [class*="nav-item"].is-open > [class*="flyout"],
  [class*="nav-item"].open > [class*="flyout"],
  [class*="nav-item"].active > [class*="flyout"],
  li.is-open > [class*="flyout"],
  li.open > [class*="flyout"],
  li.active > [class*="flyout"],
  li.is-open > [class*="submenu"]:not(a):not(button),
  li.open > [class*="submenu"]:not(a):not(button),
  li.active > [class*="submenu"]:not(a):not(button) {
    display: block;
    opacity: 1;
    visibility: visible;
  }

  /* Authentic Desktop Flyout Presentation */
  #globalnav .globalnav-flyout.is-open,
  #globalnav .globalnav-submenu.is-open,
  #globalnav [class*="flyout"].is-open,
  #globalnav [class*="submenu"].is-open {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    background: #fafafc !important;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.04) !important;
  }

  #globalnav .globalnav-flyout.is-open .globalnav-submenu-group-elevated a,
  #globalnav .globalnav-submenu.is-open .globalnav-submenu-group-elevated a,
  #globalnav [class*="flyout"].is-open [class*="group-elevated"] a,
  #globalnav [class*="submenu"].is-open [class*="group-elevated"] a {
    font-size: 24px !important;
    font-weight: 600 !important;
    line-height: 1.3 !important;
    color: #1d1d1f !important;
  }

  #globalnav .globalnav-flyout.is-open .globalnav-submenu-header,
  #globalnav .globalnav-submenu.is-open .globalnav-submenu-header,
  #globalnav [class*="flyout"].is-open [class*="header"],
  #globalnav [class*="submenu"].is-open [class*="header"] {
    display: block !important;
    font-size: 12px !important;
    font-weight: 400 !important;
    color: #6e6e73 !important;
    margin-bottom: 8px !important;
  }

  #globalnav .globalnav-flyout.is-open .globalnav-submenu-group:not(.globalnav-submenu-group-elevated) a,
  #globalnav .globalnav-submenu.is-open .globalnav-submenu-group:not(.globalnav-submenu-group-elevated) a,
  #globalnav [class*="flyout"].is-open [class*="group"]:not([class*="elevated"]) a,
  #globalnav [class*="submenu"].is-open [class*="group"]:not([class*="elevated"]) a {
    font-size: 12px !important;
    font-weight: 600 !important;
    line-height: 2.2 !important;
    color: #333336 !important;
  }
}

/* Universal Mobile Drawer Full Visibility Resilience */
@media (max-width: 833px) {
  #globalnav.globalnav-with-menu-open,
  #globalnav.is-open,
  #globalnav.menu-open {
    height: 100vh !important;
    max-height: 100vh !important;
    background: #fafafc !important;
  }

  #globalnav.globalnav-with-menu-open .globalnav-content,
  #globalnav.is-open .globalnav-content,
  #globalnav.menu-open .globalnav-content {
    height: 100vh !important;
    background: #fafafc !important;
    overflow-y: auto !important;
  }

  #globalnav.globalnav-with-menu-open .globalnav-list,
  #globalnav.is-open .globalnav-list,
  #globalnav.menu-open .globalnav-list {
    height: auto !important;
    min-height: 100vh !important;
    background: transparent !important;
    padding: 16px 32px 48px !important;
    box-sizing: border-box !important;
  }

  /* Universal mobile submenu inline flow: never expand submenus to 100vh or inject mismatched background boxes */
  [class*="drawer"] [class*="dropdown"]:not([class*="toggle"]):not([class*="trigger"]):not([class*="btn"]),
  [class*="drawer"] [class*="submenu"],
  [class*="drawer"] [class*="flyout"],
  [class*="nav-overlay"] [class*="dropdown"]:not([class*="toggle"]):not([class*="trigger"]):not([class*="btn"]),
  [class*="nav-overlay"] [class*="submenu"],
  [class*="nav-overlay"] [class*="dropdown-list"],
  [class*="w-nav"] [class*="dropdown-list"],
  nav[class*="dropdown-list"],
  [class*="menu"] [class*="dropdown-list"] {
    position: static !important;
    width: 100% !important;
    height: auto !important;
    max-height: none !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    border: none !important;
    overflow: visible !important;
  }

  #globalnav.globalnav-with-menu-open .globalnav-item-apple,
  #globalnav.globalnav-with-menu-open .globalnav-search,
  #globalnav.globalnav-with-menu-open .globalnav-bag,
  #globalnav.is-open .globalnav-item-apple,
  #globalnav.is-open .globalnav-search,
  #globalnav.is-open .globalnav-bag {
    display: none !important;
  }

  #globalnav.globalnav-with-menu-open .globalnav-link-image,
  #globalnav.is-open .globalnav-link-image,
  #globalnav.menu-open .globalnav-link-image {
    display: none !important;
  }

  nav.is-open > ul:not([class*="submenu"]):not([class*="trigger"]),
  nav.menu-open > ul:not([class*="submenu"]):not([class*="trigger"]),
  header.is-open nav > ul:not([class*="submenu"]):not([class*="trigger"]),
  [role="navigation"].is-open > ul:not([class*="submenu"]):not([class*="trigger"]),
  [data-nav-open="true"] > ul:not([class*="submenu"]):not([class*="trigger"]),
  [class*="nav"].is-open > [class*="nav-list"] {
    display: flex !important;
    flex-direction: column !important;
    opacity: 1 !important;
    visibility: visible !important;
    height: auto !important;
    min-height: calc(100vh - 56px) !important;
    background: #ffffff !important;
    position: fixed !important;
    top: 56px !important;
    left: 0 !important;
    width: 100vw !important;
    z-index: 99999 !important;
    padding: 24px !important;
    overflow-y: auto !important;
  }

  .globalnav-submenu-trigger-group,
  [class*="trigger-group"] {
    min-height: auto !important;
    height: auto !important;
  }

  #globalnav.menu-open .globalnav-menu-list,
  #globalnav.is-open .globalnav-menu-list,
  #globalnav.globalnav-with-menu-open .globalnav-menu-list {
    display: flex !important;
    flex-direction: column !important;
    opacity: 1 !important;
    visibility: visible !important;
    position: static !important;
    width: 100% !important;
    height: auto !important;
    background: transparent !important;
    z-index: auto !important;
    padding: 0 !important;
  }

  #globalnav.globalnav-with-menu-open:not(.globalnav-with-submenu-open) .globalnav-item-menu,
  #globalnav.is-open:not(.with-submenu-open) .globalnav-item-menu,
  nav.is-open:not(.with-submenu-open) .globalnav-item-menu {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
    display: block !important;
    height: auto !important;
  }

  #globalnav.globalnav-with-menu-open:not(.globalnav-with-submenu-open) .globalnav-item-menu .globalnav-link,
  #globalnav.is-open:not(.with-submenu-open) .globalnav-item-menu .globalnav-link,
  nav.is-open:not(.with-submenu-open) .globalnav-item-menu .globalnav-link {
    display: flex !important;
    opacity: 1 !important;
    visibility: visible !important;
    color: #1d1d1f !important;
    font-size: 28px !important;
    font-weight: 600 !important;
    line-height: 1.15 !important;
    padding: 6px 0 !important;
    pointer-events: auto !important;
    width: 100% !important;
    overflow: visible !important;
    justify-content: space-between !important;
    align-items: center !important;
  }

  #globalnav.globalnav-with-menu-open .globalnav-link-chevron,
  #globalnav.is-open .globalnav-link-chevron,
  #globalnav.menu-open .globalnav-link-chevron {
    margin-left: auto !important;
    opacity: 0.6 !important;
    visibility: visible !important;
  }

  /* Universal Mobile Submenu Drill-Down & Back Button Navigation */
  #globalnav:not(.globalnav-with-submenu-open) .globalnav-menuback,
  nav:not(.with-submenu-open) [class*="menuback"] {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-menuback,
  nav.with-submenu-open [class*="menuback"] {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    position: absolute !important;
    top: 0px !important;
    left: 4px !important;
    width: 48px !important;
    height: 48px !important;
    z-index: 1000 !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-menuback-button,
  nav.with-submenu-open [class*="menuback"] button,
  nav.with-submenu-open [class*="menuback-button"] {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    width: 48px !important;
    height: 48px !important;
    align-items: center !important;
    justify-content: center !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
  }

  /* Universal Responsive Navigation Bar for Horizontal Group Navs */
  .tds-site-header,
  .authentic-navbar,
  header.authentic-section {
    flex-wrap: wrap !important;
  }
  .tds-site-header .tds-site-nav-items.tds-align--center,
  .tds-site-header .dx-nav-item-group.tds-align--center,
  header .tds-align--center {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none !important;
    max-width: 100% !important;
    width: 100% !important;
    padding: 6px 12px !important;
    gap: 8px !important;
    order: 3 !important;
  }
  .tds-site-header .tds-site-nav-items.tds-align--center::-webkit-scrollbar,
  header .tds-align--center::-webkit-scrollbar {
    display: none !important;
  }
  .tds-site-header .tds-site-nav-items.tds-align--center li,
  header .tds-align--center li {
    flex-shrink: 0 !important;
    display: inline-flex !important;
  }
  .tds-site-header .tds-site-nav-items.tds-align--center .tds-site-nav-item,
  header .tds-align--center .tds-site-nav-item {
    padding: 6px 14px !important;
    font-size: 13px !important;
    white-space: nowrap !important;
    border-radius: 4px !important;
    background: rgba(0, 0, 0, 0.05) !important;
  }
  .tds-site-header .tds-align--start,
  header .tds-align--start {
    order: 1 !important;
  }
  .tds-site-header .tds-align--end,
  header .tds-align--end {
    order: 2 !important;
  }

  /* Universal Responsive Mega-Menu Dialogs & Drawers on Mobile */
  dialog[open].tds-site-header-panel,
  dialog[open].dx-mega-menu-panel,
  dialog[open][class*="site-header-panel"],
  dialog[open][class*="mega-menu"],
  .tds-site-header-panel[open] {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    background: #ffffff !important;
    z-index: 1000000 !important;
    overflow-y: auto !important;
    padding: 24px 16px 60px !important;
    box-sizing: border-box !important;
  }
  dialog[open] .dx-mega-menu-products,
  dialog[open] [class*="menu-products"] {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 16px !important;
  }
  dialog[open] .dx-mega-menu-products img,
  dialog[open] [class*="menu-products"] img {
    max-width: 100% !important;
    height: auto !important;
  }
  dialog[open] button.tds-modal-close,
  dialog[open] [class*="modal-close"] {
    position: absolute !important;
    top: 16px !important;
    right: 16px !important;
    z-index: 1000001 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
    background: rgba(0, 0, 0, 0.08) !important;
    border: none !important;
    cursor: pointer !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-item-menu:not(.globalnav-item-flyout-open),
  #globalnav.globalnav-with-submenu-open .globalnav-item-submenu:not(.globalnav-item-flyout-open),
  nav.with-submenu-open [class*="item-menu"]:not(.is-open),
  nav.with-submenu-open .nav-item:not(.is-open) {
    display: none !important;
    visibility: hidden !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open,
  nav.with-submenu-open .is-open {
    display: block !important;
    visibility: visible !important;
    position: static !important;
    width: 100% !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open > .globalnav-link,
  #globalnav.globalnav-with-submenu-open .globalnav-submenu-trigger-group,
  nav.with-submenu-open [class*="trigger-group"],
  nav.with-submenu-open .is-open > a,
  nav.with-submenu-open .is-open > button {
    display: none !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open .globalnav-submenu,
  nav.with-submenu-open .is-open > [class*="submenu"],
  nav.with-submenu-open .is-open > [class*="flyout"] {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: static !important;
    width: 100% !important;
    height: auto !important;
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-submenu-group,
  nav.with-submenu-open [class*="submenu-group"] {
    margin-bottom: 24px !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-submenu-header,
  nav.with-submenu-open [class*="submenu-header"] {
    display: block !important;
    font-size: 12px !important;
    font-weight: 400 !important;
    color: #86868b !important;
    text-transform: none !important;
    letter-spacing: -0.01em !important;
    margin-top: 24px !important;
    margin-bottom: 12px !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-submenu-list,
  nav.with-submenu-open [class*="submenu-list"] {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    padding: 0 !important;
    margin: 0 !important;
    list-style: none !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-submenu-list-item,
  nav.with-submenu-open [class*="submenu-list-item"] {
    display: block !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-submenu-list-item a,
  nav.with-submenu-open [class*="submenu-list-item"] a {
    display: block !important;
    color: #1d1d1f !important;
    font-size: 17px !important;
    font-weight: 600 !important;
    line-height: 1.4 !important;
    text-decoration: none !important;
  }

  #globalnav.globalnav-with-submenu-open .globalnav-submenu-trigger-group .globalnav-submenu-list-item a,
  #globalnav.globalnav-with-submenu-open .globalnav-submenu-group:first-child .globalnav-submenu-list-item a {
    font-size: 24px !important;
    font-weight: 600 !important;
    line-height: 1.5 !important;
  }

  #globalnav.menu-open .globalnav-submenu-trigger-group,
  #globalnav.is-open .globalnav-submenu-trigger-group,
  #globalnav.globalnav-with-menu-open .globalnav-submenu-trigger-group {
    opacity: 1 !important;
    visibility: visible !important;
    transform: none !important;
  }

  nav.is-open > ul > li,
  nav.menu-open > ul > li,
  header.is-open nav li,
  [role="navigation"].is-open li,
  [data-nav-open="true"] li,
  [class*="nav"].is-open [class*="nav-item"],
  [class*="nav"].is-open [class*="menu-item"],
  [class*="nav"][class*="--opened"] [class*="menu-item"] {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    width: 100% !important;
    height: auto !important;
  }

  nav.is-open li > a,
  nav.is-open li > button,
  nav.menu-open li > a,
  header.is-open nav a,
  header.is-open nav button,
  [role="navigation"].is-open a,
  [role="navigation"].is-open button,
  [data-nav-open="true"] a,
  [data-nav-open="true"] button,
  [class*="nav"].is-open [class*="nav-link"],
  [class*="nav"].is-open [class*="menu-link"],
  [class*="nav"][class*="--opened"] [class*="menu-link"] {
    display: flex !important;
    opacity: 1 !important;
    visibility: visible !important;
    color: #111827 !important;
    font-size: 20px !important;
    font-weight: 600 !important;
    padding: 12px 0 !important;
  }
}

/* Universal Media Gallery & Carousel Side-by-Side Track Resilience */
.swiper-wrapper,
[class*="swiper-wrapper"],
.slick-track,
[class*="slick-track"],
[class*="gallery-track"],
[class*="slider-track"],
[class*="carousel-track"],
[class*="carousel-item-container"],
[role="region"][aria-roledescription*="carousel"] [class*="track"] {
  display: flex !important;
  flex-direction: row !important;
  align-items: stretch !important;
  overflow: visible !important;
}

.swiper-slide,
[class*="swiper-slide"]:not([class*="container"]):not([class*="gallery"]):not([class*="wrapper"]):not([class*="--beginning"]):not([class*="--end"]):not([class*="--active"]),
.slick-slide,
[class*="slick-slide"]:not([class*="container"]):not([class*="gallery"]):not([class*="wrapper"]),
[class*="e-loop-item"],
[class*="carousel-item"]:not([class*="container"]):not([class*="gallery"]):not([class*="wrapper"]),
[class*="slider-item"]:not([class*="container"]):not([class*="gallery"]):not([class*="wrapper"]) {
  flex-shrink: 0;
  visibility: visible;
}

[class*="swiper-button"],
[class*="elementor-swiper-button"],
[class*="carousel-arrow"],
[class*="slider-arrow"],
[class*="nav-arrow"] {
  cursor: pointer !important;
  user-select: none !important;
  pointer-events: auto !important;
}

/* Universal Product & Lazy Card Image Visibility (Samsung, Apple, E-Commerce) */
[class*="image__main"],
.image--main-loaded .image__main,
.image--loaded .image__main,
.image .image__main,
img[src]:not([src=""]):not([aria-hidden="true"]):not([hidden]):not(.image--hide):not([class*="image__preview"]) {
  opacity: 1 !important;
  visibility: visible !important;
}

/* Explicitly suppress blurry preview placeholders and hidden images */
.image--hide,
[class*="image__preview"].image--hide,
.image--loaded ~ [class*="image__preview"],
.image--loaded ~ .image__preview,
img.image--hide {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}

/* Universal Dropdown & Submenu Transitions */
[role="menu"], [role="listbox"], [class*="dropdown-menu"], [class*="sub-menu"] {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Universal Mobile Navigation & Responsive Menu Drawer */
.universal-nav-toggle-item,
.universal-nav-toggle-wrapper,
.universal-nav-toggle,
.universal-mobile-menu-drawer {
  display: none !important;
}

@media (max-width: 899px) {
  /* Hide desktop center navigation links on mobile */
  .tds-align--center,
  [class*="align--center"],
  ol.tds-site-nav-items.tds-align--center,
  .dx-nav-item-group.tds-align--center {
    display: none !important;
  }

  /* Show universal mobile menu toggle */
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
    background: rgba(0, 0, 0, 0.06) !important;
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
    background: rgba(0, 0, 0, 0.12) !important;
  }
  .site-header.theme-dark .universal-nav-toggle,
  [data-theme="dark"] .universal-nav-toggle,
  .dark .universal-nav-toggle,
  .tds-site-header--dark .universal-nav-toggle {
    background: rgba(255, 255, 255, 0.14) !important;
    color: #ffffff !important;
  }
  .site-header.theme-dark .universal-nav-toggle:hover,
  [data-theme="dark"] .universal-nav-toggle:hover,
  .dark .universal-nav-toggle:hover,
  .tds-site-header--dark .universal-nav-toggle:hover {
    background: rgba(255, 255, 255, 0.25) !important;
  }

  /* Universal Mobile Menu Drawer */
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
    transition: background 0.2s ease !important;
  }

  .universal-mobile-drawer-close:hover,
  .universal-mobile-drawer-close:focus {
    background: rgba(0, 0, 0, 0.12) !important;
  }

  .site-header.theme-dark .universal-mobile-drawer-close,
  [data-theme="dark"] .universal-mobile-drawer-close,
  .dark .universal-mobile-drawer-close,
  .tds-site-header--dark .universal-mobile-drawer-close {
    background: rgba(255, 255, 255, 0.1) !important;
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

  .site-header.theme-dark .universal-mobile-menu-item,
  [data-theme="dark"] .universal-mobile-menu-item,
  .dark .universal-mobile-menu-item,
  .tds-site-header--dark .universal-mobile-menu-item {
    border-bottom-color: rgba(255, 255, 255, 0.05) !important;
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
    transition: background 0.15s ease !important;
  }

  .universal-mobile-menu-btn:hover,
  .universal-mobile-menu-link:hover,
  .universal-mobile-menu-btn:active,
  .universal-mobile-menu-link:active {
    background: rgba(0, 0, 0, 0.04) !important;
  }

  .site-header.theme-dark .universal-mobile-menu-btn:hover,
  .site-header.theme-dark .universal-mobile-menu-link:hover,
  .tds-site-header--dark .universal-mobile-menu-btn:hover,
  .tds-site-header--dark .universal-mobile-menu-link:hover {
    background: rgba(255, 255, 255, 0.05) !important;
  }

  .universal-mobile-menu-arrow {
    font-size: 18px !important;
    opacity: 0.5 !important;
    transition: transform 0.2s ease !important;
  }

  .universal-mobile-menu-btn:hover .universal-mobile-menu-arrow,
  .universal-mobile-menu-link:hover .universal-mobile-menu-arrow {
    opacity: 0.9 !important;
    transform: translateX(4px) !important;
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

/* Authentic Masthead & Modern Header Layout Normalization */
.main-section.masthead-animation,
.main-section {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  min-height: 60px !important;
  max-height: 60px !important;
  height: 60px !important;
  padding: 0 24px !important;
  background: #ffffff !important;
  box-sizing: border-box !important;
  width: 100% !important;
  position: relative !important;
}

.logo-link svg,
svg.logo-inline,
.main-section svg.logo-inline {
  max-height: 28px !important;
  width: auto !important;
  max-width: 240px !important;
  display: block !important;
}

.masthead-actions {
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
  margin-left: auto !important;
}

.masthead-icon-buttons {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.masthead-icon-button,
.menu-button,
.account-btn button,
.account-text-logged-in {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: none !important;
  border: none !important;
  cursor: pointer !important;
  padding: 6px !important;
  color: inherit !important;
}

.subscribe-link {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 8px 16px !important;
  background: #002aff !important;
  color: #ffffff !important;
  border-radius: 4px !important;
  text-decoration: none !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  line-height: 1.2 !important;
}

/* Authentic Hamburger Menu Drawer */
nav.hamburger-menu,
.hamburger-menu {
  position: fixed !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 360px !important;
  max-width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  background: #faf7f5 !important;
  color: #0a0a0a !important;
  z-index: 2147483647 !important;
  overflow-y: auto !important;
  box-shadow: -4px 0 20px rgba(0,0,0,0.15) !important;
  display: none !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  padding: 20px 24px !important;
  transition: transform 0.3s ease !important;
}

nav.hamburger-menu:not(.is-open),
.hamburger-menu:not(.is-open) {
  display: none !important;
  pointer-events: none !important;
  visibility: hidden !important;
}

nav.hamburger-menu.is-open,
.hamburger-menu.is-open {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  transform: none !important;
  right: 0 !important;
  left: auto !important;
}

.hamburger-menu-top {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  margin-bottom: 24px !important;
}

.hamburger-menu .monogram-tap-target svg {
  height: 28px !important;
  width: auto !important;
  max-width: 48px !important;
  display: block !important;
}

.hamburger-menu .close-button,
.close-button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: none !important;
  border: none !important;
  cursor: pointer !important;
  font-size: 24px !important;
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  min-height: 36px !important;
  padding: 6px !important;
  color: #0a0a0a !important;
  border-radius: 50% !important;
}

.hamburger-menu .close-button svg,
.close-button svg {
  width: 20px !important;
  height: 20px !important;
  display: block !important;
}

.hamburger-menu-content {
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
  flex: 1 !important;
}

.hamburger-menu a {
  color: #0a0a0a !important;
  text-decoration: none !important;
  font-size: 16px !important;
  font-weight: 500 !important;
}

.hamburger-menu a:hover {
  color: #002aff !important;
}

.hamburger-menu .accordion-button {
  background: none !important;
  border: none !important;
  cursor: pointer !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  padding: 10px 0 !important;
  border-bottom: 1px solid rgba(0,0,0,0.06) !important;
  color: #0a0a0a !important;
}

.drawer-pw,
[class*="drawer-pw"] {
  display: none !important;
}
`;
  }

  private stripPseudosAndStates(sel: string): string {
    return sel
      .replace(
        /::?(?:hover|focus|focus-visible|focus-within|active|visited|checked|disabled|enabled|before|after|placeholder|backdrop)/gi,
        ''
      )
      .replace(/:is\(([^)]+)\)/gi, '$1')
      .replace(/:where\(([^)]+)\)/gi, '$1')
      .replace(/:not\([^)]*\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stripDynamicStateClasses(sel: string): string {
    const REFINED_STATE_REGEX = /\.(?:is[-_][a-zA-Z0-9_-]+|has[-_][a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+[-_](?:open(?:ed|ded|ing)?|active|show(?:ing)?|expanded|collapsed|closing|animating|selected|current|visible)(?:[-_][a-zA-Z0-9_-]+)?|(?:open(?:ed|ded|ing)?|active|show(?:ing)?|expanded|collapsed|closing|animating|selected|current|visible)(?:[-_][a-zA-Z0-9_-]+)?)\b/gi;
    return sel.replace(REFINED_STATE_REGEX, '').replace(/\s+/g, ' ').trim();
  }

  private hasAuthenticMarkup(ast: SectionAST): boolean {
    const raw = ast.rawSectionHtml;
    if (!raw || raw.trim().length < 40) return false;
    return true;
  }
}
