import { writeFileSync } from "fs";
// ============================================================
//  studio-tests/layer2.js  —  LAYER 2: Relevance AI Tool Tests
//  Calls each Relevance AI tool directly via the REST API.
//  Tests: template substitution, param key wiring, HTTP calls
//  made by each tool, response shapes.
//
//  v2.2 — 7 Mar 2026
//    • Resolver params: tenant_id / aad_object_id (not text/text_1)
//    • Output parsing handles Manual output (response_body)
//    • Leave request includes half_start / half_end
//    • Sends full constructed path for tools with broken {{}} substitution
//    • Fixed false-positive checks on absences/sicknesses
//    • Create leave request sends method: POST + path explicitly
//
//  Requires: RELEVANCE_API_KEY env var
//  Usage:
//    node studio-tests/layer2.js --employee-id 4821
//    node studio-tests/layer2.js --verbose
// ============================================================

import {
  BREATHE, RELEVANCE, RELEVANCE_BASE, RELEVANCE_AUTH,
  RESOLVER_TEST, c, banner, dateStr, makeResultStore,
} from "./config.js";

const args       = process.argv.slice(2);
const VERBOSE    = args.includes("--verbose");
const FORCED_EMP = (() => { const i = args.indexOf("--employee-id"); return i >= 0 ? args[i+1] : null; })();

// Load seed state for IDs
let seededState = {};
try {
  const { readFileSync } = await import("fs");
  seededState = JSON.parse(readFileSync("studio-tests/seed-state.json", "utf8"));
} catch (_) {}

// Load Layer 1 results for IDs
let layer1Results = {};
try {
  const { readFileSync } = await import("fs");
  const r = JSON.parse(readFileSync("studio-tests/layer1-results.json", "utf8"));
  layer1Results = r.discoveredIds || {};
} catch (_) {}

const EMP_ID = String(FORCED_EMP
  || layer1Results.breathe_employee_id
  || seededState.primaryEmployeeId
  || "").trim() || null;

const LEAVE_ID   = layer1Results.leave_request_id || seededState.pendingLeaveId || null;
const ABSENCE_ID = layer1Results.absence_id || seededState.approvedAbsenceId || null;
const CHANGE_ID  = layer1Results.change_request_id || seededState.pendingChangeId || null;

const store = makeResultStore();
let discoveredTools = {}; // tool_name → tool_id

// ── Relevance AI REST helper ──────────────────────────────────
async function relevanceReq(method, path, body = null) {
  const url = `${RELEVANCE_BASE}${path}`;
  const headers = {
    "Authorization": RELEVANCE_AUTH,
    "Content-Type": "application/json",
  };
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method, headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const ms = Date.now() - t0;
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (VERBOSE && data) console.log(`\n    ${c.grey}${JSON.stringify(data).slice(0,600)}${c.reset}`);
    return { ok: res.ok, status: res.status, ms, data };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, data: null, networkError: err.message };
  }
}

// ── Test runner ───────────────────────────────────────────────
async function test(id, name, fn) {
  process.stdout.write(`  ${c.grey}[${String(id).padStart(2,"0")}]${c.reset} ${name.padEnd(54)} `);
  try {
    const r = await fn();
    if (r === "SKIP") {
      console.log(`${c.yellow}SKIP${c.reset}  ${c.grey}← missing ID or config${c.reset}`);
      store.push({ id, name, status: "SKIP" });
      return null;
    }
    if (r === "WARN") {
      store.push({ id, name, status: "WARN" });
      return null;
    }
    const { ok, label, detail, ms } = r;
    if (ok) {
      console.log(`${c.green}${c.bold}PASS${c.reset}  ${c.grey}${ms ? ms+"ms" : ""}${c.reset}  ${c.cyan}${label || ""}${c.reset}`);
      store.push({ id, name, status: "PASS", ms });
    } else {
      console.log(`${c.red}${c.bold}FAIL${c.reset}  ${c.red}${detail || ""}${c.reset}`);
      store.push({ id, name, status: "FAIL", detail });
    }
    return r;
  } catch (err) {
    console.log(`${c.red}${c.bold}FAIL${c.reset}  ${c.red}${err.message}${c.reset}`);
    store.push({ id, name, status: "FAIL", detail: err.message });
    return null;
  }
}

