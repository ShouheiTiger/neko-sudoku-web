import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../stores/gameStore.js";
import { SudokuBoard } from "../../components/SudokuBoard/SudokuBoard.js";
import { NumberPad } from "../../components/NumberPad/NumberPad.js";
import { Toolbar } from "../../components/Toolbar/Toolbar.js";
import { HintPanel } from "../../components/HintPanel/HintPanel.js";
import { formatElapsed } from "../../lib/timer.js";

const DIFF_NAME: Record<number, string> = {
  1: "初次见面",
  2: "轻松一下",
  3: "动动脑筋",
  4: "专心一下",
};

// M2 /play. Source of truth is the store (hydrated from localStorage.activeGame). No live
// timer is shown while playing (§14). Toolbar = 删除/撤销/笔记/提示 (§23).
export function GamePage() {
  const navigate = useNavigate();
  const game = useGameStore((s) => s.game);
  const status = useGameStore((s) => s.status);
  const restoreAttempted = useGameStore((s) => s.restoreAttempted);
  const errorMode = useGameStore((s) => s.errorMode);
  const gentleError = useGameStore((s) => s.gentleError);
  const hint = useGameStore((s) => s.hint);
  const completedElapsedMs = useGameStore((s) => s.completedElapsedMs);

  const restoreGame = useGameStore((s) => s.restoreGame);
  const selectCell = useGameStore((s) => s.selectCell);
  const enterDigit = useGameStore((s) => s.enterDigit);
  const clearSelectedCell = useGameStore((s) => s.clearSelectedCell);
  const toggleNoteMode = useGameStore((s) => s.toggleNoteMode);
  const clearGentleError = useGameStore((s) => s.clearGentleError);
  const undo = useGameStore((s) => s.undo);
  const setErrorMode = useGameStore((s) => s.setErrorMode);
  const requestHint = useGameStore((s) => s.requestHint);
  const applyHintFill = useGameStore((s) => s.applyHintFill);
  const dismissHint = useGameStore((s) => s.dismissHint);
  const abandonGame = useGameStore((s) => s.abandonGame);

  useEffect(() => {
    if (!game && !restoreAttempted) restoreGame();
  }, [game, restoreAttempted, restoreGame]);

  useEffect(() => {
    if (restoreAttempted && !game) navigate("/", { replace: true });
  }, [restoreAttempted, game, navigate]);

  // §11 gentle: auto-clear the ephemeral wrong-input message after ~1.5s.
  useEffect(() => {
    if (!gentleError) return;
    const id = window.setTimeout(() => clearGentleError(), 1500);
    return () => window.clearTimeout(id);
  }, [gentleError, clearGentleError]);

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
        <div className="done" data-testid="done">
          <div className="cat" aria-hidden="true">🐱</div>
          <h2>完成啦！</h2>
          {completedElapsedMs != null && (
            <p className="done-time" data-testid="done-time">
              这一局用了 {formatElapsed(completedElapsedMs)}
            </p>
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              abandonGame();
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
  const hintCells = hint && hint.available ? hint.focusCells : [];

  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")}>← 首页</button>
        <span className="diff-tag">{DIFF_NAME[game.difficulty]}</span>
        <div className="mode-switch" role="group" aria-label="错误模式">
          <button
            type="button"
            className={`mode-opt${errorMode === "gentle" ? " active" : ""}`}
            aria-pressed={errorMode === "gentle"}
            data-testid="mode-gentle"
            onClick={() => setErrorMode("gentle")}
          >
            温柔
          </button>
          <button
            type="button"
            className={`mode-opt${errorMode === "unchecked" ? " active" : ""}`}
            aria-pressed={errorMode === "unchecked"}
            data-testid="mode-unchecked"
            onClick={() => setErrorMode("unchecked")}
          >
            不检查
          </button>
        </div>
      </div>

      {game.noteMode && (
        <p className="note-banner" data-testid="note-banner">✎ 笔记模式：点数字记候选</p>
      )}

      <SudokuBoard
        board={game.board}
        selectedCell={selected}
        showConflicts={errorMode === "unchecked"}
        hintCells={hintCells}
        onSelectCell={(index) => selectCell(index)}
      />

      {gentleError && (
        <p className="gentle-toast" role="alert" data-testid="gentle-toast">
          好像不是这个数字哦。
        </p>
      )}

      {hint && (
        <HintPanel
          hint={hint}
          onMore={() => requestHint(2)}
          onReveal={() => requestHint(3)}
          onApplyFill={applyHintFill}
          onDismiss={dismissHint}
        />
      )}

      <Toolbar
        noteMode={game.noteMode}
        canUndo={game.undoStack.length > 0}
        disabledDelete={selected == null || game.board[selected]?.given === true}
        onDelete={clearSelectedCell}
        onUndo={undo}
        onToggleNote={toggleNoteMode}
        onHint={() => requestHint(1)}
      />

      <NumberPad
        disabled={selected == null || game.board[selected]?.given === true}
        noteMode={game.noteMode}
        onDigit={(d) => enterDigit(d)}
      />
    </main>
  );
}
