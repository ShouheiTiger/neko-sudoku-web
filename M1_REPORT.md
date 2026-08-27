# Neko Sudoku — M1 Mobile Web Shell & Core Game Loop — Report

## A. 基础信息
```text
base commit SHA   : e42787fb83d6b32a9ca9256e181fbc8467390822   (M0 CLOSED)
final commit SHA  : 023e5812fe7e618e5c7ff0c32d535e73ade9d8a3
branch            : feature/m1-web-shell
```
唯一需求基准：Neko Sudoku V1 Frozen PRD & Technical Specification v2.0 + M1 开发指令。
M0 Core 未被修改（见 F 节）。

## B. 实际修改文件

### 新增（Web 层，全部叠加，不移动 M0 文件）
- `index.html` — Vite 入口，viewport-fit=cover。
- `src/main.tsx` — React 挂载。
- `src/app/App.tsx` — RouterProvider + §21 生命周期兜底保存（visibilitychange→hidden / pagehide）。
- `src/app/router.tsx` — §6 路由 `/` `/new` `/play` + 未知路径回首页。
- `src/app/styles.css` — §28 奶油猫 CSS 变量、9×9 棋盘、NumberPad、320px 基线。
- `src/data/dev-puzzles.ts` — §10 开发题池（L1–L4 各 3 题，共 12）。离线生成、经 M0 validator+solver 验证。
- `src/storage/schemas.ts` — §20/§22 Zod schema：cell/board/difficulty/ActiveGame/envelope；SCHEMA_VERSION=1。
- `src/storage/gameStorage.ts` — §20–§23 save/restore/clear，损坏缓存处理（parse→zod→schemaVersion→puzzleId）。
- `src/stores/gameStore.ts` — §12 Zustand：startNewGame/restoreGame/selectCell/enterDigit/clearSelectedCell/abandonGame。
- `src/stores/settingsStore.ts` — 占位（M1 无用户设置），不实现未来功能。
- `src/components/SudokuBoard/SudokuBoard.tsx` + `SudokuCell.tsx` — §13/§14/§67 棋盘与格子（peer 高亮来自 M0 `getPeers`）。
- `src/components/NumberPad/NumberPad.tsx` — §15/§16/§17 格子优先输入 + 删除，触控 ≥44px。
- `src/pages/HomePage/HomePage.tsx` — §8 首页（有/无 active game 两态）。
- `src/pages/DifficultyPage/DifficultyPage.tsx` — §9 仅 L1–L4；§24 换局确认。
- `src/pages/GamePage/GamePage.tsx` — §7 /play 恢复/重定向；§25 完成态（清 activeGame）。
- 测试：`tests/setup.ts`、`tests/gameStore.test.ts`、`tests/gameStorage.test.ts`、`tests/integration.test.ts`、`tests/puzzle-pool.test.ts`、`tests/DifficultyPage.test.tsx`。
- E2E：`playwright.config.ts`、`e2e/core-loop.spec.ts`。

### 修改（仅配置，未触碰 M0 逻辑源码）
- `package.json` — 加 React/Vite/Router/Zustand/Zod/Playwright 依赖与 dev/build/preview/e2e 脚本。
- `tsconfig.json` — 加 DOM lib、`jsx: react-jsx`、`resolveJsonModule`、`node` types。
- `vitest.config.ts` — jsdom 环境 + react 插件 + setup；排除 `e2e/`。
- `vite.config.mjs` — react 插件 + 沙箱注入的 host 允许项（构建/预览用）。
- `.gitignore` — 加 dist/test-results/playwright-report。
- `package-lock.json` — 依赖锁。

M0 源码文件（`src/candidate-engine.ts`、`src/game-engine.ts`、`src/human-solver/**`、`src/hint-engine/**`、`src/difficulty/**`、`src/tools/**`、`src/board.ts`、`src/grid.ts`、`src/types.ts`、`src/index.ts`）与全部 M0 测试 **零改动**。

## C. 架构

