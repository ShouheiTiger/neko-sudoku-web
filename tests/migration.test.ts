import { describe, it, expect, beforeEach } from "vitest";
import {
  loadActiveGame,
  ACTIVE_GAME_KEY,
  migrateV1ToV2,
} from "../src/storage/gameStorage.js";
import { SCHEMA_VERSION_V1, type ActiveGameV1 } from "../src/storage/schemas.js";
import { parsePuzzle } from "../src/board.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";
import { elapsedMs } from "../src/lib/timer.js";

const sample = DEV_PUZZLES[0]!;

function makeV1(): ActiveGameV1 {
  const parsed = parsePuzzle(sample.puzzle);
  if (!parsed.ok) throw new Error("fixture");
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    gameId: "g-v1",
    puzzleId: sample.id,
    difficulty: sample.difficulty,
    board: parsed.board,
    selectedCell: 5,
    createdAt: 100,
    updatedAt: 200,
    engineVersion: 1,
  };
}

describe("M1 → M2 migration (§24, §25)", () => {
  beforeEach(() => window.localStorage.clear());

  it("migrateV1ToV2 fills new fields with safe defaults and starts timer at now", () => {
    const v2 = migrateV1ToV2(makeV1(), 50000);
    expect(v2.schemaVersion).toBe(2);
    expect(v2.noteMode).toBe(false);
    expect(v2.undoStack).toEqual([]);
    expect(v2.hintCount).toBe(0);
    expect(v2.directHintCount).toBe(0);
    // timer starts fresh at migration time; elapsed from now is 0
    expect(elapsedMs(v2.timer, 50000)).toBe(0);
    // preserved fields
    expect(v2.gameId).toBe("g-v1");
    expect(v2.board.length).toBe(81);
    expect(v2.difficulty).toBe(sample.difficulty);
  });

  it("loadActiveGame migrates an on-disk v1 envelope and re-persists as v2", () => {
    const v1Envelope = { schemaVersion: SCHEMA_VERSION_V1, savedAt: 1, data: makeV1() };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(v1Envelope));

    const loaded = loadActiveGame(undefined, 77000);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(2);
    expect(loaded!.undoStack).toEqual([]);

    // it should have been re-saved in v2 form
    const raw = JSON.parse(window.localStorage.getItem(ACTIVE_GAME_KEY)!);
    expect(raw.schemaVersion).toBe(2);
    expect(raw.data.schemaVersion).toBe(2);
  });

  it("v1 with unknown puzzleId is still dropped after migration (§23)", () => {
    const bad = makeV1();
    bad.puzzleId = "nope";
    const env = { schemaVersion: SCHEMA_VERSION_V1, savedAt: 1, data: bad };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(env));
    expect(loadActiveGame(undefined, 1000)).toBeNull();
  });
});
