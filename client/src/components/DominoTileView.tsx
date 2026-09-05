import React from 'react';

interface DominoTileViewProps {
  sideA: number;
  sideB: number;
  rotation?: number; // 0, 90, 180, 270
  isSelected?: boolean;
  isPending?: boolean;
  scale?: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Returns exact SVG coordinates (within a 100x100 square) for domino pips (0 to 9).
 * Coordinates are proportioned to ensure pips never clip or overlap boundaries.
 */
function getSvgPipPositions(val: number): { x: number; y: number }[] {
  switch (val) {
    case 0:
      return [];
    case 1:
      // Single center dot
      return [{ x: 50, y: 50 }];
    case 2:
      // Diagonal 2
      return [
        { x: 27, y: 27 },
        { x: 73, y: 73 },
      ];
    case 3:
      // Diagonal 3
      return [
        { x: 27, y: 27 },
        { x: 50, y: 50 },
        { x: 73, y: 73 },
      ];
    case 4:
      // 4 corners
      return [
        { x: 27, y: 27 },
        { x: 73, y: 27 },
        { x: 27, y: 73 },
        { x: 73, y: 73 },
      ];
    case 5:
      // 4 corners + center
      return [
        { x: 27, y: 27 },
        { x: 73, y: 27 },
        { x: 50, y: 50 },
        { x: 27, y: 73 },
        { x: 73, y: 73 },
      ];
    case 6:
      // 2 columns of 3
      return [
        { x: 27, y: 25 },
        { x: 27, y: 50 },
        { x: 27, y: 75 },
        { x: 73, y: 25 },
        { x: 73, y: 50 },
        { x: 73, y: 75 },
      ];
    case 7:
      // 6 pips + center
      return [
        { x: 27, y: 25 },
        { x: 27, y: 50 },
        { x: 27, y: 75 },
        { x: 50, y: 50 },
        { x: 73, y: 25 },
        { x: 73, y: 50 },
        { x: 73, y: 75 },
      ];
    case 8:
      // 2 columns of 4
      return [
        { x: 27, y: 20 },
        { x: 27, y: 40 },
        { x: 27, y: 60 },
        { x: 27, y: 80 },
        { x: 73, y: 20 },
        { x: 73, y: 40 },
        { x: 73, y: 60 },
        { x: 73, y: 80 },
      ];
    case 9:
      // 3 columns of 3
      return [
        { x: 27, y: 25 },
        { x: 27, y: 50 },
        { x: 27, y: 75 },
        { x: 50, y: 25 },
        { x: 50, y: 50 },
        { x: 50, y: 75 },
        { x: 73, y: 25 },
        { x: 73, y: 50 },
        { x: 73, y: 75 },
      ];
    default:
      return [];
  }
}

/**
 * Returns optimal pip dot radius depending on pip count so dots look thick, bold,
 * and prominent while maintaining proper clearance.
 */
function getPipRadius(val: number): number {
  if (val === 8) return 7.8;
  if (val === 9 || val === 7) return 9.0;
  if (val === 1) return 11.0; // Bold prominent single center dot
  return 10.2; // Thick, bold dots for 2, 3, 4, 5, 6
}

/**
 * Renders a single square half of a domino using vector SVG so pips never get clipped,
 * distorted, or hidden regardless of screen resolution or scale factor.
 */
function HalfTile({ value }: { value: number }) {
  const pips = getSvgPipPositions(value);
  const r = getPipRadius(value);

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full block select-none pointer-events-none"
      preserveAspectRatio="xMidYMid meet"
    >
      {pips.map((pt, idx) => (
        <g key={idx}>
          {/* Subtle bottom highlight rim simulating physical carved indentation */}
          <circle
            cx={pt.x}
            cy={pt.y + 0.9}
            r={r}
            fill="rgba(255, 255, 255, 0.5)"
          />
          {/* Solid rich ebony pip body */}
          <circle
            cx={pt.x}
            cy={pt.y}
            r={r}
            fill="#18181b"
          />
          {/* Subtle top-left specular reflection */}
          <circle
            cx={pt.x - r * 0.28}
            cy={pt.y - r * 0.28}
            r={r * 0.35}
            fill="rgba(255, 255, 255, 0.22)"
          />
        </g>
      ))}
    </svg>
  );
}

export const DominoTileView: React.FC<DominoTileViewProps> = ({
  sideA,
  sideB,
  rotation = 0,
  isSelected = false,
  isPending = false,
  scale = 1,
  onClick,
  className = '',
}) => {
  // Base dimensions: width 80px, height 40px (standard 2:1 ratio)
  const baseWidth = 80;
  const baseHeight = 40;

  return (
    <div
      onClick={onClick}
      style={{
        width: `${baseWidth * scale}px`,
        height: `${baseHeight * scale}px`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
      }}
      className={`
        relative select-none cursor-pointer
        transition-all duration-150 ease-out flex flex-row items-center
        rounded-lg overflow-hidden
        ${isPending
          ? 'bg-amber-50 border-2 border-amber-400 animate-pulse ring-2 ring-amber-400'
          : 'bg-gradient-to-b from-[#FFFDF8] via-[#FAF6EC] to-[#EFEAD9] border border-[#D4CDBA] shadow-[0_4px_10px_rgba(0,0,0,0.35),0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-1px_2px_rgba(0,0,0,0.08)]'
        }
        ${isSelected ? 'ring-4 ring-emerald-500 scale-105 shadow-glow z-20' : 'hover:brightness-105'}
        ${className}
      `}
    >
      {/* Side A Half */}
      <div className="flex-1 h-full p-0.5 flex items-center justify-center overflow-hidden">
        <HalfTile value={sideA} />
      </div>

      {/* Center Dividing Line with Metallic Brass Pin */}
      <div className="w-[1.5px] h-[78%] bg-[#BFB79F] shadow-[1px_0_0_rgba(255,255,255,0.8)] relative flex items-center justify-center flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-[#FFE599] via-[#D4AF37] to-[#8C6D1F] border border-[#A67C1E] shadow-[0_1px_2px_rgba(0,0,0,0.5)] absolute" />
      </div>

      {/* Side B Half */}
      <div className="flex-1 h-full p-0.5 flex items-center justify-center overflow-hidden">
        <HalfTile value={sideB} />
      </div>
    </div>
  );
};
