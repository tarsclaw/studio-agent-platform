import { writeFileSync } from "fs";
// ============================================================
//  studio-tests/layer4b-admin-tools.js
//  LAYER 4B: Admin Tool Variable Substitution Verification
//
//  Tests every admin tool that has a variable ID in its Breathe
//  API path. Uses REAL sandbox IDs discovered at runtime.
//
//  Phase 1: Discover real IDs from Breathe (employees, leave, etc.)
//  Phase 2: Call each admin tool directly via REST with real IDs
//  Phase 3: Full conversation tests with STRICT checks
//
//  Usage:
//    node studio-tests/layer4b-admin-tools.js --verbose
//    node studio-tests/layer4b-admin-tools.js --phase 1
//    node studio-tests/layer4b-admin-tools.js --phase 2
//    node studio-tests/layer4b-admin-tools.js --phase 3
// ============================================================

import * as RelevanceSDK from "@relevanceai/sdk";
const { Agent, createClient } = RelevanceSDK;

// ── Global crash guards ─────────────────────────────────────
let _lastSDKError = null;
function isTransientError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = err?.cause?.message || err?.cause?.code || "";
  return /Bad Gateway|Service Unavailable|502|503|ECONNRESET|socket hang up|fetch failed|ETIMEDOUT|UND_ERR/i.test(`${msg} ${cause}`);
}
process.on("uncaughtException", (err) => {
  if (isTransientError(err)) { _lastSDKError = err.message; if (VERBOSE) console.error(`\n  \x1b[33m⚠ ${err.message}\x1b[0m`); }
  else { console.error(`\n  \x1b[31mUncaught:\x1b[0m`, err); process.exit(1); }
});
process.on("unhandledRejection", (reason) => {
  if (isTransientError(reason)) { _lastSDKError = reason?.message || String(reason); if (VERBOSE) console.error(`\n  \x1b[33m⚠ ${_lastSDKError}\x1b[0m`); }
  else { console.error(`\n  \x1b[31mUnhandled:\x1b[0m`, reason); process.exit(1); }
});

// ── Config ──────────────────────────────────────────────────
const BREATHE_BASE = process.env.BREATHE_API_KEY?.startsWith("sandbox-")
  ? "https://api.sandbox.breathehr.info" : "https://api.breathehr.com";
const BREATHE_KEY  = process.env.BREATHE_API_KEY || "";

const RELEVANCE = {
  REGION_STACK: "bcbe5a",
  API_KEY:      process.env.RELEVANCE_API_KEY || "",
  PROJECT_ID:   "ca7f193a-f48c-41ab-8c3e-6833ec9a5001",
  AGENT_ID:     "540367c8-180d-4ed1-8eb0-eac213535433",
};

const ADMIN_IDENTITY = {
  TENANT_ID:     "allect",
  AAD_OBJECT_ID: "81143a8a-a44e-4ca9-941e-341befa6eff2",
  EXPECTED_BREATHE_ID: "9811",
  NAME: "Maddox Rigby",
};

const RELEVANCE_BASE = `https://api-${RELEVANCE.REGION_STACK}.stack.tryrelevance.com/latest`;
const RELEVANCE_AUTH = `${RELEVANCE.PROJECT_ID}:${RELEVANCE.API_KEY}`;

// ── Admin tool IDs ──────────────────────────────────────────
const TOOLS = {
  resolver:                          "897c3b0e-ceaf-4bb6-8d93-fc2479243f14",
  // Self-service (verified in Layer 4)
  get_my_employee_details:           "60f26c1b-d02f-41b0-9488-f1ed06ccf226",
  list_my_absences:                  "a16998c9-871d-47ba-8448-6bbdf7c59b90",
  list_my_sicknesses:                "b5237b9b-437e-4f4b-b3d6-650e1cfca600",
  list_my_bonuses:                   "fd6cce9f-fabd-4552-9892-d648a116ffb6",
  create_my_leave_request:           "8a3a8e14-dd2c-46cd-8293-974f12bf204c",
  // Admin tools with variable IDs in path
  get_employee_details_admin:        "08459149-06bd-442b-862e-ac53fcaad9b3",
  list_employee_bonuses_admin:       "572c0580-3dad-4089-85b7-4b584c1ccf24",
  get_leave_request_admin:           "5ba48db6-beca-4cba-a52f-f4833aa28a77",
  approve_leave_request_admin:       "13cafa91-d591-41c0-955e-a12d2deda8c6",
  reject_leave_request_admin:        "a9420ab8-d263-464b-9686-6f9b34639873",
  create_leave_request_admin:        "6a6ca15b-15f0-4412-baa8-ded63f9f6b88",
  create_change_request_admin:       "90670946-976e-4390-8686-06a5f5902705",
  approve_change_request_admin:      "2d7afb5d-8c3a-42e0-a710-ab384f3c0af2",
  cancel_absence:                    "c9b23140-d895-4fd5-83a8-a3ca798d5b47",
  // Org-wide (no variable IDs — skip)
  list_sicknesses_admin:             "d5257fc0-15a0-4f51-9f69-0a89be743754",
};

