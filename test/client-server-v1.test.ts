import { Readable } from 'stream';
import { createServer } from '../src/server.js';
import { AppDatabase } from '../src/db/database.js';
import { AuthService } from '../src/auth/auth-service.js';
import { TokenService, tokenService } from '../src/tokens/token-service.js';
import {
  DOMAnalysisWorker,
  CSSAnalysisWorker,
  AssetAnalysisWorker,
  VisualSegmentationWorker,
  ReconstructionWorker,
  OptimizationWorker,
} from '../src/workers/index.js';

// In-memory HTTP dispatcher for Express (zero network sockets needed, 100% sandbox safe)
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

async function runTestSuite() {
  console.log('🚀 Running Comprehensive Client/Server Architecture Test Suite...\n');

  // ----------------------------------------------------
  // TEST 1: Workers Pipeline Unit Verification (Deterministic, Non-AI)
  // ----------------------------------------------------
  console.log('--- TEST 1: Deterministic Workers Pipeline ---');
  const sampleHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Demo SaaS</title>
        <style>
          :root { --primary-color: #2563eb; }
          .navbar { display: flex; justify-content: space-between; padding: 1rem; }
          .hero { text-align: center; padding: 4rem 1rem; }
          .pricing { display: grid; grid-template-columns: 1fr 1fr; }
          .footer { text-align: center; }
          @media (max-width: 768px) { .pricing { grid-template-columns: 1fr; } }
        </style>
      </head>
      <body>
        <header class="navbar"><a href="/">Brand</a><nav><a href="/pricing">Pricing</a></nav></header>
        <section class="hero"><h1>Reconstruct Anything</h1><p>Deterministic UI Extraction</p><img src="/logo.png" /></section>
        <section class="pricing"><div class="plan">$10/mo</div><div class="plan">$20/mo</div></section>
        <footer class="footer"><p>&copy; 2026 SaaS Inc.</p></footer>
      </body>
    </html>
  `;
  const sampleCss = `
    :root { --primary-color: #2563eb; }
    .navbar { display: flex; justify-content: space-between; padding: 1rem; }
    .hero { text-align: center; padding: 4rem 1rem; }
    .pricing { display: grid; grid-template-columns: 1fr 1fr; }
    .footer { text-align: center; }
    @media (max-width: 768px) { .pricing { grid-template-columns: 1fr; } }
  `;

  // 1a. DOMAnalysisWorker
  const domWorker = new DOMAnalysisWorker();
  const domResult = await domWorker.execute(sampleHtml);
  if (domResult.totalNodes <= 0 || domResult.maxDepth <= 0) throw new Error('DOMAnalysisWorker failed');
  console.log(`  ✓ DOMAnalysisWorker: ${domResult.totalNodes} nodes, depth ${domResult.maxDepth}`);

  // 1b. CSSAnalysisWorker
  const cssWorker = new CSSAnalysisWorker();
  const cssResult = await cssWorker.execute(sampleCss);
  if (cssResult.totalRules < 4 || cssResult.mediaQueriesCount !== 1) throw new Error('CSSAnalysisWorker failed');
  console.log(`  ✓ CSSAnalysisWorker: ${cssResult.totalRules} rules, ${cssResult.mediaQueriesCount} media queries, vars: ${cssResult.customProperties}`);

  // 1c. AssetAnalysisWorker
  const assetWorker = new AssetAnalysisWorker();
  const assetResult = await assetWorker.execute(sampleHtml, sampleCss, 'https://example.com');
  if (assetResult.totalAssets < 1) throw new Error('AssetAnalysisWorker failed');
  console.log(`  ✓ AssetAnalysisWorker: ${assetResult.totalAssets} assets discovered (${assetResult.imageCount} images)`);

  // 1d. VisualSegmentationWorker
  const segWorker = new VisualSegmentationWorker();
  const segResult = await segWorker.execute(domResult.cleanedHtml);
  if (segResult.totalSections < 3) throw new Error('VisualSegmentationWorker failed');
  console.log(`  ✓ VisualSegmentationWorker: ${segResult.totalSections} sections detected (${segResult.sections.map((s) => s.archetype).join(', ')})`);

  // 1e. ReconstructionWorker
  const recWorker = new ReconstructionWorker();
  const recResult = await recWorker.execute(domResult.cleanedHtml, sampleCss, '', segResult.sections, 'https://example.com');
  if (!recResult.fullHtml || recResult.sections.length === 0) throw new Error('ReconstructionWorker failed');
  console.log(`  ✓ ReconstructionWorker: Synthesized ${recResult.sections.length} semantic sections`);

  // 1f. OptimizationWorker
  const optWorker = new OptimizationWorker();
  const optResult = await optWorker.executeIteration(recResult.fullHtml, recResult.fullCss, 1, 10);
  if (!optResult.optimizedHtml || optResult.improvementsApplied.length === 0) throw new Error('OptimizationWorker failed');
  console.log(`  ✓ OptimizationWorker: Applied ${optResult.improvementsApplied.length} optimization passes`);

  // ----------------------------------------------------
  // TEST 2: Token Economics, Atomic Reservation & Ledger
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Token Economics & Immutable Ledger ---');
  const testDb = new AppDatabase({ inMemory: true });
  const testTokenSvc = new TokenService(testDb);
  const testAuthSvc = new AuthService(testDb, testTokenSvc);

  // Register user
  const userReg = testAuthSvc.register('bob@builder.com', 'password123');
  const testUserId = userReg.user.id;

  // Initial balance (10 starter bonus)
  let balance = testTokenSvc.getUserBalance(testUserId);
  console.log(`  Initial balance for user: ${balance.current_balance} (available: ${balance.available_tokens})`);
  if (balance.current_balance !== 10) throw new Error('Initial grant mismatch');

  // Purchase/Grant +90 tokens -> 100 total
  testTokenSvc.grantTokens(testUserId, 90, 'purchase', { orderId: 'ord_123' });
  balance = testTokenSvc.getUserBalance(testUserId);
  console.log(`  Balance after purchase: ${balance.current_balance} (available: ${balance.available_tokens})`);
  if (balance.current_balance !== 100) throw new Error('Grant failed');

  // Reserve 20 tokens
  const reservation = testTokenSvc.reserveTokens(testUserId, 'job_99', 'reconstruction', 20);
  balance = testTokenSvc.getUserBalance(testUserId);
  console.log(`  Balance after reserving 20: ${balance.current_balance} (reserved: ${balance.reserved_tokens}, available: ${balance.available_tokens})`);
  if (balance.reserved_tokens !== 20 || balance.available_tokens !== 80) throw new Error('Reservation accounting failed');

  // Prevent double spending / overdraft
  try {
    testTokenSvc.reserveTokens(testUserId, 'job_98', 'reconstruction', 85); // Only 80 available!
    throw new Error('Should have rejected overdraft reservation');
  } catch (err: any) {
    if (!err.message.includes('INSUFFICIENT_TOKENS')) throw err;
    console.log('  ✓ Overdraft protection correctly prevented reservation exceeding available balance');
  }

  // Settle with actual usage = 13 (Refund 7)
  const settlement = testTokenSvc.settleReservation(reservation.reservationId, 13, { operation: 'reconstruction' });
  balance = testTokenSvc.getUserBalance(testUserId);
  console.log(`  Settled with 13 tokens. Refunded: ${settlement.refundedAmount}. Final Balance: ${balance.current_balance} (available: ${balance.available_tokens})`);
  if (balance.current_balance !== 87 || settlement.refundedAmount !== 7) throw new Error('Settlement calculation failed');

  // Verify immutable ledger entries
  const ledger = testTokenSvc.getLedgerHistory(testUserId);
  console.log(`  ✓ Immutable ledger entries recorded: ${ledger.length}`);
  const ledgerTypes = ledger.map((l) => l.type);
  if (!ledgerTypes.includes('grant') || !ledgerTypes.includes('reservation') || !ledgerTypes.includes('consumption') || !ledgerTypes.includes('refund')) {
    throw new Error(`Missing expected transaction types in ledger: ${ledgerTypes}`);
  }

  // ----------------------------------------------------
  // TEST 3: REST API Integration & Security Verification
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Versioned REST API & Security Verification ---');
  const app = createServer();

  // 3a. Registration & Auth
  const regRes = await callApp(app, 'POST', '/api/v1/auth/register', {
    email: `carol_${Date.now()}@tester.com`,
    password: 'mypassword123',
  });
  if (regRes.status !== 201 || !regRes.data.initialToken) throw new Error('API register failed');
  const bearerToken = regRes.data.initialToken;
  const authHeaders = { authorization: `Bearer ${bearerToken}` };
  console.log('  ✓ POST /api/v1/auth/register: User registered with initial Bearer token');

  // 3b. Verify Bearer required (401 without auth)
  const unauthRes = await callApp(app, 'GET', '/api/v1/projects');
  if (unauthRes.status !== 401) throw new Error('Should have required Bearer token');
  console.log('  ✓ GET /api/v1/projects correctly rejected unauthorized request (HTTP 401)');

  // 3c. Query Token Balance
  const tokensRes = await callApp(app, 'GET', '/api/v1/tokens', undefined, authHeaders);
  if (tokensRes.status !== 200 || tokensRes.data.current_balance !== 10) throw new Error('Token query failed');
  console.log(`  ✓ GET /api/v1/tokens: ${JSON.stringify(tokensRes.data)}`);

  // 3d. Project CRUD
  const prjRes = await callApp(
    app,
    'POST',
    '/api/v1/projects',
    { name: 'My Landing Page', sourceUrl: 'https://example.com' },
    authHeaders
  );
  if (prjRes.status !== 201 || !prjRes.data.project.id) throw new Error('Project create failed');
  const projectId = prjRes.data.project.id;
  console.log(`  ✓ POST /api/v1/projects: Created project ${projectId}`);

  // 3e. Sections API
  const secRes = await callApp(
    app,
    'POST',
    '/api/v1/sections',
    {
      projectId,
      sourceUrl: 'https://example.com',
      selector: '.navbar',
      tagName: 'header',
      domRepresentation: '<header class="navbar"><a href="/">Logo</a></header>',
    },
    authHeaders
  );
  if (secRes.status !== 201 || !secRes.data.section.sectionId) throw new Error('Section create failed');
  console.log(`  ✓ POST /api/v1/sections: Saved section ${secRes.data.section.sectionId}`);

  // 3f. DOM Analysis API (consumes 1 token)
  const domApiRes = await callApp(
    app,
    'POST',
    '/api/v1/analyze/dom',
    { html: '<main><section><h1>Hello World</h1></section></main>' },
    authHeaders
  );
  if (domApiRes.status !== 200 || !domApiRes.data.analysis) { console.error("domApiRes failed:", domApiRes); throw new Error('Analyze DOM API failed'); }
  console.log(`  ✓ POST /api/v1/analyze/dom: Analyzed successfully (Tokens used: ${domApiRes.data.tokensUsed})`);

  // Check balance decreased by 1
  const tokensAfterAnalyze = await callApp(app, 'GET', '/api/v1/tokens', undefined, authHeaders);
  if (tokensAfterAnalyze.data.available_tokens !== 9) throw new Error('Token balance did not deduct');
  console.log(`  ✓ Tokens after DOM analysis: ${tokensAfterAnalyze.data.available_tokens} (Deducted 1 token server-side)`);

  // 3g. Usage reporting API
  const usageRes = await callApp(app, 'GET', '/api/v1/usage', undefined, authHeaders);
  if (usageRes.status !== 200 || usageRes.data.usage.length === 0) throw new Error('Usage API failed');
  console.log(`  ✓ GET /api/v1/usage: Total tokens used: ${usageRes.data.total_tokens_used}, records: ${usageRes.data.usage.length}`);

  // 3h. Token rotation & revocation
  const tokensListRes = await callApp(app, 'GET', '/api/v1/auth/tokens', undefined, authHeaders);
  const tokenId = tokensListRes.data.tokens[0].id;
  const rotateRes = await callApp(app, 'POST', `/api/v1/auth/tokens/${tokenId}/rotate`, {}, authHeaders);
  if (rotateRes.status !== 200 || !rotateRes.data.token) throw new Error('Token rotate failed');
  const newBearerToken = rotateRes.data.token;
  console.log('  ✓ POST /api/v1/auth/tokens/:id/rotate: Successfully rotated API token');

  // Old token should now fail
  const oldRes = await callApp(app, 'GET', '/api/v1/tokens', undefined, authHeaders);
  if (oldRes.status !== 401) throw new Error('Old token was not revoked!');
  console.log('  ✓ Old token was properly revoked and rejected (HTTP 401)');

  // New token works
  const newBalRes = await callApp(app, 'GET', '/api/v1/tokens', undefined, { authorization: `Bearer ${newBearerToken}` });
  if (newBalRes.status !== 200) throw new Error('New token failed');
  console.log('  ✓ New rotated token authenticated successfully');

  // 3i. Reconstruction Job Queue & Asynchronous Polling
  console.log('\n--- TEST 4: Asynchronous Reconstruction Job Queue ---');
  // Top up user with 50 tokens for reconstruction
  tokenService.grantTokens(regRes.data.user.id, 50, 'purchase');

  const jobSubmitRes = await callApp(
    app,
    'POST',
    '/api/v1/reconstruction',
    {
      url: 'https://example.com',
      projectId,
      htmlSnapshot: sampleHtml,
      clientStylesheets: [sampleCss],
      options: { renameClasses: true },
      limits: { maxIterations: 1 },
    },
    { authorization: `Bearer ${newBearerToken}` }
  );

  if (jobSubmitRes.status !== 202 || !jobSubmitRes.data.job_id || jobSubmitRes.data.status !== 'queued') {
    throw new Error(`Reconstruction job dispatch failed: ${JSON.stringify(jobSubmitRes.data)}`);
  }
  const jobId = jobSubmitRes.data.job_id;
  console.log(`  ✓ POST /api/v1/reconstruction: Job enqueued -> ${jobId} (Estimated tokens: ${jobSubmitRes.data.estimated_tokens})`);

  // Poll until completed (or failed)
  let jobCompleted = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 600));
    const pollRes = await callApp(app, 'GET', `/api/v1/jobs/${jobId}`, undefined, {
      authorization: `Bearer ${newBearerToken}`,
    });
    const status = pollRes.data.status;
    process.stdout.write(`  ... Job status: ${status} (steps: ${pollRes.data.steps?.length || 0})\r`);

    if (status === 'completed') {
      jobCompleted = true;
      console.log(`\n  ✓ Job ${jobId} completed successfully! Actual tokens: ${pollRes.data.actual_tokens}`);
      break;
    }
    if (status === 'failed') {
      throw new Error(`Job failed: ${pollRes.data.error_message}`);
    }
  }

  if (!jobCompleted) {
    throw new Error('Job did not complete within timeout');
  }

  // 3j. Query Result API
  const resultRes = await callApp(app, 'GET', `/api/v1/results/${jobId}`, undefined, {
    authorization: `Bearer ${newBearerToken}`,
  });
  if (resultRes.status !== 200 || !resultRes.data.code?.html) throw new Error('Result API failed');
  console.log(`  ✓ GET /api/v1/results/${jobId}: Generated HTML (${resultRes.data.code.html.length} bytes), Fidelity: ${resultRes.data.accuracy_metrics.fidelity_score}%`);

  // 3k. Cost Control Verification (TOKEN_LIMIT_REACHED / 402)
  console.log('\n--- TEST 5: Cost Control & Insufficient Tokens ---');
  const lowRegRes = await callApp(app, 'POST', '/api/v1/auth/register', {
    email: `dave_${Date.now()}@broke.com`,
    password: 'mypassword123',
  });
  const lowUserId = lowRegRes.data.user.id;
  const lowToken = lowRegRes.data.initialToken;

  // Drain 8 of 10 tokens so only 2 remain
  const { reservationId: drainResId } = tokenService.reserveTokens(lowUserId, 'job_drain', 'drain', 8);
  tokenService.settleReservation(drainResId, 8);
  const lowBal = tokenService.getUserBalance(lowUserId);
  console.log(`  Low-token user balance: ${lowBal.available_tokens} tokens`);

  const drainRes = await callApp(
    app,
    'POST',
    '/api/v1/reconstruction',
    { url: 'https://example.com', tokenBudget: 15 },
    { authorization: `Bearer ${lowToken}` }
  );
  if (drainRes.status !== 402) throw new Error(`Should have returned HTTP 402, got ${drainRes.status}`);
  console.log(`  ✓ Rejected with HTTP 402: ${drainRes.data.error} (${drainRes.data.message})`);

  console.log('\n======================================================');
  console.log('🎉 ALL CLIENT/SERVER ARCHITECTURE TESTS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
