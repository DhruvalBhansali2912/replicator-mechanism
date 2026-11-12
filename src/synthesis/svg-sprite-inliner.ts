import axios from 'axios';
import * as cheerio from 'cheerio';

// In-memory cache of fetched SVG sprite contents to avoid redundant network requests across requests
const spriteCache = new Map<string, string>();

/**
 * Universal SVG Sprite Inliner:
 * Detects external SVG sprite references in <use xlink:href="...#id"> or <use href="...#id">,
 * fetches the external sprite sheet, embeds the inner symbols/defs into a hidden root SVG,
 * and rewrites the <use> references to local fragments (#id).
 *
 * This completely prevents browser CORS/Same-Origin security blocks on external SVG sprites.
 */
export async function inlineSvgSprites(html: string, baseUrl?: string): Promise<{ html: string; modified: boolean }> {
  if (!html || !html.includes('<use') || !html.includes('#')) {
    return { html, modified: false };
  }

  const $ = cheerio.load(html, { xmlMode: false }, false);
  const externalUses = $('use').filter((_, el) => {
    const h = $(el).attr('xlink:href') || $(el).attr('href') || '';
    return (
      h.includes('#') &&
      (h.startsWith('http://') ||
        h.startsWith('https://') ||
        h.startsWith('/') ||
        h.startsWith('./') ||
        h.startsWith('../') ||
        h.includes('.svg#'))
    );
  });

  if (externalUses.length === 0) {
    return { html, modified: false };
  }

  // Group uses by sprite file URL
  const spriteMap = new Map<string, cheerio.Cheerio<any>[]>();
  externalUses.each((_, el) => {
    const $el = $(el);
    const h = $el.attr('xlink:href') || $el.attr('href') || '';
    const hashIdx = h.indexOf('#');
    if (hashIdx === -1) return;
    const fileUrl = h.slice(0, hashIdx);
    const fragId = h.slice(hashIdx + 1);
    if (!fragId) return;

    if (!spriteMap.has(fileUrl)) spriteMap.set(fileUrl, []);
    spriteMap.get(fileUrl)!.push($el);
  });

  let modified = false;

  for (const [fileUrl, uses] of spriteMap.entries()) {
    try {
      let resolvedUrl = fileUrl;
      if (baseUrl && (fileUrl.startsWith('/') || fileUrl.startsWith('.'))) {
        try {
          resolvedUrl = new URL(fileUrl, baseUrl).toString();
        } catch (_) {}
      }

      if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
        continue;
      }

      let svgContent = spriteCache.get(resolvedUrl);
      if (!svgContent) {
        const resp = await axios.get(resolvedUrl, {
          timeout: 10000,
          responseType: 'text',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/svg+xml,image/*,*/*;q=0.8',
          },
        });
        if (resp.data && typeof resp.data === 'string' && resp.data.includes('<')) {
          svgContent = resp.data;
          spriteCache.set(resolvedUrl, svgContent);
        }
      }

      if (svgContent) {
        const $sprite = cheerio.load(svgContent, { xmlMode: true });
        const spriteRoot = $sprite('svg');
        const innerContent = spriteRoot.html() || svgContent;

        // Create an inlined hidden container
        const inlinedContainer = `<svg xmlns="http://www.w3.org/2000/svg" style="display: none !important;" aria-hidden="true" data-inlined-sprite="${resolvedUrl}">${innerContent}</svg>`;

        const body = $('body');
        if (body.length > 0) {
          body.prepend(inlinedContainer);
        } else {
          $.root().prepend(inlinedContainer);
        }

        // Rewrite all use hrefs to local fragment
        uses.forEach(($u) => {
          const h = $u.attr('xlink:href') || $u.attr('href') || '';
          const hashIdx = h.indexOf('#');
          if (hashIdx !== -1) {
            const fragId = h.slice(hashIdx + 1);
            $u.attr('xlink:href', '#' + fragId);
            $u.attr('href', '#' + fragId);
          }
        });

        modified = true;
      }
    } catch (err: any) {
      console.warn('[SVG Sprite Inliner] Failed to inline sprite:', fileUrl, err?.message);
    }
  }

  return { html: modified ? $.html() : html, modified };
}
