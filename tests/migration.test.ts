import { describe, it, expect, beforeEach } from "vitest";
import {
  loadActiveGame,
  ACTIVE_GAME_KEY,
  migrateV1ToV3,
  migrateV2ToV3,
} from "../src/storage/gameStorage.js";
import {
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  type ActiveGameV1,
  type ActiveGameV2,
} from "../src/storage/schemas.js";
import { parsePuzzle } from "../src/board.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";
import { elapsedMs, startTimer } from "../src/lib/timer.js";

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

function makeV2(): ActiveGameV2 {
  const parsed = parsePuzzle(sample.puzzle);
  if (!parsed.ok) throw new Error("fixture");
  return {
    schemaVersion: SCHEMA_VERSION_V2,
    gameId: "g-v2",
    puzzleId: sample.id,
    difficulty: sample.difficulty,
    board: parsed.board,
    selectedCell: 5,
    noteMode: true,
    undoStack: [],
    hintCount: 2,
    directHintCount: 1,
    timer: startTimer(1000),
    createdAt: 100,
    updatedAt: 200,
    engineVersion: 1,
  };
}

describe("ActiveGame migration (§24, §25, §29)", () => {
  beforeEach(() => window.localStorage.clear());

  it("migrateV1ToV3 fills new fields with safe defaults and starts timer at now", () => {
    const v3 = migrateV1ToV3(makeV1(), 50000);
    expect(v3.schemaVersion).toBe(3);
    expect(v3.noteMode).toBe(false);
    expect(v3.undoStack).toEqual([]);
    expect(v3.hintCount).toBe(0);
    expect(v3.directHintCount).toBe(0);
    expect(v3.puzzleSnapshot).toBeUndefined();
    expect(elapsedMs(v3.timer, 50000)).toBe(0);
    expect(v3.gameId).toBe("g-v1");
    expect(v3.board.length).toBe(81);
    expect(v3.difficulty).toBe(sample.difficulty);
  });

  it("migrateV2ToV3 preserves puzzleId/difficulty/board/notes/undo/timer (§29)", () => {
    const v3 = migrateV2ToV3(makeV2(), 60000);
    expect(v3.schemaVersion).toBe(3);
    expect(v3.puzzleId).toBe(sample.id);
    expect(v3.difficulty).toBe(sample.difficulty);
    expect(v3.noteMode).toBe(true);
    expect(v3.hintCount).toBe(2);
    expect(v3.directHintCount).toBe(1);
    expect(v3.board.length).toBe(81);
    // timer preserved verbatim (not reset)
    expect(v3.timer).toEqual(makeV2().timer);
  });

  it("loadActiveGame migrates an on-disk v1 envelope and re-persists as v3", () => {
    const v1Envelope = { schemaVersion: SCHEMA_VERSION_V1, savedAt: 1, data: makeV1() };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(v1Envelope));

    const loaded = loadActiveGame(undefined, 77000);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(3);
    expect(loaded!.undoStack).toEqual([]);

    const raw = JSON.parse(window.localStorage.getItem(ACTIVE_GAME_KEY)!);
    expect(raw.schemaVersion).toBe(3);
    expect(raw.data.schemaVersion).toBe(3);
  });

  it("loadActiveGame migrates an on-disk v2 envelope and re-persists as v3 (§29)", () => {
    const v2Envelope = { schemaVersion: SCHEMA_VERSION_V2, savedAt: 1, data: makeV2() };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(v2Envelope));

    const loaded = loadActiveGame(undefined, 77000);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(3);
    expect(loaded!.noteMode).toBe(true);
    expect(loaded!.hintCount).toBe(2);

    const raw = JSON.parse(window.localStorage.getItem(ACTIVE_GAME_KEY)!);
    expect(raw.data.schemaVersion).toBe(3);
  });

  it("v1 with unknown puzzleId is still dropped after migration (§23)", () => {
    const bad = makeV1();
    bad.puzzleId = "nope";
    const env = { schemaVersion: SCHEMA_VERSION_V1, savedAt: 1, data: bad };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(env));
    expect(loadActiveGame(undefined, 1000)).toBeNull();
  });
});
