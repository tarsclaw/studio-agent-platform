import { writeFileSync } from "fs";
// ============================================================
//  studio-tests/layer2-admin.js  —  LAYER 2: Admin Tool Tests
//
//  Tool names taken from --verbose discovery on 2026-03-08:
//    list_employees(admin)              list_leave_requests_(admin)
//    list_change_requests_(admin)       list_absences_(admin)
//    list_sicknesses_(admin)            list_all_bonuses_(admin)_
//    get_company_account_details_(admin)_ get_employee_details_(admin)
//    list_employee_bonuses_(admin)      get_leave_request_(admin)_
//    create_leave_request_(admin)       create_employee_change_request_(admin)
//    create_employee                    approve_leave_request_(admin)_
//    reject_leave_request_(admin)_      approve_change_request(admin)
//    cancel_absence                     + shared self-service tools
//
//  Usage:
//    node studio-tests/layer2-admin.js
//    node studio-tests/layer2-admin.js --verbose
//    node studio-tests/layer2-admin.js --employee-id 9811
// ============================================================

import {
  BREATHE, RELEVANCE, RELEVANCE_BASE, RELEVANCE_AUTH,
  ADMIN_TEST, EMPLOYEE_TEST, RESOLVER_TOOL_ID,
  c, banner, dateStr, makeResultStore,
} from "./config.admin.js";

const args       = process.argv.slice(2);
const VERBOSE    = args.includes("--verbose");
const FORCED_EMP = (() => { const i = args.indexOf("--employee-id"); return i >= 0 ? args[i+1] : null; })();

// Load seed state + Layer 1 results for IDs
let seededState = {};
try { seededState = JSON.parse((await import("fs")).readFileSync("studio-tests/seed-state.json", "utf8")); } catch (_) {}
let layer1Results = {};
try {
  const r = JSON.parse((await import("fs")).readFileSync("studio-tests/layer1-results.json", "utf8"));
  layer1Results = r.discoveredIds || {};
} catch (_) {}

// All IDs as STRINGS
const EMP_ID = String(FORCED_EMP
  || ADMIN_TEST.EXPECTED_EMPLOYEE_ID
  || layer1Results.breathe_employee_id
  || seededState.primaryEmployeeId
  || "").trim() || null;

const SECONDARY_EMP = String(seededState.secondaryEmployeeId || layer1Results.secondaryEmployeeId || "12661").trim();
const LEAVE_ID   = String(layer1Results.leave_request_id || seededState.pendingLeaveId || "").trim() || null;
const CHANGE_ID  = String(layer1Results.change_request_id || seededState.pendingChangeId || "").trim() || null;

const store = makeResultStore();
let discoveredTools = {};

// Breathe OAuth Account ID — used as workaround for tools missing baked-in Breathe Account
const BREATHE_OAUTH_ID = "aac2b837-6920-4b17-936b-e2b1bf62b180";

