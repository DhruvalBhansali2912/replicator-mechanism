import * as prettier from 'prettier';

export class JsTransformer {
  /**
   * Deminifies and formats JavaScript code using Prettier
   */
  public static async deminify(jsCode: string): Promise<string> {
    if (!jsCode || !jsCode.trim()) return '';

    try {
      return await prettier.format(jsCode, {
        parser: 'babel',
        semi: true,
        singleQuote: true,
        tabWidth: 2,
      });
    } catch {
      // If full parse fails (e.g. inline script fragment), basic beautify fallback
      return basicJsBeautify(jsCode);
    }
  }

  /**
   * Replaces selector strings and class/ID names in JavaScript to match renamed classes/IDs
   */
  public static transformScript(
    jsCode: string,
    classMapping: Record<string, string>,
    idMapping: Record<string, string> = {}
  ): string {
    if (!jsCode || (!Object.keys(classMapping).length && !Object.keys(idMapping).length)) {
      return jsCode;
    }

    let modified = jsCode;

    // 1. Replace class names in selectors e.g. querySelector('.old-class') or classList.contains('old-class')
    for (const [oldCls, newCls] of Object.entries(classMapping)) {
      // In dot selectors: .old-class
      const dotRegex = new RegExp(`(\\.)(${escapeRegex(oldCls)})(?=[\\s"',)\\]\\[:#>]|$)`, 'g');
      modified = modified.replace(dotRegex, `$1${newCls}`);

      // In classList / getElementsByClassName strings: 'old-class' or "old-class"
      const stringRegex = new RegExp(`(['"\`])${escapeRegex(oldCls)}\\1`, 'g');
      modified = modified.replace(stringRegex, `$1${newCls}$1`);
    }

    // 2. Replace ID names in selectors e.g. #old-id or getElementById('old-id')
    for (const [oldId, newId] of Object.entries(idMapping)) {
      const hashRegex = new RegExp(`(#)(${escapeRegex(oldId)})(?=[\\s"',)\\]\\[:#>]|$)`, 'g');
      modified = modified.replace(hashRegex, `$1${newId}`);

      const stringRegex = new RegExp(`(['"\`])${escapeRegex(oldId)}\\1`, 'g');
      modified = modified.replace(stringRegex, `$1${newId}$1`);
    }

    return modified;
  }

  /**
   * Sanitizes ES Module syntax (import/export/import.meta) so scripts can safely execute in standard classic scripts or function closures
   */
  public static sanitizeModuleSyntax(code: string): string {
    if (!code || !code.trim()) return '';
    return code
      .replace(/import\.meta(?:\.[a-zA-Z0-9_$]+)*/g, '({ url: "" })')
      // 1. Dynamic import: import('...') or import("...") -> Promise.resolve({})
      .replace(/\bimport\s*\(([^)]*)\)/g, 'Promise.resolve({})')
      // 2. Static import with 'from': import ... from '...'
      .replace(/\bimport\s*(?:\{[^}]*\}|[^{};\n]*?)\s*from\s*['"][^'"]+['"];?/g, ';/* [import removed] */;')
      // 3. Side-effect import: import '...' or import "..."
      .replace(/\bimport\s*['"][^'"]+['"];?/g, ';/* [import removed] */;')
      // 4. Any remaining import statements up to semicolon
      .replace(/\bimport\s*[^;{\n]*?['"][^'"]+['"];?/g, ';/* [import removed] */;')
      // 5. Export default
      .replace(/(?:^|[;\n\r])\s*export\s+default\s+/g, ';/* export default */ ')
      // 6. Export named declarations: export const/let/var/function/class
      .replace(/(?:^|[;\n\r])\s*export\s+(const|let|var|function|class)\s+/g, ';$1 ')
      // 7. Export specifiers: export { a, b } or export { a as b } from '...'
      .replace(/(?:^|[;\n\r])\s*export\s*\{[^}]*\}\s*(?:from\s*['"][^'"]+['"])?;?/g, ';/* [export removed] */;')
      // 8. Any remaining export statements
      .replace(/\bexport\s+[^;{\n]*?;?/g, ';/* [export removed] */;')
      // 9. Neutralize destructive navigation hiding scripts (e.g. webview hide-header logic)
      .replace(/(?:document\.)?querySelector(?:All)?\s*\([^)]*(?:gnb|nav|header|navbar|menu)[^)]*\)[^;{}]*\.style\.display\s*=\s*['"]none['"]/gi, '/* [neutralized nav hiding] */ (()=>{})()')
      // 10. Neutralize hostile page redirects
      .replace(/\b(?:window\.)?location\.(?:replace|assign)\s*\(/g, '/* [redirect neutralized] */ (()=>{})(');
  }
}

function basicJsBeautify(code: string): string {
  return code
    .replace(/\{/g, ' {\n  ')
    .replace(/\}/g, '\n}\n')
    .replace(/;\s*/g, ';\n  ')
    .replace(/\n\s*\n\s*\n/g, '\n\n');
}

function escapeRegex(str: string): string {
  return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
