# Neko Sudoku M3 — 定点修复报告 (M3_FIX_REPORT.md)

本轮范围严格限定为 M3 Gate Review 的两个 Medium：**M-1**（History 写入失败语义）与
**M-2**（`--color-muted` WCAG 对比度）。未重构 M3、未触碰 M0/M1/M2 Frozen Core、未改
Cat grading 架构、未改正常 History exactly-once 语义、未动 Tutorial / Large Text /
Keyboard 架构、未修 Low backlog、未修 Hint Panel layout、未清理 `catStateForScreen`、
未进入 Release Prep。

## SHA

- base SHA (上一轮审核): `bfd7ab95712653704a3c7b5c38bb1df697d298ca`
- final SHA: 见文末 push 记录（本次提交 tip）
- branch: `feature/m3-companion-accessibility`

---

## FIX M-1 — History failure semantics

### 修改方案
以前 `commit()` 顺序为 `appendHistoryOnce(...)` → **无条件** `clearActiveGame()`。
`appendHistoryOnce` 对 `setItem` 失败内部 `try/catch` 后返回模糊 boolean，无法区分
duplicate 与 failure，导致写失败时 activeGame 仍被删除、完成事件可能永久丢失。

现在改为显式结果契约，并让清理条件化于结果。

### History result contract
`appendHistoryOnce(record, store?) : HistoryAppendResult`
（`src/storage/gameStorage.ts`）

```
type HistoryAppendResult = "written" | "duplicate" | "failed";
```

- `"written"`   —— 本次新写入一条记录。
- `"duplicate"` —— 该 `gameId` 已持久化：视为**已成功持久化**，允许清除 activeGame，
  且不写第二条（保持 gameId 去重 / exactly-once / schema / 150 上限不变）。
- `"failed"`    —— 记录非法 **或** storage 写入失败（quota/security 等）：未持久化，
  调用方**必须保留 activeGame** 以便重试。函数仍然**永不抛出**（completion UI 不 crash）。

### completion path（`src/stores/gameStore.ts` `commit()`）
```
const historyResult = appendHistoryOnce({...});
if (historyResult === "written" || historyResult === "duplicate") {
  clearActiveGame();          // 已持久化 → 清理，Home 不再提供“继续上一局”
} else { // "failed"
  saveActiveGame(next);       // 未持久化 → 保留已完成的棋盘，供下次重试
}
```

### retry behavior（`restoreGame()`）
重新进入时若持久化的棋盘**已完成**（即上次写失败被保留下来）：
- 不 resume 其计时器（完成时已冻结），避免 elapsed 被 background 时间污染；
- 通过 `commit(set, loaded)` 重新执行完成副作用 → 重试写 History；
- `appendHistoryOnce` 以 gameId 幂等 → **最终 History 只有一条**；
- 成功（`written`/`duplicate`）后 activeGame **最终被清理**。

### duplicate behavior
已存在相同 gameId → 返回 `"duplicate"` → 视为已持久化 → 允许清除 activeGame →
不产生第二条记录，避免 completed activeGame 永久残留。

### 未改变的保证
gameId 去重、History exactly-once、History schema 白名单、150 条 limit、
正常路径的 activeGame completion cleanup（FIX-1 / M2）全部保持不变（回归测试证明）。

---

## FIX M-2 — WCAG contrast

### 新 muted color
`--color-muted: #8a8172` → **`#6f675a`**（更深、仍为温柔暖灰，仅加深明度、保留色相，
不改变任何尺寸/布局）。仅统一修改 CSS 变量，未为 `.cat-copy` / `.settings-hint` /
`.toggle-state` / `.history-diff` / `.done-sub` 增加独立颜色。

### 两个背景的实际 contrast ratio（WCAG relative luminance 公式实测）
| 前景 `#6f675a` | 背景 | contrast | AA(4.5:1) |
|---|---|---|---|
| muted | `#fbf7ef`（页面背景） | **5.22:1** | ✅ |
| muted | `#ffffff`（卡片背景） | **5.58:1** | ✅ |

（原 `#8a8172`：3.60:1 / 3.84:1，均不达标。）

Large Text OFF / ON 只影响 font-size，不影响颜色对比度；颜色只加深不改尺寸，
故 320×568 / 390×844 双视口下无新增 layout overflow（Playwright 回归通过）。

---

## 修改文件
| 文件 | 变更 |
|---|---|
| `src/storage/gameStorage.ts` | M-1：新增 `HistoryAppendResult` 类型，`appendHistoryOnce` 返回 written/duplicate/failed |
| `src/stores/gameStore.ts` | M-1：`commit()` 条件化 clear；`restoreGame()` 对已完成棋盘重试写 History |
| `src/app/styles.css` | M-2：`--color-muted` → `#6f675a` |
| `tests/history.test.ts` | 更新断言以匹配新 result contract |
| `tests/m3-fixes.test.ts` | 新增：M-1 A/B/C/D + M-2 对比度锁定 |

`git diff --name-status bfd7ab9...HEAD` 仅涉及上述文件，无其他生产文件。

## 新增测试
- **M-1 A**：history `setItem` 抛 `QuotaExceededError` → 不 crash → history 缺失 → activeGame 保留。
- **M-1 B**：reload/restore 保留的完成局 → 重试写成功 → history 恰一条 → elapsed 冻结不膨胀 → activeGame 清理。
- **M-1 C**：history 已含同 gameId → `duplicate` → activeGame 可安全清理 → 无第二条。
- **M-1 D**：正常完成 → history 一条 → activeGame 清除。
- **M-2**：解析 `--color-muted` / `--color-bg` / `--color-surface`，实测两背景 contrast ≥ 4.5:1。

## 验证结果
| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm test` (vitest) | **166 passed / 25 files**（159 基线 + 7 新增，全部保留） |
| `npm run build` | 成功，`dist/assets/index-*.js` 302.88 KB / **gzip 93.58 KB**（< 200KB） |
| `npx playwright test` | **36 passed / 36**（基线全部保留，双视口 320/390） |
| bundle gzip | JS **93.58 KB** < 200KB ✅ |
| `git status` | 干净（提交后） |

---

M3_FIX_SELF_CHECK = PASS

> 已停止，不 merge main，不进入 Release Prep，等待 Claude M3 Fix Review。
