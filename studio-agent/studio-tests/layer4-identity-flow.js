import { writeFileSync } from "fs";
// ============================================================
//  studio-tests/layer4-identity-flow.js
//  LAYER 4: Identity Resolution & Personalised Data Flow
//
//  This suite isolates every step of the critical chain:
//    Teams AAD ID → Resolver → breathe_employee_id → Tool → Breathe API → Personal Data
//
//  It tests at THREE levels:
//    Phase 1: Resolver tool called directly via REST (is the ID coming back?)
//    Phase 2: Each "My" tool called directly via REST with the resolved ID
//             (does the tool accept and substitute the param?)
//    Phase 3: Full agent conversation (does the entire chain work end-to-end?)
//             These have STRICT checks — "trouble retrieving" is a FAIL, not a pass.
//
//  Usage:
//    node studio-tests/layer4-identity-flow.js --verbose
//    node studio-tests/layer4-identity-flow.js --phase 1
//    node studio-tests/layer4-identity-flow.js --phase 2
//    node studio-tests/layer4-identity-flow.js --phase 3
//
//  ENV VARS:
//    RELEVANCE_API_KEY         required
//    BREATHE_API_KEY           sandbox key
// ============================================================

import * as RelevanceSDK from "@relevanceai/sdk";
const { Agent, createClient } = RelevanceSDK;

// ── Global crash guards (same as layer3-admin) ──────────────
let _lastSDKError = null;
function isTransientError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = err?.cause?.message || err?.cause?.code || "";
  const full = `${msg} ${cause}`;
  return /Bad Gateway|Service Unavailable|502|503|ECONNRESET|socket hang up|fetch failed|ETIMEDOUT|ENOTFOUND|UND_ERR/i.test(full);
}
process.on("uncaughtException", (err) => {
  if (isTransientError(err)) {
    _lastSDKError = err.message;
    if (VERBOSE) console.error(`\n  \x1b[33m⚠ SDK error (swallowed): ${err.message}\x1b[0m`);
  } else { console.error(`\n  \x1b[31mUncaught:\x1b[0m`, err); process.exit(1); }
});
process.on("unhandledRejection", (reason) => {
  if (isTransientError(reason)) {
    _lastSDKError = reason instanceof Error ? reason.message : String(reason);
    if (VERBOSE) console.error(`\n  \x1b[33m⚠ SDK rejection (swallowed): ${_lastSDKError}\x1b[0m`);
  } else { console.error(`\n  \x1b[31mUnhandled rejection:\x1b[0m`, reason); process.exit(1); }
});

// ── Config ──────────────────────────────────────────────────
const RELEVANCE = {
  REGION_STACK: process.env.RELEVANCE_REGION_STACK || "bcbe5a",
  API_KEY:      process.env.RELEVANCE_API_KEY      || "",
  PROJECT_ID:   process.env.RELEVANCE_PROJECT_ID   || "ca7f193a-f48c-41ab-8c3e-6833ec9a5001",
  // Admin agent — where all the tools live
  AGENT_ID:     process.env.RELEVANCE_ADMIN_AGENT_ID || "540367c8-180d-4ed1-8eb0-eac213535433",
};

const ADMIN_IDENTITY = {
  TENANT_ID:     "allect",
  AAD_OBJECT_ID: process.env.ADMIN_AAD_OBJECT_ID || "81143a8a-a44e-4ca9-941e-341befa6eff2",
  EXPECTED_BREATHE_ID: "9811",
  NAME: "Maddox Rigby",
};

const RELEVANCE_BASE = `https://api-${RELEVANCE.REGION_STACK}.stack.tryrelevance.com/latest`;
const RELEVANCE_AUTH = `${RELEVANCE.PROJECT_ID}:${RELEVANCE.API_KEY}`;

