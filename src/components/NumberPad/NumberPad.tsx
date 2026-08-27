export type NumberPadProps = {
  onDigit: (digit: number) => void;
  onClear: () => void;
  disabled?: boolean;
};

// Cell-first input only (§15): the pad enters a digit into the currently selected cell.
// No number-first / repeat-fill. Delete lives next to the pad (§17, §19).
// All keys meet the 44x44 touch target (§16) via .pad-key CSS.
export function NumberPad({ onDigit, onClear, disabled }: NumberPadProps) {
  return (
    <div className="pad" role="group" aria-label="数字键盘">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <button
          key={d}
          type="button"
          className="pad-key"
          disabled={disabled}
          aria-label={`填入 ${d}`}
          data-testid={`pad-${d}`}
          onClick={() => onDigit(d)}
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        className="pad-key del"
        disabled={disabled}
        aria-label="删除"
        data-testid="pad-del"
        onClick={onClear}
      >
        删除
      </button>
    </div>
  );
}
