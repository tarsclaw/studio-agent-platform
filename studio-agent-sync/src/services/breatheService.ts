/**
 * breatheService.ts
 * Breathe HR API client — pulls employee roster for identity matching.
 * Reads BREATHE_API_KEY and BREATHE_BASE_URL from environment.
 */

export interface BreatheEmployee {
  id: number;                    // breathe_employee_id
  first_name: string;
  last_name: string;
  email: string;
  status: string;                // "Active", "Inactive", "Leaver", etc.
  department?: string;
  location?: string;
  job_title?: string;
  start_date?: string;
}

interface BreatheListResponse {
  employees: Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    status: string;
    department?: string;
    location?: string;
    job_title?: string;
    start_date?: string;
  }>;
}

const API_KEY = () => process.env.BREATHE_API_KEY!;
const BASE_URL = () => process.env.BREATHE_BASE_URL || "https://api.breathehr.com/v1";

async function breatheFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL()}${path}`;
  const res = await fetch(url, {
    headers: {
      "X-API-KEY": API_KEY(),
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Breathe API ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Pull all employees from Breathe HR.
 * Handles pagination — Breathe returns up to 100 per page.
 */
export async function getAllEmployees(): Promise<BreatheEmployee[]> {
  const employees: BreatheEmployee[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await breatheFetch<BreatheListResponse>(
      `/employees?page=${page}&per_page=100`
    );

    if (!data.employees || data.employees.length === 0) {
      hasMore = false;
    } else {
      employees.push(
        ...data.employees.map((e) => ({
          id: e.id,
          first_name: e.first_name,
          last_name: e.last_name,
          email: (e.email || "").toLowerCase().trim(),
          status: e.status,
          department: e.department,
          location: e.location,
          job_title: e.job_title,
          start_date: e.start_date,
        }))
      );

      // If fewer than 100 returned, no more pages
      if (data.employees.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return employees;
}

/**
 * Get a single employee by Breathe ID.
 * Used by onboarding trigger to check profile completeness.
 */
export async function getEmployee(breatheId: number): Promise<BreatheEmployee> {
  return breatheFetch<BreatheEmployee>(`/employees/${breatheId}`);
}