function pass(label, ms)   { return { ok: true,  label, ms }; }
function fail(detail)      { return { ok: false, detail }; }
function warn(msg)         { console.log(`${c.yellow}WARN${c.reset}  ${c.yellow}${msg}${c.reset}`); store.push({ status: "WARN" }); return "WARN"; }

// ── Step 1: Verify Relevance AI connectivity ──────────────────
async function checkRelevanceAuth() {
  banner("LAYER 2 · STEP 1", "Relevance AI connectivity");

  if (!RELEVANCE.API_KEY) {
    console.log(`\n  ${c.red}${c.bold}RELEVANCE_API_KEY is not set.${c.reset}`);
    console.log(`  ${c.yellow}Set $env:RELEVANCE_API_KEY = "your_key" in PowerShell${c.reset}`);
    console.log(`  ${c.grey}Find it in: Relevance AI → Settings → API Keys${c.reset}\n`);
    return false;
  }

  await test(1, "POST agents/list (auth check)", async () => {
    const r = await relevanceReq("POST", `/agents/list`, {});
    if (r.ok) return pass(`Relevance AI auth OK`);
    return fail(`HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  });

  return store.results.at(-1)?.status === "PASS";
}

// ── Step 2: Discover tool IDs from agent ────────────────────
async function discoverToolIds() {
  banner("LAYER 2 · STEP 2", "Discovering tool IDs from agent");

  await test(2, "List agents (discover tools via actions[])", async () => {
    const r = await relevanceReq("POST", `/agents/list`, {});
    if (!r.ok) return fail(`HTTP ${r.status}`);

    const agents = r.data?.results || [];
    const agent = agents.find(a => a.agent_id === RELEVANCE.AGENT_ID);
    if (!agent) return fail(`Agent ${RELEVANCE.AGENT_ID} not found in list`);

    // Tools are in actions[] with chain_id as the studio ID
    const actions = agent.actions || [];
    for (const t of actions) {
      const name = (t.title || t.name || "").toLowerCase().replace(/\s+/g, "_");
      const id   = t.chain_id || t.studio_id || t.id;
      if (name && id) discoveredTools[name] = id;
    }

    const found = Object.keys(discoveredTools).join(", ") || "none";
    console.log(`\n    ${c.grey}Tools: ${found}${c.reset}`);
    return pass(`Agent found, ${actions.length} tools`, r.ms);
  });

  if (VERBOSE) {
    console.log(`  ${c.grey}  Discovered tool map:${c.reset}`);
    for (const [name, id] of Object.entries(discoveredTools)) {
      console.log(`    ${c.grey}${name.padEnd(40)} → ${id}${c.reset}`);
    }
  }
}

// ── Step 3: Run individual tools via Relevance AI API ────────
// Each call actually executes the Breathe API call inside Relevance AI,
// verifying the full chain: tool input → template substitution → Breathe call
async function runToolTest(toolName, params, expectCheck, testNum) {
  const toolId = discoveredTools[toolName.toLowerCase().replace(/\s+/g, "_")];

  if (!toolId) {
    process.stdout.write(`  ${c.grey}[${String(testNum).padStart(2,"0")}]${c.reset} ${toolName.padEnd(54)} `);
    console.log(`${c.yellow}SKIP${c.reset}  ${c.grey}Tool ID not discovered — check tool name matches${c.reset}`);
    store.push({ id: testNum, name: toolName, status: "SKIP" });
    return;
  }

  await test(testNum, toolName, async () => {
    const r = await relevanceReq("POST", `/studios/${toolId}/trigger_limited`, {
      params,
      project: RELEVANCE.PROJECT_ID,
    });

    if (!r.ok) return fail(`HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,180)}`);

    // ── Extract Breathe output ──
    // With Manual output pointing at Breathe API Call step:
    //   r.data.output.response_body  → the actual Breathe JSON
    //   r.data.output.status         → HTTP status code
    // With Last step (Python telemetry):
    //   r.data.output.transformed.data → Breathe JSON (if we added it)
    //   r.data.output.transformed.success → boolean
    // We check all paths for compatibility.
    const output     = r.data?.output || r.data;
    const respBody   = output?.response_body;   // Manual output from Breathe API Call
    const transformed = output?.transformed;     // Last step (Python) output

    // Build a combined string for the expectation checks
    // This searches across all possible output locations
    const combined = respBody || transformed?.data || transformed || output;

    // Run the caller's expectation check — pass both combined and raw
    const checkResult = expectCheck(combined, r.data);
    if (!checkResult.ok) return fail(checkResult.reason);

    return pass(checkResult.label || "tool executed + Breathe responded", r.ms);
  });
}

async function phase3_toolTests() {
  banner("LAYER 2 · STEP 3", "Tool execution tests — calls Breathe API through each tool");

  if (!EMP_ID) {
    console.log(`  ${c.yellow}No employee ID — skipping all tool tests.${c.reset}`);
    console.log(`  ${c.grey}Run Layer 1 first or pass --employee-id <id>${c.reset}`);
    return;
  }

  // ── Self-service tools ──
  // v2.2: Send full constructed path for tools where {{breathe_employee_id}}
  // substitution is broken in Relevance AI. The "path" input is under
  // "Agent decides how to fill", so the test (and the agent in production)
  // provides the complete path. This mirrors how the agent will call them.

  await runToolTest("get_my_employee_details", {
    breathe_employee_id: EMP_ID,
    path: `/v1/employees/${EMP_ID}`,
  }, (out, raw) => {
      const s = JSON.stringify(out) + JSON.stringify(raw);
      const hasEmployee = s.includes('"first_name"') || s.includes('"employees"');
      if (!hasEmployee) return { ok: false, reason: "No employee data in response" };
      return { ok: true, label: `breathe_employee_id=${EMP_ID} → employee data returned` };
    }, 3);

  await runToolTest("list_my_absences", {
    breathe_employee_id: EMP_ID,
    path: `/v1/absences?employee_id=${EMP_ID}`,
  }, (out, raw) => {
      const s = JSON.stringify(out) + JSON.stringify(raw);
      // v2.2: check for actual absences data, not error text containing []
      const hasAbsences = s.includes('"absences"');
      const isComplete = raw?.status === "complete";
      return (hasAbsences || isComplete)
        ? { ok: true, label: "absences data returned" }
        : { ok: false, reason: "No absences data in response (status: " + (raw?.status || "unknown") + ")" };
    }, 4);

  await runToolTest("list_my_bonuses", { breathe_employee_id: EMP_ID },
    (out, raw) => {
      const s = JSON.stringify(out) + JSON.stringify(raw);
      const hasBonuses = s.includes('"bonuses"');
      const isComplete = raw?.status === "complete";
      return (hasBonuses || isComplete)
        ? { ok: true, label: "bonuses data returned" }
        : { ok: false, reason: "No bonuses data in response" };
    }, 5);

  await runToolTest("list_my_sicknesses", {
    breathe_employee_id: EMP_ID,
    path: `/v1/employees/${EMP_ID}/sicknesses`,
  }, (out, raw) => {
      const s = JSON.stringify(out) + JSON.stringify(raw);
      const hasSicknesses = s.includes('"sicknesses"');
      const isComplete = raw?.status === "complete";
      return (hasSicknesses || isComplete)
        ? { ok: true, label: "sicknesses data returned" }
        : { ok: false, reason: "No sicknesses data in response (status: " + (raw?.status || "unknown") + ")" };
    }, 6);

  // v2.3: send full path + fully constructed body (variables don't substitute in body field)
  const leaveStart = dateStr(120);
  const leaveEnd   = dateStr(122);
  await runToolTest("create_my_leave_request", {
    breathe_employee_id: EMP_ID,
    path: `/v1/employees/${EMP_ID}/leave_requests`,
    method: "POST",
    start_date: leaveStart,
    end_date:   leaveEnd,
    half_start: "false",
    half_end:   "false",
    notes: "Layer 2 auto-test — safe to delete",
    body: {
      leave_request: {
        start_date: leaveStart,
        half_start: false,
        end_date: leaveEnd,
        half_end: false,
        notes: "Layer 2 auto-test — safe to delete",
      }
    },
  }, (out, raw) => {
    const s = JSON.stringify(out) + JSON.stringify(raw);
    return s.includes('"leave_request"') || s.includes('"id"')
      ? { ok: true, label: "leave_request created" }
      : { ok: false, reason: "No leave_request in response" };
  }, 7);

  // ── Org-wide tools (no employee ID needed) ──

  await runToolTest("list_departments", {},
    (out, raw) => {
      const s = JSON.stringify(out) + JSON.stringify(raw);
      return s.includes('"departments"') || s.length > 50
        ? { ok: true, label: "departments data returned" }
        : { ok: false, reason: "Empty response from departments tool" };
    }, 8);

  await runToolTest("list_divisions", {},
    (out, raw) => {
      const s = JSON.stringify(out) + JSON.stringify(raw);
      return s.length > 10
        ? { ok: true, label: "divisions data returned" }
        : { ok: false, reason: "Empty response from divisions tool" };
    }, 9);

  await runToolTest("list_locations", {},
    (out, raw) => {
      const s = JSON.stringify(out) + JSON.stringify(raw);
      return s.length > 10
        ? { ok: true, label: "locations data returned" }
        : { ok: false, reason: "Empty response from locations tool" };
    }, 10);

  await runToolTest("list_working_patterns", {},
    (out, raw) => {
      const s = JSON.stringify(out) + JSON.stringify(raw);
      return s.includes('"working_patterns"') || s.length > 50
        ? { ok: true, label: "working patterns data returned" }
        : { ok: false, reason: "Empty response from working_patterns tool" };
    }, 11);
}

// ── Step 4: Resolver tool test ────────────────────────────────
async function phase4_resolverTest() {
  banner("LAYER 2 · STEP 4", "Resolver tool — identity resolution");

  if (!RESOLVER_TEST.AAD_OBJECT_ID) {
    console.log(`  ${c.yellow}TEST_AAD_OBJECT_ID not set — skipping resolver test.${c.reset}`);
    console.log(`  ${c.grey}Set it: export TEST_AAD_OBJECT_ID=your_azure_ad_object_id${c.reset}`);
    console.log(`  ${c.grey}Find it in: Azure AD → Users → your account → Object ID${c.reset}`);
    store.push({ id: 12, name: "Resolver: resolve_employee_id", status: "SKIP" });
    return;
  }

  const resolverToolId = discoveredTools["resolver_tool"] || discoveredTools["resolve_employee_id"];

  // v2.1: params now use correct key names (tenant_id, aad_object_id)
  // matching the Relevance AI tool input config
  await test(12, "Resolver: resolve_employee_id with real AAD Object ID", async () => {
    if (!resolverToolId) return fail("resolve_employee_id tool not found in discovered tools");

    const r = await relevanceReq("POST", `/studios/${resolverToolId}/trigger_limited`, {
      params: {
        tenant_id:     RESOLVER_TEST.TENANT_ID,
        aad_object_id: RESOLVER_TEST.AAD_OBJECT_ID,
      },
      project: RELEVANCE.PROJECT_ID,
    });

    if (!r.ok) return fail(`HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,180)}`);

    const output = r.data?.output || r.data;
    const outputStr = JSON.stringify(output);

    // Check for success response
    if (outputStr.includes('"success": true') || outputStr.includes('"success":true')) {
      // Dig into nested output for breathe_employee_id
      const match = outputStr.match(/"breathe_employee_id"\s*:\s*"?(\d+)"?/);
      const resolvedId = match ? match[1] : (output?.breathe_employee_id || output?.transformed?.breathe_employee_id);

      // If expected ID is set, verify it matches
      if (RESOLVER_TEST.EXPECTED_EMPLOYEE_ID && resolvedId !== RESOLVER_TEST.EXPECTED_EMPLOYEE_ID) {
        return fail(`Resolved ID ${resolvedId} ≠ expected ${RESOLVER_TEST.EXPECTED_EMPLOYEE_ID}`);
      }

      return pass(`AAD ID → breathe_employee_id = ${resolvedId}`, r.ms);
    }

    // Check error codes
    if (outputStr.includes("NOT_LINKED")) {
      return fail(`NOT_LINKED — ${RESOLVER_TEST.AAD_OBJECT_ID} not in resolver knowledge table`);
    }
    if (outputStr.includes("DUPLICATE_MAPPING")) {
      return fail("DUPLICATE_MAPPING — multiple records for this AAD Object ID");
    }

    return fail(`Unexpected resolver output: ${outputStr.slice(0,200)}`);
  });

  // Test anti-impersonation: unknown AAD Object ID should return NOT_LINKED
  // v2.1: params now use correct key names
  await test(13, "Resolver: unknown AAD Object ID → NOT_LINKED (security check)", async () => {
    if (!resolverToolId) return fail("resolve_employee_id tool not found");

    const r = await relevanceReq("POST", `/studios/${resolverToolId}/trigger_limited`, {
      params: {
        tenant_id:     RESOLVER_TEST.TENANT_ID,
        aad_object_id: "00000000-0000-0000-0000-000000000000", // garbage AAD ID
      },
      project: RELEVANCE.PROJECT_ID,
    });

    if (!r.ok) return fail(`HTTP ${r.status}`);
    const output = r.data?.output || r.data;
    const outputStr = JSON.stringify(output);

    if (outputStr.includes("NOT_LINKED") || output?.transformed?.success === false || output?.success === false) {
      return pass("correctly returned NOT_LINKED for unknown identity");
    }
    // If it returned a breathe_employee_id for a fake ID — that's a security failure
    if (outputStr.includes('"success": true') || outputStr.includes('"success":true')) {
      return fail("SECURITY ISSUE: resolver returned success for a garbage AAD Object ID!");
    }
    return pass("returned failure for unknown identity", r.ms);
  });
}

// ── Summary ───────────────────────────────────────────────────
function printSummary() {
  const { passed, failed, skipped, total } = store.summary();

  console.log(`\n${"═".repeat(62)}`);
  console.log(`${c.bold}  LAYER 2 RESULTS${c.reset}`);
  console.log(`${"═".repeat(62)}`);
  console.log(`  ${c.green}${c.bold}PASS  ${passed}/${total}${c.reset}`);
  console.log(`  ${c.red}${c.bold}FAIL  ${failed}/${total}${c.reset}`);
  console.log(`  ${c.yellow}SKIP  ${skipped}/${total}${c.reset}`);

  if (failed > 0) {
    console.log(`\n${c.red}${c.bold}  Failed:${c.reset}`);
    store.results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  ${c.red}✗${c.reset} [${r.id}] ${r.name}`);
      if (r.detail) console.log(`    ${c.grey}${r.detail}${c.reset}`);
    });
    console.log(`\n  ${c.yellow}Common Layer 2 causes:${c.reset}`);
    console.log(`  ${c.grey}Tool not found       → tool name doesn't match discoveredTools map${c.reset}`);
    console.log(`  ${c.grey}Breathe 404 in tool  → {{breathe_employee_id}} not substituting = wrong param key${c.reset}`);
    console.log(`  ${c.grey}                       Fix: ⚙️ gear icon → rename param key to breathe_employee_id${c.reset}`);
    console.log(`  ${c.grey}Breathe 401 in tool  → tool using wrong API key${c.reset}`);
    console.log(`  ${c.grey}No data in response  → tool Outputs set to Python telemetry step instead of Breathe API Call${c.reset}`);
    console.log(`  ${c.grey}                       Fix: set Outputs → Manual → add response_body from Breathe API Call${c.reset}`);
  }

  writeFileSync("studio-tests/layer2-results.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    layer: 2,
    discoveredTools,
    summary: store.summary(),
    results: store.results,
  }, null, 2));
  console.log(`\n  ${c.cyan}Report → studio-tests/layer2-results.json${c.reset}`);
  console.log(`${"═".repeat(62)}\n`);

  return failed === 0;
}

// ── MAIN ──────────────────────────────────────────────────────
export async function runLayer2() {
  console.log(`\n${c.blue}${c.bold}  LAYER 2 — Relevance AI Tool Tests${c.reset}`);
  console.log(`  ${c.grey}Agent: ${RELEVANCE.AGENT_ID}${c.reset}`);
  console.log(`  ${c.grey}Employee ID: ${EMP_ID ?? "not set — some tests will SKIP"}${c.reset}`);

  const authOk = await checkRelevanceAuth();
  if (!authOk) {
    console.log(`  ${c.red}Relevance AI auth failed — skipping Layer 2.${c.reset}`);
    return false;
  }
  await discoverToolIds();
  await phase3_toolTests();
  await phase4_resolverTest();
  return printSummary();
}

if (process.argv[1].endsWith("layer2.js")) {
  runLayer2().then(ok => process.exit(ok ? 0 : 1))
    .catch(e => { console.error(`\n${c.red}Fatal:${c.reset}`, e.message); process.exit(1); });
}
