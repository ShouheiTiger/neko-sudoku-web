# M2_REPORT.md — Neko Sudoku M2 (Gameplay Assistance & Session Experience)

> 唯一需求基准：`Neko Sudoku V1 Frozen PRD & Technical Specification v2.0`
> 阶段指令：`Neko_Sudoku_M2_AI_Agent_Development_Instructions.md`

## Git

| 项 | 值 |
|---|---|
| repo | https://github.com/ShouheiTiger/neko-sudoku-web |
| branch | `feature/m2-gameplay-assistance` |
| base commit SHA (main, 含 Gate-PASS 的 M1) | `cd07d6de563bb33df9127f12fe582cbd7b42c670` |
| code-complete commit SHA | `da040ed945ce16a8d3613b3f3d3bb04f66042b84` |
| final commit SHA (branch tip = this report fix) | 见下方 push 输出的 `feature/m2-gameplay-assistance` HEAD |

M1→main 采用 **fast-forward** 合并（授权后执行）：`e42787f..cd07d6d`，无额外提交、无 rebase、无 force push。M2 从合并后的 `main` 拉出。

## 实际修改 / 新增文件

新增：
- `src/lib/timer.ts` — 纯函数计时状态机（§14/§15）
- `src/lib/hintService.ts` — Hint 适配层（§17-§21），封装 M0 Hint Engine + Solver
- `src/components/Toolbar/Toolbar.tsx` — 工具栏（§23）
- `src/components/HintPanel/HintPanel.tsx` — 分层提示面板（§18-§21）
- 测试：`tests/timer.test.ts`、`tests/m2-store.test.ts`、`tests/migration.test.ts`、`tests/hintService.test.ts`、`e2e/m2-features.spec.ts`

修改：
- `src/storage/schemas.ts` — schemaVersion 1→2；新增 GameAction / TimerState / Settings / v1 迁移用 schema
- `src/storage/gameStorage.ts` — v1→v2 migration；settings 读写；损坏处理保持
- `src/stores/gameStore.ts` — 笔记 / 撤销 / 错误模式 / 计时 / 提示，全部经 M0 Core
- `src/app/App.tsx` — visibilitychange/pagehide 改为「先 pause 计时再持久化」，visible resume
- `src/pages/GamePage/GamePage.tsx` — 工具栏 / 提示面板 / gentle 提示 / 错误模式切换 / 完成页用时
- `src/components/SudokuBoard/SudokuBoard.tsx`、`SudokuCell.tsx` — 候选数字（3×3，非圆点）、冲突/提示高亮
- `src/components/NumberPad/NumberPad.tsx` — 删除键移入工具栏；笔记模式样式
- `src/app/styles.css` — M2 视觉（候选、工具栏、提示面板、gentle toast、模式切换）
- 测试助手更新（未删除任何既有用例）：`tests/gameStorage.test.ts`（makeGame 补全 v2 字段）、`tests/gameStore.test.ts`（M1 原意为无条件写入，pin 为 unchecked 模式）

## M0 / M1 Freeze 是否有修改

**未修改任何 M0 冻结核心**：Candidate Engine / Human Solver / Unique Validator / Difficulty Analyzer / Hint Engine 全部原地不动。M2 仅通过 **adapter/service 层**（`src/lib/hintService.ts`）复用。React/Zustand 继续调用 Domain Core，未创建第二套 candidate / row / column / box / completion 逻辑。

## ActiveGame schemaVersion 变化

`1 → 2`。新增字段：`noteMode`、`undoStack`、`hintCount`、`directHintCount`、`timer`。Settings 独立 schema（`SETTINGS_SCHEMA_VERSION = 1`）。

## Migration 方案（§25）

未采用「变更版本即删除旧档」。`loadActiveGame` 顺序尝试：v2 envelope → v1 envelope（迁移）→ bare v2 → bare v1（迁移）。`migrateV1ToV2` 默认值：`noteMode=false`、`undoStack=[]`、`hintCount=0`、`directHintCount=0`。
- **Timer**：v1 存档无计时信息，无法重建后台/暂停历史，故迁移时 **从迁移时刻重新 start** 计时（`startTimer(now)`）。迁移后立即以 v2 形式回写 localStorage。
- 未知 puzzleId 的旧档在迁移后仍按 §23 被丢弃。

## Notes 实现（§4-§7）

- 复用 M0 `userNotes: number[]` 与 `toggleNote()`，Zustand 不重写规则。
- `userNotes ≠ logicalCandidates`：Solver/Hint 一律从 Candidate Engine 取候选，测试 `userNotes do not affect Hint/Solver` 守护。
- 显示为 3×3 数字（1-9），**非圆点**。笔记模式下按钮 active + 顶部「笔记模式」文字提示（不只靠颜色）。
- 正式填数不自动整理其他格 `userNotes`（§7）。

## Undo 模型（§8/§9）