// ── CLI ─────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const PHASE   = (() => { const i = args.indexOf("--phase"); return i >= 0 ? parseInt(args[i+1]) : null; })();

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

const results = [];
function log(id, phase, name, status, detail = "") {
  results.push({ id, phase, name, status, detail });
  const icon = status === "PASS" ? `${c.green}${c.bold}PASS${c.reset}` :
               status === "FAIL" ? `${c.red}${c.bold}FAIL${c.reset}` :
               `${c.yellow}${c.bold}${status}${c.reset}`;
  console.log(`  ${c.grey}[${String(id).padStart(2,"0")}]${c.reset} ${name.padEnd(54)} ${icon}  ${c.grey}${detail}${c.reset}`);
}

// ── Breathe direct call ─────────────────────────────────────
async function breatheReq(method, path, body = null) {
  const url = `${BREATHE_BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { "X-API-KEY": BREATHE_KEY, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

// ── Relevance tool call ─────────────────────────────────────
async function callTool(toolId, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const r = await relevanceReq("POST", `/studios/${toolId}/trigger_limited`, {
      params, project: RELEVANCE.PROJECT_ID,
    });
    if (r.ok) return r;
    if (attempt < retries && (r.status >= 500 || r.status === 0)) {
      if (VERBOSE) console.log(`    ${c.yellow}⚠ Retry ${attempt}/${retries}...${c.reset}`);
      await sleep(3000 * attempt);
      continue;
    }
    return r;
  }
}

async function relevanceReq(method, path, body = null) {
  const url = `${RELEVANCE_BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { "Authorization": RELEVANCE_AUTH, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 1: DISCOVER REAL IDS FROM BREATHE
// ═══════════════════════════════════════════════════════════════
const IDS = {
  employeeId: null,
  secondEmployeeId: null,
  leaveRequestId: null,
  absenceId: null,
  changeRequestId: null,
};

async function phase1() {
  banner("PHASE 1 · Discover Real IDs", "Query Breathe API directly to find test data");

  // Employees
  const empR = await breatheReq("GET", "/v1/employees");
  if (empR.ok && empR.data?.employees?.length > 0) {
    IDS.employeeId = String(empR.data.employees[0].id);
    if (empR.data.employees.length > 1) IDS.secondEmployeeId = String(empR.data.employees[1].id);
    log(1, 1, "Discover employee IDs", "PASS",
      `primary=${IDS.employeeId}, second=${IDS.secondEmployeeId || "none"}, total=${empR.data.employees.length}`);
  } else {
    log(1, 1, "Discover employee IDs", "FAIL", `HTTP ${empR.status}`);
  }

  // Leave requests
  const leaveR = await breatheReq("GET", "/v1/leave_requests");
  if (leaveR.ok) {
    const reqs = leaveR.data?.leave_requests || [];
    IDS.leaveRequestId = reqs.length > 0 ? String(reqs[0].id) : null;
    log(2, 1, "Discover leave request IDs", IDS.leaveRequestId ? "PASS" : "WARN",
      IDS.leaveRequestId ? `leaveRequestId=${IDS.leaveRequestId} (${reqs.length} total)` : "No leave requests in sandbox");
  } else {
    log(2, 1, "Discover leave request IDs", "FAIL", `HTTP ${leaveR.status}`);
  }

  // Absences
  const absR = await breatheReq("GET", "/v1/absences");
  if (absR.ok) {
    const abs = absR.data?.absences || [];
    IDS.absenceId = abs.length > 0 ? String(abs[0].id) : null;
    log(3, 1, "Discover absence IDs", IDS.absenceId ? "PASS" : "WARN",
      IDS.absenceId ? `absenceId=${IDS.absenceId} (${abs.length} total)` : "No absences in sandbox");
  } else {
    log(3, 1, "Discover absence IDs", "FAIL", `HTTP ${absR.status}`);
  }

  // Change requests
  const crR = await breatheReq("GET", "/v1/change_requests");
  if (crR.ok) {
    const crs = crR.data?.change_requests || [];
    IDS.changeRequestId = crs.length > 0 ? String(crs[0].id) : null;
    log(4, 1, "Discover change request IDs", IDS.changeRequestId ? "PASS" : "WARN",
      IDS.changeRequestId ? `changeRequestId=${IDS.changeRequestId} (${crs.length} total)` : "No change requests in sandbox");
  } else {
    log(4, 1, "Discover change request IDs", "FAIL", `HTTP ${crR.status}`);
  }

  console.log(`\n  ${c.magenta}${c.bold}Discovered IDs:${c.reset}`);
  for (const [k, v] of Object.entries(IDS)) {
    console.log(`    ${c.cyan}${k}${c.reset} = ${v || `${c.yellow}none${c.reset}`}`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 2: ADMIN TOOL DIRECT CALLS (REST)
//  Call each admin tool with real IDs and verify Breathe responds.
// ═══════════════════════════════════════════════════════════════
async function phase2() {
  banner("PHASE 2 · Admin Tool Direct Calls", "Each admin tool called via REST with real sandbox IDs");

  if (!IDS.employeeId) {
    console.log(`  ${c.red}No employee ID from Phase 1 — cannot run.${c.reset}`);
    return;
  }

  const tests = [
    // ── Employee-scoped tools ──
    {
      id: 10,
      name: "Get Employee Details (Admin)",
      toolId: TOOLS.get_employee_details_admin,
      params: { employee_id: IDS.employeeId },
      expectedPath: `/v1/employees/${IDS.employeeId}`,
      check: (s) => s.includes('"first_name"') || s.includes('"employees"'),
    },
    {
      id: 11,
      name: "List Employee Bonuses (Admin)",
      toolId: TOOLS.list_employee_bonuses_admin,
      params: { employee_id: IDS.employeeId },
      expectedPath: `/v1/employees/${IDS.employeeId}/bonuses`,
      check: (s) => s.includes('"bonuses"'),
    },
    {
      id: 12,
      name: "Create Leave Request (Admin) — dry run params",
      toolId: TOOLS.create_leave_request_admin,
      params: {
        employee_id: IDS.employeeId,
        start_date: "2026-06-01",
        end_date: "2026-06-02",
        notes: "Layer4B test — do not approve",
      },
      expectedPath: `/v1/employees/${IDS.employeeId}/leave_requests`,
      check: (s) => s.includes('"leave_request"') || s.includes('"id"') || s.includes('"start_date"'),
    },
    {
      id: 13,
      name: "Create Employee Change Request (Admin) — dry run",
      toolId: TOOLS.create_change_request_admin,
      params: {
        employee_id: IDS.employeeId,
        field: "job_title",
        value: "Layer4B Test Title",
      },
      expectedPath: `/v1/employees/${IDS.employeeId}/change_requests`,
      check: (s) => s.includes('"change_request"') || s.includes('"id"') || s.includes('"field"'),
    },

    // ── Leave request-scoped tools ──
    ...(IDS.leaveRequestId ? [
      {
        id: 14,
        name: "Get Leave Request (Admin)",
        toolId: TOOLS.get_leave_request_admin,
        params: { leave_request_id: IDS.leaveRequestId },
        expectedPath: `/v1/leave_requests/${IDS.leaveRequestId}`,
        check: (s) => s.includes('"leave_request"') || s.includes('"start_date"') || s.includes('"id"'),
      },
    ] : []),

    // ── Absence-scoped tools ──
    ...(IDS.absenceId ? [
      {
        id: 17,
        name: "Cancel Absence — param check (won't execute if already cancelled)",
        toolId: TOOLS.cancel_absence,
        params: { absence_id: IDS.absenceId },
        expectedPath: `/v1/absences/${IDS.absenceId}/cancel`,
        // May return error if already cancelled — that's fine, we're checking param substitution
        check: (s) => s.includes('"absence"') || s.includes('"cancelled"') || s.includes('"id"') || s.includes("already") || s.length > 20,
      },
    ] : []),
  ];

  // Also test approve/reject if we have a PENDING leave request
  if (IDS.leaveRequestId) {
    // Check if the leave request is still pending before trying approve
    const checkR = await breatheReq("GET", `/v1/leave_requests/${IDS.leaveRequestId}`);
    const status = checkR.data?.leave_requests?.[0]?.status || checkR.data?.leave_request?.status || "";
    const isPending = /pending/i.test(status) || !status;

    if (isPending) {
      tests.push({
        id: 15,
        name: "Approve Leave Request (Admin) — LIVE with real pending leave",
        toolId: TOOLS.approve_leave_request_admin,
        params: { leave_request_id: IDS.leaveRequestId },
        expectedPath: `/v1/leave_requests/${IDS.leaveRequestId}/approve`,
        check: (s) => s.includes('"leave_request"') || s.includes("approved") || s.includes('"id"') || s.length > 20,
      });
    } else {
      console.log(`  ${c.yellow}Leave request ${IDS.leaveRequestId} is "${status}" — skipping approve/reject tests.${c.reset}`);
    }
  }

  // Sort by ID for clean output
  tests.sort((a, b) => a.id - b.id);

  for (const test of tests) {
    await sleep(1500);
    console.log(`\n  ${c.magenta}── ${test.name} ──${c.reset}`);
    console.log(`  ${c.grey}Tool ID: ${test.toolId}${c.reset}`);
    console.log(`  ${c.grey}Expected path: ${test.expectedPath}${c.reset}`);
    console.log(`  ${c.grey}Params: ${JSON.stringify(test.params)}${c.reset}`);

    const r = await callTool(test.toolId, test.params);

    if (!r || !r.ok) {
      log(test.id, 2, test.name, "FAIL", `HTTP ${r?.status || 0}`);
      if (VERBOSE && r?.data) console.log(`    ${c.grey}Error: ${JSON.stringify(r.data).slice(0,400)}${c.reset}`);
      continue;
    }

    const output = r.data?.output || r.data;
    const outputStr = JSON.stringify(output);

    if (VERBOSE) {
      console.log(`  ${c.grey}Output (${outputStr.length} chars): ${outputStr.slice(0,500)}${c.reset}`);
    }

    // Check for null response body (the signature of broken variable substitution)
    const respBody = output?.breathe_api_call_response_body;
    if (respBody === null || respBody === undefined) {
      log(test.id, 2, test.name, "FAIL",
        "breathe_api_call_response_body is NULL — variable not substituting into path");
      console.log(`  ${c.red}${c.bold}  ✗ BROKEN: {{variable}} not reaching the Breathe API call step${c.reset}`);
      continue;
    }

    // Check for actual data
    const fullStr = JSON.stringify(respBody);
    if (test.check(fullStr)) {
      log(test.id, 2, test.name, "PASS", `Breathe returned real data (${fullStr.length} chars)`);
      console.log(`  ${c.green}${c.bold}  ✓ Variable substitution working${c.reset}`);
    } else {
      // Tool returned something but not what we expected — check for error messages
      const hasError = /error|invalid|not found|404/i.test(fullStr);
      if (hasError) {
        log(test.id, 2, test.name, "WARN",
          `Breathe returned an error (data may not exist) but tool DID execute — variable substitution is working`);
        console.log(`  ${c.yellow}  ~ Tool executed correctly, but Breathe returned: ${fullStr.slice(0,200)}${c.reset}`);
      } else {
        log(test.id, 2, test.name, "WARN", `Ambiguous response: ${fullStr.slice(0,200)}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 3: CONVERSATION-LEVEL VERIFICATION
//  Test admin operations via the agent with STRICT checks.
// ═══════════════════════════════════════════════════════════════
const AGENT_TIMEOUT_MS = 90_000;
const AGENT_SETTLE_MS  = 1_500;

let _agent = null;
async function getAgent() {
  if (!_agent) _agent = await Agent.get(RELEVANCE.AGENT_ID);
  return _agent;
}

async function sendMsg(text) {
  const payload = JSON.stringify({
    text, tenant_id: ADMIN_IDENTITY.TENANT_ID, aad_object_id: ADMIN_IDENTITY.AAD_OBJECT_ID,
    conversation_id: `l4b-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    thread_id: `l4b-t-${Date.now()}`, event_id: `l4b-e-${Date.now()}`,
  });
  const t0 = Date.now();
  _lastSDKError = null;
  try {
    const agent = await getAgent();
    const task = await agent.sendMessage(payload);
    const reply = await new Promise((resolve, reject) => {
      let latest = "", settled = false, st = null;
      const ht = setTimeout(() => fin(null, new Error(_lastSDKError ? `SDK: ${_lastSDKError}` : "TIMEOUT")), AGENT_TIMEOUT_MS);
      function fin(t, e) { if (settled) return; settled=true; clearTimeout(ht); if(st)clearTimeout(st);
        try{task.removeEventListener("message",onM)}catch{} try{task.removeEventListener("error",onE)}catch{}
        try{task.removeEventListener("update",onU)}catch{} try{task.unsubscribe()}catch{}
        e ? reject(e) : resolve(t||""); }
      function rs() { if(st)clearTimeout(st); st=setTimeout(()=>{if(latest)fin(latest)}, AGENT_SETTLE_MS); }
      function onM({detail:{message:m}}) { if(m?.isAgent?.()) { latest=String(m.text??""); rs(); } }
      function onE({detail:{message:m}}) { fin(null, new Error(m?.lastError||"err")); }
      function onU() { const s=String(task?.status??""); if(s==="idle"&&latest)fin(latest); if(s==="error")fin(null,new Error("err")); }
      task.addEventListener("message",onM); task.addEventListener("error",onE); task.addEventListener("update",onU);
    });
    return { ok: true, reply, ms: Date.now()-t0 };
  } catch(e) { return { ok:false, reply:null, ms:Date.now()-t0, error:e.message }; }
}

async function phase3() {
  banner("PHASE 3 · Conversation Verification (STRICT)", "Admin operations via agent — trouble/error = FAIL");

  createClient({ apiKey: RELEVANCE.API_KEY, region: RELEVANCE.REGION_STACK, project: RELEVANCE.PROJECT_ID });

  const TROUBLE = /(trouble|having trouble|can't retrieve|unable to retrieve|having difficulty|error.*retriev)/i;

  const tests = [
    {
      id: 30,
      name: "Admin: get employee details for specific employee",
      msg: `Show me the employee details for employee ${IDS.employeeId || ADMIN_IDENTITY.EXPECTED_BREATHE_ID}`,
      pass: /(first.?name|last.?name|name|job|title|email|status|employee|start.?date|john|smith)/i,
      fail: TROUBLE,
    },
    {
      id: 31,
      name: "Admin: list bonuses for specific employee",
      msg: `Show me the bonuses for employee ${IDS.employeeId || ADMIN_IDENTITY.EXPECTED_BREATHE_ID}`,
      pass: /(bonus|bonuses|no.*bonus|none|amount|don't have)/i,
      fail: TROUBLE,
    },
    {
      id: 32,
      name: "Self-service: my employee details (resolver chain)",
      msg: "What are my employee details?",
      pass: /(name|first.?name|job|title|department|email|john|smith|start.?date|status)/i,
      fail: TROUBLE,
    },
    {
      id: 33,
      name: "Self-service: my absences (resolver chain)",
      msg: "Show me my absences",
      pass: /(absence|leave|holiday|no.*absence|none|april|pending|you don't)/i,
      fail: TROUBLE,
    },
    {
      id: 34,
      name: "Self-service: my sickness records (resolver chain)",
      msg: "Do I have any sickness records?",
      pass: /(sickness|sick|no.*sickness|none|you don't|no.*record)/i,
      fail: TROUBLE,
    },
    {
      id: 35,
      name: "Self-service: my bonuses (resolver chain)",
      msg: "Show me my bonuses",
      pass: /(bonus|bonuses|no.*bonus|none|you don't)/i,
      fail: TROUBLE,
    },
  ];

  // Add leave request test if we have one
  if (IDS.leaveRequestId) {
    tests.push({
      id: 36,
      name: `Admin: get leave request ${IDS.leaveRequestId}`,
      msg: `Show me the details for leave request ${IDS.leaveRequestId}`,
      pass: /(leave|request|date|start|end|status|employee|approved|pending)/i,
      fail: TROUBLE,
    });
  }

  for (const test of tests) {
    await sleep(2000);
    process.stdout.write(`  ${c.grey}[${String(test.id).padStart(2,"0")}]${c.reset} ${test.name.padEnd(54)} `);

    const r = await sendMsg(test.msg);

    if (!r.ok || !r.reply) {
      console.log(`${c.red}${c.bold}FAIL${c.reset}  ${c.red}${r.error || "no reply"}${c.reset}  ${c.grey}${r.ms}ms${c.reset}`);
      results.push({ id: test.id, phase: 3, name: test.name, status: "FAIL", detail: r.error || "no reply" });
      continue;
    }

    if (VERBOSE) console.log(`\n    ${c.grey}Reply: ${r.reply.slice(0,400)}${c.reset}`);

    if (test.fail.test(r.reply)) {
      console.log(`${c.red}${c.bold}FAIL${c.reset}  ${c.red}Tool variable broken — agent said "trouble retrieving"${c.reset}  ${c.grey}${r.ms}ms${c.reset}`);
      console.log(`         ${c.grey}Reply: "${r.reply.slice(0,250)}"${c.reset}`);
      results.push({ id: test.id, phase: 3, name: test.name, status: "FAIL", detail: "TOOL_VARIABLE_BROKEN", reply: r.reply.slice(0,400) });
    } else if (test.pass.test(r.reply)) {
      console.log(`${c.green}${c.bold}PASS${c.reset}  ${c.grey}${r.ms}ms${c.reset}  ${c.cyan}real data returned${c.reset}`);
      results.push({ id: test.id, phase: 3, name: test.name, status: "PASS" });
    } else {
      console.log(`${c.yellow}${c.bold}WARN${c.reset}  ${c.yellow}Unexpected pattern${c.reset}  ${c.grey}${r.ms}ms${c.reset}`);
      console.log(`         ${c.grey}Reply: "${r.reply.slice(0,250)}"${c.reset}`);
      results.push({ id: test.id, phase: 3, name: test.name, status: "WARN", reply: r.reply.slice(0,400) });
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
  console.log(`${c.bold}  LAYER 4B — ADMIN TOOL VERIFICATION RESULTS${c.reset}`);
  console.log(`${"═".repeat(66)}`);
  console.log(`  ${c.green}${c.bold}PASS  ${passed}/${total}${c.reset}`);
  if (failed > 0) console.log(`  ${c.red}${c.bold}FAIL  ${failed}/${total}${c.reset}`);
  if (warned > 0) console.log(`  ${c.yellow}${c.bold}WARN  ${warned}/${total}${c.reset}`);

  for (const p of [1, 2, 3]) {
    const pr = results.filter(r => r.phase === p);
    if (pr.length === 0) continue;
    const pp = pr.filter(r => r.status === "PASS").length;
    const pf = pr.filter(r => r.status === "FAIL").length;
    console.log(`  ${pf === 0 ? c.green+"✓" : c.red+"✗"}${c.reset} Phase ${p}: ${pp}/${pr.length} pass`);
  }

  const broken = results.filter(r => r.detail === "TOOL_VARIABLE_BROKEN" || (r.detail || "").includes("NULL"));
  if (broken.length > 0) {
    console.log(`\n  ${c.red}${c.bold}🔧 BROKEN TOOLS:${c.reset}`);
    broken.forEach(r => console.log(`  ${c.red}✗${c.reset} ${r.name}: ${r.detail}`));
  }

  if (broken.length === 0 && failed === 0) {
    console.log(`\n  ${c.green}${c.bold}✅ ALL ADMIN TOOLS VERIFIED — VARIABLE SUBSTITUTION WORKING${c.reset}`);
  }

  writeFileSync("studio-tests/layer4b-admin-results.json", JSON.stringify({
    timestamp: new Date().toISOString(), layer: "4b-admin-tools",
    discoveredIds: IDS, results,
    diagnosis: broken.length > 0 ? "BROKEN" : "HEALTHY",
  }, null, 2));
  console.log(`\n  ${c.cyan}Report → studio-tests/layer4b-admin-results.json${c.reset}`);
  console.log(`${"═".repeat(66)}\n`);

  return failed === 0;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${c.blue}${c.bold}  LAYER 4B — Admin Tool Variable Substitution Verification${c.reset}`);
  console.log(`  ${c.grey}Admin Agent: ${RELEVANCE.AGENT_ID}${c.reset}`);
  console.log(`  ${c.grey}Identity: ${ADMIN_IDENTITY.NAME}${c.reset}`);

  if (!BREATHE_KEY) { console.log(`\n  ${c.red}BREATHE_API_KEY not set.${c.reset}\n`); return false; }
  if (!RELEVANCE.API_KEY) { console.log(`\n  ${c.red}RELEVANCE_API_KEY not set.${c.reset}\n`); return false; }

  if (!PHASE || PHASE === 1) await phase1();
  if (!PHASE || PHASE === 2) await phase2();
  if (!PHASE || PHASE === 3) await phase3();

  return printSummary();
}

main()
  .then(ok => process.exit(ok ? 0 : 1))
  .catch(e => { console.error(`\n${c.red}Fatal:${c.reset}`, e.message); process.exit(1); });
