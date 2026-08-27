export type NumberPadProps = {
  onDigit: (digit: number) => void;
  disabled?: boolean;
  /** When true, tapping a digit toggles a note (§6); style keys to signal note mode. */
  noteMode?: boolean;
};

// Cell-first input only (§15): the pad enters a digit into the currently selected cell.
// No number-first / repeat-fill (Scope: 连续数字输入 forbidden). Delete/Undo/Note/Hint live
// in the toolbar (§23). All keys meet the 44x44 touch target (§23) via .pad-key CSS.
export function NumberPad({ onDigit, disabled, noteMode }: NumberPadProps) {
  return (
    <div
      className={`pad${noteMode ? " pad-note" : ""}`}
      role="group"
      aria-label={noteMode ? "数字键盘（笔记模式）" : "数字键盘"}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <button
          key={d}
          type="button"
          className="pad-key"
          disabled={disabled}
          aria-label={noteMode ? `候选 ${d}` : `填入 ${d}`}
          data-testid={`pad-${d}`}
          onClick={() => onDigit(d)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
