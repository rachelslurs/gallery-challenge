/**
 * What the floating bar should say.
 *
 * One surface reports three different things, so the precedence between them
 * is a rule worth stating once and testing, rather than a chain of ternaries
 * inside JSX.
 */

export type BarState =
  | { kind: "hidden" }
  | { kind: "notice"; message: string }
  | { kind: "moved"; count: number; board: string }
  | { kind: "selection"; assets: number; boards: number; mixed: boolean };

export interface BarInput {
  /** A refusal to explain. Outranks everything: the user just tried something. */
  notice: string | null;
  /** An undo offer for the most recent move. */
  moved: { count: number; board: string } | null;
  assets: number;
  boards: number;
}

export const resolveBar = ({ notice, moved, assets, boards }: BarInput): BarState => {
  if (notice !== null) return { kind: "notice", message: notice };

  const selected = Math.max(0, assets) + Math.max(0, boards);

  // A selection supersedes an undo offer. The offer describes the last thing
  // that happened; once a new selection exists it is stale, and showing both
  // would leave the bar ambiguous about which one it is describing.
  if (selected > 0) {
    return { kind: "selection", assets, boards, mixed: assets > 0 && boards > 0 };
  }

  if (moved !== null) return { kind: "moved", count: moved.count, board: moved.board };

  return { kind: "hidden" };
};
