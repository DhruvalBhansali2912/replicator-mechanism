import * as cheerio from 'cheerio';
import { DesignTokens, ColorPalette, TypographyTokens, SpacingTokens } from './types.js';

export class TokenHarvester {
  /**
   * Deterministically harvests design tokens from a target section and stylesheet.
   */
  public harvest(html: string, css: string = ''): DesignTokens {
    const $ = cheerio.load(html);

    const colors = this.extractColorPalette($, css);
    const typography = this.extractTypography($, css);
    const spacing = this.extractSpacing($, css);

    return {
      colors,
      typography,
      spacing,
    };
  }

  private extractColorPalette($: cheerio.CheerioAPI, css: string): ColorPalette {
    // 1. Gather color candidates from CSS & inline styles
    const hexColors = new Set<string>();
    const rgbColors = new Set<string>();

    const matchesHex = css.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g);
    for (const m of matchesHex) {
      const hex = m[0].toLowerCase();
      if (hex.length === 7 || hex.length === 4) {
        hexColors.add(this.normalizeHex(hex));
      }
    }

    const matchesRgb = css.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/g);
    for (const m of matchesRgb) {
      const r = parseInt(m[1], 10);
      const g = parseInt(m[2], 10);
      const b = parseInt(m[3], 10);
      rgbColors.add(this.rgbToHex(r, g, b));
    }

    const allColors = Array.from(new Set([...hexColors, ...rgbColors]));

    // Determine primary brand color (dominant non-grayscale color)
    let primary = '#171a20'; // modern tech neutral dark primary
    for (const col of allColors) {
      if (!this.isGrayscale(col)) {
        primary = col;
        break;
      }
    }

    // Determine background color based on section DOM and inline styles
    const rootEl = $.root().children().first();
    const classList = (rootEl.attr('class') || '').toLowerCase();
    const styleAttr = (rootEl.attr('style') || '').toLowerCase();

    let background = '#ffffff';
    const hasDarkDescendant =
      $('[class*="theme-dark"], [class*="theme--dark"], [class*="bg-dark"], [class*="bg-black"], [style*="background: #000"], [style*="background:#000"], [style*="background-color: #000"], [style*="background-color:#000"], [style*="background: rgb(0, 0, 0)"], [style*="background-color: rgb(0, 0, 0)"]').length > 0;

    const isExplicitDarkSection =
      classList.includes('scrim--black') ||
      classList.includes('tds-scrim--black') ||
      classList.includes('theme--dark') ||
      classList.includes('theme-dark') ||
      classList.includes('bg-dark') ||
      classList.includes('bg-black') ||
      styleAttr.includes('background: #000') ||
      styleAttr.includes('background-color: #000') ||
      styleAttr.includes('background:#000') ||
      styleAttr.includes('background-color:#000') ||
      styleAttr.includes('background: rgb(0, 0, 0)') ||
      styleAttr.includes('background-color: rgb(0, 0, 0)') ||
      hasDarkDescendant;

    if (isExplicitDarkSection) {
      background = '#000000';
    }

    const isDark = this.isDarkColor(background);

    return {
      primary: isDark ? '#ffffff' : '#171a20',
      secondary: isDark ? '#393c41' : '#f4f4f4',
      accent: '#2563eb',
      background,
      surface: isDark ? '#171a20' : '#ffffff',
      textPrimary: isDark ? '#ffffff' : '#171a20',
      textMuted: isDark ? '#a2a3a5' : '#5c5e62',
      border: isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0',
    };
  }

  private extractTypography($: cheerio.CheerioAPI, css: string): TypographyTokens {
    // Detect font family from CSS
    let fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const fontMatch = css.match(/font-family:\s*([^;]+)/i);
    if (fontMatch && fontMatch[1]) {
      const cleanFont = fontMatch[1].trim();
      if (!cleanFont.includes('inherit')) {
        fontFamily = cleanFont;
      }
    }

    return {
      fontFamily,
      headingFamily: fontFamily,
      baseFontSize: 16,
      lineHeight: 1.5,
      scale: {
        h1: 44,
        h2: 32,
        h3: 24,
        body: 16,
        small: 14,
      },
    };
  }

  private extractSpacing($: cheerio.CheerioAPI, css: string): SpacingTokens {
    let borderRadius = 8;
    if (css.includes('border-radius: 9999px') || css.includes('rounded-full')) {
      borderRadius = 24;
    } else if (css.includes('border-radius: 4px')) {
      borderRadius = 4;
    } else if (css.includes('border-radius: 12px') || css.includes('border-radius: 16px')) {
      borderRadius = 12;
    }

    return {
      containerMaxWidth: 1200,
      sectionPaddingY: 64,
      gridGap: 24,
      borderRadius,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    };
  }

  private normalizeHex(hex: string): string {
    if (hex.length === 4) {
      return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
    }
    return hex.toLowerCase();
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  private isGrayscale(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    return diff < 15; // very low saturation
  }

  private isDarkColor(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  private adjustBrightness(hex: string, percent: number): string {
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + percent));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + percent));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + percent));
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
}
