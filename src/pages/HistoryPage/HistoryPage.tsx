import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadHistory } from "../../storage/gameStorage.js";
import type { HistoryRecord } from "../../storage/schemas.js";
import { difficultyLabel } from "../../lib/difficulty.js";
import { formatDate, formatHistoryElapsed } from "../../lib/format.js";

// M3 §20/§29 /history. Shows ONLY date / difficulty / elapsed. NEVER score / rank / hint /
// mistakes / best time (§21/§23). Records are already stored newest-first.
export function HistoryPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<HistoryRecord[] | null>(null);

  useEffect(() => {
    // loadHistory is safe (Zod + corrupted fallback → []).
    setRecords(loadHistory());
  }, []);

  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")} aria-label="返回首页">
          ← 返回
        </button>
        <span className="diff-tag">历史</span>
        <span style={{ width: 44 }} />
      </div>

      {records == null ? (
        <div className="spacer" />
      ) : records.length === 0 ? (
        <div className="history-empty" data-testid="history-empty">
          <p>还没有完成记录。</p>
          <p className="settings-hint">慢慢来，第一局就在前面。</p>
        </div>
      ) : (
        <ul className="history-list" data-testid="history-list">
          {records.map((r) => (
            <li key={r.gameId} className="history-item" data-testid="history-item">
              <span className="history-date">{formatDate(r.completedAt)}</span>
              <span className="history-diff">{difficultyLabel(r.difficulty)}</span>
              <span className="history-time">{formatHistoryElapsed(r.elapsedMs)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
