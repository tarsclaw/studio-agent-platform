import type { AttendanceAbsenceRecord, AttendanceGroupCounts, AttendanceResponse } from '../api/types';

export const COMPANY_ORDER = ['Allect', 'Rigby & Rigby', 'Helen Green', 'Lawson Robb'] as const;

export interface AttendanceCompanySummary {
  name: string;
  present: number;
  absent: number;
  total: number;
  absenceRate: number;
  topDepartment: string;
  absencePreview: AttendanceAbsenceRecord[];
}

export interface AttendanceDepartmentSummary {
  name: string;
  company: string;
  absent: number;
  presentEstimate: number;
  total: number;
  absenceRate: number;
  people: AttendanceAbsenceRecord[];
}

export interface AttendanceAlertItem {
  title: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'positive';
}

export interface AttendancePersonSummary {
  employeeName: string;
  company: string;
  department: string;
  location: string;
  status: 'out';
  type: string;
  startDate: string;
  endDate: string;
}

function normalizeCompany(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('rigby')) return 'Rigby & Rigby';
  if (lower.includes('helen')) return 'Helen Green';
  if (lower.includes('lawson')) return 'Lawson Robb';
  if (lower.includes('allect')) return 'Allect';
  return name;
}

export function getCompanySummaries(data: AttendanceResponse): AttendanceCompanySummary[] {
  const absenceMap = new Map<string, AttendanceAbsenceRecord[]>();
  for (const absence of data.absences ?? []) {
    const company = normalizeCompany(absence.brand || 'Unknown');
    const items = absenceMap.get(company) ?? [];
    items.push({ ...absence, brand: company });
    absenceMap.set(company, items);
  }

  const names = new Set<string>([...Object.keys(data.byBrand ?? {}), ...absenceMap.keys()]);
  const ordered = [...COMPANY_ORDER.filter((name) => names.has(name)), ...[...names].filter((name) => !COMPANY_ORDER.includes(name as any)).sort()];

  return ordered.map((name) => {
    const counts: AttendanceGroupCounts = data.byBrand?.[name] ?? { present: 0, absent: 0 };
    const preview = (absenceMap.get(name) ?? []).slice(0, 3);
    const topDepartment = preview.length
      ? Object.entries(preview.reduce<Record<string, number>>((acc, item) => {
          acc[item.department || 'Unknown'] = (acc[item.department || 'Unknown'] ?? 0) + 1;
          return acc;
        }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No absences'
      : 'No absences';
    const total = counts.present + counts.absent;
    return {
      name,
      present: counts.present,
      absent: counts.absent,
      total,
      absenceRate: total > 0 ? Math.round((counts.absent / total) * 100) : 0,
      topDepartment,
      absencePreview: preview,
    };
  });
}

export function getDepartmentSummaries(data: AttendanceResponse): AttendanceDepartmentSummary[] {
  const map = new Map<string, AttendanceDepartmentSummary>();
  for (const absence of data.absences ?? []) {
    const department = absence.department || 'Unknown';
    const company = normalizeCompany(absence.brand || 'Unknown');
    const key = `${company}::${department}`;
    const existing = map.get(key) ?? {
      name: department,
      company,
      absent: 0,
      presentEstimate: 0,
      total: 0,
      absenceRate: 0,
      people: [],
    };
    existing.absent += 1;
    existing.total += 1;
    existing.people.push({ ...absence, brand: company });
    map.set(key, existing);
  }

  const items = [...map.values()].map((item) => ({
    ...item,
    absenceRate: item.total > 0 ? 100 : 0,
  }));

  return items.sort((a, b) => b.absent - a.absent || a.name.localeCompare(b.name));
}

export function getLocationSummaries(data: AttendanceResponse) {
  return Object.entries(data.byLocation ?? {})
    .map(([name, counts]) => ({
      name,
      present: counts.present,
      absent: counts.absent,
      total: counts.present + counts.absent,
      absenceRate: counts.present + counts.absent > 0 ? Math.round((counts.absent / (counts.present + counts.absent)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getPeopleSummaries(data: AttendanceResponse): AttendancePersonSummary[] {
  return (data.absences ?? [])
    .map((absence) => ({
      employeeName: absence.employeeName,
      company: normalizeCompany(absence.brand || 'Unknown'),
      department: absence.department || 'Unknown',
      location: absence.location || 'Unknown',
      status: 'out' as const,
      type: absence.type,
      startDate: absence.startDate,
      endDate: absence.endDate,
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export function getAttendanceAlerts(data: AttendanceResponse): AttendanceAlertItem[] {
  const companies = getCompanySummaries(data);
  const departments = getDepartmentSummaries(data);
  const topCompany = companies.sort((a, b) => b.absent - a.absent)[0];
  const topDepartment = departments[0];

  if ((data.totalAbsent ?? 0) === 0) {
    return [
      {
        title: 'Full coverage today',
        detail: 'No absences were returned for the selected date, so the live HR feed suggests full attendance coverage.',
        tone: 'positive',
      },
    ];
  }

  const alerts: AttendanceAlertItem[] = [];
  if (topCompany && topCompany.absent > 0) {
    alerts.push({
      title: `Highest absence concentration: ${topCompany.name}`,
      detail: `${topCompany.absent} people are out today across ${topCompany.name}.`,
      tone: topCompany.absent >= 3 ? 'warning' : 'neutral',
    });
  }

  if (topDepartment && topDepartment.absent > 0) {
    alerts.push({
      title: `${topDepartment.name} is the most impacted team`,
      detail: `${topDepartment.absent} recorded absences in ${topDepartment.company}.`,
      tone: topDepartment.absent >= 2 ? 'warning' : 'neutral',
    });
  }

  return alerts.slice(0, 3);
}
