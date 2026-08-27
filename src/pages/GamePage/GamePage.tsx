import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../stores/gameStore.js";
import { SudokuBoard } from "../../components/SudokuBoard/SudokuBoard.js";
import { NumberPad } from "../../components/NumberPad/NumberPad.js";

const DIFF_NAME: Record<number, string> = {
  1: "初次见面",
  2: "轻松一下",
  3: "动动脑筋",
  4: "专心一下",
};

// §7 /play. Source of truth is the store (which is hydrated from localStorage.activeGame).
// If there is no valid active game, redirect home — never white-screen, never auto-generate.
export function GamePage() {
  const navigate = useNavigate();
  const game = useGameStore((s) => s.game);
  const status = useGameStore((s) => s.status);
  const restoreAttempted = useGameStore((s) => s.restoreAttempted);
  const restoreGame = useGameStore((s) => s.restoreGame);
  const selectCell = useGameStore((s) => s.selectCell);
  const enterDigit = useGameStore((s) => s.enterDigit);
  const clearSelectedCell = useGameStore((s) => s.clearSelectedCell);
  const abandonGame = useGameStore((s) => s.abandonGame);

  // On mount, if the store has no game yet (e.g. page refresh), try to restore from storage.
  useEffect(() => {
    if (!game && !restoreAttempted) restoreGame();
  }, [game, restoreAttempted, restoreGame]);

  // Once a restore attempt has settled with no game, go home (§7).
  useEffect(() => {
    if (restoreAttempted && !game) navigate("/", { replace: true });
  }, [restoreAttempted, game, navigate]);

  if (!game) {
    return (
      <main className="app-shell">
        <div className="spacer" />
      </main>
    );
  }

  if (status === "completed") {
    return (
      <main className="app-shell">
        <div className="spacer" />
        <div className="done">
          <div className="cat" aria-hidden="true">🐱</div>
          <h2>完成啦！</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              abandonGame(); // §25 clear activeGame so it is not offered as "继续上一局"
              navigate("/", { replace: true });
            }}
          >
            回到首页
          </button>
        </div>
        <div className="spacer" />
      </main>
    );
  }

  const selected = game.selectedCell;

  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")}>← 首页</button>
        <span className="diff-tag">{DIFF_NAME[game.difficulty]}</span>
        <span style={{ width: 44 }} />
      </div>

      <SudokuBoard
        board={game.board}
        selectedCell={selected}
        onSelectCell={(index) => {
          // Given cells cannot be selected for editing (§14) — but selecting to highlight
          // is harmless; we simply won't allow edits. Keep it selectable for peer highlight.
          selectCell(index);
        }}
      />

      <NumberPad
        disabled={selected == null || game.board[selected]?.given === true}
        onDigit={(d) => enterDigit(d)}
        onClear={() => clearSelectedCell()}
      />
    </main>
  );
}
