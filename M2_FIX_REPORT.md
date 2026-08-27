# M2_FIX_REPORT.md — Neko Sudoku M2 定点修复（PASS_WITH_FIXES → 复核）

> 依据：`M2_CLAUDE_GATE_REVIEW.md`（`M2_GATE = PASS_WITH_FIXES`）
> 本轮仅修复 3 个 Medium，未重构 M2、未改 M0 Core、未改 gentle/elimination 方案、未扩 scope、未进入 M3。

## Git

| 项 | 值 |
|---|---|
| repo | https://github.com/ShouheiTiger/neko-sudoku-web |
| branch | `feature/m2-gameplay-assistance` |
| base commit SHA（本轮修复前 = Gate 审核 commit） | `ea7eb088077bf365c80bcb7dd2d8fe36a61e8759` |
| fix commit SHA | `__FIX_SHA__` |
| final branch tip（含本报告 SHA 修订） | 见 push 输出 |

`git diff --name-status ea7eb088...HEAD` 仅涉及 Web/App/Test 文件（见下）。M0 Core `git diff --stat` 为空。

## 三项 Medium 修复

### FIX-1 — Completed activeGame cleanup（Gate Medium-1）
**问题**：完成后的对局仍留在 `localStorage.nekoSudoku.activeGame`，Home 因 `loadActiveGame() != null` 误显示「继续上一局」。
**修复（根因，非表面隐藏）**：让 persistent `activeGame` 的语义严格保持「未完成的 active game」。
- `src/stores/gameStore.ts` `commit()`：当 `statusFor(board) === "completed"` 时调用 `clearActiveGame()`（不再 `saveActiveGame`）。内存 Store 仍保留 `game` 与 `completedElapsedMs`，供完成页显示 🐱 + 用时。
- `persistCurrentGame()`（visibilitychange / pagehide 兜底）：加 `status !== "completed"` 守卫，完成后的对局不会被生命周期事件再次写回 `activeGame`。
- `pauseForHidden` / `resumeFromVisible` 原本已在 completed 时 early-return，保持不变。
- HomePage **未改**：它继续读 `loadActiveGame()`，因持久层已清理而自然不显示「继续上一局」。

### FIX-2 — Timer restore 遵循 visibilityState（Gate Medium-2）
**问题**：`restoreGame()` 无条件 `resumeTimer`，当 JS 上下文在隐藏标签页中重启时，会把后台时间计入 active elapsed（实测 ~1.2s 被误计）。
**修复（小 helper，未重构 Timer）**：
- 新增可注入的可见性读取 `visibilityFn`（默认读 `document.visibilityState`；`document` 不可用时按 `visible` 处理），并提供 `__setVisibilityForTests` / `__resetVisibilityForTests` 供确定性测试。
- 新增 `resumeTimerForRestore(t, at)`：先 `pauseTimer`（对已暂停幂等，杜绝二次累计），再判断——`hidden` 则**保持 paused**、不设 `activeStartedAt`；`visible` 才 `resumeTimer`。
- `restoreGame()` 改为使用该 helper。
- 未使用 `setInterval`。前台刷新 / 正常后台切换 / hidden→visible / visible→visible 均无回归。

### FIX-3 — Conflict 非颜色信号（Gate Medium-3）
**问题**：unchecked 模式冲突格仅靠文字色/背景色区分，违反 Frozen PRD §38「颜色不能是唯一错误提示」。
**修复**：
- `src/components/SudokuBoard/SudokuCell.tsx`：冲突格渲染一个轻量角标 `!`（`.conflict-mark`，`data-testid="conflict-{index}"`，`aria-hidden` 避免与 aria-label 重复读）；`ariaLabel()` 增参 `conflict`，冲突时追加「，冲突」，屏幕阅读器可感知。数字改用独立 `<span class="cell-value" data-testid="value-{index}">` 包裹，保证角标不与数字文本混读、数字仍清晰可读。
- `src/app/styles.css`：`.conflict-mark` 绝对定位于左上角、9px、`pointer-events:none`，温柔视觉（非大红叉/Game Over），不遮挡居中数字或 3×3 笔记；320×568 无溢出。

## 修改文件

| 文件 | 说明 |
|---|---|
| `src/stores/gameStore.ts` | FIX-1（commit/persistCurrentGame 守卫）+ FIX-2（visibility helper、resumeTimerForRestore、restoreGame） |
| `src/components/SudokuBoard/SudokuCell.tsx` | FIX-3（`!` 角标、aria-label 冲突、value span） |
| `src/app/styles.css` | FIX-3（`.conflict-mark` 样式） |
| `e2e/core-loop.spec.ts` | 断言改用 `value-{i}`（避免角标文本干扰），行为不变 |
| `e2e/m2-features.spec.ts` | undo 断言改用 `value-{i}`；新增 FIX-1 / FIX-3 E2E |

## 新增测试

- `tests/m2-fixes.test.ts`（8 用例）
  - FIX-1：completion → `loadActiveGame()` 为 null；completion → 内存 game/elapsed 保留；completion → `persistCurrentGame()` 不复活 activeGame；未完成对局仍正常持久化。
  - FIX-2（fake clock + 注入可见性）：hidden reload 保持 paused、后台时间不计、hidden→hidden 不二次累计；visible restore 正常 resume；hidden 恢复后转 visible 不计隐藏间隙；visible→visible 不 double resume。
- `tests/SudokuCell.test.tsx`（4 用例）：冲突格有 `!` 非颜色 marker；aria-label 含「冲突」；非冲突格无 marker 且 aria-label 不含冲突；marker 与数字共存（数字仍渲染）。
- `e2e/m2-features.spec.ts` 新增：FIX-1（completion 清 activeGame + Home 无「继续上一局」）、FIX-3（`!` marker + aria-label 冲突 + 数字可读 + 无横向溢出），均在 320×568 / 390×844 两视口运行。

## 验证结果

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | **0 错误** |
| `npm test`（vitest） | **118 passed**（原 106 全保留通过 + 新增 12） |
| `npm run build` | **成功**；JS gzip **89.95 KB**（< 200KB） |
| `npx playwright test` | **22 passed**（原 18 全保留通过 + 新增 4；2 viewport） |
| `git diff --name-status ea7eb088...HEAD` | 仅 Web/App/Test 文件；M0 Core 零改动 |
| `git status --short`（交付前） | 干净 |

## 必须保持不变（已核对未改动）

gentle wrong-input 不写 board 的实现、Notes、Undo 架构、M1→M2 migration、Hint L1/L2、Hint L3 placement、Elimination Hint 3 adapter、userNotes/logicalCandidates 分离、M0 Core、Scope guardrails —— 全部未修改。

## Scope

未新增依赖，未触碰任何禁止列表功能；本轮仅为 3 个 Medium 的局部 Web/App/Test 修复。

---

M2_FIX_SELF_CHECK = PASS
