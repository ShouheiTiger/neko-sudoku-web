import { useNavigate } from "react-router-dom";

// M3 §27 /help. Short, gentle rules — NOT a knowledge base. Emphasises no ranking/score.
export function HelpPage() {
  const navigate = useNavigate();
  return (
    <main className="app-shell">
      <div className="game-top">
        <button className="link-btn" onClick={() => navigate("/")} aria-label="返回首页">
          ← 返回
        </button>
        <span className="diff-tag">帮助</span>
        <span style={{ width: 44 }} />
      </div>

      <section className="help-section">
        <h2 className="settings-title">数独规则</h2>
        <p>每一行、每一列、每个 3×3 小方块，都要有 1～9，而且不能重复。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">怎么填数字</h2>
        <p>先点一个空格，再点下面键盘上的数字。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">怎么记笔记</h2>
        <p>点工具栏的「✎ 笔记」进入笔记模式，再点数字，就能在格子里记下候选。再点一次可以取消。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">怎么撤销</h2>
        <p>点工具栏的「↶ 撤销」，可以回到上一步。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">怎么用提示</h2>
        <p>点「💡 提示」，猫咪会陪你一起看看这一步。提示分三层，越往后讲得越清楚，最后也可以直接帮你填上。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">两种错误检查</h2>
        <p>「温柔提示」会在填错时轻声提醒，不计错、不结束游戏；「不检查」则允许你先随意尝试。</p>
      </section>

      <section className="help-section">
        <h2 className="settings-title">关于成绩</h2>
        <p>这里没有分数、没有排名、也不和别人比较。慢慢想，也很好。</p>
      </section>
    </main>
  );
}
