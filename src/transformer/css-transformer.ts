import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import * as prettier from 'prettier';

export class CssTransformer {
  /**
   * Replaces class selectors and ID selectors in CSS according to provided mapping
   */
  public static async transformSelectors(
    cssContent: string,
    classMapping: Record<string, string>,
    idMapping: Record<string, string> = {}
  ): Promise<string> {
    if (!cssContent || (!Object.keys(classMapping).length && !Object.keys(idMapping).length)) {
      return cssContent;
    }

    try {
      const transformSelectorProcessor = selectorParser((selectors) => {
        selectors.walkClasses((classNode) => {
          if (classMapping[classNode.value]) {
            classNode.value = classMapping[classNode.value];
          }
        });
        selectors.walkIds((idNode) => {
          if (idMapping[idNode.value]) {
            idNode.value = idMapping[idNode.value];
          }
        });
      });

      const plugin = {
        postcssPlugin: 'selector-renamer',
        Rule(rule: any) {
          try {
            rule.selector = transformSelectorProcessor.processSync(rule.selector);
          } catch {
            // If complex/unsupported selector, keep original selector
          }
        },
      };

      const result = await postcss([plugin]).process(cssContent, { from: undefined });
      return result.css;
    } catch (err) {
      console.warn('PostCSS transformation error, falling back to regex:', err);
      // Fallback regex replacement for classes
      let output = cssContent;
      for (const [oldCls, newCls] of Object.entries(classMapping)) {
        const regex = new RegExp(`\\.${escapeRegex(oldCls)}(?=[\\s{:,.\\[\\]>]|$)`, 'g');
        output = output.replace(regex, `.${newCls}`);
      }
      for (const [oldId, newId] of Object.entries(idMapping)) {
        const regex = new RegExp(`#${escapeRegex(oldId)}(?=[\\s{:,.\\[\\]>]|$)`, 'g');
        output = output.replace(regex, `#${newId}`);
      }
      return output;
    }
  }

  /**
   * Deminifies / formats CSS to make it human-readable
   */
  public static async beautify(cssContent: string): Promise<string> {
    try {
      return await prettier.format(cssContent, { parser: 'css', tabWidth: 2 });
    } catch {
      // Fallback simple indentation formatting
      return cssContent
        .replace(/\{/g, ' {\n  ')
        .replace(/\}/g, '\n}\n\n')
        .replace(/;\s*/g, ';\n  ')
        .replace(/,\s*/g, ', ');
    }
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
