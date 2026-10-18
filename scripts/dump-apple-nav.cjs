const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--disable-web-security']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  console.log('Navigating to https://www.apple.com/...');
  await page.goto('https://www.apple.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const dump = await page.evaluate(() => {
    const nav = document.querySelector('nav#globalnav, nav.globalnav');
    if (!nav) return null;

    // Collect all stylesheet texts
    const sheets = [];
    for (const sheet of document.styleSheets) {
      try {
        const rules = [];
        for (const r of sheet.cssRules) {
          rules.push(r.cssText);
        }
        sheets.push(rules.join('\n'));
      } catch (e) {}
    }

    // Root variables
    const rootStyle = window.getComputedStyle(document.documentElement);
    const rootVars = {};
    for (let i = 0; i < rootStyle.length; i++) {
      const prop = rootStyle[i];
      if (prop.startsWith('--')) {
        rootVars[prop] = rootStyle.getPropertyValue(prop);
      }
    }

    const rect = nav.getBoundingClientRect();
    return {
      html: nav.outerHTML,
      fullHtml: document.documentElement.outerHTML,
      sheets,
      rootVars,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      }
    };
  });

  if (!dump) {
    console.error('Apple globalnav not found!');
    process.exit(1);
  }

  fs.writeFileSync('storage/apple_nav_dump.json', JSON.stringify(dump, null, 2));
  console.log('Successfully dumped Apple Global Navigation! HTML length:', dump.html.length, 'Sheets:', dump.sheets.length, 'Rect:', dump.rect);

  await browser.close();
})();
