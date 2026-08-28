import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../stores/gameStore.js";
import { loadActiveGame } from "../../storage/gameStorage.js";

type Difficulty = 1 | 2 | 3 | 4;

// §9 Only L1..L4 are shown. L5/L6 are never rendered (Scope Guardrail §0/§9).
const DIFFICULTIES: { value: Difficulty; name: string; note: string }[] = [
  { value: 1, name: "初次见面", note: "入门" },
  { value: 2, name: "轻松一下", note: "简单" },
  { value: 3, name: "动动脑筋", note: "普通" },
  { value: 4, name: "专心一下", note: "中等" },
];

export function DifficultyPage() {
  const navigate = useNavigate();
  const startNewGame = useGameStore((s) => s.startNewGame);
  const prepareLevel = useGameStore((s) => s.prepareLevel);
  const bankError = useGameStore((s) => s.bankError);
  const clearBankError = useGameStore((s) => s.clearBankError);
  const [pending, setPending] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState<Difficulty | null>(null);
  const [lastPicked, setLastPicked] = useState<Difficulty>(1);

  const begin = async (difficulty: Difficulty) => {
    setPending(null);
    setLastPicked(difficulty);
    setLoading(difficulty);
    const err = await prepareLevel(difficulty); // §23/§45 load bank first
    setLoading(null);
    if (err) return; // bankError is set; UI shows a gentle message + retry
    startNewGame(difficulty);
    if (useGameStore.getState().bankError) return;
    navigate("/play");
  };

  const onPick = (difficulty: Difficulty) => {
    clearBankError();
    // §24 If an active (unfinished) game exists, confirm before replacing it.
    if (loadActiveGame() != null) setPending(difficulty);
    else void begin(difficulty);
  };

  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")}>← 返回</button>
        <span className="diff-tag">选择难度</span>
        <span style={{ width: 44 }} />
      </div>

      {DIFFICULTIES.map((d) => (
        <button
          key={d.value}
          className="btn"
          data-testid={`difficulty-${d.value}`}
          disabled={loading != null}
          onClick={() => onPick(d.value)}
        >
          {d.name} · <span style={{ color: "var(--color-muted)" }}>{d.note}</span>
        </button>
      ))}

      {loading != null && (
        <p className="loading-note" role="status">正在准备题目…</p>
      )}

      {bankError != null && (
        <div className="bank-error" role="alert">
          <p>题目暂时没有准备好，请再试一次。</p>
          <div className="btn-row">
            <button className="btn" onClick={() => navigate("/")}>返回</button>
            <button
              className="btn btn-primary"
              data-testid="bank-error-retry"
              onClick={() => void begin(lastPicked)}
            >
              重试
            </button>
          </div>
        </div>
      )}

      {pending != null && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <p>当前这一局还没有完成，确定换一局吗？</p>
            <div className="btn-row">
              <button className="btn" onClick={() => setPending(null)}>
                继续当前游戏
              </button>
              <button className="btn btn-primary" onClick={() => void begin(pending)}>
                换一局
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
