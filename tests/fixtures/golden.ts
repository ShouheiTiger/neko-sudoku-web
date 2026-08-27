// Golden puzzle fixtures for M0. Each `puzzle` is 81 chars ('0' = empty).
// These are well-known human-solvable puzzles used to validate solver/hint/analysis.
export type Golden = { id: string; puzzle: string; solution: string };

// A classic "easy" puzzle solvable with singles (naked/hidden single).
export const EASY: Golden = {
  id: "easy-1",
  puzzle:
    "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  solution:
    "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
};

// A puzzle that genuinely requires locked candidates (pointing) beyond singles.
// Verified by analyze(): solves at L3 with maxRequiredTechnique="pointing-pair".
export const LOCKED: Golden = {
  id: "locked-1",
  puzzle:
    "400000938032094100095300240370609004529001673604703090957008300003900400240030709",
  solution:
    "461572938732894156895316247378629514529481673614753892957248361183967425246135789",
};

