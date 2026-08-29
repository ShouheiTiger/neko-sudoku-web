import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../stores/gameStore.js";
import { SudokuBoard } from "../../components/SudokuBoard/SudokuBoard.js";
import { NumberPad } from "../../components/NumberPad/NumberPad.js";
import { Toolbar } from "../../components/Toolbar/Toolbar.js";
import { HintPanel } from "../../components/HintPanel/HintPanel.js";
import { Cat } from "../../components/Cat/Cat.js";
import { useCatCompanion } from "../../hooks/useCatCompanion.js";
import { formatElapsed } from "../../lib/timer.js";
import { DIFFICULTY_NAME } from "../../lib/difficulty.js";

// M3 /play. M2 gameplay unchanged; adds Cat companion, completion celebration, keyboard
// support. No live timer while playing (§14). Toolbar = 删除/撤销/笔记/提示 (§23).
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

  const cat = useCatCompanion(status === "completed" ? "completed" : "playing");

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

  const selected = game?.selectedCell ?? null;

  // §18 basic keyboard support. Reuses the SAME store actions as taps — no second input rule
  // set. Given cells stay non-editable (enterDigit/clearSelectedCell enforce it in Core).
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!game || status === "completed") return;
      // Don't hijack keys while a form control is focused (none here, but future-safe).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      if (e.key >= "1" && e.key <= "9") {
        if (selected != null) {
          enterDigit(Number(e.key));
          cat.noteActivity();
          e.preventDefault();
        }
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selected != null) {
          clearSelectedCell();
          cat.noteActivity();
          e.preventDefault();
        }
        return;
      }
      // Arrow keys move the selected cell (§18 optional). Wrap within the 9x9 grid.
      const move: Record<string, number> = {
        ArrowUp: -9,
        ArrowDown: 9,
        ArrowLeft: -1,
        ArrowRight: 1,
      };
      if (e.key in move) {
        const base = selected ?? 0;
        const next = Math.max(0, Math.min(80, base + move[e.key]!));
        selectCell(next);
        cat.noteActivity();
        e.preventDefault();
      }
    },
    [game, status, selected, enterDigit, clearSelectedCell, selectCell, cat],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

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
          <Cat state="celebrating" difficulty={game.difficulty} size="large" />
          <h2>完成啦！</h2>
          {completedElapsedMs != null && (
            <p className="done-time" data-testid="done-time">
              这一局用了 {formatElapsed(completedElapsedMs)}。
            </p>
          )}
          <p className="done-sub">慢慢想，也很好。</p>
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

  const hintCells = hint && hint.available ? hint.focusCells : [];

  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")} aria-label="返回首页">
          ← 首页
        </button>
        <span className="diff-tag">{DIFFICULTY_NAME[game.difficulty]}</span>
        <div className="mode-switch" role="group" aria-label="错误提醒">
          <button
            type="button"
            className={`mode-opt${errorMode === "gentle" ? " active" : ""}`}
            aria-pressed={errorMode === "gentle"}
            aria-label="温柔提醒：填错时轻轻提醒，不记录错误次数"
            data-testid="mode-gentle"
            onClick={() => setErrorMode("gentle")}
          >
            温柔提醒{errorMode === "gentle" ? "\u00A0·" : ""}
          </button>
          <button
            type="button"
            className={`mode-opt${errorMode === "unchecked" ? " active" : ""}`}
            aria-pressed={errorMode === "unchecked"}
            aria-label="自己检查：输入后不判断对错，由你自己检查"
            data-testid="mode-unchecked"
            onClick={() => setErrorMode("unchecked")}
          >
            自己检查{errorMode === "unchecked" ? "\u00A0·" : ""}
          </button>
        </div>
      </div>

      {/* Fixed-space cat companion so state changes never shift the board (§12). */}
      <Cat state={cat.state} difficulty={game.difficulty} />

      {game.noteMode && (
        <p className="note-banner" data-testid="note-banner">✎ 笔记模式：点数字记候选</p>
      )}

      <SudokuBoard
        board={game.board}
        selectedCell={selected}
        showConflicts={errorMode === "unchecked"}
        hintCells={hintCells}
        onSelectCell={(index) => {
          selectCell(index);
          cat.noteActivity();
        }}
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
        onDelete={() => {
          clearSelectedCell();
          cat.noteActivity();
        }}
        onUndo={() => {
          undo();
          cat.noteActivity();
        }}
        onToggleNote={toggleNoteMode}
        onHint={() => {
          requestHint(1);
          cat.enterHinting();
        }}
      />

      <NumberPad
        disabled={selected == null || game.board[selected]?.given === true}
        noteMode={game.noteMode}
        onDigit={(d) => {
          enterDigit(d);
          cat.noteActivity();
        }}
      />
    </main>
  );
}
