/**
 * Parse YYYY-MM-DD directly so we don't fall into the "new Date('2026-05-12')"
 * trap — that parses as UTC midnight, then localizes, which flips the day
 * for any timezone west of UTC.
 */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
