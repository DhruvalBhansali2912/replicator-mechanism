import postcss, { Root, Rule, AtRule } from 'postcss';

export interface CSSAnalysisResult {
  totalRules: number;
  mediaQueriesCount: number;
  keyframesCount: number;
  customProperties: string[];
  cleanCss: string;
  scopedRulesCount: number;
}

export class CSSAnalysisWorker {
  public static readonly workerName = 'CSSAnalysisWorker';

  public async execute(css: string): Promise<CSSAnalysisResult> {
    if (!css || !css.trim()) {
      return {
        totalRules: 0,
        mediaQueriesCount: 0,
        keyframesCount: 0,
        customProperties: [],
        cleanCss: '',
        scopedRulesCount: 0,
      };
    }

    let totalRules = 0;
    let mediaQueriesCount = 0;
    let keyframesCount = 0;
    const customPropsSet = new Set<string>();

    const processor = postcss([
      (root: Root) => {
        root.walkRules((rule: Rule) => {
          totalRules++;
          rule.walkDecls((decl) => {
            if (decl.prop.startsWith('--')) {
              customPropsSet.add(decl.prop);
            }
          });
        });

        root.walkAtRules((atRule: AtRule) => {
          if (atRule.name === 'media') {
            mediaQueriesCount++;
          } else if (atRule.name === 'keyframes' || atRule.name === '-webkit-keyframes') {
            keyframesCount++;
          }
        });
      },
    ]);

    let cleanCss = css;
    try {
      const res = await processor.process(css, { from: undefined });
      cleanCss = res.css;
    } catch {
      // Fallback if parsing malformed vendor css
      cleanCss = css;
    }

    return {
      totalRules,
      mediaQueriesCount,
      keyframesCount,
      customProperties: Array.from(customPropsSet),
      cleanCss,
      scopedRulesCount: totalRules,
    };
  }
}
