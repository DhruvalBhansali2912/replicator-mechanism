const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://anthropic.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const secInfo = await page.evaluate(() => {
    // Look for section after hero
    const hero = document.querySelector('header#main, .hero_wrap');
    let nextEl = hero ? hero.nextElementSibling : null;
    while (nextEl && (nextEl.offsetHeight < 50 || nextEl.tagName.toLowerCase() === 'script')) {
      nextEl = nextEl.nextElementSibling;
    }

    const target = nextEl || document.querySelector('section.vaquita-cta_section, .vaquita-cta_section');
    if (!target) return null;

    return {
      tagName: target.tagName,
      className: target.className,
      id: target.id,
      outerHTMLLength: target.outerHTML.length,
      outerHTMLSnippet: target.outerHTML.slice(0, 500),
      box: {
        width: target.offsetWidth,
        height: target.offsetHeight
      },
      computedBg: window.getComputedStyle(target).backgroundColor,
      computedColor: window.getComputedStyle(target).color,
      headings: Array.from(target.querySelectorAll('h1, h2, h3, h4')).map(h => ({
        tag: h.tagName,
        text: h.innerText.trim(),
        fontFamily: window.getComputedStyle(h).fontFamily,
        fontSize: window.getComputedStyle(h).fontSize,
        fontWeight: window.getComputedStyle(h).fontWeight,
        color: window.getComputedStyle(h).color
      })),
      buttonsAndLinks: Array.from(target.querySelectorAll('a, button')).map(a => ({
        tag: a.tagName,
        text: a.innerText.trim(),
        href: a.href || '',
        className: a.className,
        bg: window.getComputedStyle(a).backgroundColor,
        color: window.getComputedStyle(a).color
      })),
      childCount: target.children.length
    };
  });

  console.log('Section 3 Info:\n', JSON.stringify(secInfo, null, 2));

  // Also grab full outerHTML and save dump
  if (secInfo) {
    const fullData = await page.evaluate(() => {
      const hero = document.querySelector('header#main, .hero_wrap');
      let nextEl = hero ? hero.nextElementSibling : null;
      while (nextEl && (nextEl.offsetHeight < 50 || nextEl.tagName.toLowerCase() === 'script')) {
        nextEl = nextEl.nextElementSibling;
      }
      const target = nextEl || document.querySelector('section.vaquita-cta_section, .vaquita-cta_section');
      return {
        selector: target ? target.tagName.toLowerCase() + (target.className ? '.' + target.className.trim().split(/\s+/).join('.') : '') : '',
        html: target ? target.outerHTML : '',
        fullPageHtml: document.documentElement.outerHTML,
        stylesheets: Array.from(document.styleSheets).map(s => {
          try {
            return Array.from(s.cssRules).map(r => r.cssText).join('\n');
          } catch {
            return '';
          }
        }).filter(Boolean)
      };
    });

    fs.writeFileSync('storage/anthropic_sec3_dump.json', JSON.stringify({
      selector: fullData.selector,
      htmlLength: fullData.html.length,
      cssLength: fullData.stylesheets.join('\n').length
    }, null, 2));
    
    // Also save html and rawCss
    fs.writeFileSync('storage/anthropic_sec3_html.html', fullData.html, 'utf8');
    fs.writeFileSync('storage/anthropic_full_page.html', fullData.fullPageHtml, 'utf8');
    fs.writeFileSync('storage/anthropic_full_css.css', fullData.stylesheets.join('\n'), 'utf8');
    console.log('Successfully saved section 3 data, full page HTML and CSS.');
  }

  await browser.close();
})();
