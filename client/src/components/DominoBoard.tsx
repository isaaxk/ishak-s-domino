import React, { useRef, useState, useEffect } from 'react';
import type { PlacedTile, DominoTile, PlacementSide, OpenEndInfo } from '../../../shared/types.js';
import { DominoTileView } from './DominoTileView.js';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  PlusCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Check,
  Undo2,
  Sparkles,
} from 'lucide-react';

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
  onRotatePendingTile?: (tileId: string, newRotation: number) => void;
  onConfirmTurn?: () => void;
  onUndoTurn?: () => void;
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
  onRotatePendingTile,
  onConfirmTurn,
  onUndoTurn,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drag over target state for highlighting
  const [activeDropZone, setActiveDropZone] = useState<PlacementSide | 'center' | null>(null);

  // Touch pinch-to-zoom tracking
  const [touchDistance, setTouchDistance] = useState<number | null>(null);

  // Auto-center board
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
      minX = Math.min(minX, t.x - 60);
      maxX = Math.max(maxX, t.x + 60);
      minY = Math.min(minY, t.y - 60);
      maxY = Math.max(maxY, t.y + 60);
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const containerW = containerRef.current?.clientWidth || 400;
    const containerH = containerRef.current?.clientHeight || 400;

    const scaleX = (containerW * 0.8) / Math.max(width, 220);
    const scaleY = (containerH * 0.8) / Math.max(height, 220);
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

  // HTML5 Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    if (!isMyTurn) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDropOnTable = (e: React.DragEvent) => {
    if (!isMyTurn) return;
    e.preventDefault();
    const tileId = e.dataTransfer.getData('text/plain') || selectedTile?.id;
    if (!tileId) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom;
    const clickY = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom;

    onPlaceTile({
      tileId,
      x: Math.round(clickX),
      y: Math.round(clickY),
      rotation: selectedRotation,
      placementSide: 'free',
    });
    setActiveDropZone(null);
  };

  const handleDropOnSide = (e: React.DragEvent, side: PlacementSide) => {
    if (!isMyTurn) return;
    e.preventDefault();
    e.stopPropagation();
    const tileId = e.dataTransfer.getData('text/plain') || selectedTile?.id;
    if (!tileId) return;

    onPlaceTile({
      tileId,
      x: 0,
      y: 0,
      rotation: side === 'top' || side === 'bottom' ? 90 : selectedRotation,
      placementSide: side,
    });
    setActiveDropZone(null);
  };

  const allTiles = [...board, ...pendingPlacements];

  // Extremities for 4-way snap targets (Left, Right, Top, Bottom)
  const leftMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), allTiles[0]) : null;
  const rightMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), allTiles[0]) : null;
  const topMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), allTiles[0]) : null;
  const bottomMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), allTiles[0]) : null;

  // Active staged pending tile (for on-tile rotation controls)
  const activePendingTile = pendingPlacements.length > 0 ? pendingPlacements[pendingPlacements.length - 1] : null;

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
      onDragOver={handleDragOver}
      onDrop={handleDropOnTable}
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
        {/* 1. Confirmed Placed Tiles */}
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

        {/* 2. Staged Pending Placements with On-Tile Rotation & Confirmation Toolbar */}
        {pendingPlacements.map((tile) => {
          const isCurrentActive = activePendingTile?.id === tile.id;

          return (
            <div
              key={tile.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-40"
              style={{
                left: `${tile.x}px`,
                top: `${tile.y}px`,
              }}
            >
              {/* The Staged Domino */}
              <DominoTileView
                sideA={tile.sideA}
                sideB={tile.sideB}
                rotation={tile.rotation}
                isPending={true}
              />

              {/* Interactive On-Tile Toolbar: 4 Ways Rotation & Confirmation */}
              {isMyTurn && isCurrentActive && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900/95 border-2 border-amber-400 rounded-2xl shadow-2xl p-1.5 flex items-center gap-1.5 backdrop-blur-md animate-bounce-short z-50 whitespace-nowrap"
                >
                  {/* Rotate 90° Cycle Button */}
                  <button
                    onClick={() => {
                      const nextRot = (tile.rotation + 90) % 360;
                      onRotatePendingTile?.(tile.id, nextRot);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-black rounded-xl shadow transition"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw size={14} /> Rotate ({tile.rotation}°)
                  </button>

                  {/* 4 Direct Orientation Buttons (0°, 90°, 180°, 270°) */}
                  <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                    {[0, 90, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => onRotatePendingTile?.(tile.id, deg)}
                        className={`px-1.5 py-1 text-[10px] font-bold rounded-lg transition ${
                          tile.rotation === deg
                            ? 'bg-emerald-600 text-white font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>

                  {/* Undo Move Button */}
                  {onUndoTurn && (
                    <button
                      onClick={onUndoTurn}
                      className="p-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded-xl shadow active:scale-95 transition"
                      title="Undo move"
                    >
                      <Undo2 size={15} />
                    </button>
                  )}

                  {/* Confirm Turn Button directly on tile */}
                  {onConfirmTurn && (
                    <button
                      onClick={onConfirmTurn}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-glow active:scale-95 transition"
                      title="Confirm Turn"
                    >
                      <Check size={15} /> Confirm
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 3. All Fives Open Ends Badges */}
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

        {/* 4. The 4 Drop / Placement Target Zones (Left, Right, Top, Bottom) */}
        {isMyTurn && selectedTile && pendingPlacements.length === 0 && (
          <>
            {allTiles.length === 0 ? (
              /* Center Target for First Tile */
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
                onDragOver={(e) => {
                  e.preventDefault();
                  setActiveDropZone('center');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPlaceTile({
                    tileId: selectedTile.id,
                    x: 0,
                    y: 0,
                    rotation: selectedRotation,
                    placementSide: 'free',
                  });
                  setActiveDropZone(null);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer pointer-events-auto transition-all ${
                  activeDropZone === 'center' ? 'scale-110' : ''
                }`}
                style={{ left: '0px', top: '0px' }}
              >
                <div className="w-28 h-16 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-500/20 flex flex-col items-center justify-center p-2 text-emerald-200 text-xs font-bold text-center hover:bg-emerald-500/40 transition shadow-glow">
                  <PlusCircle size={22} className="mb-1 animate-pulse" />
                  Drop First Tile Here
                </div>
              </div>
            ) : (
              /* The 4 Placement Sides: Left, Right, Top, Bottom */
              <>
                {/* ⬅️ 1. Left Side Target */}
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
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropZone('left');
                    }}
                    onDrop={(e) => handleDropOnSide(e, 'left')}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer pointer-events-auto transition-all ${
                      activeDropZone === 'left' ? 'scale-110' : ''
                    }`}
                    style={{
                      left: `${leftMost.x - 95}px`,
                      top: `${leftMost.y}px`,
                    }}
                  >
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-2xl border-2 border-emerald-300 transition-all hover:scale-105 active:scale-95">
                      <ArrowLeft size={16} /> Put Left
                    </button>
                  </div>
                )}

                {/* ➡️ 2. Right Side Target */}
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
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropZone('right');
                    }}
                    onDrop={(e) => handleDropOnSide(e, 'right')}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer pointer-events-auto transition-all ${
                      activeDropZone === 'right' ? 'scale-110' : ''
                    }`}
                    style={{
                      left: `${rightMost.x + 95}px`,
                      top: `${rightMost.y}px`,
                    }}
                  >
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-2xl border-2 border-emerald-300 transition-all hover:scale-105 active:scale-95">
                      Put Right <ArrowRight size={16} />
                    </button>
                  </div>
                )}

                {/* ⬆️ 3. Top Side Target */}
                {topMost && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaceTile({
                        tileId: selectedTile.id,
                        x: topMost.x,
                        y: topMost.y - 70,
                        rotation: 90,
                        placementSide: 'top',
                      });
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropZone('top');
                    }}
                    onDrop={(e) => handleDropOnSide(e, 'top')}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer pointer-events-auto transition-all ${
                      activeDropZone === 'top' ? 'scale-110' : ''
                    }`}
                    style={{
                      left: `${topMost.x}px`,
                      top: `${topMost.y - 75}px`,
                    }}
                  >
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black shadow-2xl border-2 border-emerald-300 transition-all hover:scale-105 active:scale-95">
                      <ArrowUp size={16} /> Put Top
                    </button>
                  </div>
                )}

                {/* ⬇️ 4. Bottom Side Target */}
                {bottomMost && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaceTile({
                        tileId: selectedTile.id,
                        x: bottomMost.x,
                        y: bottomMost.y + 70,
                        rotation: 90,
                        placementSide: 'bottom',
                      });
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setActiveDropZone('bottom');
                    }}
                    onDrop={(e) => handleDropOnSide(e, 'bottom')}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer pointer-events-auto transition-all ${
                      activeDropZone === 'bottom' ? 'scale-110' : ''
                    }`}
                    style={{
                      left: `${bottomMost.x}px`,
                      top: `${bottomMost.y + 75}px`,
                    }}
                  >
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black shadow-2xl border-2 border-emerald-300 transition-all hover:scale-105 active:scale-95">
                      Put Bottom <ArrowDown size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Helpful Overlay Instruction */}
      {selectedTile && isMyTurn && pendingPlacements.length === 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fadeIn">
          <div className="px-4 py-2 rounded-full bg-neutral-900/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-2xl text-center backdrop-blur flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            Drag & drop or tap: Left, Right, Top, Bottom, or anywhere on table
          </div>
        </div>
      )}
    </div>
  );
};
