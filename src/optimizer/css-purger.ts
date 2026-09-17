import postcss, { Root, Rule, AtRule } from 'postcss';
import * as cheerio from 'cheerio';
import CleanCSS from 'clean-css';
import { CssTransformer } from '../transformer/css-transformer.js';

export interface PurgeResult {
  purgedCss: string;
  minifiedCss: string;
  originalBytes: number;
  purgedBytes: number;
  minifiedBytes: number;
}

export class CssPurger {
  private cleanCssInstance = new CleanCSS({
    level: {
      1: {
        all: true,
        tidySelectors: true,
      },
      2: {
        mergeMedia: true,
        removeDuplicateFontRules: true,
        removeDuplicateMediaBlocks: true,
        removeDuplicateRules: true,
        removeUnusedAtRules: false,
      },
    },
  });

  /**
   * Purges unused CSS rules that do not match elements in the given HTML,
   * then produces both beautified and minified outputs.
   */
  public async purge(cssContent: string, htmlContent: string): Promise<PurgeResult> {
    const originalBytes = Buffer.byteLength(cssContent || '', 'utf8');
    if (!cssContent || !cssContent.trim()) {
      return {
        purgedCss: '',
        minifiedCss: '',
        originalBytes: 0,
        purgedBytes: 0,
        minifiedBytes: 0,
      };
    }

    const $ = cheerio.load(htmlContent, { xmlMode: false }, false);

    try {
      const purgePlugin = {
        postcssPlugin: 'css-purger',
        Once(root: Root) {
          // Walk rules and remove rules that don't match any elements
          root.walkRules((rule: Rule) => {
            // Keep rules inside keyframes
            if (rule.parent && rule.parent.type === 'atrule' && (rule.parent as AtRule).name.includes('keyframes')) {
              return;
            }

            const rawSelectors = rule.selectors || [rule.selector];
            const matchingSelectors: string[] = [];

            for (const selector of rawSelectors) {
              if (shouldAlwaysKeepSelector(selector)) {
                matchingSelectors.push(selector);
                continue;
              }

              // Strip pseudo classes/elements for testing in Cheerio
              const cleanSelector = stripPseudos(selector);
              if (!cleanSelector) {
                matchingSelectors.push(selector);
                continue;
              }

              try {
                if ($(cleanSelector).length > 0) {
                  matchingSelectors.push(selector);
                }
              } catch {
                // If cheerio cannot parse advanced selector (e.g. :is, :has), keep it to be safe
                matchingSelectors.push(selector);
              }
            }

            if (matchingSelectors.length === 0) {
              rule.remove();
            } else {
              rule.selectors = matchingSelectors;
            }
          });

          // Clean empty at-rules (like @media with no rules inside)
          root.walkAtRules((atRule: AtRule) => {
            if (atRule.name === 'media' || atRule.name === 'supports') {
              if (!atRule.nodes || atRule.nodes.length === 0) {
                atRule.remove();
              }
            }
          });
        },
      };

      const result = await postcss([purgePlugin]).process(cssContent, { from: undefined });
      const purgedRaw = result.css;

      // Beautified version
      const purgedCss = await CssTransformer.beautify(purgedRaw);
      const purgedBytes = Buffer.byteLength(purgedCss, 'utf8');

      // Minified version
      const minifiedOutput = this.cleanCssInstance.minify(purgedRaw);
      const minifiedCss = minifiedOutput.styles || purgedRaw;
      const minifiedBytes = Buffer.byteLength(minifiedCss, 'utf8');

      return {
        purgedCss,
        minifiedCss,
        originalBytes,
        purgedBytes,
        minifiedBytes,
      };
    } catch (err) {
      console.warn('CSS purge error, falling back to minification only:', err);
      const minifiedOutput = this.cleanCssInstance.minify(cssContent);
      const minifiedCss = minifiedOutput.styles || cssContent;
      return {
        purgedCss: cssContent,
        minifiedCss,
        originalBytes,
        purgedBytes: originalBytes,
        minifiedBytes: Buffer.byteLength(minifiedCss, 'utf8'),
      };
    }
  }
}

function shouldAlwaysKeepSelector(selector: string): boolean {
  const s = selector.trim();
  if (
    s === '*' ||
    s === ':root' ||
    s === 'html' ||
    s === 'body' ||
    s.startsWith(':root') ||
    s.includes('--') ||
    s.startsWith('@')
  ) {
    return true;
  }
  return false;
}

function stripPseudos(selector: string): string {
  return selector
    .replace(/::?(?:hover|focus|active|visited|focus-visible|focus-within|checked|disabled|enabled|before|after|placeholder|first-child|last-child|nth-child\([^)]*\)|first-of-type|last-of-type)/g, '')
    .trim();
}
