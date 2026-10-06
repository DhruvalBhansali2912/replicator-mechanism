import * as cheerio from 'cheerio';

export interface ExtractedAssetMeta {
  url: string;
  type: 'image' | 'font' | 'svg' | 'script' | 'stylesheet' | 'media';
  mimeType?: string;
  tagName?: string;
}

export interface AssetAnalysisResult {
  totalAssets: number;
  imageCount: number;
  fontCount: number;
  svgCount: number;
  assets: ExtractedAssetMeta[];
}

export class AssetAnalysisWorker {
  public static readonly workerName = 'AssetAnalysisWorker';

  public async execute(html: string, css: string, baseUrl: string): Promise<AssetAnalysisResult> {
    const $ = cheerio.load(html);
    const assets: ExtractedAssetMeta[] = [];
    const seenUrls = new Set<string>();

    const addAsset = (rawUrl: string | undefined, type: ExtractedAssetMeta['type'], tag?: string) => {
      if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return;
      try {
        const resolved = new URL(rawUrl, baseUrl).href;
        if (!seenUrls.has(resolved)) {
          seenUrls.add(resolved);
          assets.push({ url: resolved, type, tagName: tag });
        }
      } catch {}
    };

    // Images
    $('img').each((_, el) => {
      addAsset($(el).attr('src'), 'image', 'img');
      const srcset = $(el).attr('srcset');
      if (srcset) {
        srcset.split(',').forEach((entry) => {
          const item = entry.trim().split(/\s+/)[0];
          addAsset(item, 'image', 'img');
        });
      }
    });

    // Picture sources
    $('picture source').each((_, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset) {
        srcset.split(',').forEach((entry) => {
          const item = entry.trim().split(/\s+/)[0];
          addAsset(item, 'image', 'source');
        });
      }
    });

    // SVGs
    let svgCount = $('svg').length;

    // Videos & Audio
    $('video, audio, source').each((_, el) => {
      addAsset($(el).attr('src'), 'media', el.tagName);
    });

    // Fonts & background images in CSS
    const urlMatches = css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi);
    for (const match of urlMatches) {
      const u = match[1]?.trim();
      if (!u || u.startsWith('data:')) continue;
      if (/\.(woff2?|ttf|otf|eot)(\?.*)?$/i.test(u)) {
        addAsset(u, 'font', 'css');
      } else {
        addAsset(u, 'image', 'css');
      }
    }

    const imageCount = assets.filter((a) => a.type === 'image').length;
    const fontCount = assets.filter((a) => a.type === 'font').length;

    return {
      totalAssets: assets.length + svgCount,
      imageCount,
      fontCount,
      svgCount,
      assets,
    };
  }
}
