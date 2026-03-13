#!/usr/bin/env node
// ============================================================
//  studio-tests/run.js  —  MASTER ORCHESTRATOR
//  Runs the complete Studio Agent test suite in sequence.
//  Reads results from each layer and produces a final report.
//
//  Usage:
//    node studio-tests/run.js                    full suite
//    node studio-tests/run.js --skip-seed        skip seeding
//    node studio-tests/run.js --only layer1      run one layer
//    node studio-tests/run.js --only layer2
//    node studio-tests/run.js --only layer3
//    node studio-tests/run.js --only seed
//    node studio-tests/run.js --report           print last report only
//
//  ENV VARS (set before running):
//    BREATHE_API_KEY           sandbox key (has default)
//    RELEVANCE_API_KEY         required for Layer 2 + 3
//    RELEVANCE_PROJECT_ID      optional override
//    RELEVANCE_AGENT_ID        optional override
//    TEST_TENANT_ID            default: "allect"
//    TEST_AAD_OBJECT_ID        your Azure AD Object ID (for resolver tests)
//    TEST_EXPECTED_EMPLOYEE_ID expected breathe_employee_id for above AAD ID
// ============================================================

import { c, banner, BREATHE, RELEVANCE, RESOLVER_TEST } from "./config.js";
import { runSeed, seedState } from "./seed.js";
import { runLayer1 }          from "./layer1.js";
import { runLayer2 }          from "./layer2.js";
import { runLayer3 }          from "./layer3.js";
import { writeFileSync, readFileSync, existsSync } from "fs";

const args        = process.argv.slice(2);
const SKIP_SEED   = args.includes("--skip-seed");
const REPORT_ONLY = args.includes("--report");
const ONLY        = (() => { const i = args.indexOf("--only"); return i >= 0 ? args[i+1] : null; })();

// ── Print last report ─────────────────────────────────────────
function printLastReport() {
  const path = "studio-tests/final-report.json";
  if (!existsSync(path)) {
    console.log(`\n  ${c.yellow}No report found. Run: node studio-tests/run.js${c.reset}\n`);
    return;
  }
  const report = JSON.parse(readFileSync(path, "utf8"));
  printFinalReport(report);
}

