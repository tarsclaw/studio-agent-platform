const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const GBP_PRECISE = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat('en-GB');

export function formatCurrency(value: number): string {
  return GBP.format(value);
}

export function formatCurrencyPrecise(value: number): string {
  return GBP_PRECISE.format(value);
}

export function formatNumber(value: number): string {
  return NUM.format(Math.round(value));
}

export function formatHours(value: number): string {
  return NUM.format(Math.round(value * 10) / 10);
}

export function formatPercent(value: number): string {
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}

export function formatLatency(ms: number): string {
  if (ms === 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatToolName(tool: string): string {
  return tool
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonth(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatMonthShort(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return `${MONTH_SHORT[month - 1]} '${String(year).slice(2)}`;
}

export function formatTooltipLabel(date: string): string {
  // Accepts "YYYY-MM-DD" or "YYYY-MM"; returns e.g. "Jan 15" or "Jan '24"
  const parts = date.split('-');
  if (parts.length === 3) {
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    return `${MONTH_SHORT[m - 1]} ${d}`;
  }
  if (parts.length === 2) {
    return formatMonthShort(date);
  }
  return date;
}
