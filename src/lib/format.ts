// M3 §29 History formatting helpers (pure).

/** "2026年8月27日" from an epoch ms. */
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * Elapsed for history display (§29). No milliseconds. Under 1h → "X分Y秒" (or "Y秒" when
 * under a minute). 1h or more → "1小时08分" (seconds dropped).
 */
export function formatHistoryElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}小时${String(m).padStart(2, "0")}分`;
  if (m === 0) return `${s}秒`;
  return `${m}分${s}秒`;
}
