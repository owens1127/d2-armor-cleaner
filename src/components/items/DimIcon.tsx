/**
 * DIM brand mark - paths from Destiny Item Manager `apple-touch-icon-release.svg` (MIT).
 * 500×500 viewBox is tuned for favicon / small-icon rendering.
 */
const DIM_LOGO_VIEW_BOX = '0 0 500 500';

const DIM_LOGO_PATHS = [
  {
    d: 'm225.193 223.8h49.619v49.62h-49.619z',
    transform: 'matrix(-.7071 -.7071 .7071 -.7071 250.9895 601.181)',
  },
  {
    d: 'm249.998 73.18-35.086 35.086 140.346 140.347-105.26 105.253-105.259-105.253 70.173-70.173-35.083-35.087-105.26 105.26 175.429 175.426 175.434-175.426z',
  },
] as const;

export interface DimIconProps {
  className?: string;
  size?: number;
}

export function DimIcon({ className = '', size = 16 }: DimIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={DIM_LOGO_VIEW_BOX}
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
      aria-hidden
      className={`block shrink-0 ${className}`.trim()}
    >
      {DIM_LOGO_PATHS.map((path) => (
        <path
          key={path.d}
          d={path.d}
          transform={'transform' in path ? path.transform : undefined}
        />
      ))}
    </svg>
  );
}
