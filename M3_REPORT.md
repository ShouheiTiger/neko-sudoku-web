# M3_REPORT.md — Neko Sudoku M3 (Companion, Accessibility & Product Experience)

> 唯一需求基准：`Neko Sudoku V1 Frozen PRD & Technical Specification v2.0`
> 阶段指令：`Neko_Sudoku_M3_AI_Agent_Development_Instructions.md`

## A. Git

| 项 | 值 |
|---|---|
| repo | https://github.com/ShouheiTiger/neko-sudoku-web |
| branch | `feature/m3-companion-accessibility` |
| base SHA（= Gate-PASS 的 M2 HEAD） | `b681917566aadf7ed2bf5248cae49e83616b777d` |
| final SHA | 见 push 输出的 `feature/m3-companion-accessibility` HEAD |

**M2→main fast-forward 结果**：先校验 `feature/m2-gameplay-assistance` = `b681917…`、`main` = `cd07d6d…`（M1）、main 是 m2 祖先且无额外提交 → `git merge --ff-only` 得 `cd07d6d..b681917`，main HEAD = `b681917…`，`git push origin main` 成功。随后从新 main 创建 `feature/m3-companion-accessibility`（base = `b681917…`）。无 rebase / 无 force push。

## B. 修改 / 新增文件

新增：
- `src/lib/cat.ts` — Cat 纯逻辑：5 状态 + 文案（仅按 state/difficulty，§6-§9/§30）
- `src/hooks/useCatCompanion.ts` — ephemeral Cat 状态机（thinking/hinting/sleeping 计时，§7/§31）
- `src/components/Cat/Cat.tsx` — Cat 展示（emoji aria-hidden，文案可读，固定高度，§11/§12/§19）
- `src/lib/difficulty.ts` — 共享 L1..L4 难度文案（§29）
- `src/lib/format.ts` — History 日期/用时格式化（§29）
- 页面：`src/pages/SettingsPage/SettingsPage.tsx`、`HistoryPage/HistoryPage.tsx`、`HelpPage/HelpPage.tsx`、`TutorialPage/TutorialPage.tsx`
- 测试：`tests/cat.test.ts`、`useCatCompanion.test.tsx`、`settings.test.ts`、`history.test.ts`、`completion-integration.test.ts`、`tutorial.test.tsx`、`e2e/m3-features.spec.ts`

修改：
- `src/storage/schemas.ts` — Settings v1→v2（+largeText,+tutorialSeen）、History schema（Zod）
- `src/storage/gameStorage.ts` — settings 迁移/默认；History `loadHistory/appendHistoryOnce/clearHistory`（gameId 去重、limit、损坏 fallback、写失败不抛）
- `src/stores/settingsStore.ts` — 全局 settings（largeText 即时生效、errorMode 委托 gameStore、tutorialSeen）
- `src/stores/gameStore.ts` — 完成流程接入 `appendHistoryOnce`（exactly-once）；`setErrorMode` 保留 M3 字段
- `src/app/App.tsx` — 挂载时 hydrate settings（大字提前生效）
- `src/app/router.tsx` — 新增 `/settings /history /help /tutorial`
- `src/pages/HomePage/HomePage.tsx` — 极简导航（历史/设置/怎么玩）+ Cat 容器
- `src/pages/GamePage/GamePage.tsx` — Cat 陪伴 + 完成庆祝 + 键盘支持
- `src/app/styles.css` — Cat 动画/reduced-motion、focus ring、Settings/History/Help/Tutorial 样式、Large Text 覆盖
- 测试助手：无既有测试删除（118 全保留）

## C. Freeze

- **M0 Core modified? 否**。`git diff --stat b681917 -- src/game-engine.ts src/candidate-engine.ts src/human-solver/ src/hint-engine/ src/tools/ src/board.ts src/grid.ts src/types.ts src/difficulty/` 为空。
- **M1/M2 frozen behavior modified? 否**。Notes/Undo/ErrorModes/Timer/Hint adapter/Storage migration/M2 三项 Fix（completed cleanup、visibility-aware restore、conflict `!` marker）均未改动，回归测试全绿。Cat 不改变任何数独规则、不依据表现调整难度或提示。

## D. Cat

- **States**：`idle | thinking | sleeping | hinting | celebrating`（5 核心，§7）；`wake` 由 sleeping→thinking 的活动转移隐式表达。
- **Transitions**（`useCatCompanion`，UI-only）：playing 默认 idle；用户操作→thinking（~0.9s 回落 idle）并重置 idle 计时；打开提示→hinting；长时间（30s）无操作→sleeping（温柔，无催促/讽刺）；completed→celebrating（钉住）。
- **Copy**：`catCopy(state, difficulty)`，仅 celebrating 按 difficulty 变正向文案（§9 允许）；其余状态 difficulty 无关。
- **No hidden grading（§30 P0）如何保证**：`cat.ts`/`useCatCompanion.ts`/`Cat.tsx` 的函数签名**只**接受 state/difficulty(/seed)，结构上无法访问 elapsed/hintCount/directHintCount/mistakes/undo；`tests/cat.test.ts` 断言同 (state,difficulty) 文案不变、celebrating 对所有难度均正向且无「快/慢/分/名次/星」等字样；`grep` 确认 cat 模块无 performance branching。
- **Reduced motion**：`@media (prefers-reduced-motion: reduce)` 关闭全部 cat 动画/过渡，功能不受影响。Cat 容器固定高度（84/120px），状态切换不造成 Board/Toolbar/Pad/Hint 位移。
- **不持久化（§10）**：Cat 状态从不写入 ActiveGame/History/localStorage；刷新后 playing→idle、completed→celebrating。

