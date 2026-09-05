import React, { useRef, useState, useEffect } from 'react';
import { getMatchingRotation, calculateOpenEnds, type PlacedTile, type DominoTile, type PlacementSide, type OpenEndInfo, type MoveSummary } from '../../../shared/types.js';
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
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  RotateCw,
  Check,
  Undo2,
  X,
  Sparkles,
  Edit3,
  Plus,
  SkipForward,
} from 'lucide-react';

interface DominoBoardProps {
  board: PlacedTile[];
  pendingPlacements: PlacedTile[];
  selectedTile: DominoTile | null;
  selectedRotation: number;
  openEnds?: OpenEndInfo[];
  isMyTurn: boolean;
  myPlayerId?: string;
  canChangeLastMove?: boolean;
  canUndoPass?: boolean;
  gameType: 'classic' | 'all-fives';
  lastMoveSummary?: MoveSummary | null;
  onPlaceTile: (placement: {
    tileId: string;
    x: number;
    y: number;
    rotation: number;
    placementSide?: PlacementSide;
    attachedToId?: string;
  }) => void;
  onRotatePendingTile?: (tileId: string, newRotation: number) => void;
  onConfirmTurn?: () => void;
  onUndoTurn?: () => void;
  onChangeLastMove?: () => void;
  onUndoPass?: () => void;
}

