import { useNavigate } from "react-router-dom";
import { APP_VERSION, PUZZLE_BANK_VERSION } from "../../lib/release.js";

// M3 §27 /help. Short, gentle rules — NOT a knowledge base. Emphasises no ranking/score.
// Copy describes the real, verified behaviour of the in-game controls (delete / undo /
// notes / hint) and the two error-reminder modes; it never promises behaviour the code
// does not implement. Presentation only — no product logic here.
export function HelpPage() {
  const navigate = useNavigate();
  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")} aria-label="返回首页">
          ← 返回
        </button>
        <span className="diff-tag">怎么玩</span>
        <span style={{ width: 44 }} />
      </div>

      <section className="tutorial-cta" aria-labelledby="tutorial-cta-title">
        <p className="tutorial-cta-title" id="tutorial-cta-title">
          <span aria-hidden="true">🐱 </span>第一次玩数独？
        </p>
        <p className="tutorial-cta-sub">跟着猫咪一步一步学，很快就会。</p>
        <button
          type="button"
          className="btn btn-soft"
          data-testid="start-tutorial"
          onClick={() => navigate("/tutorial")}
        >
          开始新手教程
        </button>
      </section>

      <section className="help-section">
        <h2 className="settings-title">数独规则</h2>
        <p>每一行、每一列、每个 3×3 小方块，都要有 1～9，而且不能重复。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">怎么填数字</h2>
        <p>先点一个空格，再点下面键盘上的数字。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">游戏中的按钮</h2>

        <h3 className="help-item-title">删除</h3>
        <p>清除当前格里你填写的数字。题目原本给出的数字不会被删除。</p>

        <h3 className="help-item-title">撤销</h3>
        <p>回到上一步操作。填错、删错，或者改了笔记，都可以一步步撤销。</p>

        <h3 className="help-item-title">笔记</h3>
        <p>还不确定答案时，可以先把可能的数字记在格子里，方便慢慢排除。先点「✎ 笔记」，再点数字就会记下候选；再点一次同一个数字，可以取消这条笔记。</p>

        <h3 className="help-item-title">提示</h3>
        <p>卡住时可以点「💡 提示」请猫咪帮忙。它会分三层，一层比一层讲得清楚：</p>
        <p>第一次：先告诉你可以看哪里。</p>
        <p>第二次：再解释为什么可以这样判断。</p>
        <p>最后：如果还是想不出来，会告诉你这一步怎么填，也可以直接帮你填上。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">错误提醒</h2>

        <h3 className="help-item-title">温柔提醒</h3>
        <p>填错时会轻轻提醒你，不记录错误次数，也不会结束游戏。</p>

        <h3 className="help-item-title">自己检查</h3>
        <p>输入后不判断答案对不对，像在纸上做数独一样，由你自己检查和修改。如果同一行、同一列或同一个小方块里出现重复的数字，还是会标出规则冲突。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">关于成绩</h2>
        <p>这里没有分数、没有排名、也不和别人比较。</p>
        <p>不用赶时间，也不用怕填错。慢慢想，也很好。</p>
      </section>

      <p className="release-meta" data-testid="release-meta">
        版本 {APP_VERSION} · 题库 {PUZZLE_BANK_VERSION}
      </p>
    </main>
  );
}
