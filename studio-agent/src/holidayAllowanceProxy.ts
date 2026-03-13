/**
 * src/holidayAllowanceProxy.ts
 *
 * GET /api/holiday-allowances
 *
 * Admin-focused read-only summary of holiday allowance policy coverage.
 * Combines Breathe employee records with holiday allowance definitions so the
 * dashboard can show which allowance policies are in use and how broadly.
 */

import { Router, Request, Response } from "express";
import https from "https";
import { requireMsalAuth } from "./msalValidator";

const ALLOWED_PREFIXES: readonly string[] = [
  "/v1/employees",
  "/v1/holiday_allowances",
] as const;

function assertAllowedPath(path: string): void {
  const allowed = ALLOWED_PREFIXES.some((prefix) =>
    path === prefix || path.startsWith(prefix + "?") || path.startsWith(prefix + "/")
  );
  if (!allowed) {
    throw new Error(`[holidayAllowanceProxy] Blocked request to disallowed Breathe path: ${path}`);
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
  console.log(`[holidayAllowanceProxy] → GET ${hostname}${pathForLog}`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path,
        method: "GET",
        headers: {
          "X-API-KEY": apiKey,
          Accept: "application/json",
        },
      },
      (res) => {
        console.log(`[holidayAllowanceProxy] ← ${res.statusCode} ${hostname}${pathForLog}`);
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
      "[holidayAllowanceProxy] WARNING: Using BREATHE_API_KEY as fallback. " +
        "Set BREATHE_API_KEY_READONLY to a dedicated read-only key for production."
    );
    return fallbackKey;
  }

  return undefined;
}

const router = Router();

router.get("/", requireMsalAuth as any, async (_req: Request, res: Response): Promise<void> => {
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

  try {
    const [employeesBody, allowanceBody] = await Promise.all([
      breatheGet("/v1/employees", breatheKey),
      breatheGet("/v1/holiday_allowances", breatheKey),
    ]);

    const employees: any[] = (employeesBody as any)?.employees ?? [];
    const allowanceDefs: any[] = (allowanceBody as any)?.holiday_allowances ?? [];

    const definitionsById = new Map<number, any>(
      allowanceDefs
        .filter((item) => typeof item?.id === "number")
        .map((item) => [item.id, item])
    );

    const totalsByBrand: Record<string, number> = {};
    const policyMap = new Map<string, {
      id: number | null;
      name: string;
      units: string;
      amount: number | null;
      employeeCount: number;
      defaultPolicy: boolean;
      carryoverAllowed: boolean;
      dependsOnService: boolean;
      brands: Record<string, number>;
    }>();

    for (const employee of employees) {
      if (employee?.status && String(employee.status).toLowerCase().includes("former")) continue;

      const allowance = employee?.holiday_allowance;
      const allowanceId = typeof allowance?.id === "number" ? allowance.id : null;
      const definition = allowanceId ? definitionsById.get(allowanceId) : null;
      const name = allowance?.name ?? definition?.name ?? "Unassigned allowance";
      const units = definition?.units ?? "days";
      const amountRaw = definition?.amount;
      const amount = amountRaw == null ? null : Number.parseFloat(String(amountRaw));
      const brand = brandFromEmail(employee?.email);
      totalsByBrand[brand] = (totalsByBrand[brand] ?? 0) + 1;

      const existing = policyMap.get(name) ?? {
        id: allowanceId,
        name,
        units,
        amount: Number.isFinite(amount as number) ? amount : null,
        employeeCount: 0,
        defaultPolicy: Boolean(definition?.default),
        carryoverAllowed: Boolean(definition?.carryover_allowed),
        dependsOnService: Boolean(definition?.depends_on_service),
        brands: {},
      };

      existing.employeeCount += 1;
      existing.brands[brand] = (existing.brands[brand] ?? 0) + 1;
      policyMap.set(name, existing);
    }

    const policies = Array.from(policyMap.values())
      .sort((a, b) => b.employeeCount - a.employeeCount || a.name.localeCompare(b.name))
      .map((policy) => ({
        ...policy,
        brandMix: Object.entries(policy.brands)
          .sort((a, b) => b[1] - a[1])
          .map(([brand, count]) => ({ brand, count })),
      }));

    const defaultPolicy = policies.find((policy) => policy.defaultPolicy) ?? null;

    res.json({
      totalEmployees: employees.filter((employee) => !(employee?.status && String(employee.status).toLowerCase().includes("former"))).length,
      totalPolicies: policies.length,
      defaultPolicy,
      policies,
      totalsByBrand: Object.entries(totalsByBrand)
        .sort((a, b) => b[1] - a[1])
        .map(([brand, count]) => ({ brand, count })),
    });
  } catch (err: unknown) {
    const e = err as any;
    console.error("[holidayAllowanceProxy] Error:", e?.message ?? e);
    res.status(502).json({
      error: "breathe_error",
      message: e?.message ?? "Unexpected error fetching holiday allowance data from Breathe HR.",
    });
  }
});

export default router;
