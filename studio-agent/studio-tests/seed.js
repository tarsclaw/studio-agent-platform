// ============================================================
//  studio-tests/seed.js
//  Seeds the Breathe HR sandbox with all data required for
//  testing. Run this before Layer 1 to eliminate all SKIPs.
//
//  Usage:
//    node studio-tests/seed.js
//    node studio-tests/seed.js --reset    (delete test data first)
//    node studio-tests/seed.js --check    (show current sandbox state only)
// ============================================================

import { BREATHE, c, banner, dateStr, extractFirstId } from "./config.js";
import { writeFileSync } from "fs";

const args = process.argv.slice(2);
const RESET_FIRST = args.includes("--reset");
const CHECK_ONLY  = args.includes("--check");

// ── HTTP helper ───────────────────────────────────────────────
async function api(method, path, body = null) {
  const url = `${BREATHE.BASE_URL}${path}`;
  const headers = {
    "X-API-KEY": BREATHE.API_KEY,
    ...(body ? { "Content-Type": "application/json" } : {}),
  };
  try {
    const res = await fetch(url, {
      method, headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, err: err.message };
  }
}

// ── Pretty print ─────────────────────────────────────────────
function log(icon, msg, sub = "") {
  console.log(`  ${icon} ${msg}${sub ? `  ${c.grey}${sub}${c.reset}` : ""}`);
}

function ok(msg, sub)   { log(`${c.green}✓${c.reset}`, msg, sub); }
function skip(msg, sub) { log(`${c.yellow}–${c.reset}`, msg, sub); }
function fail(msg, sub) { log(`${c.red}✗${c.reset}`, `${c.red}${msg}${c.reset}`, sub); }
function info(msg, sub) { log(`${c.cyan}ℹ${c.reset}`, msg, sub); }

// ── State ─────────────────────────────────────────────────────
export const seedState = {
  primaryEmployeeId:   null,
  secondaryEmployeeId: null,
  pendingLeaveId:      null,
  approvedAbsenceId:   null,
  pendingChangeId:     null,
};

// ── Individual seed functions ─────────────────────────────────

async function checkAuth() {
  banner("SEED: Authentication check");
  const r = await api("GET", "/v1/account");
  if (!r.ok) {
    fail("Authentication failed — check BREATHE_API_KEY", `HTTP ${r.status}`);
    process.exit(1);
  }
  ok(`Authenticated to sandbox`, `Account: "${r.data?.account?.name}"`);
}

async function checkExistingState() {
  banner("SEED: Checking current sandbox state");

  const [empR, leaveR, absR, changeR] = await Promise.all([
    api("GET", "/v1/employees"),
    api("GET", "/v1/leave_requests"),
    api("GET", "/v1/absences"),
    api("GET", "/v1/change_requests"),
  ]);

  const empCount    = empR.data?.employees?.length    ?? 0;
  const leaveCount  = leaveR.data?.leave_requests?.length  ?? 0;
  const absCount    = absR.data?.absences?.length    ?? 0;
  const changeCount = changeR.data?.change_requests?.length ?? 0;

  const pendingLeaves  = leaveR.data?.leave_requests?.filter(l => l.status?.toLowerCase() === "pending") ?? [];
  const approvedAbs    = absR.data?.absences?.filter(a => a.status?.toLowerCase() === "approved") ?? [];
  const pendingChanges = changeR.data?.change_requests?.filter(c => !c.approved) ?? [];

  info(`Employees:       ${empCount}`);
  info(`Leave requests:  ${leaveCount} (${pendingLeaves.length} pending)`);
  info(`Absences:        ${absCount} (${approvedAbs.length} approved)`);
  info(`Change requests: ${changeCount} (${pendingChanges.length} pending)`);

  // Harvest existing usable IDs
  if (empR.data?.employees?.length > 0) {
    seedState.primaryEmployeeId = empR.data.employees[0].id;
    if (empR.data.employees.length > 1) {
      seedState.secondaryEmployeeId = empR.data.employees[1].id;
    }
  }
  if (pendingLeaves.length > 0)  seedState.pendingLeaveId  = pendingLeaves[0].id;
  if (approvedAbs.length > 0)    seedState.approvedAbsenceId = approvedAbs[0].id;
  if (pendingChanges.length > 0) seedState.pendingChangeId = pendingChanges[0].id;

  const needs = [];
  if (!seedState.primaryEmployeeId)   needs.push("primary employee");
  if (!seedState.secondaryEmployeeId) needs.push("secondary employee");
  if (!seedState.pendingLeaveId)      needs.push("pending leave request");
  if (!seedState.approvedAbsenceId)   needs.push("approved absence");
  if (!seedState.pendingChangeId)     needs.push("pending change request");

  if (needs.length === 0) {
    ok(`Sandbox already has all required data — no seeding needed`);
    return true; // fully ready
  }

  info(`Will create: ${needs.join(", ")}`);
  return false;
}

async function seedPrimaryEmployee() {
  if (seedState.primaryEmployeeId) {
    skip("Primary employee already exists", `id=${seedState.primaryEmployeeId}`);
    return;
  }
  const ts = Date.now();
  const r = await api("POST", "/v1/employees", {
    employee: {
      first_name: "Studio",
      last_name:  "TestPrimary",
      email:      `studio.primary.${ts}@allect-sandbox.com`,
      company_join_date: dateStr(-90),
      job_title:  "Self-Service Test User — safe to delete",
    },
  });
  if (r.ok) {
    seedState.primaryEmployeeId = r.data?.employee?.id ?? r.data?.employees?.[0]?.id;
    ok("Created primary employee", `id=${seedState.primaryEmployeeId}`);
  } else {
    fail("Failed to create primary employee", `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  }
}

async function seedSecondaryEmployee() {
  if (seedState.secondaryEmployeeId) {
    skip("Secondary employee already exists", `id=${seedState.secondaryEmployeeId}`);
    return;
  }
  const ts = Date.now();
  const r = await api("POST", "/v1/employees", {
    employee: {
      first_name: "Studio",
      last_name:  "TestAdmin",
      email:      `studio.admin.${ts}@allect-sandbox.com`,
      company_join_date: dateStr(-180),
      job_title:  "Admin Test User — safe to delete",
    },
  });
  if (r.ok) {
    seedState.secondaryEmployeeId = r.data?.employee?.id ?? r.data?.employees?.[0]?.id;
    ok("Created secondary employee", `id=${seedState.secondaryEmployeeId}`);
  } else {
    fail("Failed to create secondary employee", `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  }
}

async function seedPendingLeave() {
  if (seedState.pendingLeaveId) {
    skip("Pending leave request already exists", `id=${seedState.pendingLeaveId}`);
    return;
  }
  const empId = seedState.primaryEmployeeId;
  if (!empId) { fail("Cannot create leave — no primary employee"); return; }
  const r = await api("POST", `/v1/employees/${empId}/leave_requests`, {
    leave_request: {
      start_date: dateStr(30),
      end_date:   dateStr(32),
      half_start: false,
      notes: "Studio Agent seed — pending leave for testing approve/reject",
    },
  });
  if (r.ok) {
    seedState.pendingLeaveId = r.data?.leave_request?.id ?? r.data?.id ?? extractFirstId(r.data);
    ok("Created pending leave request", `id=${seedState.pendingLeaveId}, dates ${dateStr(30)}→${dateStr(32)}`);
  } else {
    fail("Failed to create pending leave", `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  }
}

async function seedApprovedAbsence() {
  if (seedState.approvedAbsenceId) {
    skip("Approved absence already exists", `id=${seedState.approvedAbsenceId}`);
    return;
  }
  const empId = seedState.primaryEmployeeId;
  if (!empId) { fail("Cannot create absence — no primary employee"); return; }

  // Create a leave request then immediately approve it to generate an absence
  const createR = await api("POST", `/v1/employees/${empId}/leave_requests`, {
    leave_request: {
      start_date: dateStr(60),
      end_date:   dateStr(61),
      half_start: false,
      notes: "Studio Agent seed — approve immediately for absence test",
    },
  });
  if (!createR.ok) {
    fail("Failed to create leave for absence seeding", `HTTP ${createR.status}`);
    return;
  }
  const leaveId = createR.data?.leave_request?.id;

  // Approve it — this generates an absence record
  const approveR = await api("POST", `/v1/leave_requests/${leaveId}/approve`);
  if (!approveR.ok) {
    fail("Failed to approve leave for absence seeding", `HTTP ${approveR.status}`);
    return;
  }

  // Fetch absences to get the generated absence ID
  await new Promise(r => setTimeout(r, 800)); // brief wait for Breathe to create the absence
  const absR = await api("GET", `/v1/absences?employee_id=${empId}`);
  const approvedAbs = absR.data?.absences?.filter(a => a.status?.toLowerCase() === "approved") ?? [];
  if (approvedAbs.length > 0) {
    seedState.approvedAbsenceId = approvedAbs[0].id;
    ok("Created + approved absence", `absenceId=${seedState.approvedAbsenceId} via leaveId=${leaveId}`);
  } else {
    // Absence may exist at org level rather than filtered by employee
    const allAbsR = await api("GET", "/v1/absences");
    const allApproved = allAbsR.data?.absences?.filter(a => a.status?.toLowerCase() === "approved") ?? [];
    if (allApproved.length > 0) {
      seedState.approvedAbsenceId = allApproved[0].id;
      ok("Created + approved absence (found at org level)", `absenceId=${seedState.approvedAbsenceId}`);
    } else {
      fail("Leave approved but no absence record found — may be a Breathe sandbox limitation");
    }
  }
}

async function seedPendingChangeRequest() {
  if (seedState.pendingChangeId) {
    skip("Pending change request already exists", `id=${seedState.pendingChangeId}`);
    return;
  }
  const empId = seedState.primaryEmployeeId;
  if (!empId) { fail("Cannot create change request — no primary employee"); return; }
  const r = await api("POST", `/v1/employees/${empId}/change_requests`, {
    change_request: {
      field: "job_title",
      value: "Studio Agent Test Role — pending for approve test",
    },
  });
  if (r.ok) {
    seedState.pendingChangeId = r.data?.change_request?.id;
    ok("Created pending change request", `id=${seedState.pendingChangeId}`);
  } else {
    fail("Failed to create change request", `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0,120)}`);
  }
}

// ── SUMMARY ───────────────────────────────────────────────────
function printSeedState() {
  banner("SEED: Sandbox state after seeding");
  const rows = [
    ["Primary employee ID",    seedState.primaryEmployeeId],
    ["Secondary employee ID",  seedState.secondaryEmployeeId],
    ["Pending leave ID",       seedState.pendingLeaveId],
    ["Approved absence ID",    seedState.approvedAbsenceId],
    ["Pending change req ID",  seedState.pendingChangeId],
  ];
  for (const [label, val] of rows) {
    if (val) {
      ok(`${label.padEnd(26)} ${c.cyan}${val}${c.reset}`);
    } else {
      fail(`${label.padEnd(26)} MISSING — some Layer 1 tests may SKIP`);
    }
  }

  console.log(`\n${c.magenta}${c.bold}  ► Copy these IDs for Layer 1:${c.reset}`);
  if (seedState.primaryEmployeeId) {
    console.log(`  ${c.magenta}    node studio-tests/layer1.js --employee-id ${seedState.primaryEmployeeId}${c.reset}`);
  }
  console.log(`\n  ${c.cyan}  Seed state saved → studio-tests/seed-state.json${c.reset}`);

  writeFileSync("studio-tests/seed-state.json", JSON.stringify(seedState, null, 2));
}

// ── RESET (delete seeded test data) ──────────────────────────
async function resetSandbox() {
  banner("SEED: Resetting test data", "Deleting Studio Agent test records");
  // Breathe API does not support DELETE on employees in sandbox — we can cancel leave/absences
  // and note that employees persist. Inform the user.
  info("Breathe API does not expose DELETE for employees or leave records.");
  info("To fully reset: log into app.breathehr.com sandbox → Settings → clear test employees.");
  info("Alternatively, Layer 1 will create fresh data on each run regardless.");
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════╗`);
  console.log(`║   Studio Agent — Sandbox Seeder                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝${c.reset}`);

  await checkAuth();

  if (CHECK_ONLY) {
    await checkExistingState();
    printSeedState();
    return;
  }

  if (RESET_FIRST) await resetSandbox();

  const alreadyReady = await checkExistingState();
  if (!alreadyReady) {
    banner("SEED: Creating required test data");
    await seedPrimaryEmployee();
    await seedSecondaryEmployee();
    await seedPendingLeave();
    await seedApprovedAbsence();
    await seedPendingChangeRequest();
  }

  printSeedState();
}

// Run standalone or export for use by orchestrator
if (process.argv[1].endsWith("seed.js")) {
  main().catch(e => { console.error(`\n${c.red}Fatal:${c.reset}`, e.message); process.exit(1); });
}

export { main as runSeed };
