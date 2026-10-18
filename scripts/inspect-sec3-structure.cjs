const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('storage/anthropic_sec3_html.html', 'utf8');
const $ = cheerio.load(html, null, false);

console.log('Root tag:', $('section').prop('tagName'));
console.log('Classes:', $('section').attr('class'));
console.log('Canvas count:', $('canvas').length);
console.log('SVG count:', $('svg').length);
console.log('Img count:', $('img').length);
console.log('Scripts inside section:', $('script').length);

$('script').each((i, el) => {
  const src = $(el).attr('src');
  const content = $(el).html();
  console.log(`Script ${i}: src=${src}, length=${content ? content.length : 0}`);
  if (content && content.length < 500) {
    console.log(`Script ${i} content:\n${content}`);
  }
});

console.log('\nDirect children of section:');
$('section').children().each((i, el) => {
  console.log(`Child ${i}: <${el.tagName} class="${$(el).attr('class') || ''}">`);
});
