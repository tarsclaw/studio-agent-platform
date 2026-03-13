/**
 * relevanceService.ts
 * Relevance AI knowledge table CRUD — upserts identity mapping records.
 *
 * The resolver_knowledge_table_with_status_csv dataset stores rows keyed
 * by aad_object_id. Each row maps an Azure AD user to their Breathe employee ID.
 */

import type { MappingRecord } from "./matchEngine";

const API_KEY = () => process.env.RELEVANCE_API_KEY!;
const PROJECT = () => process.env.RELEVANCE_PROJECT_ID!;
const REGION = () => process.env.RELEVANCE_REGION || "bcbe5a";
const DATASET = () => process.env.RELEVANCE_DATASET_ID || "resolver_knowledge_table_with_status_csv";

function baseUrl(): string {
  return `https://api-${REGION()}.stack.tryrelevance.com`;
}

function headers(): Record<string, string> {
  return {
    Authorization: `${PROJECT()}:${API_KEY()}`,
    "Content-Type": "application/json",
  };
}

/**
 * Fetch all existing records from the knowledge table.
 * Used by the sync engine to compute the diff.
 */
export async function getAllMappings(): Promise<MappingRecord[]> {
  const records: MappingRecord[] = [];
  let cursor: string | null = null;
  let page = 0;
  const pageSize = 100;

  while (true) {
    const body: Record<string, unknown> = {
      knowledge_set: DATASET(),
      page_size: pageSize,
    };
    if (cursor) {
      body.cursor = cursor;
    }

    const res = await fetch(`${baseUrl()}/latest/knowledge/list`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Relevance list failed ${res.status}: ${text}`);
    }

    const data = await res.json() as {
      results: Array<Record<string, unknown>>;
      cursor?: string;
    };

    if (!data.results || data.results.length === 0) break;

    for (const row of data.results) {
      records.push({
        tenant_id: String(row.tenant_id || ""),
        aad_object_id: String(row.aad_object_id || ""),
        breathe_employee_id: String(row.breathe_employee_id || ""),
        employee_name: String(row.employee_name || ""),
        status: (row.status as "active" | "inactive") || "inactive",
        role: (row.role as "employee" | "admin") || "employee",
        email: String(row.email || ""),
        department: row.department ? String(row.department) : undefined,
        job_title: row.job_title ? String(row.job_title) : undefined,
        last_synced: String(row.last_synced || ""),
      });
    }

    cursor = data.cursor || null;
    if (!cursor || data.results.length < pageSize) break;

    page++;
    if (page > 50) break; // safety valve
  }

  return records;
}

/**
 * Upsert a batch of mapping records into the knowledge table.
 * Uses the bulk upsert endpoint. Records are keyed by aad_object_id.
 * Batches in groups of 50 to avoid payload limits.
 */
export async function upsertMappings(records: MappingRecord[]): Promise<{
  inserted: number;
  updated: number;
  failed: number;
}> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const documents = batch.map((r) => ({
      aad_object_id: r.aad_object_id,
      tenant_id: r.tenant_id,
      breathe_employee_id: r.breathe_employee_id,
      employee_name: r.employee_name,
      status: r.status,
      role: r.role,
      email: r.email,
      department: r.department || "",
      job_title: r.job_title || "",
      last_synced: r.last_synced,
    }));

    try {
      const res = await fetch(
        `${baseUrl()}/latest/knowledge/sets/${DATASET()}/documents/bulk_upsert`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            documents,
            upsert_key: "aad_object_id",
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`Relevance upsert batch failed ${res.status}: ${text}`);
        failed += batch.length;
        continue;
      }

      const result = await res.json() as {
        inserted_count?: number;
        updated_count?: number;
      };

      inserted += result.inserted_count || 0;
      updated += result.updated_count || 0;
    } catch (err) {
      console.error("Relevance upsert error:", err);
      failed += batch.length;
    }

    // Brief pause between batches to avoid rate limits
    if (i + batchSize < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return { inserted, updated, failed };
}

/**
 * Insert a single new mapping record.
 * Used by the webhook handler for real-time single-user updates.
 */
export async function upsertSingleMapping(record: MappingRecord): Promise<void> {
  await upsertMappings([record]);
}

/**
 * Delete records by aad_object_id.
 * Used when an employee is permanently removed (rare).
 */
export async function deleteMappings(aadObjectIds: string[]): Promise<void> {
  if (aadObjectIds.length === 0) return;

  const res = await fetch(
    `${baseUrl()}/latest/knowledge/sets/${DATASET()}/documents/bulk_delete`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        filters: [
          {
            field: "aad_object_id",
            condition: "in",
            value: aadObjectIds,
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Relevance delete failed ${res.status}: ${text}`);
  }
}
