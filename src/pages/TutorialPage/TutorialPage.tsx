import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../../stores/settingsStore.js";

// M3 §25/§26 /tutorial. 3 static rule screens + 1 fixed interaction (answer = 5). Skippable.
// MUST NOT: create activeGame / history / start any gameplay timer / call the Hint Engine.
// It only reads/writes tutorialSeen via settings.

const RULE_SCREENS = [
  "每一行都要有 1～9，而且不能重复。",
  "每一列也是一样。",
  "每个 3×3 小方块也要有 1～9。",
];

const PRACTICE = [1, 2, 3, 4, null, 6, 7, 8, 9] as const; // missing 5

export function TutorialPage() {
  const navigate = useNavigate();
  const markTutorialSeen = useSettingsStore((s) => s.markTutorialSeen);
  // step 0..2 = rule screens, 3 = interaction, 4 = done
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  const finish = () => {
    markTutorialSeen();
    navigate("/", { replace: true });
  };

  const pick = (n: number) => {
    if (n === 5) {
      setWrong(null);
      setSolved(true);
      setStep(4);
    } else {
      setWrong(n);
    }
  };

  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")} aria-label="返回首页">
          ← 返回
        </button>
        <span className="diff-tag">怎么玩</span>
        <button className="link-btn" data-testid="tutorial-skip" onClick={finish}>
          跳过
        </button>
      </div>

      {step <= 2 && (
        <div className="tutorial-screen" data-testid={`tutorial-rule-${step}`}>
          <div className="cat-companion cat-large">
            <div className="cat-art" aria-hidden="true">🐱</div>
          </div>
          <p className="tutorial-text">{RULE_SCREENS[step]}</p>
          <div className="tutorial-dots" aria-hidden="true">
            {RULE_SCREENS.map((_, i) => (
              <span key={i} className={`dot${i === step ? " on" : ""}`} />
            ))}
          </div>
          <button
            className="btn btn-primary"
            data-testid="tutorial-next"
            onClick={() => setStep(step + 1)}
          >
            下一步
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="tutorial-screen" data-testid="tutorial-interaction">
          <p className="tutorial-text">这里缺哪个数字？</p>
          <div className="tutorial-row" role="group" aria-label="练习一行">
            {PRACTICE.map((v, i) => (
              <span key={i} className={`t-cell${v == null ? " blank" : ""}`}>
                {v ?? "＿"}
              </span>
            ))}
          </div>
          <div className="pad tutorial-pad" role="group" aria-label="选择数字">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                className="pad-key"
                data-testid={`tutorial-pick-${n}`}
                onClick={() => pick(n)}
              >
                {n}
              </button>
            ))}
          </div>
          {wrong != null && (
            <p className="gentle-toast" role="alert" data-testid="tutorial-wrong">
              再看看，这一行还缺哪个呢？
            </p>
          )}
        </div>
      )}

      {step === 4 && solved && (
        <div className="tutorial-screen" data-testid="tutorial-done">
          <div className="cat-companion cat-large">
            <div className="cat-art" aria-hidden="true">😺</div>
          </div>
          <p className="tutorial-text">就是这样，5 正好补齐了这一行。</p>
          <button className="btn btn-primary" data-testid="tutorial-finish" onClick={finish}>
            开始玩吧
          </button>
        </div>
      )}
    </main>
  );
}
