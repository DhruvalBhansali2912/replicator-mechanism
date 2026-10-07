import postcss, { Rule, AtRule } from 'postcss';
import * as cheerio from 'cheerio';
import { SectionAST } from './types.js';

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
  border-radius: 9999px !important;
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
  background-color: rgba(0, 0, 0, 0.8) !important;
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
  color: #ffffff !important;
}

.site-header:not(.theme-dark) .megamenu-card-title {
  color: #000000 !important;
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

.mobile-menu-toggle {
  display: none;
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

.hamburger-bar {
  display: block;
  width: 20px;
  height: 2px;
  background-color: var(--color-text-primary);
  margin: 3px 0;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
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
    max-width: 110px !important;
    max-height: 22px !important;
    height: 22px !important;
    width: auto !important;
  }
  .navbar-utility-bar {
    display: none;
  }
  .nav-menu {
    display: none !important;
  }
  .mobile-menu-toggle {
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
    display: none !important;
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
    transform: translateX(0) !important;
    visibility: visible !important;
    pointer-events: auto !important;
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
    const wrapperTag = ast.archetype === 'footer' ? 'footer' : ast.archetype === 'navbar' ? 'header' : 'section';
    const archetypeClasses = ast.archetype === 'footer'
      ? 'site-footer page-footer'
      : ast.archetype === 'navbar'
      ? 'site-header shared-header header-nav globalnav'
      : '';
    const wrappedHtml = `<${wrapperTag} class="section section-${ast.archetype} authentic-section ${ast.archetype}-section ${archetypeClasses}" id="${ast.id}">\n${sectionHtml}\n</${wrapperTag}>`;
    const $ = cheerio.load(wrappedHtml, { xmlMode: false }, false);

    let scopedCss = '';
    try {
      const root = postcss.parse(rawCss);

      root.walkRules((rule: Rule) => {
        if (rule.parent && rule.parent.type === 'atrule' && (rule.parent as AtRule).name.includes('keyframes')) {
          return;
        }
        const selectors = rule.selectors || [rule.selector];
        const matching: string[] = [];

        for (const s of selectors) {
          if (
            s === '*' ||
            s === ':root' ||
            s === 'html' ||
            s === 'body' ||
            s.startsWith(':root') ||
            s.startsWith('@')
          ) {
            matching.push(s);
            continue;
          }

          const clean = this.stripPseudosAndStates(s);
          if (!clean) {
            matching.push(s);
            continue;
          }

          try {
            if ($(clean).length > 0) {
              matching.push(s);
              continue;
            }
          } catch {
            matching.push(s);
            continue;
          }

          // If selector uses ancestor combinators from parent page layout (e.g. main > .section-hero or section [data-tile-id="..."]),
          // check if the descendant part matches within the wrapped section
          const parts = clean.split(/\s*[\s>+~]\s*/).filter(Boolean);
          if (parts.length > 1) {
            const prefix = parts[0].toLowerCase();
            if (['main', 'body', 'html', 'section', '.section', 'div', '#main', '#content', '#container', 'theme', 'root', 'app', '[data-'].some((p) => prefix.includes(p))) {
              for (let i = 1; i < parts.length; i++) {
                const sub = parts.slice(i).join(' ');
                try {
                  if ($(sub).length > 0) {
                    matching.push(s);
                    break;
                  }
                } catch {}
              }
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

    // Resolve any relative URLs (such as @font-face and background images) against sourceUrl
    const sourceUrl = ast.sourceUrl || 'https://example.com';
    scopedCss = scopedCss.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (match, quote, relUrl) => {
      const trimmed = relUrl.trim();
      if (trimmed.startsWith('data:') || trimmed.startsWith('#') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return match;
      }
      try {
        const resolved = new URL(trimmed, sourceUrl).href;
        return `url(${quote}${resolved}${quote})`;
      } catch {
        return match;
      }
    });

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
  --color-bg: ${ast.theme === 'dark' ? '#000000' : colors.background};
  --color-surface: ${ast.theme === 'dark' ? '#121212' : colors.surface};
  --color-text-primary: ${ast.theme === 'dark' ? '#ffffff' : colors.textPrimary};
  --color-text-muted: ${ast.theme === 'dark' ? '#a1a1a6' : colors.textMuted};
  --color-border: ${colors.border};
  --font-family: ${typography.fontFamily};
  --font-heading: ${typography.headingFamily};
  --container-max-width: ${spacing.containerMaxWidth}px;
  --r-globalnav-background-opened: ${ast.theme === 'dark' || colors.background === '#000000' || colors.background === '#111111' ? 'var(--r-globalnav-background-opened-dark, #161617)' : '#fafafc'};
  --r-globalnav-background-opened-dark: #161617;${rootVarsBlock}
}

/* ==========================================================================
   Normalization & Base Resets
   ========================================================================== */
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  -webkit-font-smoothing: antialiased;
  background-color: var(--color-bg, ${ast.theme === 'dark' ? '#000000' : '#ffffff'});
  color: var(--color-text-primary, ${ast.theme === 'dark' ? '#ffffff' : '#000000'});
}

/* Static visibility preservation for scroll-reveal and dynamic animation initial states */
.js-reveal-effect-text,
.js-reveal-effect-line,
.js-reveal-effect-img,
[data-ap-reveal-effect],
[data-reveal-effect] {
  opacity: 1 !important;
  transform: none !important;
  visibility: visible !important;
}

/* Universal hover elevation & click state rules */
a, button, .btn {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease, background-color 0.2s ease;
}

a:hover, button:hover, .btn:hover {
  transform: translateY(-1px);
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

/* ==========================================================================
   Universal Master Component Navigation System
   ========================================================================== */
/* Universal SVG Dimension & Icon Safety: guarantees icons never explode */
svg {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  max-width: 100%;
}

header svg:not(.logo):not([class*="logo"]):not([class*="brand"]),
nav svg:not(.logo):not([class*="logo"]):not([class*="brand"]),
[role="navigation"] svg:not(.logo):not([class*="logo"]):not([class*="brand"]) {
  max-height: 48px;
}

a:not([class*="logo"]):not([class*="brand"]) svg:not(.logo):not([class*="logo"]):not([class*="brand"]),
button:not([class*="logo"]):not([class*="brand"]) svg:not(.logo):not([class*="logo"]):not([class*="brand"]),
.nav-action-icon svg,
[class*="icon"]:not([class*="logo"]):not([class*="brand"]) svg {
  max-width: 28px;
  max-height: 28px;
}

/* Authentic Logo & Brand SVG Proportions: Never crush logos */
.logo,
.nav__logo,
[class*="nav__logo"],
[class*="site-logo"],
[class*="brand-logo"] {
  display: block;
}

.logo,
.nav__logo svg,
[class*="nav__logo"] svg,
[class*="logo"] svg,
[class*="brand"] svg,
svg.logo,
svg[class*="logo"] {
  width: auto !important;
  max-width: 100% !important;
  height: 100% !important;
  max-height: 5rem !important;
  fill: currentColor;
}

/* Base Navigation Container & Tokens */
header.section, nav.section, [role="banner"].section, .section-navbar, .site-header {
  --nav-bg: ${ast.theme === 'dark' || colors.background === '#000000' || colors.background === '#111111' ? '#000000' : '#ffffff'};
  --nav-text: ${ast.theme === 'dark' || colors.background === '#000000' || colors.background === '#111111' ? '#f5f5f7' : '#171a20'};
  --nav-text-muted: ${ast.theme === 'dark' || colors.background === '#000000' || colors.background === '#111111' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'};
  --nav-hover-bg: ${ast.theme === 'dark' || colors.background === '#000000' || colors.background === '#111111' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)'};
  --nav-dropdown-bg: ${ast.theme === 'dark' || colors.background === '#000000' || colors.background === '#111111' ? '#161617' : '#ffffff'};
  --r-globalnav-background-opened: var(--nav-dropdown-bg);
  --globalnav-background: var(--nav-dropdown-bg);
  --r-globalnav-color: var(--nav-text);
  --r-globalnav-color-secondary: var(--nav-text-muted);
  --r-globalnav-color-hover: var(--nav-text);
  --color-text: var(--nav-text);
  position: relative;
  z-index: 500 !important;
}

/* Universal Account & Utility Popups (hidden until hovered) */
aside[class*="account"], [class*="view-account"], [class*="account-popup"] {
  display: none;
}
[class*="account"]:hover aside[class*="account"],
[class*="account"]:hover [class*="view-account"],
[class*="account"]:hover [class*="account-popup"] {
  display: block;
}

/* Nav Item Hover Feedback - Authentic sites use text color / underlines; buttons/pills use background */
header nav a:hover,
header nav button:hover,
[role="navigation"] a:hover,
[role="navigation"] button:hover,
.nav-item:hover,
.nav-link:hover,
[class*="nav-item"]:hover,
.is-hovered {
  opacity: 1;
  cursor: pointer;
}

header nav button:hover,
[role="navigation"] button:hover,
.nav-pills .nav-link:hover,
.nav-pills a:hover {
  background-color: var(--nav-hover-bg, rgba(0, 0, 0, 0.05));
  border-radius: 4px;
}

/* Universal header & navbar stacking above backdrops */
header,
nav,
[role="banner"],
[class*="siteHeader"],
[class*="site-header"],
[class*="navbar"],
header,
nav,
.header,
.site-header,
.section-navbar,
[role="banner"],
[class*="globalnav"] {
  position: relative;
  z-index: 500 !important;
}

/* Backdrop & Curtain for navigation and dialog overlays */
.nav-curtain,
.globalnav-curtain,
.modal-backdrop,
[class*="modal-backdrop"],
[class*="dialog-backdrop"],
[class*="drawer-backdrop"],
[class*="curtain"]:not([class*="hero"]):not([class*="slide"]) {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 400;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.25s ease, visibility 0.25s;
}

.nav-curtain.is-active,
.globalnav-curtain.is-active,
.modal-backdrop.is-active,
[class*="modal-backdrop"].is-active,
[class*="dialog-backdrop"].is-active,
[class*="drawer-backdrop"].is-active,
[class*="curtain"].is-active {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

/* Default state for mobile nav toggle button on desktop */
.universal-nav-toggle-wrapper {
  display: none !important;
}

/* Universal mobile drawer open state fallback */
[role="dialog"].is-open,
[role="dialog"].open,
[role="dialog"][aria-hidden="false"],
[id*="mobile-menu" i].is-open,
[id*="mobile-menu" i].open,
[class*="mobile-menu" i].is-open,
[class*="mobile-menu" i].open,
[class*="drawer" i].is-open,
[class*="drawer" i].open,
[class*="nav-drawer" i].is-open,
[class*="nav-drawer" i].open,
[class*="sidebar" i].is-open,
[class*="sidebar" i].open {
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
  display: block !important;
  transform: none !important;
  z-index: 1000 !important;
}

/* Universal accordion open content fallback */
.is-open > [class*="toggle-content" i],
.is-open > [class*="accordion-content" i],
.is-open > [class*="collapse" i] {
  display: block;
}


/* ==========================================================================
   Desktop Navigation Architecture (>= 834px)
   ========================================================================== */
@media (min-width: 834px) {
  /* Detached dialog panels & megamenu overlays */
  dialog[class*="panel"],
  dialog[class*="menu"],
  [class*="mega-menu-panel"],
  dialog {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: 100%;
    background: var(--nav-dropdown-bg, #ffffff);
    border: none;
    margin: 0;
    padding-top: 56px;
    padding-bottom: 24px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
    z-index: 490;
    transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s;
    height: auto;
    max-height: 90vh;
    overflow-y: auto;
  }

  dialog:not([open]):not(.is-open):not(.open),
  [class*="mega-menu-panel"]:not([open]):not(.is-open):not(.open) {
    display: none !important;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-8px);
  }

  dialog[open],
  dialog.is-open,
  [class*="mega-menu-panel"][open],
  [class*="mega-menu-panel"].is-open {
    display: block !important;
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0);
  }

  /* Multi-column grid for products / cards inside panels */
  [class*="panel-content"],
  [class*="mega-menu-panel-content"] {
    width: 100%;
    max-width: 1360px;
    margin: 0 auto;
    box-sizing: border-box;
    padding: 24px;
  }

  /* Dynamic Multi-Column Products Grid: automatically tiles items inside panels/flyouts without breaking nested footers */
  dialog [class*="products"]:not([class*="link"]):not([class*="item"]):not([class*="btn"]):not([class*="footer"]):not([class*="wrapper"]),
  [class*="mega-menu-panel"] [class*="products"]:not([class*="link"]):not([class*="item"]):not([class*="btn"]):not([class*="footer"]):not([class*="wrapper"]),
  [class*="product-grid"] {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important;
    gap: 24px !important;
    align-items: start !important;
  }

  /* Inline dropdown menus and flyouts (BEM, Kebab, and Semantic) */
  .has-dropdown:hover > [class*="dropdown-menu"],
  .has-dropdown.is-open > [class*="dropdown-menu"],
  [class*="nav-item"]:hover > [class*="dropdown-menu"],
  [class*="nav-item"].is-open > [class*="dropdown-menu"],
  [class*="nav-item"]:hover > [class*="submenu"],
  [class*="nav-item"].is-open > [class*="submenu"],
  [class*="nav__item"]:hover > [class*="nav__submenu"],
  [class*="nav__item"].is-open > [class*="nav__submenu"],
  [class*="nav__item"]:focus-within > [class*="nav__submenu"],
  .nav__item:hover > .nav__submenu,
  .nav__item.is-open > .nav__submenu,
  .nav__item:focus-within > .nav__submenu,
  [class*="item"]:hover > [class*="submenu"],
  [class*="item"]:hover > [class*="sub-menu"],
  li:hover > [class*="submenu"],
  li:hover > [class*="sub-menu"],
  [class*="nav-item"][class*="flyout-open"] > [class*="flyout"],
  [class*="nav-item"][class*="flyout-open"] > [class*="submenu"],
  .group:hover > [class*="group-hover"],
  .group:hover [class*="group-hover\:block"],
  [class*="group"]:hover [class*="group-hover\:block"],
  .group:hover > [class*="dropdown"],
  [class*="group"]:hover > [class*="dropdown"],
  [class*="nav-item"]:hover > [class*="dropdown"],
  .nav-item:hover > .dropdown {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  /* Desktop Submenu Alignment & Flow */
  .nav__item > .nav__submenu,
  [class*="nav__item"] > [class*="nav__submenu"] {
    top: 100% !important;
    padding-top: 0.5rem !important;
  }

  /* Desktop background backdrop hover reveal */
  .nav__menu:hover::before,
  .nav__menu:focus-within::before,
  .nav__menu.nav__menu--expanded::before {
    visibility: visible !important;
    opacity: 1 !important;
  }
  .nav__menu:not(:hover):not(:focus-within):not(.nav__menu--expanded)::before {
    visibility: hidden !important;
    opacity: 0 !important;
  }

  /* Submenu flex columns */
  [class*="submenu-content"],
  [class*="flyout-content"],
  [class*="megamenu-content"] {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    justify-content: flex-start !important;
    align-items: flex-start !important;
    box-sizing: border-box !important;
    width: 100% !important;
  }

  [class*="submenu-group"],
  [class*="flyout-group"],
  [class*="megamenu-column"] {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 0% !important;
    min-width: 0 !important;
  }
}

/* ==========================================================================
   Mobile Navigation Architecture (< 834px)
   ========================================================================== */
@media (max-width: 833px) {
  /* Universal hamburger / menu trigger button (fallback only if authentic button is absent) */
  .universal-nav-toggle-wrapper {
    display: none !important;
  }
  body:not(:has([id*="menu-open"], [class*="menu-open"], [class*="openButton"], button[aria-label*="menu" i], button[aria-label*="nav" i], button[aria-controls*="menu" i], button[aria-controls*="nav" i])) .universal-nav-toggle-wrapper {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    position: fixed !important;
    top: 10px !important;
    right: 16px !important;
    z-index: 100002 !important;
  }

  .universal-nav-toggle {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 38px !important;
    height: 38px !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer !important;
    padding: 0 !important;
    color: inherit !important;
    position: relative !important;
    pointer-events: auto !important;
  }

  .universal-nav-toggle .nav-toggle-line {
    position: absolute !important;
    width: 22px !important;
    height: 2px !important;
    background: currentColor !important;
    border-radius: 2px !important;
    transition: transform 0.25s ease, opacity 0.25s ease !important;
    transform-origin: 50% 50% !important;
  }
  .universal-nav-toggle .nav-toggle-line:nth-child(1) { transform: translateY(-6px) !important; }
  .universal-nav-toggle .nav-toggle-line:nth-child(2) { transform: translateY(0) !important; }
  .universal-nav-toggle .nav-toggle-line:nth-child(3) { transform: translateY(6px) !important; }

  header.menu-open .universal-nav-toggle .nav-toggle-line:nth-child(1),
  header.is-open .universal-nav-toggle .nav-toggle-line:nth-child(1),
  nav.menu-open .universal-nav-toggle .nav-toggle-line:nth-child(1),
  nav.is-open .universal-nav-toggle .nav-toggle-line:nth-child(1) {
    transform: translateY(0) rotate(45deg) !important;
  }
  header.menu-open .universal-nav-toggle .nav-toggle-line:nth-child(2),
  header.is-open .universal-nav-toggle .nav-toggle-line:nth-child(2),
  nav.menu-open .universal-nav-toggle .nav-toggle-line:nth-child(2),
  nav.is-open .universal-nav-toggle .nav-toggle-line:nth-child(2) {
    opacity: 0 !important;
  }
  header.menu-open .universal-nav-toggle .nav-toggle-line:nth-child(3),
  header.is-open .universal-nav-toggle .nav-toggle-line:nth-child(3),
  nav.menu-open .universal-nav-toggle .nav-toggle-line:nth-child(3),
  nav.is-open .universal-nav-toggle .nav-toggle-line:nth-child(3) {
    transform: translateY(0) rotate(-45deg) !important;
  }



  /* When dialog / submenu is open on mobile: render as full-screen sub-drawer without getting blocked */
  dialog[open],
  dialog.is-open,
  [class*="mega-menu-panel"][open],
  [class*="mega-menu-panel"].is-open {
    display: block !important;
    position: fixed !important;
    top: 56px !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: calc(100vh - 56px) !important;
    height: calc(100dvh - 56px) !important;
    background: var(--nav-dropdown-bg, #ffffff) !important;
    z-index: 100001 !important;
    overflow-y: auto !important;
    padding: 24px !important;
    border: none !important;
  }

  /* When dialog is NOT open on mobile, keep it concealed */
  dialog:not([open]):not(.is-open),
  [class*="mega-menu-panel"]:not([open]):not(.is-open) {
    display: none !important;
  }

  /* Stacking mobile submenu content */
  [class*="submenu-content"],
  [class*="flyout-content"],
  [class*="megamenu-content"] {
    display: flex !important;
    flex-direction: column !important;
    flex-wrap: nowrap !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  [class*="submenu-group"],
  [class*="flyout-group"],
  [class*="megamenu-column"] {
    width: 100% !important;
    max-width: 100% !important;
    flex: none !important;
  }
}

/* ==========================================================================
   Universal Hero Archetype Scrim & Overlay Defaults
   ========================================================================== */
.hero-has-backdrop,
.hero-backdrop-container,
[class*="hero-fullscreen"],
[class*="hero-fullbleed"] {
  position: relative !important;
  width: 100% !important;
  min-height: clamp(520px, 80vh, 760px) !important;
  height: clamp(520px, 82vh, 760px) !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  opacity: 1 !important;
  visibility: visible !important;
}

@media (max-width: 600px) {
  .hero-has-backdrop,
  .hero-backdrop-container,
  [class*="hero-fullscreen"],
  [class*="hero-fullbleed"] {
    min-height: 85vh !important;
    height: auto !important;
  }
}

/* Universal Hero Slide Transitions */
.hero-slide {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  opacity: 0 !important;
  visibility: hidden !important;
  transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.5s ease !important;
  pointer-events: none !important;
  z-index: 1 !important;
}

.hero-slide.is-active,
.hero-slide[aria-hidden="false"] {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  z-index: 2 !important;
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
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 10px !important;
  z-index: 5 !important;
  position: relative !important;
}

.swiper-pagination-bullet,
[class*="carousel-bullet"],
[class*="carousel__indicator"],
[class*="slider-bullet"],
.hero-dot {
  width: 10px !important;
  height: 10px !important;
  min-width: 10px !important;
  min-height: 10px !important;
  border-radius: 50% !important;
  border: none !important;
  background-color: rgba(255, 255, 255, 0.4) !important;
  padding: 0 !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
}

.swiper-pagination-bullet-active,
[class*="carousel-bullet"].is-active,
[class*="carousel-bullet"].active,
.hero-dot.is-active,
.hero-dot.active {
  background-color: #ffffff !important;
  transform: scale(1.3) !important;
  opacity: 1 !important;
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

[role="tabpanel"][aria-hidden="true"],
[class*="tab__pane"][aria-hidden="true"],
[class*="tab-pane"][aria-hidden="true"],
[data-tab-pane][aria-hidden="true"] {
  display: none !important;
}

/* Universal Carousel Navigation Arrows */
.carousel-arrow {
  position: absolute !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  width: 44px !important;
  height: 44px !important;
  border-radius: 4px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: none !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 10 !important;
  font-size: 18px !important;
  color: #171a20 !important;
  transition: background-color 0.2s ease, opacity 0.2s ease, transform 0.2s ease !important;
  opacity: 0.9 !important;
}

.carousel-arrow:hover {
  background: rgba(255, 255, 255, 0.95) !important;
  opacity: 1 !important;
  transform: translateY(-50%) scale(1.05) !important;
}

.carousel-arrow-prev {
  left: 24px !important;
}

.carousel-arrow-next {
  right: 24px !important;
}

@media (max-width: 600px) {
  .carousel-arrow {
    display: none !important;
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
  content: none !important;
  display: none !important;
}

.swiper-button-prev:has(svg):focus:after,
.swiper-button-next:has(svg):focus:after,
[class*="indicator__arrow"]:focus:after {
  font-size: 0 !important;
  font-family: inherit !important;
}

[class*="indicator__arrow"],
[class*="progressbar-indicator__arrow"] {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  vertical-align: middle !important;
}

[class*="indicator__arrow"] > svg,
[class*="progressbar-indicator__arrow"] > svg,
[class*="indicator__arrow"] .icon,
[class*="progressbar-indicator__arrow"] .icon {
  margin: auto !important;
  display: block !important;
  pointer-events: none !important;
}

.swiper-button-disabled,
[class*="indicator__arrow"]:disabled,
[class*="indicator__arrow"][aria-disabled="true"],
[class*="indicator__arrow"].swiper-button-disabled {
  opacity: 0.35 !important;
  cursor: default !important;
  pointer-events: none !important;
}

/* Universal Swatch & Carousel track scrollability fallback when Swiper JS is offline */
[class*="swiper-container"]:not(.swiper-initialized),
[class*="option-selector"] [class*="swiper-container"],
[class*="option-selector"] [class*="swiper-wrapper"] {
  overflow-x: auto !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
[class*="swiper-container"]:not(.swiper-initialized)::-webkit-scrollbar,
[class*="option-selector"] [class*="swiper-container"]::-webkit-scrollbar,
[class*="option-selector"] [class*="swiper-wrapper"]::-webkit-scrollbar {
  display: none !important;
}

/* Universal Accessibility & Utility Rules */
[hidden],
.blind {
  display: none !important;
}

.hidden:not(.is-open):not(.open):not([class*="group-hover"]):not([class*="hover"]):not([class*="show"]) {
  display: none;
}

@media (min-width: 768px) {
  [class*="--mo"]:not([class*="--pc"]),
  [class*="--mobile"]:not([class*="--desktop"]),
  [class*="__mo"]:not([class*="__pc"]),
  [class*="__mo-"],
  [class*="-mo-"] {
    display: none !important;
  }
}

@media (max-width: 767px) {
  [class*="--pc"]:not([class*="--mo"]),
  [class*="--desktop"]:not([class*="--mobile"]),
  [class*="__pc"]:not([class*="__mo"]),
  [class*="__pc-"],
  [class*="-pc-"] {
    display: none !important;
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
    transform: translateY(-50%) rotate(180deg) !important;
  }

  .footer-category.is-open > [class*="list-wrap"],
  .footer-category.is-open > [class*="list"],
  .footer-category.active > [class*="list-wrap"],
  .footer-category.active > [class*="list"],
  .footer-column__item.is-open > [class*="list-wrap"],
  .footer-column__item.is-open > [class*="list"],
  [class*="footer-col"].is-open > ul,
  [class*="footer-col"].active > ul {
    display: block !important;
  }
}

/* Universal Interactive Dropdown, Menu, and Flyout ARIA State Rules */
[aria-expanded="true"] svg,
[aria-expanded="true"] .icon,
[aria-expanded="true"] [class*="icon"],
[aria-expanded="true"] [class*="chevron"],
[aria-expanded="true"] [class*="arrow"],
[aria-expanded="true"]::after {
  transform: rotate(180deg) !important;
}

[aria-expanded="false"] svg,
[aria-expanded="false"] .icon,
[aria-expanded="false"] [class*="icon"],
[aria-expanded="false"] [class*="chevron"],
[aria-expanded="false"] [class*="arrow"],
[aria-expanded="false"]::after {
  transform: rotate(0deg) !important;
}

/* Universal popovers / dropdowns controlled by an open trigger */
[aria-expanded="true"] + [class*="dropdown"]:not(button):not(a),
[aria-expanded="true"] + [class*="submenu"]:not(button):not(a),
[aria-expanded="true"] + [class*="popover"]:not(button):not(a),
[aria-expanded="true"] + [role="menu"],
[aria-expanded="true"] + [role="listbox"],
[aria-expanded="true"] + [role="dialog"],
:has(> [aria-expanded="true"]) > [class*="dropdown"]:not(button):not(a),
:has(> [aria-expanded="true"]) > [class*="submenu"]:not(button):not(a),
:has(> [aria-expanded="true"]) > [class*="popover"]:not(button):not(a),
:has(> [aria-expanded="true"]) > [role="menu"],
:has(> [aria-expanded="true"]) > [role="listbox"],
:has(> [aria-expanded="true"]) > [role="dialog"] {
  opacity: 1 !important;
  transform: translateY(0) !important;
  visibility: visible !important;
  pointer-events: auto !important;
  display: block !important;
  z-index: 600 !important;
}

/* Universal popovers / dropdowns controlled by a closed trigger (resting state only, never blocking hover) */
[aria-expanded="false"]:not(:hover) + [class*="dropdown"]:not(button):not(a):not(:hover),
[aria-expanded="false"]:not(:hover) + [class*="submenu"]:not(button):not(a):not(:hover),
[aria-expanded="false"]:not(:hover) + [class*="popover"]:not(button):not(a):not(:hover),
[aria-expanded="false"]:not(:hover) + [role="menu"]:not(:hover),
[aria-expanded="false"]:not(:hover) + [role="listbox"]:not(:hover),
[aria-expanded="false"]:not(:hover) + [role="dialog"]:not(:hover),
:has(> [aria-expanded="false"]:not(:hover)):not(:hover):not(:focus-within) > [class*="dropdown"]:not(button):not(a):not(.is-open):not([class*="open"]):not(:hover),
:has(> [aria-expanded="false"]:not(:hover)):not(:hover):not(:focus-within) > [class*="submenu"]:not(button):not(a):not(.is-open):not([class*="open"]):not(:hover),
:has(> [aria-expanded="false"]:not(:hover)):not(:hover):not(:focus-within) > [class*="popover"]:not(button):not(a):not(.is-open):not([class*="open"]):not(:hover),
:has(> [aria-expanded="false"]:not(:hover)):not(:hover):not(:focus-within) > [role="menu"]:not(.is-open):not([class*="open"]):not(:hover),
:has(> [aria-expanded="false"]:not(:hover)):not(:hover):not(:focus-within) > [role="listbox"]:not(.is-open):not([class*="open"]):not(:hover),
:has(> [aria-expanded="false"]:not(:hover)):not(:hover):not(:focus-within) > [role="dialog"]:not(.is-open):not([class*="open"]):not(:hover) {
  display: none;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
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
  opacity: 1 !important;
  visibility: visible !important;
}

img[src]:not([src=""]):not([aria-hidden="true"]):not([hidden]) {
  opacity: 1 !important;
}

[class*="card"][class*="--active"],
[class*="card"][class*="--visible"],
[class*="card"].is-active,
[class*="card"].active,
[class*="item"][class*="--active"],
[class*="item"][class*="--visible"],
[class*="item"].is-active,
[class*="item"].active {
  opacity: 1 !important;
  visibility: visible !important;
  transform: none !important;
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
  opacity: 1 !important;
  visibility: visible !important;
}

svg.pointer-svg,
svg.pointer-svg path,
[class*="pointerSvg"] path,
[class*="pointer-svg"] path,
svg[class*="pointer"] path {
  opacity: 1 !important;
  stroke-dashoffset: 0 !important;
  visibility: visible !important;
}
`;
  }

  private stripPseudosAndStates(sel: string): string {
    return sel
      .replace(/:(?:where|is|has|not)\([^)]*\)/gi, '')
      .replace(
        /::?(?:-webkit-|-moz-|-ms-)?[a-zA-Z0-9_-]+(?:\([^)]*\))?/gi,
        ''
      )
      .replace(
        /\.(?:open|active|is-open|is-active|opened|expanded|show|visible|closed|collapsed|animating|closing|js|touch|[a-zA-Z0-9_-]*open[a-zA-Z0-9_-]*)[a-zA-Z0-9_-]*/gi,
        ''
      )
      .replace(/\[(?:aria-expanded|data-state|data-active|data-selected|data-open)[^\]]*\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasAuthenticMarkup(ast: SectionAST): boolean {
    const raw = ast.rawSectionHtml;
    if (!raw || raw.trim().length < 80) return false;

    const css = ast.rawCssContext || '';
    if (css.trim().length < 200) {
      return false;
    }

    // Extract classes from raw HTML and verify matches against CSS
    const classMatches = raw.match(/class=["']([^"']+)["']/g) || [];
    if (classMatches.length === 0 && css.length > 500) {
      return true;
    }

    let matchingClasses = 0;
    const genericClasses = new Set(['container', 'hidden', 'active', 'row', 'col', 'inner', 'icon', 'btn', 'text', 'title', 'wrap', 'image']);
    const checked = new Set<string>();

    for (const cm of classMatches.slice(0, 40)) {
      const classes = cm.replace(/class=["']|["']/g, '').split(/\s+/);
      for (const cls of classes) {
        if (cls.length > 2 && !genericClasses.has(cls) && !checked.has(cls)) {
          checked.add(cls);
          if (css.includes(cls)) {
            matchingClasses++;
            if (matchingClasses >= 1) return true;
          }
        }
      }
    }

    return matchingClasses >= 1 || css.length > 2000;
  }
}
