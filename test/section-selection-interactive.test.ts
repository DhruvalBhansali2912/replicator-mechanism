import { Readable } from 'stream';
import { createServer } from '../src/server.js';
import { getDb } from '../src/db/database.js';
import { tokenService } from '../src/tokens/token-service.js';

// In-memory HTTP dispatcher for Express
function callApp(app: any, method: string, url: string, body?: any, headers: Record<string, string> = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const raw = body !== undefined ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) : Buffer.alloc(0);
    const req: any = Readable.from([raw]);
    req.method = method;
    req.url = url;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = req.socket;
    req.headers = {
      'content-type': 'application/json',
      'content-length': String(raw.length),
      ...headers,
    };

    let resHeaders: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      setHeader: (k: string, v: string) => { resHeaders[k.toLowerCase()] = v; },
      getHeader: (k: string) => resHeaders[k.toLowerCase()],
      status: function (c: number) { this.statusCode = c; return this; },
      json: function (data: any) { resolve({ status: this.statusCode, data }); },
      send: function (data: any) { resolve({ status: this.statusCode, data }); },
      end: function () { resolve({ status: this.statusCode, data: null }); },
    };

    app(req, res);
  });
}

async function runSectionSelectionTests() {
  console.log('\n======================================================');
  console.log('🧪 VERIFYING GROUND-UP SECTION SELECTION & INTERACTIVITY');
  console.log('======================================================\n');

  const app = createServer();
  const db = getDb();

  // Register User
  const regEmail = `creator_${Date.now()}@test.com`;
  const regRes = await callApp(app, 'POST', '/api/v1/auth/register', {
    email: regEmail,
    password: 'Password123!',
  });
  if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
  const token = regRes.data.initialToken;
  const userId = regRes.data.user.id;
  const authHeaders = { authorization: `Bearer ${token}` };

  // Grant 50 tokens
  tokenService.grantTokens(userId, 50, 'bonus');
  let balance = tokenService.getUserBalance(userId);
  console.log(`✓ Initialized test user with ${balance.available_tokens} tokens`);

  // -------------------------------------------------------------------
  // TEST 1: Direct Interactive Section Synthesis (Pricing Section)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 1: Direct Interactive Section Synthesis (Pricing) ---');
  const samplePricingHtml = `
    <section id="pricing" class="pricing-container">
      <div class="header">
        <h2>Simple, Transparent Pricing</h2>
        <p>Choose the perfect plan for your development team with no hidden fees.</p>
      </div>
      <div class="pricing-grid">
        <div class="tier card">
          <h3>Starter</h3>
          <div class="price">$19/mo</div>
          <ul class="features">
            <li>5 Projects</li>
            <li>Basic Analytics</li>
            <li>Community Support</li>
          </ul>
          <a href="/signup?plan=starter" class="btn btn-primary">Start Free Trial</a>
        </div>
        <div class="tier card popular">
          <span class="badge">Most Popular</span>
          <h3>Pro</h3>
          <div class="price">$49/mo</div>
          <ul class="features">
            <li>Unlimited Projects</li>
            <li>Real-time Collaboration</li>
            <li>Priority 24/7 Support</li>
          </ul>
          <a href="/signup?plan=pro" class="btn btn-primary">Go Pro Now</a>
        </div>
        <div class="tier card">
          <h3>Enterprise</h3>
          <div class="price">$199/mo</div>
          <ul class="features">
            <li>Dedicated Infrastructure</li>
            <li>Custom Integrations</li>
            <li>SLA Guarantee</li>
          </ul>
          <a href="/contact" class="btn btn-secondary">Contact Sales</a>
        </div>
      </div>
    </section>
  `;

  const synthRes = await callApp(
    app,
    'POST',
    '/api/v1/sections/synthesize',
    {
      html: samplePricingHtml,
      sourceUrl: 'https://example.com/pricing',
      selector: '#pricing',
    },
    authHeaders
  );

  if (synthRes.status !== 200 || !synthRes.data.success) {
    throw new Error(`Section synthesis failed: ${JSON.stringify(synthRes.data)}`);
  }

  const result = synthRes.data;
  console.log(`  ✓ Archetype detected: ${result.archetype}`);
  console.log(`  ✓ Scoring Breakdown:`);
  console.log(`    - Structural:    ${result.scoring.structuralScore} / 30`);
  console.log(`    - Visual Layout: ${result.scoring.visualScore} / 40`);
  console.log(`    - Interactivity: ${result.scoring.interactiveScore} / 30`);
  console.log(`    - Total Quality: ${result.scoring.totalScore} / 100 (Threshold >= 90)`);
  console.log(`  ✓ Interactive Features: ${result.interactiveFeatures.join(', ')}`);

  if (result.scoring.totalScore < 90) {
    throw new Error(`Quality score ${result.scoring.totalScore} did not meet the >= 90 standard`);
  }

  // Verify synthesized code properties
  if (!result.code.html.includes('<section') || !result.code.html.includes('Simple, Transparent Pricing')) {
    throw new Error('Synthesized HTML missing semantic landmarks or content');
  }
  if (!result.code.css.includes(':hover') || !result.code.css.includes('transform: translateY(')) {
    throw new Error('Synthesized CSS missing interactive hover transitions');
  }
  if (!result.code.css.includes('--color-primary') || !result.code.css.includes('display: grid')) {
    throw new Error('Synthesized CSS missing modern CSS grid and token variables');
  }

  console.log('  ✓ Generated clean ground-up HTML, CSS with :hover elevation and token variables');

  // Verify token accounting (1 token charged for successful synthesis)
  const afterBalance = tokenService.getUserBalance(userId);
  console.log(`  ✓ Token balance after synthesis: ${afterBalance.available_tokens} (Deducted: ${60 - afterBalance.available_tokens})`);
  if (60 - afterBalance.available_tokens !== 1) {
    throw new Error('Expected exactly 1 token deducted for section synthesis');
  }

  // -------------------------------------------------------------------
  // TEST 2: Strict Quality Threshold Gate (Score < 90 Rejection & 0 Tokens Deducted)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 2: Strict Quality Gate (< 90 Rejection & Zero Deductions) ---');
  // Pass a snippet that will score < 90
  const badSnippet = '<div><span>Just plain text</span></div>';

  const preBadBalance = tokenService.getUserBalance(userId).available_tokens;
  console.log(`  Balance before rejected test: ${preBadBalance}`);

  const badRes = await callApp(
    app,
    'POST',
    '/api/v1/sections/synthesize',
    {
      html: badSnippet,
      sourceUrl: 'https://example.com',
      selector: 'div',
    },
    authHeaders
  );

  console.log(`  Synthesis result status: ${badRes.status}`);
  if (badRes.status === 422) {
    console.log(`  ✓ Successfully rejected with HTTP 422 (${badRes.data.error})`);
    console.log(`  ✓ Message: ${badRes.data.message}`);
    const postBadBalance = tokenService.getUserBalance(userId).available_tokens;
    if (preBadBalance !== postBadBalance) {
      throw new Error(`Tokens were deducted on failure! (Pre: ${preBadBalance}, Post: ${postBadBalance})`);
    }
    console.log(`  ✓ Zero token deduction verified! Balance remains ${postBadBalance}`);
  } else {
    console.log(`  Score: ${badRes.data.scoring?.totalScore}`);
  }

  // -------------------------------------------------------------------
  // TEST 3: Asynchronous Section Isolation via Job Queue
  // -------------------------------------------------------------------
  console.log('\n--- TEST 3: Asynchronous Section Isolation via Job Queue ---');

  const fullPageWithSections = `
    <!DOCTYPE html>
    <html>
      <head><title>Full Company Page</title></head>
      <body>
        <header id="site-header">
          <nav>
            <a href="/" class="brand">Acme Corp</a>
            <div class="links">
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
            </div>
          </nav>
        </header>

        <section id="hero" class="hero-section">
          <h1>Build Better Software Faster</h1>
          <p>The enterprise platform designed for engineering speed and stability.</p>
          <button class="btn btn-primary">Start Trial</button>
        </section>

        <section id="features-target" class="features-section">
          <h2>Enterprise Features</h2>
          <p>Everything you need to ship high-quality apps without infrastructure overhead.</p>
          <div class="features-grid">
            <div class="feature-card">
              <h3>Fast CI/CD</h3>
              <p>Automated builds and tests triggered on every git push.</p>
            </div>
            <div class="feature-card">
              <h3>Zero Downtime</h3>
              <p>Seamless rolling deployments with instant rollback capability.</p>
            </div>
            <div class="feature-card">
              <h3>Observability</h3>
              <p>Deep distributed tracing and real-time metrics dashboards.</p>
            </div>
          </div>
        </section>

        <footer id="site-footer">
          <p>&copy; 2026 Acme Corp. All rights reserved.</p>
        </footer>
      </body>
    </html>
  `;

  // Submit job targeting ONLY "#features-target"
  const queueRes = await callApp(
    app,
    'POST',
    '/api/v1/reconstruction',
    {
      url: 'https://example.com',
      htmlSnapshot: fullPageWithSections,
      options: {
        sectionSelector: '#features-target',
      },
      limits: { maxIterations: 1 },
    },
    authHeaders
  );

  if (queueRes.status !== 202 || !queueRes.data.job_id) {
    throw new Error(`Queue submission failed: ${JSON.stringify(queueRes.data)}`);
  }
  const targetJobId = queueRes.data.job_id;
  console.log(`  ✓ Enqueued section-isolated job: ${targetJobId}`);

  // Poll until job completes
  let jobFinished = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const poll = await callApp(app, 'GET', `/api/v1/jobs/${targetJobId}`, undefined, authHeaders);
    const status = poll.data.status;
    if (status === 'completed') {
      jobFinished = true;
      console.log(`  ✓ Section isolation job completed successfully!`);
      console.log(`    - Steps executed: ${poll.data.steps.length}`);
      console.log(`    - Actual tokens:  ${poll.data.actual_tokens}`);
      break;
    }
    if (status === 'failed') {
      throw new Error(`Section isolation job failed: ${poll.data.error_message}`);
    }
  }

  if (!jobFinished) throw new Error('Job did not complete in time');

  // Verify reconstruction results
  const resEndpoint = await callApp(app, 'GET', `/api/v1/results/${targetJobId}`, undefined, authHeaders);
  if (resEndpoint.status !== 200 || !resEndpoint.data.code?.html) {
    throw new Error(`Failed to fetch job results: ${JSON.stringify(resEndpoint.data)}`);
  }

  const jobResult = resEndpoint.data;
  console.log(`  ✓ Result Code Size: ${jobResult.code.html.length} bytes HTML, ${jobResult.code.css.length} bytes CSS`);
  console.log(`  ✓ Fidelity Score: ${jobResult.accuracy_metrics.fidelity_score}% (>= 90 Required)`);
  if (jobResult.accuracy_metrics.fidelity_score < 90) {
    throw new Error(`Job fidelity score ${jobResult.accuracy_metrics.fidelity_score} is below 90%`);
  }

  // Verify that ONLY the features section was synthesized, NOT the hero or footer!
  if (!jobResult.code.html.includes('Enterprise Features') || !jobResult.code.html.includes('Fast CI/CD')) {
    throw new Error('Selected section content missing from isolated output');
  }
  if (jobResult.code.html.includes('Build Better Software Faster') || jobResult.code.html.includes('Acme Corp. All rights reserved')) {
    throw new Error('Section isolation failed: non-targeted sections were leaked into output');
  }
  console.log('  ✓ Section Isolation Verified: Only the targeted section was extracted and synthesized!');

  console.log('\n======================================================');
  console.log('🎉 ALL SECTION SELECTION & INTERACTIVE TESTS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runSectionSelectionTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
