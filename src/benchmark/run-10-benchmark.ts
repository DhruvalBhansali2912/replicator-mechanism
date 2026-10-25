import { BENCHMARK_SITES, benchmarkSite } from './awwwards-suite.js';

async function runFullSuite() {
  console.log(`========================================================================`);
  console.log(`🌟 RUNNING 10-SITE AWWWARDS BENCHMARK WITH INTERACTIVE USER SIMULATION 🌟`);
  console.log(`========================================================================\n`);

  const results: any[] = [];
  let allAbove95 = true;

  for (let i = 0; i < BENCHMARK_SITES.length; i++) {
    const site = BENCHMARK_SITES[i];
    try {
      const res = await benchmarkSite(site);
      results.push(res);
      if (res.score < 95) {
        allAbove95 = false;
      }
    } catch (err: any) {
      console.error(`❌ Error on site ${site.name}:`, err.message);
      results.push({
        siteId: site.id,
        name: site.name,
        jobId: 'error',
        previewUrl: '',
        score: 0,
        error: err.message,
      });
      allAbove95 = false;
    }
  }

  console.log(`\n========================================================================`);
  console.log(`📊 BENCHMARK SUITE RESULTS`);
  console.log(`========================================================================`);
  for (const r of results) {
    const status = r.score >= 95 ? '✅ PASSED (>=95%)' : '⚠️ NEEDS TUNING (<95%)';
    console.log(`${r.name.padEnd(25)} | Score: ${r.score}% | ${status} | Preview: ${r.previewUrl}`);
  }

  const avg = results.reduce((acc, r) => acc + (r.score || 0), 0) / results.length;
  console.log(`\nOverall Average Fidelity Score: ${avg.toFixed(1)}%`);

  if (allAbove95) {
    console.log(`\n🎉 ALL 10 SITES ACHIEVED >= 95% FIDELITY!`);
    console.log(`<!-- GOAL_COMPLETE -->`);
  } else {
    console.log(`\n⚠️ Some sites scored below 95%. Continuing iteration...`);
  }
}

runFullSuite().catch(console.error);
