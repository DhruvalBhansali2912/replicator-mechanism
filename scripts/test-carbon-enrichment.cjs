const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('storage/carbon360.html', 'utf8');
const $snap = cheerio.load(html);

// Find header
const header = $snap('.elementor-location-header, header, [role="banner"]').first();
console.log('Found header:', header.get(0)?.tagName, header.attr('class'));

// Test trigger extraction
const triggers = header.find('button, a, [role="button"], [class*="toggle"], [class*="burger"], [class*="hamburger"], [class*="menu-btn"], [aria-controls], [data-target], [data-bs-target], [data-elementor-open-popup]');
console.log('Triggers found in header:', triggers.length);

triggers.each((i, el) => {
  const $el = $snap(el);
  const href = $el.attr('href') || '';
  const ariaControls = $el.attr('aria-controls') || '';
  const dataTarget = $el.attr('data-target') || $el.attr('data-bs-target') || '';
  console.log(`Trigger ${i}: <${el.tagName}> class="${$el.attr('class')}" href="${href}" ariaControls="${ariaControls}" dataTarget="${dataTarget}"`);

  // Test Elementor action href decoding
  if (href.includes('elementor-action') || href.includes('popup')) {
    try {
      const decoded = decodeURIComponent(href);
      console.log('   Decoded href:', decoded);
      const match = decoded.match(/settings=([A-Za-z0-9+/=]+)/);
      if (match && match[1]) {
        const jsonStr = Buffer.from(match[1], 'base64').toString('utf8');
        console.log('   Decoded settings JSON:', jsonStr);
        const settings = JSON.parse(jsonStr);
        if (settings.id) {
          const popup = $snap(`[data-elementor-id="${settings.id}"], .elementor-${settings.id}, #elementor-popup-modal-${settings.id}`);
          console.log(`   Found associated popup by id ${settings.id}: count =`, popup.length);
          if (popup.length > 0) {
            console.log('   Popup classes:', popup.attr('class'));
            console.log('   Popup contains links:', popup.find('a').length);
          }
        }
      }
    } catch (err) {
      console.error('   Decoding error:', err);
    }
  }
});
