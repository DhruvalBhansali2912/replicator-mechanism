import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

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

    // Sanitize commas and spaces in asset URLs (e.g. Cloudinary / Tesla transforms: upload/f_auto, q_auto)
    // Unencoded commas break srcset candidate parsing both in HTML parsers and in browsers.
    html = html.replace(/upload\/([^/"'>]+)\//gi, (m, seg) => {
      return 'upload/' + seg.replace(/,\s*/g, '%2C').replace(/,/g, '%2C').replace(/\s+/g, '') + '/';
    });
    css = css.replace(/upload\/([^/"'>]+)\//gi, (m, seg) => {
      return 'upload/' + seg.replace(/,\s*/g, '%2C').replace(/,/g, '%2C').replace(/\s+/g, '') + '/';
    });

    const $ = cheerio.load(html);
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

    // Also gather URLs from inside <noscript> tags
    $('noscript').each((_, el) => {
      const noscriptHtml = $(el).html() || '';
      if (!noscriptHtml.trim()) return;
      const $nos = cheerio.load(noscriptHtml);
      $nos('img, source, video, audio, link[rel*="icon"]').each((_, nEl) => {
        const $nEl = $nos(nEl);
        const src = $nEl.attr('src');
        const srcset = $nEl.attr('srcset');
        const href = $nEl.attr('href');
        const poster = $nEl.attr('poster');

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
    });

    // 2. Gather external scripts: strip tracking/telemetry scripts, download functional scripts
    $('script[src]').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      if (!src) return;

      if (isTrackingOrAnalytics(src)) {
        // Strip telemetry scripts that cause ERR_FILE_NOT_FOUND or offline errors
        $el.remove();
        return;
      }

      if (isValidAssetUrl(src)) {
        assetUrlsToDownload.add(resolveUrl(src, baseUrl));
      }
    });

    // 3. Gather URLs from CSS (background-image, @font-face)
    const cssUrlRegex = /url\(\s*(?:['"]?)([^'")]+)(?:['"]?)\s*\)/gi;
    let match: RegExpExecArray | null;
    while ((match = cssUrlRegex.exec(css)) !== null) {
      const rawUrl = match[1]?.trim();
      if (rawUrl && isValidAssetUrl(rawUrl)) {
        assetUrlsToDownload.add(resolveUrl(rawUrl, baseUrl));
      }
    }

    // 4. Download assets concurrently (batch of 8)
    const urlArray = Array.from(assetUrlsToDownload);
    const batchSize = 8;
    for (let i = 0; i < urlArray.length; i += batchSize) {
      const batch = urlArray.slice(i, i + batchSize);
      await Promise.all(
        batch.map((url) => this.downloadAsset(url, baseUrl, assetsDir))
      );
    }

    // 5. Rewrite HTML asset links
    $('img, video, audio, link[rel*="icon"]').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      if (src) {
        const absUrl = resolveUrl(src, baseUrl);
        const local = this.getLocalPath(absUrl);
        if (local) $el.attr('src', `./assets/${local}`);
      }

      const href = $el.attr('href');
      if (href && isValidAssetUrl(href)) {
        const absUrl = resolveUrl(href, baseUrl);
        const local = this.getLocalPath(absUrl);
        if (local) $el.attr('href', `./assets/${local}`);
      }

      const poster = $el.attr('poster');
      if (poster) {
        const absUrl = resolveUrl(poster, baseUrl);
        const local = this.getLocalPath(absUrl);
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
            const local = this.getLocalPath(absUrl);
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
        const local = this.getLocalPath(absUrl);
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
            const local = this.getLocalPath(absUrl);
            return local ? `./assets/${local}${descriptor ? ' ' + descriptor : ''}` : item;
          })
          .join(', ');
        $el.attr('srcset', updatedParts);
      }
    });

    $('script[src]').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      if (src) {
        const absUrl = resolveUrl(src, baseUrl);
        const local = this.getLocalPath(absUrl);
        if (local) {
          $el.attr('src', `./assets/${local}`);
        } else if (absUrl.startsWith(origin) || absUrl.includes('/assets/js/') || absUrl.includes('_bm') || absUrl.includes('_sec')) {
          // If a private script from the target domain was not localized (e.g. rejected by bot defense),
          // keeping the remote src will fail with ERR_BLOCKED_BY_ORB or CORS errors in the browser.
          $el.remove();
        }
      }
    });

    // Rewrite within <noscript> tags
    $('noscript').each((_, el) => {
      let content = $(el).html() || '';
      for (const [origUrl, localName] of this.downloadedUrls.entries()) {
        if (content.includes(origUrl)) {
          content = content.replaceAll(origUrl, `./assets/${localName}`);
        }
      }
      $(el).html(content);
    });

    // 6. Rewrite CSS url() references
    const updatedCss = this.rewriteCssUrls(css, baseUrl);

    return {
      html: $.html(),
      css: updatedCss,
      downloadedAssetsCount: this.downloadedUrls.size,
    };
  }

  /**
   * Rewrites url(...) occurrences in CSS to point to localized assets
   */
  public rewriteCssUrls(css: string, baseUrl: string): string {
    if (!css) return '';
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (fullMatch, quote, rawUrl) => {
      if (!isValidAssetUrl(rawUrl)) return fullMatch;
      const absUrl = resolveUrl(rawUrl, baseUrl);
      const local = this.getLocalPath(absUrl);
      if (local) {
        return `url('./assets/${local}')`;
      }
      return fullMatch;
    });
  }

  private getLocalPath(absUrl: string): string | undefined {
    const cleanUrl = absUrl.split('?')[0].split('#')[0];
    return this.downloadedUrls.get(absUrl) || this.downloadedUrls.get(cleanUrl);
  }

  private async downloadAsset(url: string, baseUrl: string, destDir: string): Promise<string | null> {
    const cleanUrl = url.split('?')[0].split('#')[0];
    if (this.downloadedUrls.has(url)) return this.downloadedUrls.get(url)!;
    if (this.downloadedUrls.has(cleanUrl)) return this.downloadedUrls.get(cleanUrl)!;

    let origin = '';
    try {
      origin = new URL(baseUrl).origin;
    } catch {}

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };
    if (baseUrl) {
      headers['Referer'] = baseUrl;
    }
    if (origin) {
      headers['Origin'] = origin;
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 12000,
        headers,
        httpsAgent,
      });

      // Guess filename from URL or header
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      let basename = path.basename(pathname);

      // Clean basename
      basename = basename.split('?')[0].split('#')[0];
      let ext = path.extname(basename).toLowerCase();

      const lowerPath = pathname.toLowerCase();
      if (lowerPath.endsWith('.woff2')) ext = '.woff2';
      else if (lowerPath.endsWith('.woff')) ext = '.woff';
      else if (lowerPath.endsWith('.ttf')) ext = '.ttf';
      else if (lowerPath.endsWith('.otf')) ext = '.otf';
      else if (lowerPath.endsWith('.eot')) ext = '.eot';
      else if (lowerPath.endsWith('.svg')) ext = '.svg';
      else if (lowerPath.endsWith('.js')) ext = '.js';
      else if (lowerPath.endsWith('.css')) ext = '.css';
      else if (!ext || ext.length > 5) {
        const contentType = String(response.headers['content-type'] || '');
        if (contentType.includes('image/svg')) ext = '.svg';
        else if (contentType.includes('image/webp')) ext = '.webp';
        else if (contentType.includes('image/png')) ext = '.png';
        else if (contentType.includes('image/jpeg')) ext = '.jpg';
        else if (contentType.includes('font/woff2')) ext = '.woff2';
        else if (contentType.includes('font/woff')) ext = '.woff';
        else if (contentType.includes('font/ttf')) ext = '.ttf';
        else if (contentType.includes('javascript')) ext = '.js';
        else ext = '.bin';
      }

      const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
      const safeName = basename
        ? `${path.basename(basename, ext).slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, '_')}-${hash}${ext}`
        : `asset-${hash}${ext}`;

      const filePath = path.join(destDir, safeName);
      fs.writeFileSync(filePath, Buffer.from(response.data));

      // Also ensure exact basename exists if this is a built JS module referenced relatively
      if (ext === '.js' && basename) {
        const exactBaseFilePath = path.join(destDir, basename);
        if (!fs.existsSync(exactBaseFilePath)) {
          fs.writeFileSync(exactBaseFilePath, Buffer.from(response.data));
        }

        // Recursively discover and download relative ES module imports (e.g. from "./xyz.built.js")
        const text = Buffer.from(response.data).toString('utf8');
        const importRegex = /(?:import|from)\s*['"](\.\/[^'"]+\.js)['"]/g;
        let importMatch: RegExpExecArray | null;
        while ((importMatch = importRegex.exec(text)) !== null) {
          const relPath = importMatch[1];
          try {
            const subUrl = new URL(relPath, url).href;
            const subBasename = path.basename(relPath);
            const subDest = path.join(destDir, subBasename);
            if (!fs.existsSync(subDest)) {
              const subResp = await axios.get(subUrl, { responseType: 'arraybuffer', headers, timeout: 10000 });
              fs.writeFileSync(subDest, Buffer.from(subResp.data));
              this.downloadedUrls.set(subUrl, subBasename);
            }
          } catch {}
        }
      }

      this.downloadedUrls.set(url, safeName);
      this.downloadedUrls.set(cleanUrl, safeName);
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

function isTrackingOrAnalytics(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('analytics') ||
    lower.includes('metrics') ||
    lower.includes('data-relay') ||
    lower.includes('auto-relay') ||
    lower.includes('gtag') ||
    lower.includes('google-analytics') ||
    lower.includes('googletagmanager') ||
    lower.includes('facebook.net') ||
    lower.includes('doubleclick') ||
    lower.includes('telemetry') ||
    lower.includes('hotjar') ||
    lower.includes('clarity.ms') ||
    lower.includes('segment.io') ||
    lower.includes('stats.wp.com') ||
    lower.includes('sentry') ||
    lower.includes('errlog') ||
    lower.includes('location-script') ||
    lower.includes('datadog')
  );
}