## E. Accessibility

- **Large Text（§15/§16/§33）**：`settingsStore.setLargeText` 通过根 `data-large-text` 属性即时切换（无刷新），CSS 用单一属性选择器覆盖各页文本/按钮/键盘/工具栏/提示/设置/历史/教程/帮助/完成页；Board 为宽度驱动，格子几何不变，数字加粗且 `clamp` 上限受控不溢出；Notes 始终 1-9 九宫格（非 dots）。持久化于 settings，刷新后仍生效。
- **Touch target**：工具栏/键盘/设置控件/返回/导航均 `min-height: var(--tap)=44px`。
- **Keyboard（§18/§42）**：GamePage 全局 keydown —— 1-9 填数、Delete/Backspace 清除、方向键移动选中格；复用同一 store action，不建第二套输入规则；given 由 Core 保证不可改。
- **Screen reader（§19）**：Sudoku cell aria-label 含行/列/给定/数值/候选/冲突；工具栏/模式/导航均有 accessible name；Cat emoji `aria-hidden`，文案可读。
- **Focus**：全局 `:focus-visible` 3px outline。
- **Contrast / 非颜色信号（§17）**：selected（outline）、note mode（banner 文字 + active 底色 + aria-pressed）、conflict（保留 M2 `!` marker + aria「冲突」，未回归）、disabled（opacity + `disabled`）、当前设置（「已开启/（已选）」文字 + aria-pressed/aria-checked）均非仅颜色。

## F. Settings

- **Schema**：v2 `{ schemaVersion:2, errorMode, largeText, tutorialSeen }`（`nekoSudoku.settings`，未新建第二套存储）。
- **Migration**：v1（errorMode-only）→ v2，补 `largeText=false/tutorialSeen=false` 并回写；不删除已有 M2 设置。
- **Corrupted fallback**：JSON 损坏/schema 不符 → `DEFAULT_SETTINGS` + console 诊断，不抛。

## G. History

- **Schema**：`{ gameId, puzzleId, difficulty, completedAt, elapsedMs }`，envelope `{ schemaVersion:1, records[] }`（`nekoSudoku.history`）。UI 仅显示 date/difficulty/elapsed。
- **gameId 去重 / exactly-once**：`appendHistoryOnce` 按 gameId 去重、幂等；完成流程 `calc elapsed → appendHistoryOnce → clearActiveGame`；重复完成 commit/rerender 不重复（integration 测试验证）。
- **Limit**：最近 **150** 局（`HISTORY_LIMIT`），newest-first。
- **Write failure**：`writeHistory` try/catch，Quota/Security 仅记日志返回 false，不 crash 完成页（测试验证）。
- **UI 字段**：仅日期/难度/用时；Zod 剥离未知字段，score/hint/mistake/rank 无法写入或显示（测试验证）。

## H. Tutorial / Help

- `/tutorial`：3 静态规则画面 + 1 固定互动（缺 5，答对=5），可跳过；仅读写 `tutorialSeen`，**不创建 activeGame / 不写 History / 不启动计时 / 不调 Hint Engine**（单测 + E2E 验证）。
- `/help`：简洁规则 + 填数/笔记/撤销/提示/两种错误检查 + 「不排名不评分」说明；非知识库。

## I. Completion

完成时（`gameStore.commit` 的 completed 分支）：`completeTimer` 冻结用时 → 计算 `completedElapsedMs` → `appendHistoryOnce`（幂等）→ `clearActiveGame`（M2 FIX-1 语义保留）→ 内存保留 completed state。完成页展示 celebrating Cat + 「这一局用了 …」+「慢慢想，也很好。」，无 Best Time/纪录/星级/名次。Cat 文案按 difficulty，绝不按 time/hint/mistake/undo。

## J. Tests

- `tsc --noEmit`：**0 errors**
- Vitest：**159 passed**（原 118 全保留 + M3 新增 41）
- `vite build`：成功
- Playwright：**36 passed**（原 22 全保留 + M3 新增 14；320×568 / 390×844 双视口）

## K. Bundle

JS **302.68 KB / gzip 93.51 KB**（< 200KB 预算；较 M2 89.95KB 增 ~3.6KB，来自 Cat/新页面/大字样式，无新增依赖）。CSS gzip 2.75KB。

## L. Scope（未实现，符合 §5/§44）

无：Daily / Calendar / Streak / 排行榜 / Score / Best Time comparison / 成就 / 账号 / Login / 云同步 / PWA / Service Worker / Push / Shop / 广告 / 声音 / 震动 / 主题商城 / L5-L6 / X-Wing / Swordfish / XY-Wing / Chains / 数字优先连续输入 / 正式 1200 题库。`§44 grep` 命中均为注释（记录排除项），无实际功能。react-router-dom 已知 Low CVE 未升级（无可利用路径，backlog）。

## M. Frozen Spec deviations

No deviations.

---

M3_GATE_SELF_CHECK = PASS