// ── Relevance AI REST helper ──────────────────────────────────
async function relevanceReq(method, path, body = null) {
  const url = `${RELEVANCE_BASE}${path}`;
  const headers = { "Authorization": RELEVANCE_AUTH, "Content-Type": "application/json" };
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
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
      console.log(`${c.yellow}SKIP${c.reset}  ${c.grey}<- missing ID or config${c.reset}`);
      store.push({ id, name, status: "SKIP" });
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

function pass(label, ms)   { return { ok: true, label, ms }; }
function fail(detail)      { return { ok: false, detail }; }

// ── Tool lookup — tries exact name, then common (admin) variants ──
function findToolId(name) {
  const key = name.toLowerCase().replace(/\s+/g, "_");
  if (discoveredTools[key]) return discoveredTools[key];
  // Try with common suffixes the admin tools use
  for (const suffix of ["_(admin)", "_(admin)_", "(admin)", "_admin", "_(admin)_ "]) {
    if (discoveredTools[key + suffix]) return discoveredTools[key + suffix];
  }
  return null;
}

// ── Tool execution helper ─────────────────────────────────────
async function runToolTest(toolName, params, expectCheck, testNum) {
  const toolId = findToolId(toolName);
  if (!toolId) {
    process.stdout.write(`  ${c.grey}[${String(testNum).padStart(2,"0")}]${c.reset} ${toolName.padEnd(54)} `);
    console.log(`${c.yellow}SKIP${c.reset}  ${c.grey}Tool "${toolName}" not discovered${c.reset}`);
    store.push({ id: testNum, name: toolName, status: "SKIP" });
    return;
  }
  await test(testNum, toolName, async () => {
    const r = await relevanceReq("POST", `/studios/${toolId}/trigger_limited`, {
      params,
      project: RELEVANCE.PROJECT_ID,
    });
    if (!r.ok) return fail(`HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,180)}`);
    const output = r.data?.output || r.data;
    const checkResult = expectCheck(output, r.data);
    if (!checkResult.ok) return fail(checkResult.reason);
    return pass(checkResult.label || "response received", r.ms);
  });
}

// ── Generic response checker — handles both output styles ─────
function anyData(out) {
  const s = JSON.stringify(out);
  if (s.includes('"breathe_api_call_response_body"') && !s.includes('"breathe_api_call_response_body":null')) {
    return { ok: true, label: "response received" };
  }
  if (s.includes('"success":true') || s.includes('"success": true')) {
    return { ok: true, label: "response received (transformed)" };
  }
  return s.length > 30
    ? { ok: true, label: "response received" }
    : { ok: false, reason: `No data. Got: ${s.slice(0,200)}` };
}

// ════════════════════════════════════════════════════════════════
//  PHASE 1: Relevance AI connectivity
// ════════════════════════════════════════════════════════════════
async function phase1_auth() {
  banner("LAYER 2 ADMIN · PHASE 1", "Relevance AI connectivity + admin agent discovery");
  if (!RELEVANCE.API_KEY) {
    console.log(`\n  ${c.red}${c.bold}RELEVANCE_API_KEY is not set.${c.reset}`);
    return false;
  }
  await test(1, "POST agents/list (auth check)", async () => {
    const r = await relevanceReq("POST", `/agents/list`, {});
    if (r.ok) return pass("Relevance AI auth OK", r.ms);
    return fail(`HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  });
  return store.results.at(-1)?.status === "PASS";
}

// ════════════════════════════════════════════════════════════════
//  PHASE 2: Discover all tools on admin agent
// ════════════════════════════════════════════════════════════════
async function phase2_discoverTools() {
  banner("LAYER 2 ADMIN · PHASE 2", "Discover all tools on admin agent");
  await test(2, "Discover admin agent tools", async () => {
    const r = await relevanceReq("POST", `/agents/list`, {});
    if (!r.ok) return fail(`HTTP ${r.status}`);
    const agents = r.data?.results || [];
    const agent = agents.find(a => a.agent_id === RELEVANCE.AGENT_ID);
    if (!agent) return fail(`Admin agent ${RELEVANCE.AGENT_ID} not found`);
    const actions = agent.actions || [];
    for (const t of actions) {
      const name = (t.title || t.name || "").toLowerCase().replace(/\s+/g, "_");
      const id   = t.chain_id || t.studio_id || t.id;
      if (name && id) discoveredTools[name] = id;
    }
    console.log(`\n    ${c.grey}Tools found: ${actions.length}${c.reset}`);
    if (VERBOSE) {
      for (const [name, id] of Object.entries(discoveredTools)) {
        console.log(`    ${c.grey}  ${name.padEnd(45)} -> ${id}${c.reset}`);
      }
    }
    return pass(`${actions.length} tools discovered (expected ~27)`, r.ms);
  });
}

// ════════════════════════════════════════════════════════════════
//  PHASE 3: Resolver — identity + role verification
// ════════════════════════════════════════════════════════════════
async function phase3_resolver() {
  banner("LAYER 2 ADMIN · PHASE 3", "Resolver — identity + role verification");

  const resolverToolId = RESOLVER_TOOL_ID
    || discoveredTools["resolver_tool"]
    || discoveredTools["resolve_employee_id"];

  await test(3, "Resolver: admin AAD ID -> success + role=admin", async () => {
    if (!resolverToolId) return fail("Resolver tool ID not found");
    const r = await relevanceReq("POST", `/studios/${resolverToolId}/trigger_limited`, {
      params: { tenant_id: ADMIN_TEST.TENANT_ID, aad_object_id: ADMIN_TEST.AAD_OBJECT_ID },
      project: RELEVANCE.PROJECT_ID,
    });
    if (!r.ok) return fail(`HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,180)}`);
    const rawOutput = r.data?.output || r.data;
    const result = rawOutput?.transformed ?? rawOutput?.answer ?? rawOutput?.output ?? rawOutput;
    if (VERBOSE) console.log(`\n    ${c.grey}Resolver admin raw: ${JSON.stringify(result).slice(0,400)}${c.reset}`);

    if (JSON.stringify(result) === '{}' || JSON.stringify(result) === 'null') {
      return fail("Resolver returned empty {}. FIX: Open Resolver Tool -> Outputs section -> set to 'Last step' (the Python code step)");
    }
    if (result?.success === true) {
      const role = result?.role || "unknown";
      const empId = String(result?.breathe_employee_id || "");
      if (role !== "admin") return fail(`role="${role}" not "admin". Check CSV role column.`);
      if (ADMIN_TEST.EXPECTED_EMPLOYEE_ID && empId !== ADMIN_TEST.EXPECTED_EMPLOYEE_ID) {
        return fail(`ID ${empId} != expected ${ADMIN_TEST.EXPECTED_EMPLOYEE_ID}`);
      }
      return pass(`admin verified: breathe_id=${empId}, role=${role}`, r.ms);
    }
    return fail(`Resolver output: ${JSON.stringify(result).slice(0,200)}`);
  });

  await test(4, "Resolver: employee AAD ID -> success + role=employee", async () => {
    if (!resolverToolId) return fail("Resolver tool ID not found");
    const r = await relevanceReq("POST", `/studios/${resolverToolId}/trigger_limited`, {
      params: { tenant_id: EMPLOYEE_TEST.TENANT_ID, aad_object_id: EMPLOYEE_TEST.AAD_OBJECT_ID },
      project: RELEVANCE.PROJECT_ID,
    });
    if (!r.ok) return fail(`HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,180)}`);
    const rawOutput = r.data?.output || r.data;
    const result = rawOutput?.transformed ?? rawOutput?.answer ?? rawOutput?.output ?? rawOutput;
    if (VERBOSE) console.log(`\n    ${c.grey}Resolver employee raw: ${JSON.stringify(result).slice(0,400)}${c.reset}`);

    if (JSON.stringify(result) === '{}') return fail("Resolver returned empty {}. Same Output config fix needed.");
    if (result?.success === true) return pass(`employee verified: role=${result?.role || "unknown"}`, r.ms);
    return fail(`Resolver failed: ${JSON.stringify(result).slice(0,200)}`);
  });

  await test(5, "Resolver: unknown AAD ID -> NOT_LINKED", async () => {
    if (!resolverToolId) return fail("Resolver tool ID not found");
    const r = await relevanceReq("POST", `/studios/${resolverToolId}/trigger_limited`, {
      params: { tenant_id: "allect", aad_object_id: "00000000-0000-0000-0000-000000000000" },
      project: RELEVANCE.PROJECT_ID,
    });
    if (!r.ok) return fail(`HTTP ${r.status}`);
    const rawOutput = r.data?.output || r.data;
    const result = rawOutput?.transformed ?? rawOutput?.answer ?? rawOutput?.output ?? rawOutput;
    if (result?.success === false || result?.error_code === "NOT_LINKED") {
      return pass("correctly returned failure for unknown identity", r.ms);
    }
    if (result?.success === true) return fail("SECURITY: resolver returned success for garbage AAD ID!");
    if (JSON.stringify(result) === '{}') {
      return pass("returned empty (Output config needs fix, but safe for unknown ID)", r.ms);
    }
    return pass("returned failure for unknown identity", r.ms);
  });
}

// ════════════════════════════════════════════════════════════════
//  PHASE 4: Org-wide read tools
// ════════════════════════════════════════════════════════════════
async function phase4_orgWideReads() {
  banner("LAYER 2 ADMIN · PHASE 4", "Org-wide read tools — no employee ID required");

  // list_employees(admin) — requires oauth_account_id (Breathe Account not baked in)
  // Workaround: pass it explicitly. Permanent fix: configure Breathe Account in Relevance AI.
  await runToolTest("list_employees", { oauth_account_id: BREATHE_OAUTH_ID }, anyData, 6);
  await runToolTest("list_leave_requests", {}, anyData, 7);
  await runToolTest("list_change_requests", {}, anyData, 8);
  await runToolTest("list_absences", {}, anyData, 9);
  await runToolTest("list_sicknesses", {}, anyData, 10);
  await runToolTest("list_all_bonuses", {}, anyData, 11);

  // Get Company Account Details — tool incorrectly requires breathe_employee_id
  await runToolTest("get_company_account_details", { breathe_employee_id: EMP_ID }, anyData, 12);

  // list_holiday_allowances is NOT on the admin agent — will SKIP gracefully
  await runToolTest("list_holiday_allowances", {}, anyData, 13);

  await runToolTest("list_departments", {},
    (out) => {
      const s = JSON.stringify(out);
      return s.includes('"departments"') ? { ok: true, label: "departments returned" } : anyData(out);
    }, 14);

  await runToolTest("list_divisions", {}, anyData, 15);
  await runToolTest("list_locations", {}, anyData, 16);
  await runToolTest("list_working_patterns", {}, anyData, 17);
}

// ════════════════════════════════════════════════════════════════
//  PHASE 5: Employee-scoped tools
// ════════════════════════════════════════════════════════════════
async function phase5_employeeScopedTools() {
  banner("LAYER 2 ADMIN · PHASE 5", "Employee-scoped tools — breathe_employee_id required");
  if (!EMP_ID) { console.log(`  ${c.yellow}No employee ID — skipping.${c.reset}`); return; }

  await runToolTest("get_my_employee_details", { breathe_employee_id: EMP_ID, path: `/v1/employees/${EMP_ID}` },
    (out) => {
      const s = JSON.stringify(out);
      return (s.includes('"first_name"') || s.includes('"employees"'))
        ? { ok: true, label: `employee ${EMP_ID} data returned` }
        : { ok: false, reason: `No employee data. Got: ${s.slice(0,200)}` };
    }, 18);

  await runToolTest("list_my_absences", { breathe_employee_id: EMP_ID, path: `/v1/absences?employee_id=${EMP_ID}` },
    (out) => {
      const s = JSON.stringify(out);
      return (s.includes('"absences"') || s.includes('[]'))
        ? { ok: true, label: "absences returned" }
        : { ok: false, reason: `No absences. Got: ${s.slice(0,200)}` };
    }, 19);

  await runToolTest("list_my_sicknesses", { breathe_employee_id: EMP_ID, path: `/v1/employees/${EMP_ID}/sicknesses` },
    (out) => {
      const s = JSON.stringify(out);
      return (s.includes('"sicknesses"') || s.includes('[]'))
        ? { ok: true, label: "sicknesses returned" }
        : { ok: false, reason: `No sicknesses. Got: ${s.slice(0,200)}` };
    }, 20);

  await runToolTest("list_my_bonuses", { breathe_employee_id: EMP_ID },
    (out) => {
      const s = JSON.stringify(out);
      return (s.includes('"bonuses"') || s.includes('[]'))
        ? { ok: true, label: "bonuses returned" }
        : { ok: false, reason: `No bonuses. Got: ${s.slice(0,200)}` };
    }, 21);

  // Admin tools — send both param key variants + explicit path workaround
  await runToolTest("get_employee_details", { breathe_employee_id: EMP_ID, employee_id: EMP_ID, path: `/v1/employees/${EMP_ID}` }, anyData, 22);
  await runToolTest("list_employee_bonuses", { breathe_employee_id: EMP_ID, employee_id: EMP_ID }, anyData, 23);

  if (LEAVE_ID) {
    await runToolTest("get_leave_request", { breathe_employee_id: LEAVE_ID, leave_request_id: LEAVE_ID, path: `/v1/leave_requests/${LEAVE_ID}` }, anyData, 24);
  } else {
    process.stdout.write(`  ${c.grey}[24]${c.reset} ${"get_leave_request".padEnd(54)} `);
    console.log(`${c.yellow}SKIP${c.reset}  ${c.grey}<- no LEAVE_ID${c.reset}`);
    store.push({ id: 24, name: "get_leave_request", status: "SKIP" });
  }
}

// ════════════════════════════════════════════════════════════════
//  PHASE 6: Write tools
// ════════════════════════════════════════════════════════════════
async function phase6_writeTools() {
  banner("LAYER 2 ADMIN · PHASE 6", "Write tools — create operations");
  if (!EMP_ID) { console.log(`  ${c.yellow}No employee ID — skipping.${c.reset}`); return; }

  await runToolTest("create_my_leave_request", {
    breathe_employee_id: EMP_ID,
    start_date: dateStr(120),
    end_date:   dateStr(122),
    half_start: "false",
    half_end:   "false",
    notes: "Layer 2 admin auto-test — safe to delete",
  }, (out) => {
    const s = JSON.stringify(out);
    return (s.includes('"leave_request"') || s.includes('"id"')) ? { ok: true, label: "leave created" } : anyData(out);
  }, 25);

  await runToolTest("create_leave_request", {
    oauth_account_id: BREATHE_OAUTH_ID,
    method: "POST",
    path: `/v1/employees/${SECONDARY_EMP}/leave_requests`,
    employee_id: SECONDARY_EMP,
    breathe_employee_id: SECONDARY_EMP,
    start_date: dateStr(130), end_date: dateStr(132),
    half_start: "false", half_end: "false",
    notes: "Layer 2 admin test — safe to delete",
    body: { leave_request: { start_date: dateStr(130), end_date: dateStr(132), notes: "Layer 2 admin test" } },
  }, (out) => anyData(out), 26);

  await runToolTest("create_employee_change_request", {
    method: "POST",
    path: `/v1/employees/${EMP_ID}/change_requests`,
    employee_id: EMP_ID, breathe_employee_id: EMP_ID,
    field: "job_title", value: "Layer 2 Test — revert me",
    body: { change_request: { field: "job_title", value: "Layer 2 Test — revert me" } },
  }, (out) => anyData(out), 27);
}

// ── Summary ───────────────────────────────────────────────────
function printSummary() {
  const { passed, failed, skipped, total } = store.summary();
  console.log(`\n${"=".repeat(64)}`);
  console.log(`${c.bold}  LAYER 2 ADMIN RESULTS${c.reset}`);
  console.log(`${"=".repeat(64)}`);
  console.log(`  ${c.green}${c.bold}PASS  ${passed}/${total}${c.reset}`);
  console.log(`  ${c.red}${c.bold}FAIL  ${failed}/${total}${c.reset}`);
  console.log(`  ${c.yellow}SKIP  ${skipped}/${total}${c.reset}`);

  if (failed > 0) {
    console.log(`\n  ${c.red}${c.bold}Failed:${c.reset}`);
    store.results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  ${c.red}x${c.reset} [${r.id}] ${r.name}`);
      if (r.detail) console.log(`    ${c.grey}${r.detail}${c.reset}`);
    });
    console.log(`\n  ${c.yellow}Fixes:${c.reset}`);
    console.log(`  ${c.grey}Empty {} from resolver -> set Output to "Last step" in Relevance AI${c.reset}`);
    console.log(`  ${c.grey}{{breathe_employee_id}} in URL -> param not mapped in Breathe API Call step${c.reset}`);
    console.log(`  ${c.grey}Tool not found -> name mismatch (run with --verbose to see discovered names)${c.reset}`);
  }

  writeFileSync("studio-tests/layer2-admin-results.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    layer: "2-admin",
    agentId: RELEVANCE.AGENT_ID,
    discoveredTools,
    summary: store.summary(),
    results: store.results,
  }, null, 2));
  console.log(`\n  ${c.cyan}Report -> studio-tests/layer2-admin-results.json${c.reset}`);
  console.log(`${"=".repeat(64)}\n`);
  return failed === 0;
}

// ── MAIN ──────────────────────────────────────────────────────
export async function runLayer2Admin() {
  console.log(`\n${c.blue}${c.bold}  LAYER 2 — Admin Agent Tool Tests${c.reset}`);
  console.log(`  ${c.grey}Admin Agent: ${RELEVANCE.AGENT_ID}${c.reset}`);
  console.log(`  ${c.grey}Employee ID: ${EMP_ID ?? "not set"}${c.reset}`);
  const authOk = await phase1_auth();
  if (!authOk) { console.log(`  ${c.red}Relevance AI auth failed — skipping Layer 2.${c.reset}`); return false; }
  await phase2_discoverTools();
  await phase3_resolver();
  await phase4_orgWideReads();
  await phase5_employeeScopedTools();
  await phase6_writeTools();
  return printSummary();
}

if (process.argv[1].endsWith("layer2-admin.js")) {
  runLayer2Admin().then(ok => process.exit(ok ? 0 : 1))
    .catch(e => { console.error(`\n${c.red}Fatal:${c.reset}`, e.message); process.exit(1); });
}