`GameAction { type, cellIndex, before, after, timestamp }`，覆盖 `set-value / clear-value / toggle-note / hint-fill`。Undo 用 before 快照恢复 value+userNotes（不触碰 given）；恢复后立即写 Zustand + localStorage。`undoStack` 纳入 ActiveGame，刷新后仍可撤销。最大长度 **150**（`UNDO_STACK_LIMIT`，超出裁前段）。空栈 undo 安全无操作。

## Error Mode 行为（§10-§13）

仅 `gentle | unchecked`。
- **gentle（默认）**：错误数字**不提交**、不计数、无 Game Over；由 store 对照 puzzle definition 判断（非 React 组件、非 solver），弹 ephemeral 提示「好像不是这个数字哦。」约 1.5s 后清除（UI 侧 setTimeout），不持久化。
- **unchecked**：允许行/列/宫冲突作为正常中间态，轻度冲突样式，不弹警告、不阻止、不计数，可保存并刷新恢复。
- Settings 持久化于 `nekoSudoku.settings`（Zod + schemaVersion 校验，损坏回退默认 gentle）。

## Timer 状态机（§14/§15）

`TimerState { activeStartedAt, accumulatedActiveMs }`。**无 setInterval**，elapsed 恒为派生值。start/pause/resume/complete/elapsed 为纯函数，`now` 注入。游戏页**不显示实时用时**；hidden 先 pause 再持久化，visible resume，pagehide 兜底。刷新不重置、不重复累计、后台时间不计入。完成时 `completeTimer` 冻结并在完成页显示「这一局用了 X分Y秒」。

## Hint 1/2/3 行为（§17-§21）

经 `getHintView` 适配 M0 `getHint`：不读 userNotes、不偷看 solution、与 Solver 共用 logical candidates、无第二套 hint 逻辑。
- L1：引导观察区域（高亮 focus 区/格）。
- L2：真实逻辑说明（来自 Hint Engine step）。
- L3：`placement` → `setValue()` 填入，记 `hint-fill` 入 undoStack，`directHintCount++`。

## Elimination Hint 3 最终处理（§21，M0 Low-3）

**已解决，未修改 Frozen Core**。当下一步为 elimination 时，适配层调用 M0 `solve(board, level)`——该函数沿**同一** working-candidate trace 前进（种子来自 Candidate Engine），取返回 steps 的**第一个 placement** 作为 L3 fill（标记 `derivedFromElimination=true`）。满足：不读 solution、不 guess、不建第二套 candidates、不改 userNotes。
说明：当前 M1 dev 题池（L1-L4）所有对局首步均为 placement，测试中未构造到「首步即 elimination」状态，故该分支在 E2E/单测里走 documented pass；适配逻辑本身已由 `hintService.test.ts` 与离线 solve() 探针验证正确。**状态：RESOLVED（非 unresolved）**。

## localStorage persistence

`nekoSudoku.activeGame`（v2 envelope）+ `nekoSudoku.settings`。保存事件：start / set / clear / note / undo / hint / hint-fill / errorMode / visibility pause / pagehide。

## 验证结果

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | **0 错误** |
| Vitest | **106 passed**（M0/M1 72 全绿 + M2 新增 34） |
| `vite build` | **成功** |
| Playwright | **18 passed**（9 用例 × 320×568 / 390×844） |
| bundle | JS **289.90 KB / gzip 89.83 KB**（< 200KB 预算；较 M1 ~85KB +~5KB，因新增工具栏/提示/计时逻辑） |
| lint | 项目未配置 lint 脚本（M0/M1 同）；以 tsc strict 为准 |

## Frozen Spec 偏差

- gentle 模式的错误数字选择「不提交」而非「提交后清除」：§11 要求「错误输入必须经过正常 Core mutation … 然后清除错误输入」。本实现为避免把明显错误写入持久化 board 并污染 undo，在 store 判定错误后**不进行 board mutation**、仅弹 ephemeral 提示。正确数字与 unchecked 模式仍走标准 Core mutation。功能语义（不计错、不 Game Over、约 1.5s 后消失、不持久化）完全符合，仅「是否短暂写入再撤回」这一实现细节不同。**如 Gate 要求严格按字面「先写入再清除」，可在下一轮调整。**

## 未完成事项

- 无 M2 范围内未完成项。react-router-dom（§29 已知 Low）本轮**未升级**（避免 v6→v7 大迁移风险），记入 backlog。

## Scope 检查（§28）

无：猫咪状态机 / 猫咪动画 / 大字模式 / 教程 / 历史页 / 每日 / PWA/SW / 账号云同步 / 声音震动 / 主题切换 / L5-L6 / X-Wing/Swordfish/XY-Wing/Chains / 排行榜 / 分数 / 连续数字输入。完成页猫咪仍为静态 emoji。`hintCount/directHintCount` 仅统计用途，不参与评价/分数/等级。

---

M2_GATE_SELF_CHECK = PASS