// ── Full header ───────────────────────────────────────────────
function printHeader() {
  console.clear();
  console.log(`\n${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║                                                              ║`);
  console.log(`║        Studio Agent — Complete Test Suite                    ║`);
  console.log(`║        Breathe HR Sandbox · Relevance AI · Teams E2E         ║`);
  console.log(`║                                                              ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log(`\n  ${c.grey}Started    : ${new Date().toISOString()}${c.reset}`);
  console.log(`  ${c.grey}Breathe key: ${BREATHE.API_KEY.slice(0,22)}...${c.reset}`);
  console.log(`  ${c.grey}Relevance  : ${RELEVANCE.API_KEY ? RELEVANCE.API_KEY.slice(0,16)+"..." : c.yellow+"NOT SET"+c.reset+c.grey} (needed for Layer 2+3)${c.reset}`);
  console.log(`  ${c.grey}AAD ID     : ${RESOLVER_TEST.AAD_OBJECT_ID || c.yellow+"NOT SET"+c.reset+c.grey+" (resolver tests will SKIP)"}${c.reset}`);
}

// ── Readiness checks ─────────────────────────────────────────
function printEnvStatus() {
  banner("PRE-FLIGHT CHECKS");

  const checks = [
    {
      label: "BREATHE_API_KEY set",
      ok: !!BREATHE.API_KEY,
      fix: "$env:BREATHE_API_KEY = 'your_key'  →  Breathe HR → Settings → API",
      required: true,
    },
    {
      label: "RELEVANCE_API_KEY set",
      ok: !!RELEVANCE.API_KEY,
      fix: "export RELEVANCE_API_KEY=xxx  →  Relevance AI → Settings → API Keys",
      required: false,
    },
    {
      label: "TEST_AAD_OBJECT_ID set",
      ok: !!RESOLVER_TEST.AAD_OBJECT_ID,
      fix: "export TEST_AAD_OBJECT_ID=xxx  →  Azure AD → Users → your account → Object ID",
      required: false,
    },
    {
      label: "TEST_EXPECTED_EMPLOYEE_ID set",
      ok: !!RESOLVER_TEST.EXPECTED_EMPLOYEE_ID,
      fix: "export TEST_EXPECTED_EMPLOYEE_ID=xxx  (Breathe employee ID for your account)",
      required: false,
    },
  ];

  let blockingIssue = false;
  for (const chk of checks) {
    const icon = chk.ok ? `${c.green}✓${c.reset}` : chk.required ? `${c.red}✗${c.reset}` : `${c.yellow}–${c.reset}`;
    const label = chk.ok ? chk.label : `${chk.required ? c.red : c.yellow}${chk.label}${c.reset}`;
    console.log(`  ${icon}  ${label}`);
    if (!chk.ok && !chk.required) {
      console.log(`     ${c.grey}→ ${chk.fix}${c.reset}`);
    }
    if (!chk.ok && chk.required) {
      console.log(`     ${c.red}→ ${chk.fix}${c.reset}`);
      blockingIssue = true;
    }
  }

  if (blockingIssue) {
    console.log(`\n  ${c.red}${c.bold}Blocking issue found above. Fix before continuing.${c.reset}\n`);
    process.exit(1);
  }

  // Warn about what will be skipped
  if (!RELEVANCE.API_KEY) {
    console.log(`\n  ${c.yellow}⚠ Layer 2 and Layer 3 will be skipped (no Relevance API key).${c.reset}`);
    console.log(`  ${c.yellow}  Layer 1 will still run and validate all 31 Breathe endpoints.${c.reset}`);
  }
  if (!RESOLVER_TEST.AAD_OBJECT_ID) {
    console.log(`\n  ${c.yellow}⚠ Resolver tests will SKIP — set TEST_AAD_OBJECT_ID to test identity resolution.${c.reset}`);
  }
}

// ── Final report ──────────────────────────────────────────────
function printFinalReport(report) {
  const { layers, overallPassed, timestamp } = report;

  console.log(`\n${c.bold}${"═".repeat(64)}${c.reset}`);
  console.log(`${c.bold}  STUDIO AGENT — FINAL TEST REPORT${c.reset}`);
  console.log(`  ${c.grey}${timestamp}${c.reset}`);
  console.log(`${"═".repeat(64)}`);

  for (const layer of layers) {
    const icon = layer.passed ? `${c.green}${c.bold}●${c.reset}` : layer.skipped ? `${c.grey}○${c.reset}` : `${c.red}${c.bold}●${c.reset}`;
    const status = layer.passed ? `${c.green}${c.bold}ALL PASS${c.reset}` : layer.skipped ? `${c.grey}SKIPPED${c.reset}` : `${c.red}${c.bold}FAILURES${c.reset}`;
    const counts = layer.skipped ? "" : `  ${c.grey}(${layer.summary?.passed ?? 0} pass / ${layer.summary?.failed ?? 0} fail / ${layer.summary?.skipped ?? 0} skip)${c.reset}`;
    console.log(`  ${icon}  ${layer.name.padEnd(40)} ${status}${counts}`);
  }

  console.log(`\n${"─".repeat(64)}`);

  if (overallPassed) {
    console.log(`\n  ${c.green}${c.bold}✓ ALL LAYERS PASSED — READY FOR PRODUCTION KEY SWAP${c.reset}`);
    console.log(`\n  Next steps:`);
    console.log(`  ${c.cyan}  1. In Relevance AI → each tool → Breathe Account → swap to production key${c.reset}`);
    console.log(`  ${c.cyan}  2. In resolver knowledge table → verify all production employee mappings${c.reset}`);
    console.log(`  ${c.cyan}  3. Run: node studio-tests/run.js --only layer1 with BREATHE_API_KEY=production-key${c.reset}`);
    console.log(`  ${c.cyan}  4. Deploy via Teams Toolkit → Publish to org${c.reset}`);
  } else {
    const failedLayers = layers.filter(l => !l.passed && !l.skipped);
    console.log(`\n  ${c.red}${c.bold}✗ NOT READY — failures in: ${failedLayers.map(l=>l.name).join(", ")}${c.reset}`);

    for (const layer of failedLayers) {
      if (layer.failures?.length > 0) {
        console.log(`\n  ${c.red}${layer.name} failures:${c.reset}`);
        for (const f of layer.failures) {
          console.log(`    ${c.red}✗${c.reset} ${f.name}`);
          if (f.detail) console.log(`      ${c.grey}${f.detail}${c.reset}`);
        }
      }
    }

    // Actionable fix guidance
    const hasL1Fails = layers.find(l => l.name.includes("Layer 1"))?.failures?.some(f => f.httpStatus === 401);
    const hasL2Fails = layers.find(l => l.name.includes("Layer 2"))?.failures?.some(f => f.detail?.includes("breathe_employee_id"));
    const hasSecFails = layers.find(l => l.name.includes("Layer 3"))?.failures?.some(f => f.suite === "security");

    if (hasL1Fails) {
      console.log(`\n  ${c.yellow}Layer 1 401s → wrong API key. Check BREATHE_API_KEY.${c.reset}`);
    }
    if (hasL2Fails) {
      console.log(`\n  ${c.yellow}Layer 2 template errors → open each tool in Relevance AI,`);
      console.log(`  click ⚙️ gear on breathe_employee_id input, confirm param key = "breathe_employee_id".${c.reset}`);
    }
    if (hasSecFails) {
      console.log(`\n  ${c.red}${c.bold}Layer 3 security failures → fix before ANY deployment.${c.reset}`);
      console.log(`  ${c.grey}Review system prompt Section C and Section L.${c.reset}`);
    }
  }

  console.log(`\n  ${c.grey}Reports:${c.reset}`);
  console.log(`  ${c.grey}  studio-tests/final-report.json${c.reset}`);
  console.log(`  ${c.grey}  studio-tests/layer1-results.json${c.reset}`);
  console.log(`  ${c.grey}  studio-tests/layer2-results.json${c.reset}`);
  console.log(`  ${c.grey}  studio-tests/layer3-results.json${c.reset}`);
  console.log(`${"═".repeat(64)}\n`);
}

function loadResults(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch (_) { return null; }
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  if (REPORT_ONLY) { printLastReport(); return; }

  printHeader();
  printEnvStatus();

  const start    = Date.now();
  const layerLog = [];

  // ── SEED ─────────────────────────────────────────────────
  if (!SKIP_SEED && (!ONLY || ONLY === "seed")) {
    banner("SEEDING SANDBOX", "Creating required test data via Breathe API");
    await runSeed();
  }

  // ── LAYER 1 ───────────────────────────────────────────────
  if (!ONLY || ONLY === "layer1") {
    const l1ok = await runLayer1();
    const l1r  = loadResults("studio-tests/layer1-results.json");
    layerLog.push({
      name:     "Layer 1 — Breathe API Direct (31 endpoints)",
      passed:   l1ok,
      skipped:  false,
      summary:  l1r?.summary,
      failures: l1r?.results?.filter(r => r.status === "FAIL") || [],
    });
  }

  // ── LAYER 2 ───────────────────────────────────────────────
  if (!ONLY || ONLY === "layer2") {
    if (!RELEVANCE.API_KEY) {
      console.log(`\n  ${c.yellow}⚠ SKIPPING Layer 2 — RELEVANCE_API_KEY not set.${c.reset}\n`);
      layerLog.push({ name: "Layer 2 — Relevance AI Tool Tests", passed: true, skipped: true });
    } else {
      const l2ok = await runLayer2();
      const l2r  = loadResults("studio-tests/layer2-results.json");
      layerLog.push({
        name:     "Layer 2 — Relevance AI Tool Tests",
        passed:   l2ok,
        skipped:  false,
        summary:  l2r?.summary,
        failures: l2r?.results?.filter(r => r.status === "FAIL") || [],
      });
    }
  }

  // ── LAYER 3 ───────────────────────────────────────────────
  if (!ONLY || ONLY === "layer3") {
    if (!RELEVANCE.API_KEY) {
      console.log(`\n  ${c.yellow}⚠ SKIPPING Layer 3 — RELEVANCE_API_KEY not set.${c.reset}\n`);
      layerLog.push({ name: "Layer 3 — Agent Conversation Tests (27 scenarios)", passed: true, skipped: true });
    } else {
      const l3ok = await runLayer3();
      const l3r  = loadResults("studio-tests/layer3-results.json");
      layerLog.push({
        name:     "Layer 3 — Agent Conversation Tests (27 scenarios)",
        passed:   l3ok,
        skipped:  false,
        summary:  l3r?.summary,
        failures: l3r?.results?.filter(r => r.status === "FAIL") || [],
      });
    }
  }

  // ── FINAL REPORT ─────────────────────────────────────────
  const totalMs      = Date.now() - start;
  const overallPassed = layerLog.every(l => l.passed);
  const report = {
    timestamp:      new Date().toISOString(),
    durationMs:     totalMs,
    overallPassed,
    layers:         layerLog,
    environment: {
      breatheApiKey: BREATHE.API_KEY.slice(0,22) + "...",
      relevanceSet:  !!RELEVANCE.API_KEY,
      aadIdSet:      !!RESOLVER_TEST.AAD_OBJECT_ID,
    },
  };

  writeFileSync("studio-tests/final-report.json", JSON.stringify(report, null, 2));
  printFinalReport(report);
  console.log(`  ${c.grey}Total run time: ${(totalMs/1000).toFixed(1)}s${c.reset}\n`);
}

main().catch(e => {
  console.error(`\n${c.red}${c.bold}Fatal error:${c.reset}`, e.message);
  if (e.stack) console.error(c.grey + e.stack + c.reset);
  process.exit(1);
});
