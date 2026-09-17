import * as cheerio from 'cheerio';
import { SectionArchetype } from '../types.js';

export interface TransformationResult {
  cleanedHtml: string;
  classMapping: Record<string, string>;
  idMapping: Record<string, string>;
}

export class HtmlTransformer {
  /**
   * Sanitizes all links in the HTML so internal/origin links become clean relative paths (e.g. /abcd/)
   */
  public static rewriteInternalLinks(html: string, pageOrigin: string): string {
    const $ = cheerio.load(html, { xmlMode: false }, false);
    let parsedOrigin: URL | null = null;
    try {
      parsedOrigin = new URL(pageOrigin);
    } catch {
      // ignore invalid URL
    }

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const trimmed = href.trim();

      // Skip anchors, javascript, mailto, tel
      if (
        trimmed.startsWith('#') ||
        trimmed.startsWith('javascript:') ||
        trimmed.startsWith('mailto:') ||
        trimmed.startsWith('tel:') ||
        trimmed.startsWith('data:')
      ) {
        return;
      }

      // Check if it matches page origin
      if (parsedOrigin && (trimmed.startsWith(parsedOrigin.origin) || trimmed.startsWith('//' + parsedOrigin.host))) {
        try {
          const urlObj = new URL(trimmed, parsedOrigin.origin);
          let newPath = urlObj.pathname;
          if (!newPath.endsWith('/') && !pathHasExtension(newPath)) {
            newPath = newPath + '/';
          }
          if (urlObj.search) newPath += urlObj.search;
          if (urlObj.hash) newPath += urlObj.hash;
          $(el).attr('href', newPath);
        } catch {
          // ignore parsing error
        }
      } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('//')) {
        // Relative link like "abcd", "contact.html", "/pricing"
        let newPath = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
        if (!newPath.includes('#') && !newPath.includes('?') && !newPath.endsWith('/') && !pathHasExtension(newPath)) {
          newPath = newPath + '/';
        }
        $(el).attr('href', newPath);
      }
    });

    $('form').each((_, el) => {
      const action = $(el).attr('action');
      if (!action) return;
      const trimmed = action.trim();
      if (parsedOrigin && trimmed.startsWith(parsedOrigin.origin)) {
        try {
          const urlObj = new URL(trimmed, parsedOrigin.origin);
          let newPath = urlObj.pathname;
          if (!newPath.endsWith('/') && !pathHasExtension(newPath)) {
            newPath = newPath + '/';
          }
          $(el).attr('action', newPath);
        } catch {
          // ignore
        }
      }
    });

    return $.html();
  }

  /**
   * Semantically renames classes and IDs of section elements and returns mapping dictionary
   */
  public transformSection(
    rawHtml: string,
    sectionId: string, // e.g. "s1"
    archetype: SectionArchetype,
    pageOrigin: string
  ): TransformationResult {
    const $ = cheerio.load(rawHtml, { xmlMode: false }, false);
    const classMapping: Record<string, string> = {};
    const idMapping: Record<string, string> = {};

    const basePrefix = `${archetype}`;
    let roleCounters: Record<string, number> = {};

    const getNextName = (role: string): string => {
      roleCounters[role] = (roleCounters[role] || 0) + 1;
      const count = roleCounters[role];
      return count === 1 ? `${basePrefix}-${role}` : `${basePrefix}-${role}-${count}`;
    };

    // First element is section root
    const rootEl = $.root().children().first();
    if (rootEl.length > 0) {
      const oldRootClass = rootEl.attr('class');
      const oldRootId = rootEl.attr('id');
      const newRootClass = `${basePrefix}-section`;
      const newRootId = `${sectionId}-${archetype}`;

      if (oldRootClass) {
        for (const cls of oldRootClass.split(/\s+/).filter(Boolean)) {
          classMapping[cls] = newRootClass;
        }
      }
      if (oldRootId) {
        idMapping[oldRootId] = newRootId;
      }
      rootEl.attr('class', newRootClass);
      rootEl.attr('id', newRootId);
    }

    // Traverse all descendants
    $('*', rootEl).each((_, el) => {
      const $el = $(el);
      const tagName = ((el as any).tagName || (el as any).name || '').toLowerCase();
      const currentClass = $el.attr('class');
      const currentId = $el.attr('id');

      // Determine element semantic role based on archetype and tag/context
      const role = this.determineRole(tagName, $el, archetype);
      const newClassName = getNextName(role);

      if (currentClass) {
        const classes = currentClass.split(/\s+/).filter(Boolean);
        for (const cls of classes) {
          // Only map if not already mapped or provide consolidated semantic name
          if (!classMapping[cls]) {
            classMapping[cls] = newClassName;
          }
        }
        $el.attr('class', newClassName);
      } else {
        // Even if element had no class, assign semantic class for readability
        $el.attr('class', newClassName);
      }

      if (currentId) {
        const newId = `${sectionId}-${role}-${Object.keys(idMapping).length + 1}`;
        idMapping[currentId] = newId;
        $el.attr('id', newId);
      }
    });

    // Also rewrite internal links in this section
    const htmlWithRewrittenLinks = HtmlTransformer.rewriteInternalLinks($.html(), pageOrigin);

    return {
      cleanedHtml: htmlWithRewrittenLinks,
      classMapping,
      idMapping,
    };
  }

  private determineRole(tagName: string, $el: cheerio.Cheerio<any>, archetype: SectionArchetype): string {
    const parentTag = $el.parent().get(0)?.tagName?.toLowerCase() || '';

    // Headings
    if (tagName === 'h1') return 'title';
    if (tagName === 'h2') return 'heading';
    if (tagName === 'h3' || tagName === 'h4') return 'subheading';

    // Buttons / CTAs
    if (tagName === 'button' || $el.attr('role') === 'button' || ($el.is('a') && $el.text().length < 25 && ($el.hasClass('btn') || $el.hasClass('button')))) {
      if (archetype === 'navbar') return 'toggle';
      if (archetype === 'hero') return 'cta-btn';
      if (archetype === 'pricing') return 'plan-btn';
      return 'btn';
    }

    // Navigation links & lists
    if (archetype === 'navbar') {
      if (tagName === 'nav') return 'nav';
      if (tagName === 'ul' || tagName === 'ol') return 'menu';
      if (tagName === 'li') return 'menu-item';
      if (tagName === 'a') return 'link';
      if (tagName === 'img' || tagName === 'svg') return 'logo';
      if (tagName === 'form') return 'search';
    }

    // Hero specific
    if (archetype === 'hero') {
      if (tagName === 'p') return 'subtitle';
      if (tagName === 'img' || tagName === 'picture' || tagName === 'video') return 'media';
      if (tagName === 'a') return 'cta-link';
    }

    // Pricing specific
    if (archetype === 'pricing') {
      if ($el.text().includes('$') || $el.text().includes('€') || $el.text().includes('/mo')) return 'price';
      if (tagName === 'ul') return 'features-list';
      if (tagName === 'li') return 'feature-item';
    }

    // Testimonial specific
    if (archetype === 'testimonials') {
      if (tagName === 'blockquote' || tagName === 'q') return 'quote';
      if (tagName === 'img') return 'avatar';
      if (tagName === 'cite') return 'author';
    }

    // Footer specific
    if (archetype === 'footer') {
      if (tagName === 'ul') return 'col-list';
      if (tagName === 'li') return 'col-item';
      if (tagName === 'a') return 'link';
      if ($el.text().toLowerCase().includes('copyright') || $el.text().includes('©')) return 'copyright';
    }

    // General structural fallback
    if (tagName === 'div' || tagName === 'section' || tagName === 'article') {
      if (parentTag === 'body' || parentTag === 'main' || $el.parent().children().first().is($el)) {
        return 'container';
      }
      return 'card';
    }
    if (tagName === 'p') return 'text';
    if (tagName === 'span') return 'label';
    if (tagName === 'img' || tagName === 'svg') return 'icon';
    if (tagName === 'input') return 'input';
    if (tagName === 'label') return 'field-label';
    if (tagName === 'a') return 'link';

    return 'item';
  }
}

function pathHasExtension(path: string): boolean {
  const lastPart = path.split('/').pop() || '';
  return /\.[a-zA-Z0-9]{2,5}$/.test(lastPart);
}
