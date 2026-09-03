import React, { useRef, useState, useEffect } from 'react';
import type { PlacedTile, DominoTile, PlacementSide, OpenEndInfo } from '../../../shared/types.js';
import { DominoTileView } from './DominoTileView.js';
import { ZoomIn, ZoomOut, Maximize2, PlusCircle, ArrowLeft, ArrowRight } from 'lucide-react';

interface DominoBoardProps {
  board: PlacedTile[];
  pendingPlacements: PlacedTile[];
  selectedTile: DominoTile | null;
  selectedRotation: number;
  openEnds?: OpenEndInfo[];
  isMyTurn: boolean;
  gameType: 'classic' | 'all-fives';
  onPlaceTile: (placement: {
    tileId: string;
    x: number;
    y: number;
    rotation: number;
    placementSide?: PlacementSide;
  }) => void;
}

export const DominoBoard: React.FC<DominoBoardProps> = ({
  board,
  pendingPlacements,
  selectedTile,
  selectedRotation,
  openEnds = [],
  isMyTurn,
  gameType,
  onPlaceTile,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch pinch-to-zoom tracking
  const [touchDistance, setTouchDistance] = useState<number | null>(null);

  // Auto-center board whenever new tiles are added
  const recenterBoard = () => {
    const allTiles = [...board, ...pendingPlacements];
    if (allTiles.length === 0) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const t of allTiles) {
      minX = Math.min(minX, t.x - 50);
      maxX = Math.max(maxX, t.x + 50);
      minY = Math.min(minY, t.y - 50);
      maxY = Math.max(maxY, t.y + 50);
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const containerW = containerRef.current?.clientWidth || 400;
    const containerH = containerRef.current?.clientHeight || 400;

    const scaleX = (containerW * 0.8) / Math.max(width, 200);
    const scaleY = (containerH * 0.8) / Math.max(height, 200);
    const fitZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 1.4);

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setZoom(fitZoom);
    setPan({ x: -midX * fitZoom, y: -midY * fitZoom });
  };

  useEffect(() => {
    if (board.length === 1 && pendingPlacements.length === 0) {
      recenterBoard();
    }
  }, [board.length]);

  // Mouse drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 2.2));
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchDistance(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && touchDistance !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchDistance;
      setZoom((prev) => Math.min(Math.max(prev * factor, 0.4), 2.2));
      setTouchDistance(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchDistance(null);
  };

  // Free placement on clicking felt table
  const handleTableClick = (e: React.MouseEvent) => {
    if (!selectedTile || !isMyTurn || isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Convert client coords into board space
    const clickX = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom;
    const clickY = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom;

    onPlaceTile({
      tileId: selectedTile.id,
      x: Math.round(clickX),
      y: Math.round(clickY),
      rotation: selectedRotation,
      placementSide: 'free',
    });
  };

  const allTiles = [...board, ...pendingPlacements];

  // Extremities for Left / Right snap buttons
  const leftMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), allTiles[0]) : null;
  const rightMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), allTiles[0]) : null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleTableClick}
      className="relative flex-1 w-full h-full overflow-hidden table-felt-pattern cursor-grab active:cursor-grabbing border-b-4 border-table-woodDark"
    >
      {/* Floating Viewport Controls */}
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5 bg-neutral-900/80 backdrop-blur p-1 rounded-xl shadow-lg border border-neutral-700">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.min(z * 1.2, 2.2));
          }}
          className="p-2 text-neutral-300 hover:text-white active:scale-95 transition"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.max(z * 0.8, 0.4));
          }}
          className="p-2 text-neutral-300 hover:text-white active:scale-95 transition"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            recenterBoard();
          }}
          className="p-2 text-emerald-400 hover:text-emerald-300 active:scale-95 transition"
          title="Recenter Table"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* 2D Board Surface (Centered with Pan & Zoom Transform) */}
      <div
        className="absolute w-0 h-0 transition-transform duration-75 ease-out"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Render Confirmed Placed Tiles */}
        {board.map((tile) => (
          <div
            key={tile.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            style={{
              left: `${tile.x}px`,
              top: `${tile.y}px`,
            }}
          >
            <DominoTileView
              sideA={tile.sideA}
              sideB={tile.sideB}
              rotation={tile.rotation}
            />
          </div>
        ))}

        {/* Render Unconfirmed Pending Placements */}
        {pendingPlacements.map((tile) => (
          <div
            key={tile.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            style={{
              left: `${tile.x}px`,
              top: `${tile.y}px`,
            }}
          >
            <DominoTileView
              sideA={tile.sideA}
              sideB={tile.sideB}
              rotation={tile.rotation}
              isPending={true}
            />
          </div>
        ))}

        {/* All Fives Open Ends Badges */}
        {gameType === 'all-fives' &&
          openEnds.map((end, idx) => (
            <div
              key={`open-end-${idx}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
              style={{
                left: `${end.x}px`,
                top: `${end.y}px`,
              }}
            >
              <div className="px-1.5 py-0.5 rounded-full bg-emerald-600/90 text-white font-black text-[11px] shadow border border-emerald-300 animate-bounce">
                {end.pipValue}
              </div>
            </div>
          ))}

        {/* Interactive Placement Targets when Tile is Selected */}
        {selectedTile && isMyTurn && (
          <>
            {allTiles.length === 0 ? (
              /* First Tile Center Target */
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onPlaceTile({
                    tileId: selectedTile.id,
                    x: 0,
                    y: 0,
                    rotation: selectedRotation,
                    placementSide: 'free',
                  });
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer pointer-events-auto group"
                style={{ left: '0px', top: '0px' }}
              >
                <div className="w-24 h-14 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-500/20 flex flex-col items-center justify-center p-2 text-emerald-200 text-xs font-bold text-center hover:bg-emerald-500/40 transition shadow-glow">
                  <PlusCircle size={20} className="mb-1 animate-pulse" />
                  Place First Tile
                </div>
              </div>
            ) : (
              /* Left and Right Quick-Snap Targets */
              <>
                {leftMost && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaceTile({
                        tileId: selectedTile.id,
                        x: leftMost.x - 90,
                        y: leftMost.y,
                        rotation: selectedRotation,
                        placementSide: 'left',
                      });
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer pointer-events-auto"
                    style={{
                      left: `${leftMost.x - 95}px`,
                      top: `${leftMost.y}px`,
                    }}
                  >
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg border border-emerald-300 transition-all hover:scale-105 active:scale-95">
                      <ArrowLeft size={14} /> Place Left
                    </button>
                  </div>
                )}

                {rightMost && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaceTile({
                        tileId: selectedTile.id,
                        x: rightMost.x + 90,
                        y: rightMost.y,
                        rotation: selectedRotation,
                        placementSide: 'right',
                      });
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer pointer-events-auto"
                    style={{
                      left: `${rightMost.x + 95}px`,
                      top: `${rightMost.y}px`,
                    }}
                  >
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg border border-emerald-300 transition-all hover:scale-105 active:scale-95">
                      Place Right <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Helpful Overlay Hint for Mobile Users */}
      {selectedTile && isMyTurn && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-neutral-900/90 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-lg text-center backdrop-blur">
            Tap Left/Right buttons, or tap anywhere on table for free placement
          </div>
        </div>
      )}
    </div>
  );
};
