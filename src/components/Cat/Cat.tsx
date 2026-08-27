import type { CatState, Difficulty } from "../../lib/cat.js";
import { catCopy, catEmoji } from "../../lib/cat.js";

export type CatProps = {
  state: CatState;
  difficulty: Difficulty;
  /** Optional variety seed (NOT performance-derived, §30). */
  seed?: number;
  /** Larger presentation for the completion page. */
  size?: "normal" | "large";
};

// M3 Cat companion presentation (§11/§12/§19). The emoji art is DECORATIVE → aria-hidden.
// The companion copy stays screen-reader readable. Fixed-height container so state changes
// never shift the board/toolbar/pad (§12). Animation is CSS-only and honours reduced-motion.
export function Cat({ state, difficulty, seed = 0, size = "normal" }: CatProps) {
  const copy = catCopy(state, difficulty, seed);
  return (
    <div className={`cat-companion cat-${size}`} data-cat-state={state} data-testid="cat">
      <div className={`cat-art cat-anim-${state}`} aria-hidden="true" data-testid="cat-art">
        {catEmoji(state)}
      </div>
      <p className="cat-copy" data-testid="cat-copy">
        {copy}
      </p>
    </div>
  );
}
