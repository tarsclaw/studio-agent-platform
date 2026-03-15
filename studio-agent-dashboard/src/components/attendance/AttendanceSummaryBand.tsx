import { Building2, MapPin, UserRoundCheck, UserRoundX, Users } from 'lucide-react';
import type { AttendanceResponse } from '../../api/types';

function Stat({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: any; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--border-primary)] p-4 ${accent ? 'bg-[var(--bg-elevated)] shadow-[0_0_0_1px_rgba(16,185,129,0.08)]' : 'bg-[var(--bg-elevated)]'}`}>
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Icon size={16} /> {label}</div>
      <div className={`mt-3 font-mono text-3xl font-bold ${accent ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  );
}

export function AttendanceSummaryBand({ data }: { data: AttendanceResponse }) {
  const departments = new Set((data.absences ?? []).map((absence) => absence.department).filter(Boolean)).size;
  const locations = Object.keys(data.byLocation ?? {}).length;
  const companies = Object.keys(data.byBrand ?? {}).length;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      <Stat label="In today" value={data.totalPresent} icon={UserRoundCheck} accent />
      <Stat label="Out today" value={data.totalAbsent} icon={UserRoundX} />
      <Stat label="Total tracked" value={data.totalEmployees} icon={Users} />
      <Stat label="Companies affected" value={companies} icon={Building2} />
      <Stat label="Departments affected" value={departments} icon={Users} />
      <Stat label="Offices affected" value={locations} icon={MapPin} />
    </div>
  );
}
