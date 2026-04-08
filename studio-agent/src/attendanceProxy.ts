/**
 * src/attendanceProxy.ts
 *
 * GET /api/attendance?date=YYYY-MM-DD
 *
 * Returns HR attendance truth for the requested date (default: today).
 * Data is sourced directly from the Breathe HR API — the API key is never
 * exposed to the browser.
 *
 * READ-ONLY BY DESIGN (Wave 1)
 * ----------------------------
 * This module is intentionally restricted to read-only access of the Breathe
 * HR API.  Only the two GET endpoints required for attendance are allowed;
 * all other paths and all non-GET HTTP methods are structurally rejected
 * before any network request is made.
 *
 * API KEY PREFERENCE ORDER
 * ------------------------
 * 1. BREATHE_API_KEY_READONLY  — preferred; use a dedicated key scoped to
 *    read-only permissions in Breathe's API settings.
 * 2. BREATHE_API_KEY           — fallback; emits a startup warning so the
 *    gap is visible in logs without leaking the key value.
 *
 * DEPENDENCY STATUS
 * -----------------
 * AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID  — must match the consented dashboard Entra app
 * BREATHE_API_KEY_READONLY                 — preferred; pending from Tracey/Allect
 * BREATHE_API_KEY                          — sandbox key available as fallback
 *
 * If no Breathe key is present the route returns 503 with a clear, honest
 * reason rather than faking data or returning empty results silently.
 *
 * Request
 *   Headers: Authorization: Bearer <MSAL access token>
 *   Query:   date=2026-03-13   (optional, defaults to today)
 *
 * Response shape (200)
 *   {
 *     "date": "2026-03-13",
 *     "totalEmployees": 57,
 *     "totalAbsent": 4,
 *     "totalPresent": 53,
 *     "absences": [
 *       {
 *         "employeeName": "Jane Smith",
 *         "type": "Holiday",
 *         "brand": "Rigby & Rigby",
 *         "location": "29 Milner Street, Chelsea",
 *         "department": "Interior Design",
 *         "startDate": "2026-03-05",
 *         "endDate": "2026-03-10"
 *       }
 *     ],
 *     "byBrand":    { "Rigby & Rigby": { "absent": 2, "present": 18 } },
 *     "byLocation": { "Chelsea": { "absent": 3, "present": 30 } }
 *   }
 *
 * Role-gated visibility is a planned future enhancement.  Currently all
 * authenticated users receive the full response.  When the knowledge-table
 * role field is wired, managers will see names and employees will see counts.
 */

import { Router, Request, Response } from "express";
import https from "https";
import { requireMsalAuth } from "./msalValidator";

// -------------------------
// Read-only path allowlist
// -------------------------
// Only these two Breathe API path prefixes are permitted.  Any attempt to
// call another path will throw before any network I/O, making mutation
// structurally impossible through this code path.

const BREATHE_ALLOWED_PATH_PREFIXES: readonly string[] = [
  "/v1/employees",
  "/v1/absences",
] as const;

function assertAllowedBreathePath(path: string): void {
  const allowed = BREATHE_ALLOWED_PATH_PREFIXES.some((prefix) =>
    path === prefix || path.startsWith(prefix + "?") || path.startsWith(prefix + "/")
  );
  if (!allowed) {
    throw new Error(
      `[attendanceProxy] Blocked request to disallowed Breathe path: ${path}`
    );
  }
}

// -------------------------
// Brand / location mappings
// -------------------------

const DOMAIN_TO_BRAND: Record<string, string> = {
  "rigbyandrigby.com": "Rigby & Rigby",
  "helengreendesign.com": "Helen Green Design",
  "lawsonrobb.com": "Lawson Robb",
};

// Maps Breathe HR location strings to canonical display names
const LOCATION_DISPLAY: Record<string, string> = {
  Chelsea: "29 Milner Street, Chelsea",
  Mayfair: "80 Brook Street, Mayfair",
  "Stratford-upon-Avon": "Stratford-upon-Avon",
};

function brandFromEmail(email?: string): string {
  if (!email) return "Allect";
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  return DOMAIN_TO_BRAND[domain] ?? "Allect";
}

function displayLocation(raw?: unknown): string {
  if (!raw) return "Unknown";
  const value = typeof raw === 'object' ? (raw as any)?.name ?? (raw as any)?.label ?? '' : raw;
  if (typeof value !== 'string') return String(value || 'Unknown');
  const trimmed = value.trim();
  if (!trimmed) return 'Unknown';
  return LOCATION_DISPLAY[trimmed] ?? trimmed;
}

// -------------------------
// Read-only Breathe client
// -------------------------
// Only GET is permitted — method is not a parameter; this function is
// GET-only by construction.  Path is validated against the allowlist before
// any network request is made.

function resolveBreatheHost(apiKey: string): string {
  if (process.env.BREATHE_BASE_URL) {
    try {
      return new URL(process.env.BREATHE_BASE_URL).hostname;
    } catch {
      return process.env.BREATHE_BASE_URL.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }
  }
  return apiKey.startsWith('sandbox-') ? 'api.sandbox.breathehr.info' : 'api.breathehr.com';
}

