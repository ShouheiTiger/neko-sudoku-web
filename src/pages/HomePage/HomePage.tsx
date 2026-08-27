import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadActiveGame } from "../../storage/gameStorage.js";

// §8 Home. Shows "继续上一局 / 新游戏" when an active game exists, else "开始一局".
export function HomePage() {
  const navigate = useNavigate();
  const [hasActive, setHasActive] = useState<boolean | null>(null);

  useEffect(() => {
    // Read-only check; loadActiveGame validates + drops corrupted entries (§22/§23).
    setHasActive(loadActiveGame() != null);
  }, []);

  if (hasActive == null) {
    return (
      <main className="app-shell">
        <div className="spacer" />
      </main>
    );
  }

  return (
    <main className="app-shell home">
      <div className="spacer" />
      <div className="cat-companion cat-large">
        <div className="cat-art" aria-hidden="true">🐱</div>
      </div>
      <p className="cat-line">
        {hasActive ? "上次那一局还在等你哦。" : "今天也慢慢来吧。"}
      </p>
      {hasActive ? (
        <>
          <button className="btn btn-primary" onClick={() => navigate("/play")}>
            继续上一局
          </button>
          <button className="btn" onClick={() => navigate("/new")}>
            新游戏
          </button>
        </>
      ) : (
        <button className="btn btn-primary" onClick={() => navigate("/new")}>
          开始一局
        </button>
      )}
      <nav className="home-nav" aria-label="更多">
        <button className="link-btn" onClick={() => navigate("/history")}>历史</button>
        <button className="link-btn" onClick={() => navigate("/settings")}>设置</button>
        <button className="link-btn" onClick={() => navigate("/tutorial")}>怎么玩</button>
      </nav>
      <div className="spacer" />
    </main>
  );
}
