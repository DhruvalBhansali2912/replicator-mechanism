const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('storage/carbon360.html', 'utf8');
const $ = cheerio.load(html);
const popup = $('.elementor-116, .elementor-location-popup, [data-elementor-type="popup"]');
console.log('Popup count:', popup.length);
console.log('Popup tag:', popup.get(0)?.tagName);
console.log('Popup classes:', popup.attr('class'));
console.log('Popup parent:', popup.parent().get(0)?.tagName, popup.parent().attr('class'));
console.log('\n--- POPUP HTML ---');
console.log($.html(popup).slice(0, 2000));
