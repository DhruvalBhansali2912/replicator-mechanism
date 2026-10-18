#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';
const WORKER_SCRIPT = path.join(__dirname, 'verify-target-worker.cjs');

// Parse CLI flags
const targetArg = process.argv.find(a => a.startsWith('--target='))?.split('=')[1]?.toLowerCase() || 'all';

const TARGETS = targetArg === 'all' ? ['samsung', 'apple', 'stripe'] : [targetArg];

console.log('================================================================');
console.log('   AUTOMATED MULTI-TARGET VISUAL & INTERACTIVE CROSS-CHECKER');
console.log('================================================================');
console.log(`Targets to cross-check: ${TARGETS.join(', ').toUpperCase()}`);
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log(`Artifacts Output Directory: ${ARTIFACTS_DIR}\n`);

const allResults = [];
let overallSuccess = true;

for (const target of TARGETS) {
  console.log(`>>> Running automated verification for [${target.toUpperCase()}] in isolated subprocess...`);
  const start = Date.now();
  
  const child = spawnSync('node', [WORKER_SCRIPT, `--target=${target}`], {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 50 * 1024 * 1024
  });

  const duration = Date.now() - start;

  if (child.status !== 0) {
    console.error(`[ERROR] Target [${target}] failed with exit code ${child.status}:`);
    console.error(child.stderr || child.stdout);
    overallSuccess = false;
    allResults.push({
      target: target.toUpperCase(),
      feature: 'Subprocess Execution',
      assertion: 'Target worker completes successfully',
      passed: false,
      durationMs: duration,
      error: child.stderr || child.stdout
    });
    continue;
  }

  // Parse JSON results from worker stdout
  const stdout = child.stdout;
  const jsonStart = stdout.indexOf('__JSON_START__');
  const jsonEnd = stdout.indexOf('__JSON_END__');

  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      const jsonStr = stdout.substring(jsonStart + '__JSON_START__'.length, jsonEnd).trim();
      const targetResults = JSON.parse(jsonStr);
      for (const r of targetResults) {
        allResults.push(r);
        if (!r.passed) overallSuccess = false;
      }
      console.log(`  ✓ Target [${target.toUpperCase()}] completed in ${duration}ms (${targetResults.filter(r => r.passed).length}/${targetResults.length} passed)\n`);
    } catch (e) {
      console.error(`Failed to parse results from worker stdout for ${target}:`, e);
      overallSuccess = false;
    }
  } else {
    console.error(`No JSON delimiter found in worker output for ${target}. Output:\n`, stdout);
    overallSuccess = false;
  }
}

// Generate formatted ASCII table
console.log('========================================================================================================================');
console.log('                                            AUTOMATED CROSS-CHECK REPORT');
console.log('========================================================================================================================');
console.log(
  '| ' + 'Target'.padEnd(9) +
  ' | ' + 'Feature / State'.padEnd(35) +
  ' | ' + 'Status'.padEnd(8) +
  ' | ' + 'Time'.padEnd(7) +
  ' | ' + 'Assertion Details'.padEnd(48) + ' |'
);
console.log('|' + '-'.repeat(11) + '|' + '-'.repeat(37) + '|' + '-'.repeat(10) + '|' + '-'.repeat(9) + '|' + '-'.repeat(50) + '|');

for (const r of allResults) {
  const statusStr = r.passed ? '✓ PASS' : '✗ FAIL';
  const timeStr = `${r.durationMs || 0}ms`;
  const detail = (r.details ? `${r.assertion} (${r.details})` : r.assertion).substring(0, 48);
  console.log(
    '| ' + (r.target || '').padEnd(9) +
    ' | ' + (r.feature || '').padEnd(35) +
    ' | ' + statusStr.padEnd(8) +
    ' | ' + timeStr.padEnd(7) +
    ' | ' + detail.padEnd(48) + ' |'
  );
}
console.log('========================================================================================================================\n');

// Write Markdown Artifact Report
const markdownRows = allResults.map(r => {
  const statusBadge = r.passed ? '✅ **PASS**' : '❌ **FAIL**';
  const artifactName = r.artifact ? path.basename(r.artifact) : 'N/A';
  const artifactLink = r.artifact ? `[${artifactName}](file://${r.artifact})` : 'N/A';
  return `| **${r.target}** | ${r.feature} | ${statusBadge} | ${r.durationMs}ms | ${r.assertion}${r.details ? ` *(${r.details})*` : ''} | ${artifactLink} |`;
}).join('\n');

const reportMarkdown = `# Automated Multi-Target Cross-Check Report

**Generated:** ${new Date().toISOString()}  
**Status:** ${overallSuccess ? '✅ ALL CHECKS PASSED' : '❌ CHECKS FAILED'}  
**Total Tests:** ${allResults.length} | **Passed:** ${allResults.filter(r => r.passed).length} | **Failed:** ${allResults.filter(r => !r.passed).length}

---

## Interactive Feature & State Verification Summary

| Target | Feature / State | Status | Duration | Programmatic Assertion | Proof Artifact |
| :--- | :--- | :---: | :---: | :--- | :--- |
${markdownRows}

---

## Visual Verification Artifacts Directory
All verified high-resolution PNG captures have been written to:
\`${ARTIFACTS_DIR}\`
`;

const reportPath = path.join(ARTIFACTS_DIR, 'CROSSCHECK_REPORT.md');
fs.writeFileSync(reportPath, reportMarkdown, 'utf8');
console.log(`Cross-check report markdown artifact written to: file://${reportPath}`);

const reportJsonPath = path.join(ARTIFACTS_DIR, 'CROSSCHECK_REPORT.json');
fs.writeFileSync(reportJsonPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  overallSuccess,
  totalTests: allResults.length,
  passedCount: allResults.filter(r => r.passed).length,
  failedCount: allResults.filter(r => !r.passed).length,
  results: allResults
}, null, 2), 'utf8');
console.log(`Cross-check JSON report written to: file://${reportJsonPath}\n`);

if (!overallSuccess) {
  console.error('[FAILED] One or more cross-check assertions failed.');
  process.exit(1);
} else {
  console.log('[SUCCESS] All cross-check assertions verified successfully across all targets!');
  process.exit(0);
}