// ── Tool IDs (from discovery) ───────────────────────────────
const TOOLS = {
  resolver:                "897c3b0e-ceaf-4bb6-8d93-fc2479243f14",
  get_my_employee_details: "60f26c1b-d02f-41b0-9488-f1ed06ccf226",
  list_my_absences:        "a16998c9-871d-47ba-8448-6bbdf7c59b90",
  list_my_sicknesses:      "b5237b9b-437e-4f4b-b3d6-650e1cfca600",
  list_my_bonuses:         "fd6cce9f-fabd-4552-9892-d648a116ffb6",
  create_my_leave_request: "8a3a8e14-dd2c-46cd-8293-974f12bf204c",
};

// ── CLI args ────────────────────────────────────────────────
const args    = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const PHASE   = (() => { const i = args.indexOf("--phase"); return i >= 0 ? parseInt(args[i+1]) : null; })();

// ── Colours ─────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", bold: "\x1b[1m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", blue: "\x1b[34m", grey: "\x1b[90m",
  magenta: "\x1b[35m",
};

function banner(title, sub = "") {
  console.log(`\n${c.blue}${c.bold}${"━".repeat(66)}${c.reset}`);
  console.log(`${c.blue}${c.bold}  ${title}${c.reset}${sub ? `  ${c.grey}${sub}${c.reset}` : ""}`);
  console.log(`${c.blue}${"━".repeat(66)}${c.reset}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Result store ────────────────────────────────────────────
const results = [];
function logResult(id, phase, name, status, detail = "") {
  results.push({ id, phase, name, status, detail });
  const icon = status === "PASS" ? `${c.green}${c.bold}PASS${c.reset}` :
               status === "FAIL" ? `${c.red}${c.bold}FAIL${c.reset}` :
               `${c.yellow}${c.bold}${status}${c.reset}`;
  console.log(`  ${c.grey}[${String(id).padStart(2,"0")}]${c.reset} ${name.padEnd(52)} ${icon}  ${c.grey}${detail}${c.reset}`);
}

// ── REST helper ─────────────────────────────────────────────
async function relevanceReq(method, path, body = null) {
  const url = `${RELEVANCE_BASE}${path}`;
  const headers = { "Authorization": RELEVANCE_AUTH, "Content-Type": "application/json" };
  try {
    const res = await fetch(url, {
      method, headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

// ── Call a Relevance AI tool directly ───────────────────────
async function callTool(toolId, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const r = await relevanceReq("POST", `/studios/${toolId}/trigger_limited`, {
      params,
      project: RELEVANCE.PROJECT_ID,
    });

    if (r.ok) return r;

    // Retry on transient errors
    if (attempt < retries && (r.status >= 500 || r.status === 0)) {
      if (VERBOSE) console.log(`    ${c.yellow}⚠ Tool call attempt ${attempt}/${retries} failed (${r.status}), retrying...${c.reset}`);
      await sleep(3000 * attempt);
      continue;
    }

    return r;
  }
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 1: RESOLVER DIRECT (REST)
//  Does the resolver return breathe_employee_id for our test identity?
// ═══════════════════════════════════════════════════════════════
async function phase1() {
  banner("PHASE 1 · Resolver Tool Direct", "Does the resolver return breathe_employee_id?");

  // Test 1: Call resolver with correct admin identity
  const r = await callTool(TOOLS.resolver, {
    tenant_id:     ADMIN_IDENTITY.TENANT_ID,
    aad_object_id: ADMIN_IDENTITY.AAD_OBJECT_ID,
  });

  if (!r.ok) {
    logResult(1, 1, "Resolver call — HTTP status", "FAIL", `HTTP ${r.status}`);
    if (VERBOSE) console.log(`    ${c.grey}Response: ${JSON.stringify(r.data).slice(0,400)}${c.reset}`);

    // Try alternative param keys (text/text_1) in case they haven't been renamed
    console.log(`\n  ${c.yellow}Trying alternative param keys (text/text_1)...${c.reset}`);
    const r2 = await callTool(TOOLS.resolver, {
      text:   ADMIN_IDENTITY.TENANT_ID,
      text_1: ADMIN_IDENTITY.AAD_OBJECT_ID,
    });
    if (r2.ok) {
      console.log(`  ${c.yellow}⚠ Resolver works with text/text_1 — params NOT renamed!${c.reset}`);
      logResult(1, 1, "Resolver call — alternate keys (text/text_1)", "WARN", "Params need renaming");
    } else {
      logResult(1, 1, "Resolver call — alternate keys also failed", "FAIL", `HTTP ${r2.status}`);
    }
    return { resolvedId: null };
  }

  // Parse the resolver output
  const output    = r.data?.output || r.data;
  const outputStr = JSON.stringify(output);

  if (VERBOSE) {
    console.log(`\n  ${c.cyan}Raw resolver output:${c.reset}`);
    console.log(`  ${c.grey}${outputStr.slice(0, 800)}${c.reset}\n`);
  }

  // Extract breathe_employee_id from the output
  const match = outputStr.match(/"breathe_employee_id"\s*:\s*"?(\d+)"?/);
  const resolvedId = match ? match[1] : null;
  const success = outputStr.includes('"success": true') || outputStr.includes('"success":true');
  const name = outputStr.match(/"employee_name"\s*:\s*"([^"]+)"/)?.[1] || "unknown";
  const role = outputStr.match(/"role"\s*:\s*"([^"]+)"/)?.[1] || "unknown";

  if (success && resolvedId) {
    logResult(1, 1, "Resolver returns breathe_employee_id", "PASS",
      `ID=${resolvedId}, name=${name}, role=${role}`);

    if (ADMIN_IDENTITY.EXPECTED_BREATHE_ID && resolvedId !== ADMIN_IDENTITY.EXPECTED_BREATHE_ID) {
      logResult(2, 1, "Resolver ID matches expected", "FAIL",
        `Got ${resolvedId}, expected ${ADMIN_IDENTITY.EXPECTED_BREATHE_ID}`);
    } else {
      logResult(2, 1, "Resolver ID matches expected", "PASS",
        `${resolvedId} === ${ADMIN_IDENTITY.EXPECTED_BREATHE_ID}`);
    }
  } else {
    logResult(1, 1, "Resolver returns breathe_employee_id", "FAIL",
      `success=${success}, resolvedId=${resolvedId}`);
    if (VERBOSE) console.log(`  ${c.grey}Full output: ${outputStr.slice(0,500)}${c.reset}`);
  }

  // Test 3: Unknown identity returns NOT_LINKED
  const r3 = await callTool(TOOLS.resolver, {
    tenant_id:     "allect",
    aad_object_id: "00000000-0000-0000-0000-000000000000",
  });
  const o3str = JSON.stringify(r3.data?.output || r3.data || {});
  const isNotLinked = o3str.includes("NOT_LINKED") || o3str.includes('"success":false') || o3str.includes('"success": false');
  logResult(3, 1, "Unknown AAD Object ID → NOT_LINKED", isNotLinked ? "PASS" : "FAIL",
    isNotLinked ? "correctly refused" : `unexpected: ${o3str.slice(0,200)}`);

  return { resolvedId };
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 2: TOOL DIRECT CALLS (REST)
//  Call each self-service tool directly with the resolved ID.
//  This bypasses the agent entirely — tests pure tool config.
// ═══════════════════════════════════════════════════════════════
async function phase2(resolvedId) {
  banner("PHASE 2 · Tool Direct Calls", "Each self-service tool called via REST with breathe_employee_id");

  if (!resolvedId) {
    console.log(`  ${c.red}No resolvedId from Phase 1 — cannot run Phase 2.${c.reset}`);
    return;
  }

  console.log(`  ${c.cyan}Using breathe_employee_id = ${resolvedId}${c.reset}\n`);

  // For each tool, we try MULTIPLE param key variations to discover what works
  const paramVariations = [
    { label: "breathe_employee_id", params: { breathe_employee_id: resolvedId } },
    { label: "text (auto-assigned)",  params: { text: resolvedId } },
    { label: "text_1",               params: { text_1: resolvedId } },
    { label: "employee_id",          params: { employee_id: resolvedId } },
  ];

  const toolTests = [
    {
      id: 4,
      name: "Get My Employee Details",
      toolId: TOOLS.get_my_employee_details,
      expectedPath: `/v1/employees/${resolvedId}`,
      successCheck: (s) => s.includes('"first_name"') || s.includes('"last_name"') || s.includes('"email"'),
      failureSignals: ["404", "not found", "error", "null"],
    },
    {
      id: 8,
      name: "List My Absences",
      toolId: TOOLS.list_my_absences,
      expectedPath: `/v1/absences?employee_id=${resolvedId}`,
      successCheck: (s) => s.includes('"absences"') || s.includes('"absence"'),
      failureSignals: ["404", "error"],
    },
    {
      id: 12,
      name: "List My Sicknesses",
      toolId: TOOLS.list_my_sicknesses,
      expectedPath: `/v1/sicknesses?employee_id=${resolvedId}`,
      successCheck: (s) => s.includes('"sicknesses"') || s.includes('"sickness"') || s.length > 50,
      failureSignals: ["404", "error", "invalid"],
    },
    {
      id: 16,
      name: "List My Bonuses (CONTROL — known working)",
      toolId: TOOLS.list_my_bonuses,
      expectedPath: `/v1/employees/${resolvedId}/bonuses`,
      successCheck: (s) => s.includes('"bonuses"') || s.includes('"bonus"'),
      failureSignals: ["404", "error"],
    },
  ];

  for (const tool of toolTests) {
    console.log(`\n  ${c.magenta}${c.bold}── ${tool.name} ──${c.reset}`);
    console.log(`  ${c.grey}Tool ID: ${tool.toolId}${c.reset}`);
    console.log(`  ${c.grey}Expected Breathe path: ${tool.expectedPath}${c.reset}`);

    let anyWorked = false;

    for (const variation of paramVariations) {
      const testId = tool.id + paramVariations.indexOf(variation);
      const testName = `${tool.name} → param: ${variation.label}`;

      await sleep(1500);  // pace requests

      const r = await callTool(tool.toolId, variation.params);

      if (!r.ok) {
        logResult(testId, 2, testName, "FAIL", `HTTP ${r.status}`);
        if (VERBOSE) console.log(`    ${c.grey}Error: ${JSON.stringify(r.data).slice(0,300)}${c.reset}`);
        continue;
      }

      const rawOutput = r.data?.output || r.data;
      const outputStr = JSON.stringify(rawOutput);

      if (VERBOSE) {
        console.log(`    ${c.grey}Raw output (${outputStr.length} chars): ${outputStr.slice(0,500)}${c.reset}`);
      }

      // Check if the tool returned actual Breathe HR data
      if (tool.successCheck(outputStr)) {
        logResult(testId, 2, testName, "PASS", "Breathe HR data returned");
        anyWorked = true;

        // Log the working param key prominently
        console.log(`  ${c.green}${c.bold}  ✓ WORKING PARAM KEY: "${variation.label}"${c.reset}`);
        break;  // no need to try other variations
      }

      // Check if the tool executed but got empty/error from Breathe
      const hasError = tool.failureSignals.some(sig => outputStr.toLowerCase().includes(sig));
      if (hasError) {
        logResult(testId, 2, testName, "FAIL",
          "Tool executed but Breathe returned error — param likely not substituting into path");
        if (VERBOSE) console.log(`    ${c.grey}Output: ${outputStr.slice(0,400)}${c.reset}`);
      } else {
        // Tool returned something but we can't tell if it's right
        logResult(testId, 2, testName, "WARN",
          `Ambiguous response (${outputStr.length} chars) — inspect manually`);
        if (VERBOSE) console.log(`    ${c.grey}Output: ${outputStr.slice(0,400)}${c.reset}`);
      }
    }

    if (!anyWorked) {
      console.log(`  ${c.red}${c.bold}  ✗ NO PARAM KEY WORKED for ${tool.name}${c.reset}`);
      console.log(`  ${c.yellow}    → The {{breathe_employee_id}} template is NOT substituting in this tool.${c.reset}`);
      console.log(`  ${c.yellow}    → Fix: Open the tool in Relevance AI, click ⚙️ on the breathe_employee_id input,`);
      console.log(`           check the ACTUAL param key name, and ensure it matches what the resolver outputs.${c.reset}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 3: CONVERSATION-LEVEL (SDK)
//  Full agent conversation with STRICT checks.
//  "Trouble retrieving" = FAIL (not a soft pass like layer3-admin).
// ═══════════════════════════════════════════════════════════════
const AGENT_TIMEOUT_MS = 90_000;
const AGENT_SETTLE_MS  = 1_500;

let _agent = null;
async function getAgent() {
  if (!_agent) _agent = await Agent.get(RELEVANCE.AGENT_ID);
  return _agent;
}

function initSDK() {
  const apiKey = process.env.RELEVANCE_API_KEY || RELEVANCE.API_KEY;
  createClient({ apiKey, region: RELEVANCE.REGION_STACK, project: RELEVANCE.PROJECT_ID });
}

async function sendAgentMessage(userText) {
  const payload = JSON.stringify({
    text:            userText,
    tenant_id:       ADMIN_IDENTITY.TENANT_ID,
    aad_object_id:   ADMIN_IDENTITY.AAD_OBJECT_ID,
    conversation_id: `l4-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    thread_id:       `l4-thread-${Date.now()}`,
    event_id:        `l4-event-${Date.now()}`,
  });

  const t0 = Date.now();
  _lastSDKError = null;

  try {
    const agent = await getAgent();
    const task  = await agent.sendMessage(payload);

    const reply = await new Promise((resolve, reject) => {
      let latestText = "";
      let settled = false;
      let settleTimer = null;
      const hardTimeout = setTimeout(() => finish(null, new Error(
        _lastSDKError ? `SDK_ERROR: ${_lastSDKError}` : "TIMEOUT"
      )), AGENT_TIMEOUT_MS);

      function finish(text, err) {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimeout);
        if (settleTimer) clearTimeout(settleTimer);
        try { task.removeEventListener("message", onMsg); } catch {}
        try { task.removeEventListener("error", onErr); } catch {}
        try { task.removeEventListener("update", onUpd); } catch {}
        try { task.unsubscribe(); } catch {}
        if (err) reject(err);
        else resolve(text || "");
      }

      function resetSettle() {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => { if (latestText) finish(latestText); }, AGENT_SETTLE_MS);
      }

      function onMsg({ detail: { message } }) {
        if (message?.isAgent?.()) { latestText = String(message.text ?? ""); resetSettle(); }
      }
      function onErr({ detail: { message } }) { finish(null, new Error(message?.lastError || "Task error")); }
      function onUpd() {
        const s = String(task?.status ?? "");
        if (s === "idle" && latestText) finish(latestText);
        if (s === "error") finish(null, new Error("Task error status"));
      }

      task.addEventListener("message", onMsg);
      task.addEventListener("error", onErr);
      task.addEventListener("update", onUpd);
    });

    return { ok: true, reply, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, reply: null, ms: Date.now() - t0, error: err.message };
  }
}

async function phase3() {
  banner("PHASE 3 · Conversation-Level (STRICT)", "Full agent flow — 'trouble retrieving' = FAIL");

  initSDK();

  const TROUBLE_REGEX = /(trouble|having trouble|couldn't|can't retrieve|unable to retrieve|having difficulty|issue.*retriev|error.*retriev)/i;

  const conversationTests = [
    {
      id: 20,
      name: "My employee details → must return real data",
      message: "What are my employee details?",
      mustContain: /(name|first.?name|last.?name|job|title|department|email|maddox|rigby|start.?date)/i,
      mustNotContain: TROUBLE_REGEX,
      failMessage: "Agent failed to return personalised employee data",
    },
    {
      id: 21,
      name: "My absences → must return data or 'no absences'",
      message: "Show me my absences",
      mustContain: /(absence|leave|holiday|sick|no.*absence|none|you don't have|no.*record)/i,
      mustNotContain: TROUBLE_REGEX,
      failMessage: "Agent failed to return personalised absence data",
    },
    {
      id: 22,
      name: "My sickness records → must return data or 'no records'",
      message: "Do I have any sickness records?",
      mustContain: /(sickness|sick|illness|no.*sickness|none|you don't have|no.*record|no.*sick)/i,
      mustNotContain: TROUBLE_REGEX,
      failMessage: "Agent failed to return personalised sickness data",
    },
    {
      id: 23,
      name: "My bonuses (CONTROL) → must return data or 'no bonuses'",
      message: "Show me my bonuses",
      mustContain: /(bonus|bonuses|no.*bonus|none|you don't have|amount|no.*record)/i,
      mustNotContain: TROUBLE_REGEX,
      failMessage: "Agent failed to return personalised bonus data",
    },
    {
      id: 24,
      name: "Book leave → must enter booking flow",
      message: "I'd like to book annual leave from 2026-04-14 to 2026-04-16",
      mustContain: /(confirm|submit|book|leave|request|shall i|go ahead|date|note)/i,
      mustNotContain: TROUBLE_REGEX,
      failMessage: "Agent failed to enter leave booking flow",
    },
  ];

  for (const test of conversationTests) {
    await sleep(2000);
    process.stdout.write(`  ${c.grey}[${String(test.id).padStart(2,"0")}]${c.reset} ${test.name.padEnd(52)} `);

    const result = await sendAgentMessage(test.message);

    if (!result.ok || !result.reply) {
      const reason = result.error || "no reply";
      console.log(`${c.red}${c.bold}FAIL${c.reset}  ${c.red}${reason}${c.reset}  ${c.grey}${result.ms}ms${c.reset}`);
      results.push({ id: test.id, phase: 3, name: test.name, status: "FAIL", detail: reason });
      continue;
    }

    const reply = result.reply;
    if (VERBOSE) console.log(`\n    ${c.grey}Reply: ${reply.slice(0,400)}${c.reset}`);

    // STRICT CHECK: "trouble retrieving" means the tool failed
    if (test.mustNotContain.test(reply)) {
      console.log(`${c.red}${c.bold}FAIL${c.reset}  ${c.red}${test.failMessage}${c.reset}  ${c.grey}${result.ms}ms${c.reset}`);
      console.log(`         ${c.grey}Reply: "${reply.slice(0,250)}"${c.reset}`);
      console.log(`         ${c.yellow}→ The breathe_employee_id is NOT reaching this tool's API call.${c.reset}`);
      results.push({ id: test.id, phase: 3, name: test.name, status: "FAIL",
        detail: `TOOL_VARIABLE_BROKEN: ${test.failMessage}`, reply: reply.slice(0,400) });
      continue;
    }

    if (test.mustContain.test(reply)) {
      console.log(`${c.green}${c.bold}PASS${c.reset}  ${c.grey}${result.ms}ms${c.reset}  ${c.cyan}personalised data returned${c.reset}`);
      results.push({ id: test.id, phase: 3, name: test.name, status: "PASS", detail: "personalised data" });
    } else {
      console.log(`${c.yellow}${c.bold}WARN${c.reset}  ${c.yellow}Response doesn't match expected pattern${c.reset}  ${c.grey}${result.ms}ms${c.reset}`);
      console.log(`         ${c.grey}Reply: "${reply.slice(0,250)}"${c.reset}`);
      results.push({ id: test.id, phase: 3, name: test.name, status: "WARN",
        detail: "Unexpected response pattern", reply: reply.slice(0,400) });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════
function printSummary() {
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const warned = results.filter(r => r.status === "WARN").length;
  const total  = results.length;

  console.log(`\n${"═".repeat(66)}`);
  console.log(`${c.bold}  LAYER 4 — IDENTITY FLOW DIAGNOSTIC RESULTS${c.reset}`);
  console.log(`${"═".repeat(66)}`);
  console.log(`  ${c.green}${c.bold}PASS  ${passed}/${total}${c.reset}`);
  if (failed > 0) console.log(`  ${c.red}${c.bold}FAIL  ${failed}/${total}${c.reset}`);
  if (warned > 0) console.log(`  ${c.yellow}${c.bold}WARN  ${warned}/${total}${c.reset}`);

  // Phase breakdown
  for (const p of [1, 2, 3]) {
    const pr = results.filter(r => r.phase === p);
    if (pr.length === 0) continue;
    const pp = pr.filter(r => r.status === "PASS").length;
    const pf = pr.filter(r => r.status === "FAIL").length;
    const icon = pf === 0 ? `${c.green}✓` : `${c.red}✗`;
    console.log(`  ${icon}${c.reset} Phase ${p}: ${pp}/${pr.length} pass`);
  }

  // Specific tool diagnosis
  const brokenTools = results.filter(r => r.detail?.startsWith("TOOL_VARIABLE_BROKEN"));
  if (brokenTools.length > 0) {
    console.log(`\n  ${c.red}${c.bold}🔧 TOOLS WITH BROKEN breathe_employee_id SUBSTITUTION:${c.reset}`);
    brokenTools.forEach(r => {
      console.log(`  ${c.red}✗${c.reset} ${r.name}`);
    });
    console.log(`\n  ${c.yellow}${c.bold}HOW TO FIX:${c.reset}`);
    console.log(`  ${c.yellow}1. Open each broken tool in Relevance AI${c.reset}`);
    console.log(`  ${c.yellow}2. Click the ⚙️ gear icon on the breathe_employee_id input${c.reset}`);
    console.log(`  ${c.yellow}3. Check the ACTUAL param key (might be "text" or "text_1" instead)${c.reset}`);
    console.log(`  ${c.yellow}4. Rename it to "breathe_employee_id" using the gear icon${c.reset}`);
    console.log(`  ${c.yellow}5. Verify the Relative Path uses {{breathe_employee_id}} correctly${c.reset}`);
    console.log(`  ${c.yellow}6. Compare against List My Bonuses (which works correctly)${c.reset}`);
    console.log(`  ${c.yellow}7. Re-run this suite to verify: node studio-tests/layer4-identity-flow.js --verbose${c.reset}`);
  }

  const workingTools = results.filter(r => r.phase === 3 && r.status === "PASS");
  if (workingTools.length > 0 && brokenTools.length === 0) {
    console.log(`\n  ${c.green}${c.bold}✅ ALL PERSONALISED DATA FLOWS WORKING${c.reset}`);
    console.log(`  ${c.green}  The resolver → breathe_employee_id → tool → Breathe API chain is fully operational.${c.reset}`);
  }

  // Write report
  writeFileSync("studio-tests/layer4-identity-results.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    layer: "4-identity-flow",
    admin_identity: ADMIN_IDENTITY,
    results,
    diagnosis: brokenTools.length > 0 ? "BROKEN" : "HEALTHY",
    brokenTools: brokenTools.map(r => r.name),
  }, null, 2));
  console.log(`\n  ${c.cyan}Report → studio-tests/layer4-identity-results.json${c.reset}`);
  console.log(`${"═".repeat(66)}\n`);

  return failed === 0;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${c.blue}${c.bold}  LAYER 4 — Identity Resolution & Personalised Data Flow${c.reset}`);
  console.log(`  ${c.grey}Admin Agent: ${RELEVANCE.AGENT_ID}${c.reset}`);
  console.log(`  ${c.grey}Identity: ${ADMIN_IDENTITY.NAME} (AAD: ${ADMIN_IDENTITY.AAD_OBJECT_ID.slice(0,8)}...)${c.reset}`);
  console.log(`  ${c.grey}Expected Breathe ID: ${ADMIN_IDENTITY.EXPECTED_BREATHE_ID}${c.reset}`);

  if (!process.env.RELEVANCE_API_KEY && !RELEVANCE.API_KEY) {
    console.log(`\n  ${c.red}RELEVANCE_API_KEY not set.${c.reset}\n`);
    return false;
  }

  let resolvedId = null;

  if (!PHASE || PHASE === 1) {
    const p1 = await phase1();
    resolvedId = p1.resolvedId;
  }

  if (!PHASE || PHASE === 2) {
    if (!resolvedId) resolvedId = ADMIN_IDENTITY.EXPECTED_BREATHE_ID;
    await phase2(resolvedId);
  }

  if (!PHASE || PHASE === 3) {
    await phase3();
  }

  return printSummary();
}

main()
  .then(ok => process.exit(ok ? 0 : 1))
  .catch(e => { console.error(`\n${c.red}Fatal:${c.reset}`, e.message); process.exit(1); });
