const fs = require('fs');
const cheerio = require('cheerio');

const job = JSON.parse(fs.readFileSync('storage/jobs/job_2c8182636e644eb8/job.json', 'utf8'));
const $ = cheerio.load(job.options.htmlSnapshot);

console.log('=== Body Direct Children ===');
$('body > *').each((i, el) => {
  const text = $(el).text().replace(/\s+/g, ' ').trim().substring(0, 80);
  console.log(`${i}. <${el.tagName}> id="${$(el).attr('id') || ''}" class="${$(el).attr('class') || ''}" | ${text}`);
});

console.log('\n=== Main Sections ===');
$('main section, body > section, [role="main"] section').each((i, el) => {
  const text = $(el).text().replace(/\s+/g, ' ').trim().substring(0, 80);
  console.log(`${i}. <${el.tagName}> id="${$(el).attr('id') || ''}" class="${$(el).attr('class') || ''}" | ${text}`);
});
