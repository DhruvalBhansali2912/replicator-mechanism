const fs = require('fs');
const cheerio = require('cheerio');

const job = JSON.parse(fs.readFileSync('storage/jobs/job_2c8182636e644eb8/job.json', 'utf8'));
const $ = cheerio.load(job.options.htmlSnapshot);

const promo = $('section.section-promo').first();
console.log('Found promo section length:', promo.length);
console.log('HTML snippet:', promo.html() ? promo.html().substring(0, 500) : 'none');

// Find all units/cards inside promo
promo.find('[class*="unit"], [class*="module"], [class*="card"], [class*="promo"]').each((i, el) => {
  const h = $(el).find('h2, h3, h4, .headline, .subhead').map((_, x) => $(x).text().trim()).get().join(' | ');
  const ctas = $(el).find('a, button').map((_, a) => $(a).text().trim()).get().filter(Boolean).join(', ');
  console.log(`Unit ${i}: <${el.tagName}> class="${$(el).attr('class')}" | Headings: "${h}" | CTAs: [${ctas}]`);
});
