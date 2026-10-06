import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { createServer } from '../src/server.js';
import { tokenService } from '../src/tokens/token-service.js';

let appInstance: any = null;

async function requestApi(
  method: string,
  urlPath: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any }> {
  // Try real fetch first
  try {
    const fetchHeaders: Record<string, string> = { ...headers };
    if (body) fetchHeaders['Content-Type'] = 'application/json';
    const resp = await fetch(`http://localhost:3000${urlPath}`, {
      method,
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text();
    let data = text;
    try { data = JSON.parse(text); } catch {}
    return { status: resp.status, data };
  } catch (err: any) {
    if (err.cause?.code === 'EPERM' || err.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
      // In-sandbox stream fallback
      if (!appInstance) appInstance = createServer();
      return new Promise((resolve) => {
        const raw = body !== undefined ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) : Buffer.alloc(0);
        const req: any = Readable.from([raw]);
        req.method = method;
        req.url = urlPath;
        req.socket = { remoteAddress: '127.0.0.1' };
        req.connection = req.socket;
        const normalizedHeaders: Record<string, string> = {
          'content-type': 'application/json',
          'content-length': String(raw.length),
        };
        for (const [k, v] of Object.entries(headers)) {
          normalizedHeaders[k.toLowerCase()] = v;
        }
        req.headers = normalizedHeaders;

        let resHeaders: Record<string, string> = {};
        const res: any = {
          statusCode: 200,
          setHeader: (k: string, v: string) => { resHeaders[k.toLowerCase()] = v; },
          getHeader: (k: string) => resHeaders[k.toLowerCase()],
          status: function (c: number) { this.statusCode = c; return this; },
          json: function (data: any) { resolve({ status: this.statusCode, data }); },
          send: function (data: any) { resolve({ status: this.statusCode, data }); },
          sendFile: function (filePath: string) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              resolve({ status: this.statusCode, data: content });
            } catch (err: any) {
              resolve({ status: 500, data: err.message });
            }
          },
          download: function (filePath: string) {
            try {
              const content = fs.readFileSync(filePath);
              resolve({ status: this.statusCode, data: content });
            } catch (err: any) {
              resolve({ status: 404, data: err.message });
            }
          },
          redirect: function (statusOrUrl: any, maybeUrl?: string) {
            const code = typeof statusOrUrl === 'number' ? statusOrUrl : 302;
            const target = typeof statusOrUrl === 'string' ? statusOrUrl : maybeUrl;
            resolve({ status: code, data: { redirectUrl: target } });
          },
          end: function () { resolve({ status: this.statusCode, data: null }); },
        };

        appInstance(req, res);
      });
    }
    throw err;
  }
}

