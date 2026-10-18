const fs = require('fs');
const cheerio = require('cheerio');

async function main() {
  try {
    let html;
    const cachePath = 'storage/carbon360.html';
    if (fs.existsSync(cachePath)) {
      html = fs.readFileSync(cachePath, 'utf8');
      console.log('Read cached HTML, length:', html.length);
    } else {
      const res = await fetch('http://carbon360.de/');
      html = await res.text();
      fs.writeFileSync(cachePath, html);
      console.log('Fetched and saved HTML, length:', html.length);
    }

    const $ = cheerio.load(html);
    const header = $('.elementor-location-header');
    console.log('\n=== ELEMENTOR LOCATION HEADER ===');
    console.log($.html(header));

    // Also look for any off-canvas / popup / sidebar elements in the entire document
    console.log('\n=== ELEMENTOR POPUPS OR OFFCANVAS ===');
    $('[class*="popup"], [class*="offcanvas"], [class*="dialog"], [class*="modal"], [id*="elementor-popup"], [class*="elementor-popup"]').each((i, el) => {
      console.log(`Popup/Modal ${i}: <${el.tagName}> id="${$(el).attr('id')}" class="${$(el).attr('class')}"`);
    });

    // Also check links with href starting with '#' or 'elementor-action'
    console.log('\n=== ACTION LINKS / BUTTONS ===');
    $('a[href*="action"], a[href^="#"], [data-elementor-open-lightbox]').each((i, el) => {
      console.log(`Action Link: <${el.tagName}> href="${$(el).attr('href')}" class="${$(el).attr('class')}" text="${$(el).text().trim()}"`);
    });

  } catch (e) {
    console.error('Error:', e);
  }
}

main();
