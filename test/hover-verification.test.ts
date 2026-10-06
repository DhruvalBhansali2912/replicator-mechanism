import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

function runHoverVerification() {
  console.log('--- Running Comprehensive Navigation, Mobile & Anti-Flicker Verification ---');
  const indexPath = path.join(process.cwd(), 'storage/jobs/job_606959e72e304872/full-page/index.html');
  const cssPath = path.join(process.cwd(), 'storage/jobs/job_606959e72e304872/full-page/style.css');
  const jsPath = path.join(process.cwd(), 'storage/jobs/job_606959e72e304872/full-page/script.js');

  const html = fs.readFileSync(indexPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  // 1. Verify Browser JavaScript Syntax (Must be pure vanilla ES6 with 0 syntax errors)
  console.log('1. Checking browser JavaScript syntax for parse errors...');
  try {
    new Function(js);
    console.log('✓ Browser JavaScript passes pure ES6 syntax check with 0 errors.');
  } catch (err: any) {
    throw new Error(`CRITICAL SYNTAX ERROR in generated browser script: ${err.message}`);
  }

  // 2. Anti-flicker CSS verification
  console.log('2. Verifying anti-flicker CSS guarantees...');
  if (css.includes('.globalnav-item:hover .globalnav-submenu {') && css.includes('height: auto !important')) {
    throw new Error('Detected conflicting height: auto !important on :hover that causes 60fps flickering');
  }
  if (!css.includes('.globalnav-item-flyout-open .globalnav-submenu') || !css.includes('visibility: visible !important')) {
    throw new Error('Missing active open state visibility rule for submenus');
  }
  console.log('✓ Anti-flicker CSS verified (no layout thrashing or unlatched hover fight).');

  // 3. Mobile menu & trigger isolation
  console.log('3. Checking mobile menu controller & trigger isolation in JS...');
  if (!js.includes('menuBtn') || !js.includes('globalnav-with-menu-open')) {
    throw new Error('Missing mobile menu toggle controller in JS');
  }
  if (!js.includes('triggers.forEach') || !js.includes('!dropdown.contains(el)')) {
    throw new Error('Trigger click isolation missing: submenu destination links must not be hijacked by mobile drilldown');
  }
  console.log('✓ Mobile menu controller and trigger isolation verified.');

  // 4. Verify all nav items and their distinct links
  console.log('4. Checking all 11 nav items and distinct submenus in DOM...');
  const $ = cheerio.load(html);
  const items = [
    'Store',
    'Mac',
    'iPad',
    'iPhone',
    'Watch',
    'Vision',
    'AirPods',
    'TV & Home',
    'Entertainment',
    'Accessories',
    'Support',
  ];

  const seenLinkSets = new Set<string>();

  for (const itemText of items) {
    const itemEl = $(`#globalnav .globalnav-item:contains("${itemText}")`).filter((_, el) => {
      const link = $(el).find('a, button').first();
      return link.text().replace(/\s+/g, ' ').includes(itemText);
    }).first();

    if (!itemEl.length) {
      throw new Error(`Nav item not found in DOM for: ${itemText}`);
    }

    const flyout = itemEl.find('.globalnav-submenu, [class*="submenu"], [class*="flyout"]').filter((_, el) => {
      const cls = $(el).attr('class') || '';
      return !cls.includes('trigger') && !cls.includes('button') && !cls.includes('link');
    }).first();

    if (!flyout.length) {
      throw new Error(`Flyout submenu not found for nav item: ${itemText}`);
    }

    const links = flyout.find('a').map((_, a) => $(a).text().trim()).get();
    if (links.length === 0) {
      throw new Error(`No links found in flyout for: ${itemText}`);
    }

    const linkFingerprint = links.slice(0, 3).join('|');
    if (seenLinkSets.has(linkFingerprint)) {
      throw new Error(`Duplicate link set detected for: ${itemText}! Links must be distinct per section.`);
    }
    seenLinkSets.add(linkFingerprint);

    console.log(`  ✓ ${itemText.padEnd(15)} -> ${links.length.toString().padStart(2)} distinct links. (Sample: ${links.slice(0, 3).join(', ')})`);
  }

  console.log('✓ All 11 navigation items have 100% distinct, verified submenus!');
  console.log('✓ All verification checks PASSED successfully!');
}

runHoverVerification();
