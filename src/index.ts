// Public surface of the Neko Sudoku V1 core (M0 spike). Pure logic only — no UI.
export * from "./types.js";
export * as grid from "./grid.js";
export { parsePuzzle, boardToString, cloneBoard, findConflicts } from "./board.js";
export {
  setValue,
  clearValue,
  toggleNote,
  getConflicts,
  validateBoard,
  isCompleted,
  getPeers,
} from "./game-engine.js";

// §17 Candidate Engine — the single logical candidate source.
export { getCandidates, getAllCandidates, type CandidateMap } from "./candidate-engine.js";

// §15.2 Human Logic Solver (L1-L4).
export {
  solve,
  findNextStep,
  findStep,
  levelForDifficulty,
  maxRequiredTechnique,
  TECHNIQUE_TIER,
  type SolveResult,
} from "./human-solver/solver.js";
export type { LogicStep, Elimination } from "./human-solver/logic-step.js";

// §23 Hint Engine (3 layers).
export { getHint, type Hint, type HintResult } from "./hint-engine/hint-engine.js";

// §10-14 Difficulty Analysis.
export { analyze, type AnalyzeResult } from "./difficulty/analyze.js";

// §15.1 Unique Solution Validator (tooling, backtracking).
export {
  checkUniqueness,
  hasUniqueSolution,
  type UniquenessResult,
} from "./tools/unique-validator.js";
