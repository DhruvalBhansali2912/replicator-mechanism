const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EVAL_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/proofs/matrix_eval';

async function testAll() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  await page.goto('https://replicator.inventkid.com/api/jobs/job_b3bc4f33d07a4af6/preview/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Repo Picker: #_R_1r9l4b36_
  await page.evaluate(() => {
    const btn = document.querySelector('#_R_1r9l4b36_');
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(EVAL_DIR, 'clone_desktop_repo_picker.png') });
  console.log('Saved clone_desktop_repo_picker.png');

  // Reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 2. Copilot Menu: #_R_aa9t4b36_
  await page.evaluate(() => {
    const btn = document.querySelector('#_R_aa9t4b36_');
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(EVAL_DIR, 'clone_desktop_copilot_menu.png') });
  console.log('Saved clone_desktop_copilot_menu.png');

  // Reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 3. Create Menu: #_R_2pt4b36_
  await page.evaluate(() => {
    const btn = document.querySelector('#_R_2pt4b36_');
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(EVAL_DIR, 'clone_desktop_create_menu.png') });
  console.log('Saved clone_desktop_create_menu.png');

  // Reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 4. Profile Menu: button[aria-labelledby="_R_1bt4b36_"]
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-labelledby="_R_1bt4b36_"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(EVAL_DIR, 'clone_desktop_profile_menu.png') });
  console.log('Saved clone_desktop_profile_menu.png');

  await browser.close();
}

testAll().catch(console.error);
