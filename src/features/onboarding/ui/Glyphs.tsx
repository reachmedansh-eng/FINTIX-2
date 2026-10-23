/**
 * Small pixel glyphs drawn on Retropix's own 12-unit grid, for marks the
 * font does not include. Sized in em, so they sit in a line of Retropix as
 * if they were part of it.
 */

function Bitmap({ rows, className }: { rows: string[]; className?: string }) {
  const width = rows[0].length;
  const height = rows.length;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      width={`${width / 12}em`}
      height={`${height / 12}em`}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) => (cell === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null)),
      )}
    </svg>
  );
}

const ARROW_RIGHT = [".....#...", "......#..", ".......#.", "#########", ".......#.", "......#..", ".....#..."];
const CHEVRON_DOWN = ["#.....#", ".#...#.", "..#.#..", "...#..."];

export const ArrowRight = ({ className }: { className?: string }) => <Bitmap rows={ARROW_RIGHT} className={className} />;
export const ChevronDown = ({ className }: { className?: string }) => <Bitmap rows={CHEVRON_DOWN} className={className} />;
