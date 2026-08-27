import { useMemo } from "react";
import type { BoardState } from "../../types.js";
import { rowOf, colOf, getPeers } from "../../grid.js";
import { SudokuCell } from "./SudokuCell.js";

export type SudokuBoardProps = {
  board: BoardState;
  selectedCell: number | null;
  onSelectCell: (index: number) => void;
};

// Renders the 9x9 grid. Peer set (§13 row/col/box light highlight) comes from the M0
// grid helper getPeers() — the UI does NOT compute row/col/box membership itself (§29).
export function SudokuBoard({ board, selectedCell, onSelectCell }: SudokuBoardProps) {
  const peerSet = useMemo(() => {
    if (selectedCell == null) return new Set<number>();
    return new Set<number>(getPeers(selectedCell));
  }, [selectedCell]);

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
            onSelect={onSelectCell}
          />
        ))}
      </div>
    </div>
  );
}