export const DominoBoard: React.FC<DominoBoardProps> = ({
  board,
  pendingPlacements,
  selectedTile,
  selectedRotation,
  openEnds = [],
  isMyTurn,
  myPlayerId,
  canChangeLastMove = false,
  canUndoPass = false,
  gameType,
  lastMoveSummary,
  onPlaceTile,
  onRotatePendingTile,
  onConfirmTurn,
  onUndoTurn,
  onChangeLastMove,
  onUndoPass,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drag over target state for highlighting
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);

  // Two-step placement state: Step 1 (null: show Put buttons at open ends), Step 2 (number: index of selected open end)
  const [selectedEndIndex, setSelectedEndIndex] = useState<number | null>(null);

  // Action notification banner for other players (Purple for pass/undo pass, Orange for draw)
  const [tableNotification, setTableNotification] = useState<{
    text: string;
    type: 'purple' | 'orange';
    action: 'pass' | 'undo_pass' | 'draw';
    timestamp: number;
  } | null>(null);

  const lastProcessedSummaryTimestamp = useRef<number>(0);

  useEffect(() => {
    if (!lastMoveSummary || !lastMoveSummary.timestamp) return;
    if (lastMoveSummary.timestamp === lastProcessedSummaryTimestamp.current) return;
    lastProcessedSummaryTimestamp.current = lastMoveSummary.timestamp;

    // "write for other players"
    const isOtherPlayer = myPlayerId ? lastMoveSummary.playerId !== myPlayerId : true;
    if (!isOtherPlayer) return;

    if (lastMoveSummary.moveType === 'pass' || lastMoveSummary.moveType === 'undo_pass') {
      setTableNotification({
        text: lastMoveSummary.description,
        type: 'purple',
        action: lastMoveSummary.moveType,
        timestamp: lastMoveSummary.timestamp,
      });
    } else if (lastMoveSummary.moveType === 'draw') {
      setTableNotification({
        text: lastMoveSummary.description,
        type: 'orange',
        action: 'draw',
        timestamp: lastMoveSummary.timestamp,
      });
    }
  }, [lastMoveSummary, myPlayerId]);

  // Auto clear table notification after 6 seconds
  useEffect(() => {
    if (!tableNotification) return;
    const timer = setTimeout(() => {
      setTableNotification(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [tableNotification?.timestamp]);

  // Reset selected end when tile changes or placement is staged
  useEffect(() => {
    setSelectedEndIndex(null);
  }, [selectedTile?.id, pendingPlacements.length]);

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

  const allTiles = [...board, ...pendingPlacements];

  // Open ends of the chain (used for placing Put buttons strictly at the open ends)
  const effectiveOpenEnds = (openEnds && openEnds.length > 0)
    ? openEnds
    : (allTiles.length > 0 ? calculateOpenEnds(allTiles).openEnds : []);

  // Extremities for 4-way snap targets (Left, Right, Top, Bottom)
  const leftMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.x < prev.x ? curr : prev), allTiles[0]) : null;
  const rightMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.x > prev.x ? curr : prev), allTiles[0]) : null;
  const topMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.y < prev.y ? curr : prev), allTiles[0]) : null;
  const bottomMost = allTiles.length > 0 ? allTiles.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), allTiles[0]) : null;

  // Active staged pending tile (for on-tile rotation controls)
  const activePendingTile = pendingPlacements.length > 0 ? pendingPlacements[pendingPlacements.length - 1] : null;

  // Helper to find closest snap point among straight & turn placements
  const findBestSnapTarget = (clickX: number, clickY: number) => {
    if (allTiles.length === 0) {
      return { side: 'free' as PlacementSide, attachedToId: undefined, rotation: selectedRotation };
    }

    const spineY = leftMost && rightMost ? (leftMost.y + rightMost.y) / 2 : (board[0]?.y ?? 0);
    const candidates: { side: PlacementSide; dist: number; attachedToId?: string; rotation: number }[] = [];

    if (leftMost) {
      // Straight left
      candidates.push({
        side: 'left',
        dist: Math.hypot(clickX - (leftMost.x - 60), clickY - leftMost.y),
        attachedToId: leftMost.id,
        rotation: selectedRotation,
      });
      // Left turn-up
      candidates.push({
        side: 'turn-up',
        dist: Math.hypot(clickX - (leftMost.x - 20), clickY - (leftMost.y - 60)),
        attachedToId: leftMost.id,
        rotation: 90,
      });
      // Left turn-down
      candidates.push({
        side: 'turn-down',
        dist: Math.hypot(clickX - (leftMost.x - 20), clickY - (leftMost.y + 60)),
        attachedToId: leftMost.id,
        rotation: 90,
      });
    }

    if (rightMost) {
      // Straight right
      candidates.push({
        side: 'right',
        dist: Math.hypot(clickX - (rightMost.x + 60), clickY - rightMost.y),
        attachedToId: rightMost.id,
        rotation: selectedRotation,
      });
      // Right turn-up
      candidates.push({
        side: 'turn-up',
        dist: Math.hypot(clickX - (rightMost.x + 20), clickY - (rightMost.y - 60)),
        attachedToId: rightMost.id,
        rotation: 90,
      });
      // Right turn-down
      candidates.push({
        side: 'turn-down',
        dist: Math.hypot(clickX - (rightMost.x + 20), clickY - (rightMost.y + 60)),
        attachedToId: rightMost.id,
        rotation: 90,
      });
    }

    if (topMost && (gameType === 'all-fives' || topMost.y < spineY - 20)) {
      candidates.push({
        side: 'top',
        dist: Math.hypot(clickX - topMost.x, clickY - (topMost.y - 60)),
        attachedToId: topMost.id,
        rotation: 90,
      });
      candidates.push({
        side: 'turn-left',
        dist: Math.hypot(clickX - (topMost.x - 60), clickY - (topMost.y - 20)),
        attachedToId: topMost.id,
        rotation: 0,
      });
      candidates.push({
        side: 'turn-right',
        dist: Math.hypot(clickX - (topMost.x + 60), clickY - (topMost.y - 20)),
        attachedToId: topMost.id,
        rotation: 0,
      });
    }

    if (bottomMost && (gameType === 'all-fives' || bottomMost.y > spineY + 20)) {
      candidates.push({
        side: 'bottom',
        dist: Math.hypot(clickX - bottomMost.x, clickY - (bottomMost.y + 60)),
        attachedToId: bottomMost.id,
        rotation: 90,
      });
      candidates.push({
        side: 'turn-left',
        dist: Math.hypot(clickX - (bottomMost.x - 60), clickY - (bottomMost.y + 20)),
        attachedToId: bottomMost.id,
        rotation: 0,
      });
      candidates.push({
        side: 'turn-right',
        dist: Math.hypot(clickX - (bottomMost.x + 60), clickY - (bottomMost.y + 20)),
        attachedToId: bottomMost.id,
        rotation: 0,
      });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dist - b.dist);
      return candidates[0];
    }

    return { side: 'right' as PlacementSide, attachedToId: undefined, rotation: selectedRotation };
  };

  // Two-step direction placement handler: places tile attached to specific open end with automatic matching rotation
  const handlePlaceAtEnd = (
    end: OpenEndInfo,
    outwardDir: 'left' | 'right' | 'top' | 'bottom',
    placementSide: PlacementSide,
    buttonX: number,
    buttonY: number
  ) => {
    if (!selectedTile) return;

    const baseTile = allTiles.find((t) => t.id === end.tileId) || allTiles[0];
    const isLeftOrTop = outwardDir === 'left' || outwardDir === 'top';
    const rot = getMatchingRotation(
      selectedTile,
      placementSide,
      baseTile || undefined,
      isLeftOrTop,
      end.pipValue
    );

    onPlaceTile({
      tileId: selectedTile.id,
      x: buttonX,
      y: buttonY,
      rotation: rot,
      placementSide,
      attachedToId: end.tileId,
    });

    setSelectedEndIndex(null);
  };

  // Smart snap placement on clicking felt table
  const handleTableClick = (e: React.MouseEvent) => {
    if (selectedEndIndex !== null) {
      setSelectedEndIndex(null);
      return;
    }
    if (!selectedTile || !isMyTurn || isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom;
    const clickY = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom;

    const snap = findBestSnapTarget(clickX, clickY);
    const baseTile = allTiles.find((t) => t.id === snap.attachedToId);
    const isLeftOrTop = snap.side === 'left' || snap.side === 'top' || (snap.side === 'turn-up' && baseTile?.id === leftMost?.id);
    const rot = getMatchingRotation(selectedTile, snap.side, baseTile, isLeftOrTop);

    onPlaceTile({
      tileId: selectedTile.id,
      x: 0,
      y: 0,
      rotation: rot,
      placementSide: snap.side,
      attachedToId: snap.attachedToId,
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
    if (!tileId || !selectedTile) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom;
    const clickY = (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom;

    const snap = findBestSnapTarget(clickX, clickY);
    const baseTile = allTiles.find((t) => t.id === snap.attachedToId);
    const isLeftOrTop = snap.side === 'left' || snap.side === 'top' || (snap.side === 'turn-up' && baseTile?.id === leftMost?.id);
    const rot = getMatchingRotation(selectedTile, snap.side, baseTile, isLeftOrTop);

    onPlaceTile({
      tileId,
      x: 0,
      y: 0,
      rotation: rot,
      placementSide: snap.side,
      attachedToId: snap.attachedToId,
    });
    setActiveDropZone(null);
  };

  const handleDropOnSide = (
    e: React.DragEvent,
    side: PlacementSide,
    attachedToId?: string
  ) => {
    if (!isMyTurn || !selectedTile) return;
    e.preventDefault();
    e.stopPropagation();
    const tileId = e.dataTransfer.getData('text/plain') || selectedTile.id;

    const baseTile = allTiles.find((t) => t.id === attachedToId);
    const isLeftOrTop = side === 'left' || side === 'top';
    const rot = getMatchingRotation(selectedTile, side, baseTile, isLeftOrTop);

    onPlaceTile({
      tileId,
      x: 0,
      y: 0,
      rotation: rot,
      placementSide: side,
      attachedToId,
    });
    setActiveDropZone(null);
    setSelectedEndIndex(null);
  };

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
        {/* 0. In-Table Felt Gold Branding: ISHAK'S DOMINO */}
        <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none text-center z-0">
          <div className="font-serif font-black tracking-[0.25em] text-4xl sm:text-6xl uppercase text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] opacity-35 whitespace-nowrap">
            ISHAK&apos;S DOMINO
          </div>
          <div className="text-[10px] sm:text-xs tracking-[0.45em] text-amber-400/50 font-bold uppercase mt-1">
            ★ CLASSIC &amp; ALL FIVES ★
          </div>
        </div>

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
                  className={`absolute left-1/2 -translate-x-1/2 bg-slate-900/95 border-2 border-amber-400 rounded-2xl shadow-2xl p-1.5 flex items-center gap-1.5 backdrop-blur-md animate-bounce-short z-50 whitespace-nowrap ${
                    tile.placementSide === 'bottom' || tile.y > 20
                      ? 'top-[100%] mt-3.5'
                      : 'bottom-[100%] mb-3.5'
                  }`}
                >
                  {/* Rotate 90° Cycle Button */}
                  <button
                    onClick={() => {
                      const nextRot = (tile.rotation + 90) % 360;
                      onRotatePendingTile?.(tile.id, nextRot);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-black rounded-xl shadow transition"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw size={14} /> Rotate ({tile.rotation}°)
                  </button>

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
                    rotation: selectedTile.isDouble ? 90 : selectedRotation,
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
                    rotation: selectedTile.isDouble ? 90 : selectedRotation,
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
              /* The Put Buttons strictly at the open ends */
              <>
                {effectiveOpenEnds.map((end, idx) => {
                  const baseTile = allTiles.find((t) => t.id === end.tileId) || allTiles[0];
                  const dx = end.x - baseTile.x;
                  const dy = end.y - baseTile.y;

                  let outwardDir: 'left' | 'right' | 'top' | 'bottom';
                  if (Math.abs(dx) > Math.abs(dy)) {
                    outwardDir = dx > 0 ? 'right' : 'left';
                  } else {
                    outwardDir = dy > 0 ? 'bottom' : 'top';
                  }

                  let buttonX = end.x;
                  let buttonY = end.y;
                  if (outwardDir === 'top') {
                    buttonY = end.y - 45;
                  } else if (outwardDir === 'bottom') {
                    buttonY = end.y + 45;
                  } else if (outwardDir === 'left') {
                    buttonX = end.x - 50;
                  } else {
                    buttonX = end.x + 50;
                  }

                  const isSelected = selectedEndIndex === idx;

                  return (
                    <div
                      key={`open-end-${end.tileId}-${end.side}-${idx}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto flex flex-col items-center gap-1.5"
                      style={{
                        left: `${buttonX}px`,
                        top: `${buttonY}px`,
                      }}
                    >
                      {isSelected ? (
                        /* Step 2: Show directions (Straight, Turn, Cancel) */
                        <div className="flex items-center gap-1.5 bg-slate-900/95 p-1.5 rounded-2xl border-2 border-emerald-400 shadow-2xl backdrop-blur animate-bounce-short z-50 whitespace-nowrap">
                          {outwardDir === 'left' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'left', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Straight Left"
                              >
                                <ArrowLeft size={14} /> Straight
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'turn-up', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Turn Up"
                              >
                                <CornerUpLeft size={14} /> ↰ Up
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'turn-down', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Turn Down"
                              >
                                <CornerDownLeft size={14} /> ↲ Down
                              </button>
                            </>
                          )}

                          {outwardDir === 'right' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'right', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Straight Right"
                              >
                                Straight <ArrowRight size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'turn-up', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Turn Up"
                              >
                                ↱ Up <CornerUpRight size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'turn-down', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Turn Down"
                              >
                                ↳ Down <CornerDownRight size={14} />
                              </button>
                            </>
                          )}

                          {outwardDir === 'top' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'top', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Straight Up"
                              >
                                <ArrowUp size={14} /> Straight
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'turn-left', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Turn Left"
                              >
                                <CornerUpLeft size={14} /> ↰ Left
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'turn-right', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Turn Right"
                              >
                                <CornerUpRight size={14} /> ↱ Right
                              </button>
                            </>
                          )}

                          {outwardDir === 'bottom' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'bottom', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Straight Down"
                              >
                                <ArrowDown size={14} /> Straight
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'turn-left', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Turn Left"
                              >
                                <CornerDownLeft size={14} /> ↲ Left
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlaceAtEnd(end, outwardDir, 'turn-right', buttonX, buttonY);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow active:scale-95 transition"
                                title="Turn Right"
                              >
                                <CornerDownRight size={14} /> ↳ Right
                              </button>
                            </>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEndIndex(null);
                            }}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white active:scale-95 transition"
                            title="Back / Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        /* Step 1: Just show "Put" button at the open end */
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEndIndex(idx);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setActiveDropZone(`end-${idx}`);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setActiveDropZone(null);
                            const straightSide: PlacementSide = outwardDir;
                            handlePlaceAtEnd(end, outwardDir, straightSide, buttonX, buttonY);
                          }}
                          className={`flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black shadow-2xl border-2 border-emerald-300 transition-all hover:scale-105 active:scale-95 ${
                            activeDropZone === `end-${idx}` ? 'scale-110 ring-2 ring-emerald-300' : ''
                          }`}
                        >
                          Put
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Change Last Move Banner */}
      {canChangeLastMove && pendingPlacements.length === 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 animate-fadeIn">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChangeLastMove?.();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-2xl border-2 border-amber-300 animate-pulse active:scale-95 transition"
          >
            <Edit3 size={15} /> You can change your move! (Tap to edit)
          </button>
        </div>
      )}

      {/* Undo Pass Banner */}
      {canUndoPass && pendingPlacements.length === 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 animate-fadeIn">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUndoPass?.();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-2xl border-2 border-indigo-300 animate-pulse active:scale-95 transition"
          >
            <Undo2 size={15} /> You passed! (Tap to Undo Pass)
          </button>
        </div>
      )}

      {/* Action Notification Banner for other players (Purple for pass/undo pass, Orange for took a tile) */}
      {tableNotification && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 animate-fadeIn pointer-events-auto">
          {tableNotification.type === 'purple' ? (
            <div
              onClick={() => setTableNotification(null)}
              className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-purple-700/95 hover:bg-purple-600/95 border-2 border-purple-300 text-white text-base font-black shadow-2xl shadow-purple-950/80 backdrop-blur transition active:scale-95 cursor-pointer"
              title="Click to dismiss"
            >
              {tableNotification.action === 'undo_pass' ? (
                <Undo2 size={20} className="text-purple-200 flex-shrink-0" />
              ) : (
                <SkipForward size={20} className="text-purple-200 flex-shrink-0" />
              )}
              <span className="tracking-wide">{tableNotification.text}</span>
            </div>
          ) : (
            <div
              onClick={() => setTableNotification(null)}
              className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-orange-600/95 hover:bg-orange-500/95 border-2 border-orange-300 text-white text-base font-black shadow-2xl shadow-orange-950/80 backdrop-blur transition active:scale-95 cursor-pointer"
              title="Click to dismiss"
            >
              <Plus size={20} className="text-orange-200 flex-shrink-0" />
              <span className="tracking-wide">{tableNotification.text}</span>
            </div>
          )}
        </div>
      )}

      {/* Helpful Overlay Instruction */}
      {selectedTile && isMyTurn && pendingPlacements.length === 0 && (
        <div
          className={`absolute ${
            canChangeLastMove || canUndoPass || tableNotification ? 'top-16' : 'top-3'
          } left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fadeIn transition-all`}
        >
          <div className="px-4 py-2 rounded-full bg-neutral-900/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-2xl text-center backdrop-blur flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            {selectedEndIndex !== null
              ? 'Step 2: Choose direction (Straight or Turn)'
              : 'Step 1: Choose open end (Click "Put")'}
          </div>
        </div>
      )}
    </div>
  );
};
