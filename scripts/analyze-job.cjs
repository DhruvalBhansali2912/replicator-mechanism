const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

const jobDir = path.resolve('storage/jobs/job_392c8592171a4a9b');
const html = fs.readFileSync(path.join(jobDir, 'reconstruction.html'), 'utf8');
const $ = cheerio.load(html);

console.log('--- RECONSTRUCTION ANALYSIS FOR JOB 392c8592171a4a9b ---');
console.log('HTML size:', html.length);
const topTags = [];
$('body > *').each((i, el) => {
  topTags.push(el.tagName + '.' + ($(el).attr('class') || '') + '#' + ($(el).attr('id') || ''));
});
console.log('Top level elements in body:', topTags);

console.log('--- DIRECT CHILDREN OF OWL STAGE ---');
$('.owl-stage > *').each((i, el) => {
  console.log(i, el.tagName, $(el).attr('class'));
});
process.exit(0);







console.log('--- ALL BANNER IMAGES IN RECONSTRUCTION ---');
$('img').each((i, el) => {
  const src = $(el).attr('src') || '';
  if (src.includes('banner') || src.includes('scooter') || src.includes('s1') || src.includes('home')) {
    console.log(i, {
      src: src.substring(0, 80),
      parentClass: $(el).parent().attr('class'),
      grandParentClass: $(el).parent().parent().attr('class'),
      owlItemParent: $(el).closest('.owl-item, .item').attr('class')
    });
  }
});

console.log('\n--- OWL ITEMS ---');
$('.owl-item, .item, [class*="carousel-item"]').each((i, el) => {
  console.log(i, {
    class: $(el).attr('class'),
    text: $(el).text().replace(/\s+/g, ' ').trim().substring(0, 50)
  });
});


const menuLinks = [];
$('nav a, header a, [class*="menu"] a').each((i, el) => {
  menuLinks.push($(el).text().trim());
});
console.log('Menu/nav links count:', menuLinks.length);
console.log('Menu/nav links sample:', menuLinks.slice(0, 20));

console.log('Images count:', $('img').length);
console.log('Buttons count:', $('button, .btn, [role="button"]').length);

const scripts = [];
$('script').each((i, el) => {
  const code = $(el).html();
  console.log(`\n=== SCRIPT ${i} (src=${$(el).attr('src') || 'inline'}, length=${code.length}) ===`);
  console.log('Has owl:', code.includes('owl'));
  console.log('Has carousel:', code.includes('carousel'));
  console.log('Has slide:', code.includes('slide'));
  console.log('Has maskVisual:', code.includes('maskVisual'));
});


