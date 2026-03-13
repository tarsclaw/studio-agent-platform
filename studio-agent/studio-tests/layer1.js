import { writeFileSync } from "fs";
// ============================================================
//  studio-tests/layer1.js  —  LAYER 1: Breathe API Direct Tests
//  Tests all 31 endpoints directly. No Relevance AI involved.
//  Auth, URL paths, HTTP methods, request bodies, responses.
//
//  Usage:
//    node studio-tests/layer1.js
//    node studio-tests/layer1.js --employee-id 4821
//    node studio-tests/layer1.js --phase 4
//    node studio-tests/layer1.js --verbose
// ============================================================

import {
  BREATHE, c, banner, dateStr, extractFirstId, makeResultStore,
} from "./config.js";

// ── CLI ───────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const VERBOSE      = args.includes("--verbose");
const PHASE_FILTER = (() => { const i = args.indexOf("--phase"); return i >= 0 ? parseInt(args[i+1]) : null; })();
const FORCED_EMP   = (() => { const i = args.indexOf("--employee-id"); return i >= 0 ? args[i+1] : null; })();

// Try to load previously seeded state
let seededState = {};
try {
  const { readFileSync } = await import("fs");
  seededState = JSON.parse(readFileSync("studio-tests/seed-state.json", "utf8"));
} catch (_) {}

// ── Discovered state (starts with seed data, augmented during run) ─
const S = {
  employeeId:      FORCED_EMP || seededState.primaryEmployeeId || null,
  secondEmployeeId: seededState.secondaryEmployeeId || null,
  leaveRequestId:  seededState.pendingLeaveId || null,
  absenceId:       seededState.approvedAbsenceId || null,
  changeId:        seededState.pendingChangeId || null,
  // Created during this run:
  createdEmpId:    null,
  createdLeaveId:  null,
  createdChangeId: null,
};

const store = makeResultStore();

// ── HTTP helper ───────────────────────────────────────────────
async function req(method, path, body = null) {
  const url = `${BREATHE.BASE_URL}${path}`;
  const headers = {
    "X-API-KEY": BREATHE.API_KEY,
    ...(body ? { "Content-Type": "application/json" } : {}),
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
    if (VERBOSE && data) console.log(`\n    ${c.grey}${JSON.stringify(data).slice(0, 500)}${c.reset}`);
    return { ok: res.ok, status: res.status, ms, data };
  } catch (err) {
    return { ok: false, status: 0, ms: Date.now() - t0, data: null, networkError: err.message };
  }
}

// ── Test runner ───────────────────────────────────────────────
async function test(phase, id, name, fn) {
  if (PHASE_FILTER && phase !== PHASE_FILTER) return null;
  process.stdout.write(`  ${c.grey}[${String(id).padStart(2,"0")}]${c.reset} ${name.padEnd(54)} `);
  try {
    const r = await fn();
    if (r === "SKIP") {
      console.log(`${c.yellow}SKIP${c.reset}  ${c.grey}← seed sandbox first${c.reset}`);
      store.push({ phase, id, name, status: "SKIP" });
      return null;
    }
    if (r.ok) {
      const note = r._note ? `  ${c.cyan}${r._note}${c.reset}` : "";
      console.log(`${c.green}${c.bold}PASS${c.reset}  ${c.grey}HTTP ${r.status}  ${r.ms}ms${c.reset}${note}`);
      store.push({ phase, id, name, status: "PASS", httpStatus: r.status, ms: r.ms });
    } else {
      const errBody = typeof r.data === "object"
        ? JSON.stringify(r.data).slice(0, 180)
        : (r.networkError || "").slice(0, 180);
      console.log(`${c.red}${c.bold}FAIL${c.reset}  ${c.grey}HTTP ${r.status}  ${r.ms}ms${c.reset}`);
      console.log(`         ${c.red}${errBody}${c.reset}`);
      store.push({ phase, id, name, status: "FAIL", httpStatus: r.status, detail: errBody });
    }
    return r;
  } catch (err) {
    console.log(`${c.red}${c.bold}FAIL${c.reset}  ${c.red}${err.message}${c.reset}`);
    store.push({ phase, id, name, status: "FAIL", detail: err.message });
    return null;
  }
}