```text
React Router (/ , /new , /play)
        │  用户操作
        ▼
Zustand gameStore  ──调用──▶  M0 Domain Core（冻结）
   │  (startNewGame/enterDigit/…)     setValue / clearValue / isCompleted
   │                                   parsePuzzle / findConflicts / getPeers
   │  每次 set/clear/start 后
   ▼
storage/gameStorage (localStorage: nekoSudoku.activeGame)
```
- 所有数独规则只经 M0 Core；React 组件与 Store **不**自行计算 candidates / row / col / box / solution（§12/§29）。棋盘 peer 高亮来自 `getPeers`。
- `/play` 的 source of truth 是 store，store 由 localStorage 水合；URL 不存棋盘（§7）。

## D. localStorage

- **schema**：`StoredEnvelope = { schemaVersion:1, savedAt:number, data: ActiveGame }`，`ActiveGame` 含 schemaVersion/gameId/puzzleId/difficulty/board/selectedCell/createdAt/updatedAt/engineVersion（§11/§20）。Key = `nekoSudoku.activeGame`。
- **save path**：`saveActiveGame` → 包 envelope → `JSON.stringify` → setItem。触发点：start / set value / clear value（§21）；并在 `visibilitychange→hidden` 与 `pagehide` 兜底保存（不只用 beforeunload）。
- **restore path**：getItem → `JSON.parse` → **Zod 校验** → schemaVersion 检查 → puzzleId 存在性检查（§22）。绝不 `JSON.parse(...) as ActiveGame`。
- **corrupted state**：JSON 损坏 / schema 非法 / schemaVersion 不符 / 结构非法 board / 未知 puzzleId → `console.warn` 诊断 + 丢弃该条 + 返回 null → `/play` 重定向首页，不白屏（§23）。

## E. 测试（实际输出）

```text
tsc      : npx tsc --noEmit → 0 errors
vitest   : 12 files, 72 passed (M0 39 + M1 33)   ← M0 39 全部仍通过
build    : vite build → 成功（72 modules, dist/index.html + css + js）
E2E      : playwright test → 6 passed
           [iphone-se 320×568] & [iphone-12 390×844] 各 3：
             ① start→选难度→/play→点空格→输入→刷新后数字仍在
             ② /play 无 activeGame → 自动回 /
             ③ 无横向滚动（scrollWidth ≤ clientWidth）
```

## F. Frozen Spec 偏差

M0 Core：No deviations（未修改）。

M1 有一处需明确记录的**实现判定**（非产品定义变更）：
- **损坏缓存判定不含“用户对局中的冲突”**：M1 指令 §23 列出“Board 非法”为丢弃条件。落地时区分两类：
  - *结构非法*（非 81 格 / 值越界 / schema 错）→ 由 Zod 拦截并丢弃（符合 §22/§23）。
  - *用户对局中的行/列/宫重复*（“不检查错误”模式下的正常中间态，Frozen Spec §37.2）→ **不丢弃**，必须可恢复（Frozen Spec §2.5“永远可恢复”）。
  若把用户冲突当作“非法 board”丢弃，会导致刷新丢局，违反 §2.5，故取最保守/最不破坏用户数据的解释。已在 `gameStorage.ts` 注释与两条测试中固化说明。

其余均无偏差。

## G. 未完成（M1 之外，属后续 milestone，本阶段刻意不做）
Notes、Undo、Hint UI、正式 Timer（含 activeStartedAt/accumulatedActiveMs）、猫咪动画、大字模式、Tutorial、History、Daily、日历、PWA、账号、云同步、主题、声音、震动、排行榜、分数、L5/L6、正式 1200 题题库。首页/游戏页仅用 `🐱` 占位符。

## H. Gate

M1 自检对照（§34）：Build ✅ / Routing ✅ / Game ✅ / Persistence ✅ / Mobile ✅（320 & 390 E2E 通过、主要按钮 ≥44px）/ Scope ✅（无 Notes/Undo/Hint/Timer/猫咪动画/PWA/L5-L6；M0 Core 未改）。

```text
M1_GATE_SELF_CHECK = PASS
```