function breatheGet(path: string, apiKey: string): Promise<unknown> {
  // Enforce allowlist before touching the network
  assertAllowedBreathePath(path);

  const hostname = resolveBreatheHost(apiKey);

  // Strip query string for log output so no sensitive filter values appear
  const pathForLog = path.split("?")[0];
  console.log(`[attendanceProxy] → GET ${hostname}${pathForLog}`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: "GET",          // hard-coded; never derived from caller input
        headers: {
          "X-API-KEY": apiKey,   // key is never logged
          Accept: "application/json",
        },
      },
      (res) => {
        console.log(`[attendanceProxy] ← ${res.statusCode} ${hostname}${pathForLog}`);
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

// -------------------------
// API key resolution
// -------------------------
// Prefers BREATHE_API_KEY_READONLY; falls back to BREATHE_API_KEY with a
// warning so the gap is visible in startup logs without leaking the value.

function resolveApiKey(): string | undefined {
  const readonlyKey = process.env.BREATHE_API_KEY_READONLY;
  if (readonlyKey) return readonlyKey;

  const fallbackKey = process.env.BREATHE_API_KEY;
  if (fallbackKey) {
    console.warn(
      "[attendanceProxy] WARNING: Using BREATHE_API_KEY as fallback. " +
        "Set BREATHE_API_KEY_READONLY to a dedicated read-only key for production."
    );
    return fallbackKey;
  }

  return undefined;
}

// -------------------------
// Route
// -------------------------

const router = Router();

router.get(
  "/",
  requireMsalAuth as any,
  async (req: Request, res: Response): Promise<void> => {
    const breatheKey = resolveApiKey();

    if (!breatheKey) {
      res.status(503).json({
        error: "breathe_not_configured",
        message:
          "Breathe HR integration is not yet active (BREATHE_API_KEY_READONLY missing). " +
          "Set BREATHE_API_KEY_READONLY to a read-only Breathe API key to enable this endpoint.",
      });
      return;
    }

    const dateParam =
      (req.query.date as string | undefined) ??
      new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      res.status(400).json({
        error: "invalid_date",
        message: "The 'date' query parameter must be in YYYY-MM-DD format.",
      });
      return;
    }

    console.log(`[attendanceProxy] Handling attendance request for date=${dateParam}`);

    try {
      // Fetch employees and date-filtered absences in parallel.
      // Both paths are validated against the allowlist inside breatheGet().
      const [employeesBody, absencesBody] = await Promise.all([
        breatheGet("/v1/employees", breatheKey),
        breatheGet(
          `/v1/absences?start_date=${dateParam}&end_date=${dateParam}`,
          breatheKey
        ),
      ]);

      const employees: any[] = (employeesBody as any)?.employees ?? [];
      const absences: any[] = (absencesBody as any)?.absences ?? [];

      // Build a fast lookup set of absent employee IDs
      const absentIds = new Set<number>(
        absences.map((a: any) => a.employee?.id).filter(Boolean)
      );

      // Build structured absence records for the response
      const absenceRecords = absences.map((a: any) => {
        const emp = employees.find((e: any) => e.id === a.employee?.id);
        return {
          employeeName:
            a.employee?.full_name ??
            [emp?.first_name, emp?.last_name].filter(Boolean).join(' ').trim() ??
            emp?.name ??
            'Unknown',
          type: a.absence_type?.name ?? a.reason ?? "Absence",
          brand: brandFromEmail(emp?.email),
          location: displayLocation(emp?.location ?? a.employee?.location),
          department:
            emp?.department?.name ??
            (typeof emp?.department === 'string' ? emp.department : 'Unknown'),
          startDate: a.start_date,
          endDate: a.end_date,
        };
      });

      // Aggregate counts by brand and location
      const byBrand: Record<string, { absent: number; present: number }> = {};
      const byLocation: Record<string, { absent: number; present: number }> =
        {};

      for (const emp of employees) {
        const brand = brandFromEmail(emp.email);
        const location = displayLocation(emp.location);
        const isAbsent = absentIds.has(emp.id);

        if (!byBrand[brand]) byBrand[brand] = { absent: 0, present: 0 };
        if (!byLocation[location])
          byLocation[location] = { absent: 0, present: 0 };

        if (isAbsent) {
          byBrand[brand].absent++;
          byLocation[location].absent++;
        } else {
          byBrand[brand].present++;
          byLocation[location].present++;
        }
      }

      res.json({
        date: dateParam,
        totalEmployees: employees.length,
        totalAbsent: absentIds.size,
        totalPresent: employees.length - absentIds.size,
        absences: absenceRecords,
        byBrand,
        byLocation,
      });
    } catch (err: unknown) {
      const e = err as any;
      console.error("[attendanceProxy] Error:", e?.message ?? e);
      res.status(502).json({
        error: "breathe_error",
        message:
          e?.message ?? "Unexpected error fetching attendance data from Breathe HR.",
      });
    }
  }
);

export default router;
