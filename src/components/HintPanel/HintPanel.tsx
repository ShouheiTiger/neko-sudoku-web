import type { HintView } from "../../lib/hintService.js";

export type HintPanelProps = {
  hint: HintView;
  onMore: () => void; // request the next layer
  onReveal: () => void; // request layer 3 directly
  onApplyFill: () => void; // §20 fill the placement
  onDismiss: () => void;
};

// M2 §18-§21 layered hint panel. Layer 1 guides attention; layer 2 explains the real
// logic; layer 3 offers "告诉我答案" and (for placement / resolved elimination) a fill.
export function HintPanel({ hint, onMore, onReveal, onApplyFill, onDismiss }: HintPanelProps) {
  if (!hint.available) {
    const msg = hint.reason === "solved" ? "已经完成啦，不需要提示～" : "现在这一步有点难，先随便试试也没关系。";
    return (
      <div className="hint-panel" role="status" data-testid="hint-panel">
        <p className="hint-msg">{msg}</p>
        <div className="hint-actions">
          <button type="button" className="btn btn-ghost" onClick={onDismiss}>知道了</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hint-panel" role="status" data-testid="hint-panel">
      <p className="hint-layer" data-testid="hint-layer">提示 {hint.layer}/3</p>
      <p className="hint-msg" data-testid="hint-msg">{hint.message}</p>
      <div className="hint-actions">
        {hint.layer < 2 && (
          <button type="button" className="btn btn-ghost" data-testid="hint-more" onClick={onMore}>
            再讲清楚一点
          </button>
        )}
        {hint.layer < 3 && (
          <button type="button" className="btn btn-ghost" data-testid="hint-reveal" onClick={onReveal}>
            告诉我答案
          </button>
        )}
        {hint.layer === 3 && hint.fill && (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="hint-fill"
            onClick={onApplyFill}
          >
            帮我填上
          </button>
        )}
        <button type="button" className="btn btn-ghost" data-testid="hint-dismiss" onClick={onDismiss}>
          收起
        </button>
      </div>
    </div>
  );
}
