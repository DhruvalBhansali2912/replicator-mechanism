import * as cheerio from 'cheerio';
import { CssPurger } from '../optimizer/css-purger.js';
import { CssTransformer } from '../transformer/css-transformer.js';

export interface OptimizationLimits {
  maxIterations: number;
  maxTokens: number;
  maxExecutionTimeMs: number;
  maxScreenshots: number;
  maxViewportCount: number;
}

export const DEFAULT_LIMITS: OptimizationLimits = {
  maxIterations: 3,
  maxTokens: 50,
  maxExecutionTimeMs: 60000,
  maxScreenshots: 10,
  maxViewportCount: 3,
};

export interface OptimizationIterationResult {
  iteration: number;
  tokensConsumed: number;
  optimizedHtml: string;
  optimizedCss: string;
  improvementsApplied: string[];
  tokenLimitReached?: boolean;
}

export class OptimizationWorker {
  public static readonly workerName = 'OptimizationWorker';
  private cssPurger = new CssPurger();

  public async executeIteration(
    html: string,
    css: string,
    iteration: number,
    tokensRemaining: number,
    limits: OptimizationLimits = DEFAULT_LIMITS
  ): Promise<OptimizationIterationResult> {
    const costPerIteration = 1;

    // Check token budget limit
    if (tokensRemaining < costPerIteration || iteration > limits.maxIterations) {
      return {
        iteration,
        tokensConsumed: 0,
        optimizedHtml: html,
        optimizedCss: css,
        improvementsApplied: [],
        tokenLimitReached: true,
      };
    }

    const improvements: string[] = [];
    const $ = cheerio.load(html);

    // 1. Clean residual non-semantic attributes
    $('*').each((_, el) => {
      $(el).removeAttr('data-tracker');
      $(el).removeAttr('data-analytics');
      $(el).removeAttr('data-gtm');
    });
    improvements.push('Removed tracking & telemetry DOM attributes');

    // 2. Ensure responsive viewport meta tag is present
    if ($('meta[name="viewport"]').length === 0) {
      $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      improvements.push('Injected responsive viewport meta');
    }

    // 3. Purge redundant CSS rules
    const purged = await this.cssPurger.purge(css, $.html());
    improvements.push('Purged unused CSS rules');

    // 4. Beautify CSS
    const beautified = await CssTransformer.beautify(purged.purgedCss);

    return {
      iteration,
      tokensConsumed: costPerIteration,
      optimizedHtml: $.html(),
      optimizedCss: beautified,
      improvementsApplied: improvements,
      tokenLimitReached: false,
    };
  }
}
