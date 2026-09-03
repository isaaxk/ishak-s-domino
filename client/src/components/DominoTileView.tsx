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
 * Returns 3x3 grid coordinates [row, col] for pip dot count from 0 to 9.
 */
function getPipCoordinates(val: number): [number, number][] {
  switch (val) {
    case 0:
      return [];
    case 1:
      return [[1, 1]]; // Center
    case 2:
      return [[0, 0], [2, 2]]; // Diagonal
    case 3:
      return [[0, 0], [1, 1], [2, 2]]; // Diagonal 3
    case 4:
      return [[0, 0], [0, 2], [2, 0], [2, 2]]; // 4 corners
    case 5:
      return [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]]; // 4 corners + center
    case 6:
      return [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]]; // 2 columns of 3
    case 7:
      return [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]; // 6 pips + center
    case 8:
      return [
        [0, 0], [1, 0], [2, 0], [3, 0],
        [0, 2], [1, 2], [2, 2], [3, 2],
      ]; // 2 columns of 4
    case 9:
      return [
        [0, 0], [1, 0], [2, 0],
        [0, 1], [1, 1], [2, 1],
        [0, 2], [1, 2], [2, 2],
      ]; // 3 columns of 3
    default:
      return [];
  }
}

function HalfTile({ value }: { value: number }) {
  const pips = getPipCoordinates(value);
  const isEight = value === 8;

  return (
    <div
      className="relative w-full h-full p-1 flex items-center justify-center"
      style={{
        display: 'grid',
        gridTemplateRows: isEight ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '2px',
      }}
    >
      {pips.map(([r, c], idx) => (
        <div
          key={idx}
          className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-domino-pip shadow-inner justify-self-center self-center"
          style={{
            gridRowStart: r + 1,
            gridColumnStart: c + 1,
          }}
        />
      ))}
    </div>
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
  // Base dimensions: width 80px, height 40px
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
        relative rounded-md border border-neutral-300 select-none cursor-pointer
        transition-all duration-150 ease-out flex flex-row overflow-hidden
        ${isPending ? 'bg-amber-50 border-amber-400 animate-pulse ring-2 ring-amber-400' : 'bg-domino-ivory'}
        ${isSelected ? 'ring-4 ring-emerald-500 scale-105 shadow-glow z-20' : 'shadow-tile hover:shadow-tile-lg'}
        ${className}
      `}
    >
      {/* Side A Half */}
      <div className="flex-1 h-full flex items-center justify-center">
        <HalfTile value={sideA} />
      </div>

      {/* Center Dividing Line with Metallic Brass Pin */}
      <div className="w-[2px] h-full bg-neutral-300 relative flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-domino-brass shadow-sm border border-amber-600" />
      </div>

      {/* Side B Half */}
      <div className="flex-1 h-full flex items-center justify-center">
        <HalfTile value={sideB} />
      </div>
    </div>
  );
};
