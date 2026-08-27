export type ToolbarProps = {
  noteMode: boolean;
  canUndo: boolean;
  disabledDelete: boolean;
  onDelete: () => void;
  onUndo: () => void;
  onToggleNote: () => void;
  onHint: () => void;
};

// M2 §23 toolbar: icon + short label (never icon-only). Four actions, each ≥44px.
export function Toolbar({
  noteMode,
  canUndo,
  disabledDelete,
  onDelete,
  onUndo,
  onToggleNote,
  onHint,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="group" aria-label="工具栏">
      <button
        type="button"
        className="tool-btn"
        disabled={disabledDelete}
        data-testid="tool-delete"
        onClick={onDelete}
      >
        <span className="tool-icon" aria-hidden="true">⌫</span>
        <span className="tool-label">删除</span>
      </button>

      <button
        type="button"
        className="tool-btn"
        disabled={!canUndo}
        data-testid="tool-undo"
        onClick={onUndo}
      >
        <span className="tool-icon" aria-hidden="true">↶</span>
        <span className="tool-label">撤销</span>
      </button>

      <button
        type="button"
        className={`tool-btn${noteMode ? " active" : ""}`}
        aria-pressed={noteMode}
        data-testid="tool-note"
        onClick={onToggleNote}
      >
        <span className="tool-icon" aria-hidden="true">✎</span>
        <span className="tool-label">笔记{noteMode ? "·开" : ""}</span>
      </button>

      <button
        type="button"
        className="tool-btn"
        data-testid="tool-hint"
        onClick={onHint}
      >
        <span className="tool-icon" aria-hidden="true">💡</span>
        <span className="tool-label">提示</span>
      </button>
    </div>
  );
}
