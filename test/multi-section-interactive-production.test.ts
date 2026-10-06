import fs from "fs";
import { GroundUpSynthesisEngine } from "../dist/synthesis/engine.js";

async function runProductionTests() {
  const engine = new GroundUpSynthesisEngine();

  const tests = [
    {
      name: "1. Apple Globalnav Navbar (SVG Logo + Clean Nav Links + Search/Bag SVGs)",
      html: JSON.parse(fs.readFileSync("storage/jobs/job_95161cb1ecd14dc8/job.json", "utf8")).options.sectionHtml,
      url: "https://www.apple.com/",
      targetArchetype: "Navbar",
      expectedScore: 90,
    },
    {
      name: "2. Tesla Full Self-Driving Card (Video + Stats + Pill Buttons)",
      html: JSON.parse(fs.readFileSync("storage/jobs/job_e184136f020648f2/job.json", "utf8")).options.sectionHtml,
      url: "https://www.tesla.com/",
      expectedScore: 90,
    },
    {
      name: "3. Tesla Model Y Showcase (Picture + Headings + Dots + Pill Buttons)",
      html: JSON.parse(fs.readFileSync("storage/jobs/job_6cddb7f19bdb4a76/job.json", "utf8")).options.sectionHtml,
      url: "https://www.tesla.com/",
      expectedScore: 90,
    },
    {
      name: "3. SaaS Pricing Section (Tiers + Prices + Monthly/Yearly)",
      html: `
        <section class="pricing-container" id="pricing">
          <h2>Simple, transparent pricing</h2>
          <p>No hidden fees. Cancel anytime.</p>
          <div class="pricing-card">
            <h3>Starter</h3>
            <div class="price">$19/mo</div>
            <ul><li>10,000 requests</li><li>Email support</li></ul>
            <a href="/signup?plan=starter" class="btn btn-primary">Start Free Trial</a>
          </div>
          <div class="pricing-card popular">
            <h3>Pro</h3>
            <div class="price">$49/mo</div>
            <ul><li>Unlimited requests</li><li>Priority 24/7 support</li><li>Custom domains</li></ul>
            <a href="/signup?plan=pro" class="btn btn-primary">Get Pro</a>
          </div>
        </section>
      `,
      url: "https://saas-example.com/pricing",
      expectedScore: 90,
    },
    {
      name: "4. FAQ Accordion Section (Details/Summary & Interactivity)",
      html: `
        <section class="faq-wrapper" id="faq">
          <h2>Frequently Asked Questions</h2>
          <p>Everything you need to know about the product.</p>
          <div class="faq-item">
            <button class="question">How does billing work?</button>
            <p class="answer">You are billed monthly with no lock-in contract.</p>
          </div>
          <div class="faq-item">
            <button class="question">Can I cancel anytime?</button>
            <p class="answer">Yes, you can cancel with one click from your dashboard.</p>
          </div>
        </section>
      `,
      url: "https://saas-example.com/faq",
      expectedScore: 90,
    },
    {
      name: "5. Feature Grid (Cards + Icons + Hover)",
      html: `
        <section class="features" id="features">
          <h2>Built for modern engineering teams</h2>
          <p>High performance primitives designed from the ground up.</p>
          <div class="feature-card">
            <div class="icon"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg></div>
            <h3>Ultra Fast</h3>
            <p>Sub-millisecond latency across global regions.</p>
          </div>
          <div class="feature-card">
            <div class="icon"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg></div>
            <h3>Deterministic</h3>
            <p>Zero hallucinations. 100% reproducible builds.</p>
          </div>
        </section>
      `,
      url: "https://saas-example.com/features",
      expectedScore: 90,
    },
    {
      name: "6. Site Navbar (Brand + Nav Links + CTA + Drawer)",
      html: `
        <header class="main-header" id="nav">
          <a href="/" class="logo">ACME Corp</a>
          <nav>
            <ul>
              <li><a href="/products">Products</a></li>
              <li><a href="/solutions">Solutions</a></li>
              <li><a href="/pricing">Pricing</a></li>
            </ul>
          </nav>
          <a href="/login" class="btn btn-secondary">Sign In</a>
          <a href="/register" class="btn btn-primary">Get Started</a>
        </header>
      `,
      url: "https://saas-example.com/",
      expectedScore: 90,
    }
  ];

  let allPassed = true;
  for (const t of tests) {
    const res = engine.synthesizeSection(t.html, t.url, "", "section", t.targetArchetype);
    const passed = res.scoring.totalScore >= t.expectedScore;
    if (!passed) allPassed = false;
    console.log(`  ✓ ${t.name} -> Score: ${res.scoring.totalScore}/100 (Threshold >= ${t.expectedScore})`);
  }

  if (!allPassed) throw new Error("Some tests failed");
  console.log("All production tests successfully verified.");
}

runProductionTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
