import fs from "fs";
import { GroundUpSynthesisEngine } from "../src/synthesis/engine.js";

async function testTeslaSection() {
  const job = JSON.parse(fs.readFileSync("storage/jobs/job_6cddb7f19bdb4a76/job.json", "utf8"));
  const sectionHtml = job.options.sectionHtml;
  const sourceUrl = job.url;

  const engine = new GroundUpSynthesisEngine();
  const res = engine.synthesizeSection(sectionHtml, sourceUrl, "", "section");

  console.log("--- TEST RESULTS ---");
  console.log("Archetype:", res.archetype);
  console.log("Score:", res.scoring.totalScore, "Passed:", res.scoring.passed);
  console.log("Breakdown:", {
    structural: res.scoring.structuralScore,
    visual: res.scoring.visualScore,
    interactive: res.scoring.interactiveScore,
  });
  console.log("Interactive features:", res.interactiveFeatures);
  console.log("HTML snippet:\n", res.html.substring(0, 800));
}

testTeslaSection().catch(console.error);
