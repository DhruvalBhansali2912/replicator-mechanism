import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

export interface LocalizedAssetResult {
  html: string;
  css: string;
  downloadedAssetsCount: number;
}

export class AssetLocalizer {
  private downloadedUrls = new Map<string, string>(); // remoteUrl -> localRelativePath

  /**
   * Scans HTML and CSS for assets (images, fonts, media, icons), downloads them to assetsDir,
   * and replaces references with relative paths.
   */
  public async localize(
    html: string,
    css: string,
    baseUrl: string,
    assetsDir: string
  ): Promise<LocalizedAssetResult> {
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    let origin = '';
    try {
      origin = new URL(baseUrl).origin;
    } catch {
      // ignore
    }

    const $ = cheerio.load(html, { xmlMode: false }, false);
    const assetUrlsToDownload: Set<string> = new Set();

    // 1. Gather image and source URLs from HTML
    $('img, source, video, audio, link[rel*="icon"]').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      const srcset = $el.attr('srcset');
      const href = $el.attr('href');
      const poster = $el.attr('poster');

      if (src && isValidAssetUrl(src)) assetUrlsToDownload.add(resolveUrl(src, baseUrl));
      if (href && isValidAssetUrl(href)) assetUrlsToDownload.add(resolveUrl(href, baseUrl));
      if (poster && isValidAssetUrl(poster)) assetUrlsToDownload.add(resolveUrl(poster, baseUrl));

      if (srcset) {
        const parts = srcset.split(',').map((s) => s.trim());
        for (const part of parts) {
          const urlPart = part.split(/\s+/)[0];
          if (isValidAssetUrl(urlPart)) {
            assetUrlsToDownload.add(resolveUrl(urlPart, baseUrl));
          }
        }
      }
    });

    // 2. Gather URLs from CSS (background-image, @font-face)
    const cssUrlRegex = /url\(\s*(?:['"]?)([^'")]+)(?:['"]?)\s*\)/gi;
    let match: RegExpExecArray | null;
    while ((match = cssUrlRegex.exec(css)) !== null) {
      const rawUrl = match[1]?.trim();
      if (rawUrl && isValidAssetUrl(rawUrl)) {
        assetUrlsToDownload.add(resolveUrl(rawUrl, baseUrl));
      }
    }

    // 3. Download assets concurrently (batch of 6)
    const urlArray = Array.from(assetUrlsToDownload);
    const batchSize = 6;
    for (let i = 0; i < urlArray.length; i += batchSize) {
      const batch = urlArray.slice(i, i + batchSize);
      await Promise.all(
        batch.map((url) => this.downloadAsset(url, assetsDir))
      );
    }

    // 4. Rewrite HTML asset links
    $('img, video, audio, link[rel*="icon"]').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      if (src) {
        const absUrl = resolveUrl(src, baseUrl);
        const local = this.downloadedUrls.get(absUrl);
        if (local) $el.attr('src', `./assets/${local}`);
      }

      const href = $el.attr('href');
      if (href && isValidAssetUrl(href)) {
        const absUrl = resolveUrl(href, baseUrl);
        const local = this.downloadedUrls.get(absUrl);
        if (local) $el.attr('href', `./assets/${local}`);
      }

      const poster = $el.attr('poster');
      if (poster) {
        const absUrl = resolveUrl(poster, baseUrl);
        const local = this.downloadedUrls.get(absUrl);
        if (local) $el.attr('poster', `./assets/${local}`);
      }

      const srcset = $el.attr('srcset');
      if (srcset) {
        const updatedParts = srcset
          .split(',')
          .map((item) => {
            const trimmed = item.trim();
            const [u, descriptor] = trimmed.split(/\s+/, 2);
            if (!u) return item;
            const absUrl = resolveUrl(u, baseUrl);
            const local = this.downloadedUrls.get(absUrl);
            return local ? `./assets/${local}${descriptor ? ' ' + descriptor : ''}` : item;
          })
          .join(', ');
        $el.attr('srcset', updatedParts);
      }
    });

    $('source').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      if (src) {
        const absUrl = resolveUrl(src, baseUrl);
        const local = this.downloadedUrls.get(absUrl);
        if (local) $el.attr('src', `./assets/${local}`);
      }
      const srcset = $el.attr('srcset');
      if (srcset) {
        const updatedParts = srcset
          .split(',')
          .map((item) => {
            const trimmed = item.trim();
            const [u, descriptor] = trimmed.split(/\s+/, 2);
            if (!u) return item;
            const absUrl = resolveUrl(u, baseUrl);
            const local = this.downloadedUrls.get(absUrl);
            return local ? `./assets/${local}${descriptor ? ' ' + descriptor : ''}` : item;
          })
          .join(', ');
        $el.attr('srcset', updatedParts);
      }
    });

    // 5. Rewrite CSS url() references
    let updatedCss = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (fullMatch, quote, rawUrl) => {
      if (!isValidAssetUrl(rawUrl)) return fullMatch;
      const absUrl = resolveUrl(rawUrl, baseUrl);
      const local = this.downloadedUrls.get(absUrl);
      if (local) {
        return `url('./assets/${local}')`;
      }
      return fullMatch;
    });

    return {
      html: $.html(),
      css: updatedCss,
      downloadedAssetsCount: this.downloadedUrls.size,
    };
  }

  private async downloadAsset(url: string, destDir: string): Promise<string | null> {
    if (this.downloadedUrls.has(url)) {
      return this.downloadedUrls.get(url)!;
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
      });

      // Guess filename from URL or header
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      let basename = path.basename(pathname);

      // Clean basename
      basename = basename.split('?')[0].split('#')[0];
      let ext = path.extname(basename).toLowerCase();

      if (!ext || ext.length > 5) {
        const contentType = String(response.headers['content-type'] || '');
        if (contentType.includes('image/svg')) ext = '.svg';
        else if (contentType.includes('image/webp')) ext = '.webp';
        else if (contentType.includes('image/png')) ext = '.png';
        else if (contentType.includes('image/jpeg')) ext = '.jpg';
        else if (contentType.includes('font/woff2')) ext = '.woff2';
        else if (contentType.includes('font/woff')) ext = '.woff';
        else if (contentType.includes('font/ttf')) ext = '.ttf';
        else ext = '.bin';
      }

      const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
      const safeName = basename
        ? `${path.basename(basename, ext).slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, '_')}-${hash}${ext}`
        : `asset-${hash}${ext}`;

      const filePath = path.join(destDir, safeName);
      fs.writeFileSync(filePath, Buffer.from(response.data));

      this.downloadedUrls.set(url, safeName);
      return safeName;
    } catch {
      // If asset download fails, graceful fallback (keep original or null)
      return null;
    }
  }
}

function isValidAssetUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('javascript:')
  ) {
    return false;
  }
  return true;
}

function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return relativeOrAbsolute;
  }
}
