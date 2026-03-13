"use strict";
/**
 * breatheService.ts
 * Breathe HR API client — pulls employee roster for identity matching.
 * Reads BREATHE_API_KEY and BREATHE_BASE_URL from environment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllEmployees = getAllEmployees;
exports.getEmployee = getEmployee;
const API_KEY = () => process.env.BREATHE_API_KEY;
const BASE_URL = () => process.env.BREATHE_BASE_URL || "https://api.breathehr.com/v1";
async function breatheFetch(path) {
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
    return res.json();
}
/**
 * Pull all employees from Breathe HR.
 * Handles pagination — Breathe returns up to 100 per page.
 */
async function getAllEmployees() {
    const employees = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
        const data = await breatheFetch(`/employees?page=${page}&per_page=100`);
        if (!data.employees || data.employees.length === 0) {
            hasMore = false;
        }
        else {
            employees.push(...data.employees.map((e) => ({
                id: e.id,
                first_name: e.first_name,
                last_name: e.last_name,
                email: (e.email || "").toLowerCase().trim(),
                status: e.status,
                department: e.department,
                location: e.location,
                job_title: e.job_title,
                start_date: e.start_date,
            })));
            // If fewer than 100 returned, no more pages
            if (data.employees.length < 100) {
                hasMore = false;
            }
            else {
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
async function getEmployee(breatheId) {
    return breatheFetch(`/employees/${breatheId}`);
}
//# sourceMappingURL=breatheService.js.map