function note(r, msg) { if (r) r._note = msg; return r; }

// ═══════════════════════════════════════════════════════════
//  PHASE 1 — AUTHENTICATION
// ═══════════════════════════════════════════════════════════
async function phase1() {
  banner("LAYER 1 · PHASE 1", "Authentication — halt on failure");

  const r = await test(1, 1, "GET /v1/account  →  auth + account details", async () => {
    const r = await req("GET", "/v1/account");
    if (r.ok) note(r, `"${r.data?.account?.name}"`);
    return r;
  });

  if (!r?.ok) {
    console.log(`\n  ${c.red}${c.bold}✗ Auth failed. Fix BREATHE_API_KEY before continuing.${c.reset}\n`);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════
//  PHASE 2 — REFERENCE LISTS (no employee ID needed)
// ═══════════════════════════════════════════════════════════
async function phase2() {
  banner("LAYER 1 · PHASE 2", "Reference lists — no ID required");

  await test(2,  2,  "GET /v1/departments",            async () => req("GET", "/v1/departments"));
  await test(2,  3,  "GET /v1/divisions",              async () => req("GET", "/v1/divisions"));
  await test(2,  4,  "GET /v1/locations",              async () => req("GET", "/v1/locations"));
  await test(2,  5,  "GET /v1/working_patterns",       async () => req("GET", "/v1/working_patterns"));
  await test(2,  6,  "GET /v1/holiday_allowances",     async () => req("GET", "/v1/holiday_allowances?page=1&per_page=25"));
  await test(2,  7,  "GET /v1/bonuses  (org-wide)",    async () => req("GET", "/v1/bonuses"));
}

// ═══════════════════════════════════════════════════════════
//  PHASE 3 — ID DISCOVERY
// ═══════════════════════════════════════════════════════════
async function phase3() {
  banner("LAYER 1 · PHASE 3", "ID discovery — simulates resolver output");

  // Employees
  if (!S.employeeId) {
    await test(3, 8, "GET /v1/employees  →  harvest breathe_employee_id", async () => {
      const r = await req("GET", "/v1/employees");
      if (r.ok) {
        S.employeeId = extractFirstId(r.data);
        if (r.data?.employees?.length > 1) S.secondEmployeeId = r.data.employees[1].id;
        note(r, `breathe_employee_id = ${S.employeeId ?? "NONE — run seed first!"}`);
      }
      return r;
    });
  } else {
    console.log(`  ${c.cyan}  breathe_employee_id = ${S.employeeId}  (from seed or --employee-id)${c.reset}`);
  }

  // Leave requests
  await test(3, 9, "GET /v1/leave_requests  →  harvest leaveRequestId", async () => {
    const r = await req("GET", "/v1/leave_requests");
    if (r.ok && !S.leaveRequestId) {
      S.leaveRequestId = extractFirstId(r.data);
    }
    note(r, `leaveId = ${S.leaveRequestId ?? "none"}`);
    return r;
  });

  // Absences
  await test(3, 10, "GET /v1/absences  →  harvest absenceId", async () => {
    const r = await req("GET", "/v1/absences");
    if (r.ok && !S.absenceId) {
      const approved = r.data?.absences?.filter(a => a.status?.toLowerCase() === "approved");
      S.absenceId = approved?.[0]?.id ?? extractFirstId(r.data);
    }
    note(r, `absenceId = ${S.absenceId ?? "none"}`);
    return r;
  });

  // Change requests
  await test(3, 11, "GET /v1/change_requests  →  harvest changeId", async () => {
    const r = await req("GET", "/v1/change_requests");
    if (r.ok && !S.changeId) {
      const pending = r.data?.change_requests?.filter(c => !c.approved);
      S.changeId = pending?.[0]?.id ?? extractFirstId(r.data);
    }
    note(r, `changeId = ${S.changeId ?? "none"}`);
    return r;
  });

  // Print discovered state
  console.log(`\n  ${c.magenta}${c.bold}► breathe_employee_id = ${S.employeeId ?? "NOT FOUND — run: node studio-tests/seed.js"}${c.reset}`);
  if (!S.employeeId) {
    console.log(`  ${c.yellow}  Phases 4–7 will SKIP without an employee ID.${c.reset}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  PHASE 4 — SELF-SERVICE READS (employee-scoped)
//  This is the core variable flow test:
//  resolver returns breathe_employee_id → tool uses it
// ═══════════════════════════════════════════════════════════
async function phase4() {
  banner("LAYER 1 · PHASE 4", "Self-service reads — breathe_employee_id flows into each tool");

  await test(4, 12, "GET /v1/employees/{{breathe_employee_id}}", async () => {
    if (!S.employeeId) return "SKIP";
    return note(await req("GET", `/v1/employees/${S.employeeId}`), `→ Get My Employee Details`);
  });

  await test(4, 13, "GET /v1/absences?employee_id={{breathe_employee_id}}", async () => {
    if (!S.employeeId) return "SKIP";
    return note(await req("GET", `/v1/absences?employee_id=${S.employeeId}`), `→ List My Absences`);
  });

  await test(4, 14, "GET /v1/employees/{{breathe_employee_id}}/bonuses", async () => {
    if (!S.employeeId) return "SKIP";
    return note(await req("GET", `/v1/employees/${S.employeeId}/bonuses`), `→ List My Bonuses`);
  });

  await test(4, 15, "GET /v1/employees/{{breathe_employee_id}}/sicknesses", async () => {
    if (!S.employeeId) return "SKIP";
    return note(await req("GET", `/v1/employees/${S.employeeId}/sicknesses`), `→ List My Sicknesses`);
  });
}

// ═══════════════════════════════════════════════════════════
//  PHASE 5 — ADMIN READS
// ═══════════════════════════════════════════════════════════
async function phase5() {
  banner("LAYER 1 · PHASE 5", "Admin reads");

  await test(5, 16, "GET /v1/employees/{{employee_id}}  (admin get)", async () => {
    if (!S.employeeId) return "SKIP";
    return req("GET", `/v1/employees/${S.employeeId}`);
  });

  await test(5, 17, "GET /v1/employees/{{employee_id}}/bonuses  (admin)", async () => {
    if (!S.employeeId) return "SKIP";
    return req("GET", `/v1/employees/${S.employeeId}/bonuses`);
  });

  await test(5, 18, "GET /v1/leave_requests/{{leave_request_id}}", async () => {
    if (!S.leaveRequestId) return "SKIP";
    return req("GET", `/v1/leave_requests/${S.leaveRequestId}`);
  });
}

// ═══════════════════════════════════════════════════════════
//  PHASE 6 — CREATE OPERATIONS
// ═══════════════════════════════════════════════════════════
async function phase6() {
  banner("LAYER 1 · PHASE 6", "Create operations");

  // Create employee
  await test(6, 19, "POST /v1/employees  →  Create Employee", async () => {
    const ts = Date.now();
    const r = await req("POST", "/v1/employees", {
      employee: {
        first_name: "AutoTest",
        last_name:  `Run${ts}`,
        email:      `autotest.${ts}@allect-sandbox.com`,
        company_join_date: dateStr(),
        job_title: "Layer 1 auto-created — safe to delete",
      },
    });
    if (r.ok) {
      S.createdEmpId = r.data?.employee?.id ?? r.data?.employees?.[0]?.id;
      note(r, `createdEmpId = ${S.createdEmpId}`);
    }
    return r;
  });

  // Create leave request (self-service path)
  await test(6, 20, "POST /v1/employees/{{breathe_employee_id}}/leave_requests  (self-service)", async () => {
    if (!S.employeeId) return "SKIP";
    const r = await req("POST", `/v1/employees/${S.employeeId}/leave_requests`, {
      leave_request: {
        start_date: dateStr(45),
        end_date:   dateStr(47),
        half_start: false,
        notes: "Layer 1 auto-test — Create My Leave Request",
      },
    });
    if (r.ok) {
      S.createdLeaveId = r.data?.leave_request?.id;
      note(r, `createdLeaveId = ${S.createdLeaveId}`);
    }
    return r;
  });

  // Create leave request (admin path — for different employee)
  await test(6, 21, "POST /v1/employees/{{employee_id}}/leave_requests  (admin)", async () => {
    const empId = S.createdEmpId || S.secondEmployeeId || S.employeeId;
    if (!empId) return "SKIP";
    const r = await req("POST", `/v1/employees/${empId}/leave_requests`, {
      leave_request: {
        start_date: dateStr(60),
        end_date:   dateStr(62),
        half_start: false,
        notes: "Layer 1 auto-test — Admin Create Leave Request",
      },
    });
    return r;
  });

  // Create change request
  await test(6, 22, "POST /v1/employees/{{employee_id}}/change_requests", async () => {
    const empId = S.createdEmpId || S.employeeId;
    if (!empId) return "SKIP";
    const r = await req("POST", `/v1/employees/${empId}/change_requests`, {
      change_request: {
        field: "job_title",
        value: "Layer 1 auto-test updated title — safe to delete",
      },
    });
    if (r.ok) {
      S.createdChangeId = r.data?.change_request?.id;
      note(r, `createdChangeId = ${S.createdChangeId}`);
    }
    return r;
  });
}

// ═══════════════════════════════════════════════════════════
//  PHASE 7 — ACTIONS (approve / reject / cancel)
// ═══════════════════════════════════════════════════════════
async function phase7() {
  banner("LAYER 1 · PHASE 7", "Actions — approve / reject / cancel");

  // Approve leave
  await test(7, 23, "POST /v1/leave_requests/{{id}}/approve", async () => {
    const id = S.createdLeaveId || S.leaveRequestId;
    if (!id) return "SKIP";
    return req("POST", `/v1/leave_requests/${id}/approve`);
  });

  // Reject leave — create a dedicated fresh one to reject
  await test(7, 24, "POST /v1/leave_requests/{{id}}/reject", async () => {
    if (!S.employeeId) return "SKIP";
    const cr = await req("POST", `/v1/employees/${S.employeeId}/leave_requests`, {
      leave_request: {
        start_date: dateStr(90),
        end_date:   dateStr(91),
        half_start: false,
        notes: "Layer 1 auto-test — created to reject",
      },
    });
    if (!cr.ok) return cr;
    const rejectId = cr.data?.leave_request?.id;
    if (!rejectId) return "SKIP";
    return req("POST", `/v1/leave_requests/${rejectId}/reject`, {
      leave_request: { rejection_reason: "Layer 1 automated rejection test" },
    });
  });

  // Approve change request
  await test(7, 25, "POST /v1/employees/{{id}}/change_requests/{{cid}}/approve", async () => {
    const empId = S.createdEmpId || S.employeeId;
    const chId  = S.createdChangeId || S.changeId;
    if (!empId || !chId) return "SKIP";
    return req("POST", `/v1/employees/${empId}/change_requests/${chId}/approve`);
  });

  // Cancel absence
  await test(7, 26, "POST /v1/absences/{{id}}/cancel", async () => {
    if (!S.absenceId) return "SKIP";
    return req("POST", `/v1/absences/${S.absenceId}/cancel`);
  });
}

// ═══════════════════════════════════════════════════════════
//  PHASE 8 — CONFIRMATORY RE-READS
// ═══════════════════════════════════════════════════════════
async function phase8() {
  banner("LAYER 1 · PHASE 8", "Confirmatory re-reads — verify mutations");

  await test(8, 27, "GET /v1/leave_requests  (post approve/reject)", async () => req("GET", "/v1/leave_requests"));
  await test(8, 28, "GET /v1/change_requests  (post approve)",        async () => req("GET", "/v1/change_requests"));
  await test(8, 29, "GET /v1/absences  (post cancel)",                async () => req("GET", "/v1/absences"));
  await test(8, 30, "GET /v1/employees",                              async () => req("GET", "/v1/employees"));
  await test(8, 31, "GET /v1/account  (final auth confirm)",          async () => req("GET", "/v1/account"));
}

// ═══════════════════════════════════════════════════════════
//  SUMMARY + REPORT
// ═══════════════════════════════════════════════════════════
function printSummary() {
  const { passed, failed, skipped, total } = store.summary();
  const avgMs = Math.round(
    store.results.filter(r => r.ms).reduce((a, b) => a + (b.ms || 0), 0) /
    (store.results.filter(r => r.ms).length || 1)
  );

  console.log(`\n${"═".repeat(62)}`);
  console.log(`${c.bold}  LAYER 1 RESULTS${c.reset}`);
  console.log(`${"═".repeat(62)}`);
  console.log(`  ${c.green}${c.bold}PASS  ${passed}/${total}${c.reset}`);
  console.log(`  ${c.red}${c.bold}FAIL  ${failed}/${total}${c.reset}`);
  console.log(`  ${c.yellow}SKIP  ${skipped}/${total}${c.reset}  ${c.grey}← run seed first to clear${c.reset}`);
  console.log(`  ${c.grey}Avg latency: ${avgMs}ms${c.reset}`);

  if (failed > 0) {
    console.log(`\n${c.red}${c.bold}  Failed tests:${c.reset}`);
    store.results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  ${c.red}✗${c.reset} [${r.id}] ${r.name}`);
      if (r.detail) console.log(`    ${c.grey}${r.detail}${c.reset}`);
    });
    console.log(`\n  ${c.yellow}Failure diagnosis:${c.reset}`);
    console.log(`  ${c.grey}HTTP 401 → wrong API key${c.reset}`);
    console.log(`  ${c.grey}HTTP 404 → wrong endpoint path${c.reset}`);
    console.log(`  ${c.grey}HTTP 422 → wrong request body (check field names)${c.reset}`);
    console.log(`  ${c.grey}HTTP   0 → network error (check BASE_URL / internet)${c.reset}`);
  }

  if (S.employeeId) {
    console.log(`\n${c.magenta}${c.bold}  ► Use for Layer 2: breathe_employee_id = ${S.employeeId}${c.reset}`);
    console.log(`  ${c.magenta}    node studio-tests/layer2.js --employee-id ${S.employeeId}${c.reset}`);
  }


  const report = {
    timestamp: new Date().toISOString(),
    layer: 1,
    summary: store.summary(),
    discoveredIds: {
      breathe_employee_id: S.employeeId,
      leave_request_id:    S.leaveRequestId,
      absence_id:          S.absenceId,
      change_request_id:   S.changeId,
    },
    results: store.results,
  };
  writeFileSync("studio-tests/layer1-results.json", JSON.stringify(report, null, 2));
  console.log(`  ${c.cyan}Full report → studio-tests/layer1-results.json${c.reset}`);
  console.log(`${"═".repeat(62)}\n`);

  return failed === 0;
}

// ── MAIN ──────────────────────────────────────────────────────
export async function runLayer1() {
  console.log(`\n${c.blue}${c.bold}  LAYER 1 — Breathe API Direct Tests${c.reset}`);
  console.log(`  ${c.grey}Key: ${BREATHE.API_KEY.slice(0,22)}...${c.reset}`);

  const authOk = await phase1();
  if (!authOk) return false;
  await phase2();
  await phase3();
  await phase4();
  await phase5();
  await phase6();
  await phase7();
  await phase8();
  return printSummary();
}

if (process.argv[1].endsWith("layer1.js")) {
  runLayer1().then(ok => process.exit(ok ? 0 : 1))
    .catch(e => { console.error(`\n${c.red}Fatal:${c.reset}`, e.message); process.exit(1); });
}
