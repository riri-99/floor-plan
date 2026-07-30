"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { ROOM_TYPES, PPF, nextRoomId, DEFAULT_CATEGORIES } from "./presets";
import { CategoryMap, CategoryPlan, Floor, RoomElement, RoomType } from "./types";
import { loadPlanState, savePlanState, clearPlanState } from "./planStorage";

const PLOT_PADDING = 20;

export default function PlanStudioPage() {
  const router = useRouter();

  // hydrate from a previously saved session if one exists, otherwise start fresh
  const [categories, setCategories] = useState<CategoryMap>(() => {
    const saved = loadPlanState();
    return saved ? saved.categories : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  });
  const [currentCategoryKey, setCurrentCategoryKey] = useState<string>(() => {
    const saved = loadPlanState();
    return saved ? saved.currentCategoryKey : "villa";
  });
  const [currentFloorIdx, setCurrentFloorIdx] = useState<number>(() => {
    const saved = loadPlanState();
    return saved ? saved.currentFloorIdx : 0;
  });
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  // persist on every change so the 3D page (and a future revisit) sees the latest edits
  useEffect(() => {
    savePlanState(categories, currentCategoryKey, currentFloorIdx);
  }, [categories, currentCategoryKey, currentFloorIdx]);

  const currentCategory: CategoryPlan = categories[currentCategoryKey];
  const currentFloor: Floor = currentCategory.floors[currentFloorIdx];
  const selectedRoom: RoomElement | undefined = currentFloor.rooms.find(
    (r) => r.id === selectedRoomId
  );

  const plotW = currentCategory.plot.w * PPF;
  const plotH = currentCategory.plot.h * PPF;

  const totalArea = useMemo(
    () =>
      currentFloor.rooms
        .filter((r) => r.type !== "door")
        .reduce((sum, r) => sum + r.w * r.h, 0),
    [currentFloor]
  );

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<RoomType, number>> = {};
    currentFloor.rooms.forEach((r) => {
      if (r.type === "door") return;
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return counts;
  }, [currentFloor]);

  /* ---------- mutation helpers ---------- */

  function updateFloor(mutator: (floor: Floor) => Floor) {
    setCategories((prev) => {
      const next = { ...prev };
      const cat: CategoryPlan = JSON.parse(JSON.stringify(next[currentCategoryKey]));
      cat.floors[currentFloorIdx] = mutator(cat.floors[currentFloorIdx]);
      next[currentCategoryKey] = cat;
      return next;
    });
  }

  function updateRoom(id: number, patch: Partial<RoomElement>) {
    updateFloor((floor) => ({
      ...floor,
      rooms: floor.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function deleteRoom(id: number) {
    updateFloor((floor) => ({
      ...floor,
      rooms: floor.rooms.filter((r) => r.id !== id),
    }));
    setSelectedRoomId(null);
  }

  function addRoom(type: RoomType, gx: number, gy: number) {
    const def = ROOM_TYPES[type];
    const id = nextRoomId();
    const newRoom: RoomElement = {
      id,
      type,
      label: def.label,
      x: Math.max(0, gx),
      y: Math.max(0, gy),
      w: type === "door" ? 3 : 8,
      h: type === "door" ? 1 : 8,
    };
    updateFloor((floor) => ({ ...floor, rooms: [...floor.rooms, newRoom] }));
    setSelectedRoomId(id);
  }

  function addFloor() {
    setCategories((prev) => {
      const next = { ...prev };
      const cat: CategoryPlan = JSON.parse(JSON.stringify(next[currentCategoryKey]));
      const n = cat.floors.length + 1;
      const ord = n === 1 ? "Ground" : n === 2 ? "First" : n === 3 ? "Second" : `${n - 1}th`;
      cat.floors.push({ name: `${ord} Floor`, rooms: [] });
      next[currentCategoryKey] = cat;
      setCurrentFloorIdx(cat.floors.length - 1);
      return next;
    });
    setSelectedRoomId(null);
  }

  function switchCategory(key: string) {
    setCurrentCategoryKey(key);
    setCurrentFloorIdx(0);
    setSelectedRoomId(null);
  }

  function resetCurrentCategory() {
    const ok = window.confirm(
      `Reset "${currentCategory.name}" back to its default layout? Your edits to this category will be lost.`
    );
    if (!ok) return;
    setCategories((prev) => ({
      ...prev,
      [currentCategoryKey]: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES[currentCategoryKey])),
    }));
    setCurrentFloorIdx(0);
    setSelectedRoomId(null);
  }

  function resetEverything() {
    const ok = window.confirm("Reset ALL categories back to their default layouts?");
    if (!ok) return;
    setCategories(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
    clearPlanState();
    setCurrentCategoryKey("villa");
    setCurrentFloorIdx(0);
    setSelectedRoomId(null);
  }

  function goTo3D() {
    savePlanState(categories, currentCategoryKey, currentFloorIdx);
    router.push("/plan-studio/3d");
  }

  /* ---------- drag to move ---------- */

  function handleRoomMouseDown(e: React.MouseEvent, room: RoomElement) {
    if ((e.target as HTMLElement).dataset.handle) return; // resize handle handles itself
    if ((e.target as HTMLElement).dataset.delete) return;
    e.stopPropagation();
    setSelectedRoomId(room.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = room.x;
    const origY = room.y;

    function onMove(ev: MouseEvent) {
      const dx = Math.round((ev.clientX - startX) / PPF);
      const dy = Math.round((ev.clientY - startY) / PPF);
      updateRoom(room.id, { x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) });
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /* ---------- drag to resize ---------- */

  function handleResizeMouseDown(e: React.MouseEvent, room: RoomElement) {
    e.stopPropagation();
    setSelectedRoomId(room.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origW = room.w;
    const origH = room.h;

    function onMove(ev: MouseEvent) {
      const dw = Math.round((ev.clientX - startX) / PPF);
      const dh = Math.round((ev.clientY - startY) / PPF);
      updateRoom(room.id, { w: Math.max(3, origW + dw), h: Math.max(3, origH + dh) });
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /* ---------- drop new element from palette ---------- */

  function handleCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/plain") as RoomType;
    if (!type || !ROOM_TYPES[type]) return;
    const shell = shellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const offsetX = Math.max(PLOT_PADDING, (rect.width - plotW) / 2);
    const offsetY = Math.max(PLOT_PADDING, (rect.height - plotH) / 2);
    const dropX = e.clientX - rect.left - offsetX;
    const dropY = e.clientY - rect.top - offsetY;
    addRoom(type, Math.round(dropX / PPF), Math.round(dropY / PPF));
  }

  function handleCanvasBackgroundMouseDown(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setSelectedRoomId(null);
  }

  const shellRect = shellRef.current?.getBoundingClientRect();
  const offsetX = shellRect ? Math.max(PLOT_PADDING, (shellRect.width - plotW) / 2) : PLOT_PADDING;
  const offsetY = shellRect ? Math.max(PLOT_PADDING, (shellRect.height - plotH) / 2) : PLOT_PADDING;

  return (
    <div className={styles.wrapper}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>BB</div>
          <div>
            <div className={styles.brandName}>Plan Studio</div>
            <div className={styles.brandSub}>2D Design Layer // BuilderBharat OS</div>
          </div>
        </div>
        <div className={styles.topbarRight}>
          <span className={`${styles.tag} ${styles.tagLive}`}>design mode</span>
          <span className={styles.tag}>cost estimation — phase 2</span>
        </div>
      </div>

      <div className={styles.layout}>
        {/* LEFT SIDEBAR */}
        <div className={styles.sidebar}>
          <div className={styles.sectionLabel}>Building Type</div>
          <div className={styles.categoryList}>
            {Object.values(categories).map((cat) => (
              <button
                key={cat.key}
                className={`${styles.categoryBtn} ${
                  cat.key === currentCategoryKey ? styles.categoryBtnActive : ""
                }`}
                onClick={() => switchCategory(cat.key)}
              >
                <span>{cat.name}</span>
                <span className={styles.categoryMeta}>{cat.meta}</span>
              </button>
            ))}
          </div>

          <div className={styles.sectionLabel}>Drag Elements Onto Plan</div>
          <div className={styles.paletteGrid}>
            {(Object.keys(ROOM_TYPES) as RoomType[]).map((type) => (
              <div
                key={type}
                className={styles.paletteItem}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", type)}
              >
                <span className={styles.swatch} style={{ background: ROOM_TYPES[type].color }} />
                <span>{ROOM_TYPES[type].label}</span>
              </div>
            ))}
          </div>

          <div className={styles.hint}>
            Click a preset above to load a base layout. Drag any block to move it, drag the
            corner handle to resize, click the badge to delete. Drag palette items onto the plan
            to add new rooms or doors.
          </div>
        </div>

        {/* CENTER CANVAS */}
        <div className={styles.center}>
          <div className={styles.canvasHeader}>
            <div className={styles.canvasTitle}>
              {currentCategory.name}
              <span className={styles.canvasTitleSub}> // {currentFloor.name.toUpperCase()}</span>
            </div>
            <div className={styles.floorTabs}>
              {currentCategory.floors.map((floor, idx) => (
                <div
                  key={idx}
                  className={`${styles.floorTab} ${
                    idx === currentFloorIdx ? styles.floorTabActive : ""
                  }`}
                  onClick={() => {
                    setCurrentFloorIdx(idx);
                    setSelectedRoomId(null);
                  }}
                >
                  {floor.name}
                </div>
              ))}
              <div className={`${styles.floorTab} ${styles.floorTabAdd}`} onClick={addFloor}>
                + Add Floor
              </div>
            </div>
          </div>

          <div className={styles.actionBar}>
            <button className={styles.ghostBtn} onClick={resetCurrentCategory}>
              ↺ Reset This Design
            </button>
            <button className={styles.ghostBtnMuted} onClick={resetEverything}>
              Reset All Categories
            </button>
            <button className={styles.primaryBtn} onClick={goTo3D}>
              Show My Plan in 3D →
            </button>
          </div>

          <div
            className={styles.canvasShell}
            ref={shellRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
            onMouseDown={handleCanvasBackgroundMouseDown}
          >
            <div className={styles.canvasToolbar}>
              <div className={styles.chip}>
                SCALE <b>1:100</b>
              </div>
              <div className={styles.chip}>
                GRID <b>ON</b>
              </div>
              <div className={styles.chip}>
                UNITS <b>FT</b>
              </div>
            </div>

            <div
              className={styles.plot}
              style={{ left: offsetX, top: offsetY, width: plotW, height: plotH }}
            />

            {currentFloor.rooms.map((room) => {
              const def = ROOM_TYPES[room.type];
              const isSelected = room.id === selectedRoomId;
              return (
                <div
                  key={room.id}
                  className={`${styles.room} ${isSelected ? styles.roomSelected : ""}`}
                  style={{
                    left: offsetX + room.x * PPF,
                    top: offsetY + room.y * PPF,
                    width: room.w * PPF,
                    height: room.h * PPF,
                    background: def.color,
                  }}
                  onMouseDown={(e) => handleRoomMouseDown(e, room)}
                >
                  <div className={styles.roomLabel}>{room.label}</div>
                  <div className={styles.roomDims}>
                    {room.w}&apos; × {room.h}&apos; — {room.w * room.h} sqft
                  </div>
                  <div
                    className={styles.roomDelete}
                    data-delete="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom(room.id);
                    }}
                  >
                    ×
                  </div>
                  <div
                    className={styles.resizeHandle}
                    data-handle="true"
                    onMouseDown={(e) => handleResizeMouseDown(e, room)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PROPS */}
        <div className={styles.props}>
          <div className={styles.propCard}>
            <div className={styles.propTitle}>Element Properties</div>
            {selectedRoom ? (
              <div>
                <div className={styles.propRow}>
                  <label>Label</label>
                  <input
                    className={styles.propInput}
                    type="text"
                    value={selectedRoom.label}
                    onChange={(e) => updateRoom(selectedRoom.id, { label: e.target.value })}
                  />
                </div>
                <div className={styles.propRow}>
                  <label>Type</label>
                  <select
                    className={styles.propSelect}
                    value={selectedRoom.type}
                    onChange={(e) =>
                      updateRoom(selectedRoom.id, { type: e.target.value as RoomType })
                    }
                  >
                    {(Object.keys(ROOM_TYPES) as RoomType[]).map((t) => (
                      <option key={t} value={t}>
                        {ROOM_TYPES[t].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.propRow}>
                  <label>Width (ft)</label>
                  <input
                    className={styles.propInput}
                    type="text"
                    inputMode="numeric"
                    value={selectedRoom.w}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && v > 0) updateRoom(selectedRoom.id, { w: v });
                    }}
                  />
                </div>
                <div className={styles.propRow}>
                  <label>Depth (ft)</label>
                  <input
                    className={styles.propInput}
                    type="text"
                    inputMode="numeric"
                    value={selectedRoom.h}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && v > 0) updateRoom(selectedRoom.id, { h: v });
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.emptyNote}>
                Select a room or fixture on the plan to edit its label, type, and dimensions.
              </div>
            )}
          </div>

          <div className={styles.propCard}>
            <div className={styles.propTitle}>Floor Summary</div>
            {Object.keys(typeCounts).length === 0 ? (
              <div className={styles.statLine}>
                <span>No rooms yet</span>
              </div>
            ) : (
              (Object.keys(typeCounts) as RoomType[]).map((t) => (
                <div className={styles.statLine} key={t}>
                  <span>{ROOM_TYPES[t].label}</span>
                  <b>{typeCounts[t]}</b>
                </div>
              ))
            )}
            <div className={styles.totalArea}>{totalArea} sq.ft carpet</div>
          </div>

          <div className={styles.propCard}>
            <div className={styles.propTitle}>Next Phase</div>
            <div className={styles.emptyNote}>
              Cost estimation, BOQ generation, and material mapping plug into this layout once
              the design is finalized — same pipeline as <b>/ai-estimator</b>.
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footerNote}>
        BUILDERBHARAT // PLAN STUDIO — DESIGN LAYER — NEXT.JS + TYPESCRIPT
      </div>
    </div>
  );
}