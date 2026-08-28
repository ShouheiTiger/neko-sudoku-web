import { useState } from "react";
import type { CatState, Difficulty } from "../../lib/cat.js";
import { catCopy, catAsset, catEmoji } from "../../lib/cat.js";

export type CatProps = {
  state: CatState;
  difficulty: Difficulty;
  /** Optional variety seed (NOT performance-derived, §30). */
  seed?: number;
  /** Larger presentation for the completion page. */
  size?: "normal" | "large";
};

// M3 Cat companion presentation (§11/§12/§19). V1 Cat Asset Integration: the art is now a final
// 512×512 transparent WebP per state (local, same-origin). It is DECORATIVE → alt="" +
// aria-hidden; the companion copy remains the screen-reader information channel. Fixed-height
// container so state changes never shift the board/toolbar/pad (§12). Animation is CSS-only and
// honours reduced-motion. If an image fails to load we fall back to the emoji glyph (§45) so the
// companion never disappears — the state machine / copy are untouched.
export function Cat({ state, difficulty, seed = 0, size = "normal" }: CatProps) {
  const copy = catCopy(state, difficulty, seed);
  const [broken, setBroken] = useState(false);
  return (
    <div className={`cat-companion cat-${size}`} data-cat-state={state} data-testid="cat">
      <div className={`cat-art cat-anim-${state}`} aria-hidden="true" data-testid="cat-art">
        {broken ? (
          <span className="cat-art-fallback">{catEmoji(state)}</span>
        ) : (
          <img
            className="cat-art-img"
            src={catAsset(state)}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
            data-testid="cat-art-img"
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <p className="cat-copy" data-testid="cat-copy">
        {copy}
      </p>
    </div>
  );
}
