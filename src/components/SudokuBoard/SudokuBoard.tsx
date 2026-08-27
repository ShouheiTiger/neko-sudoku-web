import { useMemo } from "react";
import type { BoardState } from "../../types.js";
import { rowOf, colOf, getPeers } from "../../grid.js";
import { getConflicts } from "../../game-engine.js";
import { SudokuCell } from "./SudokuCell.js";

export type SudokuBoardProps = {
  board: BoardState;
  selectedCell: number | null;
  /** When true, light conflict styling is applied (unchecked mode, §12). */
  showConflicts: boolean;
  /** Cells highlighted by an active hint (§18). */
  hintCells: number[];
  onSelectCell: (index: number) => void;
};

// Renders the 9x9 grid. Peer set + conflicts come from M0 helpers — the UI does NOT
// compute row/col/box membership or conflicts itself (§2/§29).
export function SudokuBoard({
  board,
  selectedCell,
  showConflicts,
  hintCells,
  onSelectCell,
}: SudokuBoardProps) {
  const peerSet = useMemo(() => {
    if (selectedCell == null) return new Set<number>();
    return new Set<number>(getPeers(selectedCell));
  }, [selectedCell]);

  const conflictSet = useMemo(
    () => (showConflicts ? new Set<number>(getConflicts(board)) : new Set<number>()),
    [board, showConflicts],
  );

  const hintSet = useMemo(() => new Set<number>(hintCells), [hintCells]);

  return (
    <div className="board-wrap">
      <div className="board" role="grid" aria-label="数独棋盘">
        {board.map((cell, index) => (
          <SudokuCell
            key={index}
            cell={cell}
            index={index}
            row={rowOf(index)}
            col={colOf(index)}
            selected={selectedCell === index}
            peer={peerSet.has(index)}
            conflict={conflictSet.has(index)}
            hintFocus={hintSet.has(index)}
            onSelect={onSelectCell}
          />
        ))}
      </div>
    </div>
  );
}
