const fs = require('fs');
const cheerio = require('cheerio');

const job = JSON.parse(fs.readFileSync('storage/jobs/job_2c8182636e644eb8/job.json', 'utf8'));
const $ = cheerio.load(job.options.htmlSnapshot);

console.log('=== All Sections in Snapshot ===');
$('section, [class*="section"]').each((i, el) => {
  const cls = $(el).attr('class') || '';
  const id = $(el).attr('id') || '';
  const heading = $(el).find('h1, h2, h3, h4, .headline, .subhead').first().text().trim();
  const ctas = $(el).find('a, button').map((_, a) => $(a).text().trim()).get().filter(Boolean).slice(0, 3).join(', ');
  console.log(`[${i}] <${el.tagName}> id="${id}" class="${cls}"`);
  console.log(`     Heading: "${heading}" | CTAs: [${ctas}]`);
});
