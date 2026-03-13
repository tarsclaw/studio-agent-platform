/**
 * src/leaveProxy.ts
 *
 * GET /api/leave-requests
 *
 * Admin-focused read-only view of Breathe leave requests.
 * Returns the most recent requests with optional status/limit filtering,
 * enriched with employee context for display in the dashboard.
 *
 * Query params:
 *   status  — filter by status (pending | approved | denied | all, default: all)
 *   limit   — max records to return (default: 50, max: 200)
 */

import { Router, Request, Response } from "express";
import https from "https";
import { requireMsalAuth } from "./msalValidator";

const ALLOWED_PREFIXES: readonly string[] = [
  "/v1/employees",
  "/v1/leave_requests",
] as const;

function assertAllowedPath(path: string): void {
  const allowed = ALLOWED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "?") || path.startsWith(p + "/")
  );
  if (!allowed) {
    throw new Error(`[leaveProxy] Blocked disallowed Breathe path: ${path}`);
  }
}

const DOMAIN_TO_BRAND: Record<string, string> = {
  "rigbyandrigby.com": "Rigby & Rigby",
  "helengreendesign.com": "Helen Green Design",
  "lawsonrobb.com": "Lawson Robb",
};

function brandFromEmail(email?: string): string {
  if (!email) return "Allect";
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  return DOMAIN_TO_BRAND[domain] ?? "Allect";
}

function resolveBreatheHost(apiKey: string): string {
  if (process.env.BREATHE_BASE_URL) {
    try {
      return new URL(process.env.BREATHE_BASE_URL).hostname;
    } catch {
      return process.env.BREATHE_BASE_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }
  }
  return apiKey.startsWith("sandbox-") ? "api.sandbox.breathehr.info" : "api.breathehr.com";
}

function breatheGet(path: string, apiKey: string): Promise<unknown> {
  assertAllowedPath(path);
  const hostname = resolveBreatheHost(apiKey);
  const pathForLog = path.split("?")[0];
  console.log(`[leaveProxy] → GET ${hostname}${pathForLog}`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: "GET",
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      },
      (res) => {
        console.log(`[leaveProxy] ← ${res.statusCode} ${hostname}${pathForLog}`);
        let raw = "";
        res.on("data", (chunk: Buffer) => (raw += chunk.toString()));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Breathe API ${res.statusCode}: ${raw}`));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error("Breathe API returned non-JSON response"));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function resolveApiKey(): string | undefined {
  const readonlyKey = process.env.BREATHE_API_KEY_READONLY;
  if (readonlyKey) return readonlyKey;
  const fallbackKey = process.env.BREATHE_API_KEY;
  if (fallbackKey) {
    console.warn(
      "[leaveProxy] WARNING: Using BREATHE_API_KEY as fallback. " +
        "Set BREATHE_API_KEY_READONLY to a dedicated read-only key for production."
    );
    return fallbackKey;
  }
  return undefined;
}

function parsePosInt(value: unknown, defaultVal: number, maxVal: number): number {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.min(n, maxVal);
}

const router = Router();

router.get("/", requireMsalAuth as any, async (req: Request, res: Response): Promise<void> => {
  const breatheKey = resolveApiKey();
  if (!breatheKey) {
    res.status(503).json({
      error: "breathe_not_configured",
      message:
        "Breathe HR integration is not active (BREATHE_API_KEY_READONLY missing).",
    });
    return;
  }

  const statusFilter = ((req.query.status as string | undefined) ?? "all").toLowerCase();
  const limit = parsePosInt(req.query.limit, 50, 200);
  const FETCH_SIZE = Math.min(limit * 4, 200); // fetch more to allow for filtering

  try {
    const [employeesBody, leaveBody] = await Promise.all([
      breatheGet("/v1/employees", breatheKey),
      breatheGet(`/v1/leave_requests?page=1&per_page=${FETCH_SIZE}`, breatheKey),
    ]);

    const employees: any[] = (employeesBody as any)?.employees ?? [];
    const allLeave: any[] = (leaveBody as any)?.leave_requests ?? [];

    // Build employee lookup by id
    const empById = new Map<number, any>(
      employees.filter((e) => typeof e?.id === "number").map((e) => [e.id, e])
    );

    // Filter by status if requested
    const filtered =
      statusFilter === "all"
        ? allLeave
        : allLeave.filter((r) => String(r?.status ?? "").toLowerCase() === statusFilter);

    // Take most recent first
    const sorted = filtered
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      )
      .slice(0, limit);

    const records = sorted.map((r) => {
      const empId: number | undefined = r?.employee?.id;
      const emp = empId ? empById.get(empId) : undefined;
      return {
        id: r.id,
        status: r.status ?? "unknown",
        type: r.type ?? "Leave",
        startDate: r.start_date,
        endDate: r.end_date,
        daysDeducted: r.deducted == null ? null : Number.parseFloat(String(r.deducted)),
        notes: r.notes ? String(r.notes).slice(0, 160) : null,
        halfStart: Boolean(r.half_start),
        halfEnd: Boolean(r.half_end),
        cancelled: Boolean(r.cancelled),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        employeeId: empId ?? null,
        employeeName:
          r.employee?.full_name ??
          ([emp?.first_name, emp?.last_name].filter(Boolean).join(" ").trim() || "Unknown"),
        employeeBrand: brandFromEmail(emp?.email),
        employeeDepartment:
          emp?.department?.name ??
          (typeof emp?.department === "string" ? emp.department : null),
        reviewedById: r.reviewed_by?.id ?? null,
      };
    });

    // Status breakdown counts across the whole unfiltered page
    const statusCounts: Record<string, number> = {};
    for (const r of allLeave) {
      const s = String(r?.status ?? "unknown").toLowerCase();
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    res.json({
      statusFilter,
      limit,
      total: filtered.length,
      records,
      statusCounts,
    });
  } catch (err: unknown) {
    const e = err as any;
    console.error("[leaveProxy] Error:", e?.message ?? e);
    res.status(502).json({
      error: "breathe_error",
      message: e?.message ?? "Unexpected error fetching leave data from Breathe HR.",
    });
  }
});

export default router;