async function runExtensionLiveTest() {
  console.log('\n======================================================');
  console.log('🧪 LIVE EXTENSION & SERVER VERIFICATION');
  console.log('======================================================\n');

  // 1. Verify popup.html DOM Structure
  console.log('--- TEST 1: Popup HTML DOM Hierarchy Audit ---');
  const popupHtmlPath = path.resolve('extension/popup/popup.html');
  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  const $ = cheerio.load(popupHtml);

  const appContainer = $('.app-container');
  if (appContainer.length !== 1) throw new Error('Missing .app-container');

  const viewLicense = $('#view-license');
  const viewReady = $('#view-ready');
  const viewProgress = $('#view-progress');
  const viewCompleted = $('#view-completed');

  if (viewLicense.length !== 1) throw new Error('Missing #view-license');
  if (viewReady.length !== 1) throw new Error('Missing #view-ready');
  if (viewProgress.length !== 1) throw new Error('Missing #view-progress');
  if (viewCompleted.length !== 1) throw new Error('Missing #view-completed');

  if (viewReady.find('#view-progress').length > 0) {
    throw new Error('FATAL BUG: #view-progress is nested inside #view-ready!');
  }
  if (viewReady.find('#view-completed').length > 0) {
    throw new Error('FATAL BUG: #view-completed is nested inside #view-ready!');
  }
  console.log('  ✓ Verified: #view-ready, #view-progress, and #view-completed are separate sibling views');

  const cardLastResult = $('#card-last-result');
  if (cardLastResult.find('.section-picker-card').length > 0) {
    throw new Error('FATAL BUG: .section-picker-card is swallowed inside #card-last-result.hidden!');
  }
  if (cardLastResult.find('#btn-start-extract').length > 0) {
    throw new Error('FATAL BUG: #btn-start-extract is swallowed inside #card-last-result.hidden!');
  }
  console.log('  ✓ Verified: #card-last-result is properly closed and does not swallow main controls');

  const btnPick = $('#btn-pick-section');
  const sectionInfo = $('#selected-section-info');
  const targetBadge = $('#badge-target-mode');
  if (btnPick.length !== 1 || sectionInfo.length !== 1 || targetBadge.length !== 1) {
    throw new Error('Missing section picker DOM elements in popup.html');
  }
  console.log('  ✓ Verified: Section selection controls present in popup.html');

  // 2. Test Server API Endpoints
  console.log('\n--- TEST 2: Server API & Token Verification ---');
  const email = `tester_${Date.now()}@e2e.com`;
  const regRes = await requestApi('POST', '/api/v1/auth/register', { email, password: 'SecurePassword123!' });
  if (regRes.status !== 201) {
    throw new Error(`Register failed with HTTP ${regRes.status}: ${JSON.stringify(regRes.data)}`);
  }
  const token = regRes.data.initialToken;
  console.log(`  ✓ Registered test account: ${email}`);
  console.log(`  ✓ Received Bearer Token: ${token.slice(0, 16)}...`);

  const balRes = await requestApi('GET', '/api/v1/tokens', undefined, { 'Authorization': `Bearer ${token}` });
  console.log(`  ✓ Initial Token Balance: ${balRes.data.available_tokens} credits`);
  if (balRes.data.available_tokens < 10) throw new Error('Initial bonus tokens missing');

  // 3. Test Ground-Up Section Synthesis with Hover & Click (Tesla landing section)
  console.log('\n--- TEST 3: Ground-Up Section Synthesis with Hover & Click ---');
  const testSectionHtml = `
    <section id="model-3" class="vehicle-section" style="background:#f4f4f4; padding:60px 20px;">
      <div class="container" style="max-width:1200px; margin:0 auto; text-align:center;">
        <h2 style="font-size:36px; font-weight:700;">Model 3 Performance</h2>
        <p style="font-size:18px; color:#555;">0-60 mph in 2.9 seconds with dual-motor all-wheel drive.</p>
        <div class="actions" style="margin-top:24px; display:flex; justify-content:center; gap:16px;">
          <a href="/order" class="btn btn-primary" style="background:#171a20; color:#fff; padding:12px 32px; border-radius:4px;">Order Now</a>
          <a href="/demo" class="btn btn-secondary" style="background:#eee; color:#171a20; padding:12px 32px; border-radius:4px;">Demo Drive</a>
        </div>
      </div>
    </section>
  `;

  const synthRes = await requestApi('POST', '/api/v1/sections/synthesize', {
    html: testSectionHtml,
    sourceUrl: 'https://tesla.com',
    selector: '#model-3',
  }, { 'Authorization': `Bearer ${token}` });

  if (synthRes.status !== 200) {
    throw new Error(`Section synthesis failed with HTTP ${synthRes.status}: ${JSON.stringify(synthRes.data)}`);
  }
  const synthData = synthRes.data;
  console.log(`  ✓ Section Archetype: ${synthData.archetype}`);
  console.log(`  ✓ Quality Score: ${synthData.scoring.totalScore} / 100 (Threshold >= 90)`);
  console.log(`    - Structural:    ${synthData.scoring.structuralScore} / 30`);
  console.log(`    - Visual Layout: ${synthData.scoring.visualScore} / 40`);
  console.log(`    - Interactivity: ${synthData.scoring.interactiveScore} / 30`);
  console.log(`  ✓ Interactive Features: ${synthData.interactiveFeatures.join(', ')}`);

  if (synthData.scoring.totalScore < 90) {
    throw new Error(`Fidelity score ${synthData.scoring.totalScore} failed the strict 90% threshold`);
  }

  if (!synthData.code.css.includes(':hover') || !synthData.code.css.includes('transform: translateY(')) {
    throw new Error('Generated CSS missing interactive hover transitions');
  }
  if (!synthData.code.html.includes('Model 3 Performance')) {
    throw new Error('Generated HTML missing section content');
  }
  console.log('  ✓ Verified: Ground-up HTML & CSS generated with full hover state elevation');

  // 4. Test Asynchronous Section Isolation via Job Queue
  console.log('\n--- TEST 4: Asynchronous Section Isolation via Queue ---');
  // Top up user with 50 tokens
  tokenService.grantTokens(regRes.data.user.id, 50, 'purchase');
  const fullTeslaPage = `
    <!DOCTYPE html>
    <html>
      <head><title>Electric Cars, Solar & Clean Energy | Tesla</title></head>
      <body>
        <header id="tds-site-header">
          <nav><a href="/" class="brand">TESLA</a><a href="/vehicles">Vehicles</a></nav>
        </header>
        <section id="model-y" class="hero-section">
          <h1>Model Y</h1>
          <p>Starting at $31,490 after Federal Tax Credit</p>
          <button class="btn btn-primary">Order Model Y</button>
        </section>
        <section id="model-3-isolated" class="showcase-section">
          <h2>Model 3</h2>
          <p>1.99% APR Available</p>
          <div class="actions">
            <button class="btn btn-primary">Order Now</button>
            <button class="btn btn-secondary">Learn More</button>
          </div>
        </section>
        <footer id="tds-footer">
          <p>Tesla &copy; 2026</p>
        </footer>
      </body>
    </html>
  `;

  const jobReq = await requestApi('POST', '/api/v1/reconstruction', {
    url: 'https://tesla.com',
    htmlSnapshot: fullTeslaPage,
    options: {
      sectionSelector: '#model-3-isolated',
    },
    limits: { maxIterations: 1 },
  }, { 'Authorization': `Bearer ${token}` });

  if (jobReq.status !== 202) {
    throw new Error(`Reconstruction job submit failed with HTTP ${jobReq.status}: ${JSON.stringify(jobReq.data)}`);
  }
  const targetJobId = jobReq.data.job_id;
  console.log(`  ✓ Section-isolated job enqueued: ${targetJobId}`);

  // Poll until completed
  let jobCompleted = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const poll = await requestApi('GET', `/api/v1/jobs/${targetJobId}`, undefined, { 'Authorization': `Bearer ${token}` });
    const pollData = poll.data;
    if (pollData.status === 'completed') {
      jobCompleted = true;
      console.log(`  ✓ Job ${targetJobId} completed! (Tokens used: ${pollData.actual_tokens})`);
      break;
    }
    if (pollData.status === 'failed') {
      throw new Error(`Job execution failed: ${pollData.error_message}`);
    }
  }

  if (!jobCompleted) throw new Error('Job did not complete in timeout');

  const resReq = await requestApi('GET', `/api/v1/results/${targetJobId}`, undefined, { 'Authorization': `Bearer ${token}` });
  const resData = resReq.data;
  console.log(`  ✓ Fidelity Score: ${resData.accuracy_metrics.fidelity_score}% (>= 90 Required)`);
  if (resData.accuracy_metrics.fidelity_score < 90) {
    throw new Error('Fidelity score below 90');
  }

  if (!resData.code.html.includes('Model 3') || !resData.code.html.includes('1.99% APR Available')) {
    throw new Error('Missing isolated section content in output');
  }
  if (resData.code.html.includes('Model Y') || resData.code.html.includes('Starting at $31,490')) {
    throw new Error('Leaked non-isolated section into output');
  }
  console.log('  ✓ Section Isolation Verified: Only #model-3-isolated was reconstructed!');

  // 5. Test User-Facing Preview and Download Endpoints (No Bearer Auth Required)
  console.log('\n--- TEST 5: User-Facing Preview & Download Endpoints ---');
  // Check preview endpoint (express.static redirects /preview -> /preview/ with 301)
  const previewRes = await requestApi('GET', `/api/jobs/${targetJobId}/preview/`);
  if (previewRes.status !== 200) {
    throw new Error(`Preview endpoint returned HTTP ${previewRes.status}: ${JSON.stringify(previewRes.data)}`);
  }
  console.log(`  ✓ /api/jobs/${targetJobId}/preview/ returned HTTP 200 (HTML preview rendered)`);

  // Check download endpoint
  const downloadRes = await requestApi('GET', `/api/jobs/${targetJobId}/download`);
  if (downloadRes.status !== 200) {
    throw new Error(`Download endpoint returned HTTP ${downloadRes.status}`);
  }
  console.log(`  ✓ /api/jobs/${targetJobId}/download returned HTTP 200 (ZIP download OK)`);

  console.log('\n======================================================');
  console.log('🎉 ALL LIVE EXTENSION & SERVER TESTS PASSED!');
  console.log('======================================================\n');
}

runExtensionLiveTest().catch((err) => {
  console.error('\n❌ E2E Test Failed:', err);
  process.exit(1);
});
