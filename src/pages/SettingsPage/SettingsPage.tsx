import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../../stores/settingsStore.js";

// M3 §13/§14 /settings. Reuses M2 errorMode (gentle/unchecked) — no second settings storage.
// Large Text applies instantly (§33). Non-color state signal: active option shows "已选" text
// + aria-pressed, not color alone (§17).
export function SettingsPage() {
  const navigate = useNavigate();
  const errorMode = useSettingsStore((s) => s.errorMode);
  const largeText = useSettingsStore((s) => s.largeText);
  const setErrorMode = useSettingsStore((s) => s.setErrorMode);
  const setLargeText = useSettingsStore((s) => s.setLargeText);

  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")} aria-label="返回首页">
          ← 返回
        </button>
        <span className="diff-tag">设置</span>
        <span style={{ width: 44 }} />
      </div>

      <section className="settings-group" aria-labelledby="set-large">
        <h2 id="set-large" className="settings-title">大字模式</h2>
        <p className="settings-hint">看得更清楚一些。</p>
        <button
          type="button"
          role="switch"
          aria-checked={largeText}
          className={`toggle-row${largeText ? " on" : ""}`}
          data-testid="toggle-large-text"
          onClick={() => setLargeText(!largeText)}
        >
          <span>大字模式</span>
          <span className="toggle-state" data-testid="large-text-state">
            {largeText ? "已开启" : "已关闭"}
          </span>
        </button>
      </section>

      <section className="settings-group" aria-labelledby="set-error">
        <h2 id="set-error" className="settings-title">错误检查方式</h2>
        <p className="settings-hint">随时可以更改，不影响成绩——这里也没有成绩。</p>
        <div className="mode-switch mode-switch-block" role="group" aria-label="错误检查方式">
          <button
            type="button"
            className={`mode-opt${errorMode === "gentle" ? " active" : ""}`}
            aria-pressed={errorMode === "gentle"}
            data-testid="set-mode-gentle"
            onClick={() => setErrorMode("gentle")}
          >
            温柔提示{errorMode === "gentle" ? "（已选）" : ""}
          </button>
          <button
            type="button"
            className={`mode-opt${errorMode === "unchecked" ? " active" : ""}`}
            aria-pressed={errorMode === "unchecked"}
            data-testid="set-mode-unchecked"
            onClick={() => setErrorMode("unchecked")}
          >
            不检查{errorMode === "unchecked" ? "（已选）" : ""}
          </button>
        </div>
      </section>

      <div className="settings-links">
        <button className="btn" onClick={() => navigate("/tutorial")}>怎么玩</button>
        <button className="btn" onClick={() => navigate("/help")}>帮助</button>
      </div>
    </main>
  );
}
