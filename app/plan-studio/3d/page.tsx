"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import styles from "./3d.module.css";
import { loadPlanState, SavedPlanState } from "../planStorage";
import { CategoryPlan, RoomElement } from "../types";

// ---------- construction constants (feet) ----------
const WALL_HEIGHT = 9.5;
const WALL_THICKNESS = 0.5;
const SLAB_THICKNESS = 0.6;
const FOUNDATION_HEIGHT = 2.5;
const FOUNDATION_MARGIN = 1.5; // how far the foundation extends past the plot edge
const DOOR_HEIGHT = 7;
const DOOR_LINTEL_THICKNESS = 0.6;
const SCALE = 0.6; // world units per foot, keeps scenes a manageable size

const WALL_COLOR = 0xe4ded7;
const SLAB_COLOR = 0xbdb6ae;
const FOUNDATION_COLOR = 0x6b6560;
const DOOR_COLOR = 0xa63b00;
const ROOM_FLOOR_COLORS: Record<string, number> = {
  bedroom: 0xe9ede9,
  living: 0xefe6da,
  kitchen: 0xf6e9d8,
  bathroom: 0xdcebf0,
  balcony: 0xe2ecdd,
  office: 0xe6e2ee,
  dining: 0xeee9e6,
  storage: 0xeee9e6,
  entrance: 0xeee9e6,
};

export default function Plan3DPage() {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const [savedState, setSavedState] = useState<SavedPlanState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [floorVisibility, setFloorVisibility] = useState<Record<number, boolean>>({});
  const floorGroupsRef = useRef<Record<number, THREE.Group>>({});

  // load saved plan on mount
  useEffect(() => {
    const state = loadPlanState();
    if (!state) {
      setNotFound(true);
      return;
    }
    setSavedState(state);
    const vis: Record<number, boolean> = {};
    state.categories[state.currentCategoryKey].floors.forEach((_, idx) => {
      vis[idx] = true;
    });
    setFloorVisibility(vis);
  }, []);

  // build the three.js scene once we have data
  useEffect(() => {
    if (!savedState || !mountRef.current) return;

    const category: CategoryPlan = savedState.categories[savedState.currentCategoryKey];
    const mount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1c1b);
    sceneRef.current = scene;

    const plotW = category.plot.w * SCALE;
    const plotD = category.plot.h * SCALE;

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000
    );
    const camDist = Math.max(plotW, plotD) * 1.4 + 20;
    camera.position.set(camDist, camDist * 0.75, camDist);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, plotW * 0.1, 0);

    // lighting
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a38, 0.9));
    const sun = new THREE.DirectionalLight(0xfff3e6, 1.1);
    sun.position.set(plotW, plotW * 1.4, plotD);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    // ground context plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(plotW * 6, plotD * 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -FOUNDATION_HEIGHT * SCALE - 0.05;
    scene.add(ground);

    // ---- FOUNDATION ----
    const foundationGeo = new THREE.BoxGeometry(
      plotW + FOUNDATION_MARGIN * 2 * SCALE,
      FOUNDATION_HEIGHT * SCALE,
      plotD + FOUNDATION_MARGIN * 2 * SCALE
    );
    const foundationMat = new THREE.MeshStandardMaterial({
      color: FOUNDATION_COLOR,
      roughness: 0.9,
    });
    const foundation = new THREE.Mesh(foundationGeo, foundationMat);
    foundation.position.set(0, -FOUNDATION_HEIGHT * SCALE * 0.5, 0);
    foundation.name = "foundation";
    scene.add(foundation);

    // helper: plot-space (ft, top-left origin) -> world-space (centered, three.js coords)
    const originX = -plotW / 2;
    const originZ = -plotD / 2;
    function toWorldX(ftX: number) {
      return originX + ftX * SCALE;
    }
    function toWorldZ(ftY: number) {
      return originZ + ftY * SCALE;
    }

    const floorGroups: Record<number, THREE.Group> = {};

    category.floors.forEach((floor, floorIdx) => {
      const group = new THREE.Group();
      group.name = `floor-${floorIdx}`;
      const floorBaseY = floorIdx * (WALL_HEIGHT + SLAB_THICKNESS) * SCALE;

      // ---- SLAB for this floor ----
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(plotW, SLAB_THICKNESS * SCALE, plotD),
        new THREE.MeshStandardMaterial({ color: SLAB_COLOR, roughness: 0.85 })
      );
      slab.position.set(0, floorBaseY + (SLAB_THICKNESS * SCALE) / 2, 0);
      group.add(slab);

      floor.rooms.forEach((room: RoomElement) => {
        const centerX = toWorldX(room.x + room.w / 2);
        const centerZ = toWorldZ(room.y + room.h / 2);
        const wFt = room.w * SCALE;
        const hFt = room.h * SCALE;
        const wallY = floorBaseY + SLAB_THICKNESS * SCALE + (WALL_HEIGHT * SCALE) / 2;

        if (room.type === "door") {
          // door frame: two posts + lintel, oriented along the wider axis
          const isWide = room.w >= room.h;
          const postThickness = WALL_THICKNESS * SCALE * 0.6;
          const doorMat = new THREE.MeshStandardMaterial({ color: DOOR_COLOR });
          const postHeight = DOOR_HEIGHT * SCALE;
          const span = (isWide ? wFt : hFt) - postThickness;

          const postGeo = new THREE.BoxGeometry(
            isWide ? postThickness : WALL_THICKNESS * SCALE,
            postHeight,
            isWide ? WALL_THICKNESS * SCALE : postThickness
          );
          const postA = new THREE.Mesh(postGeo, doorMat);
          const postB = new THREE.Mesh(postGeo, doorMat);
          const offset = span / 2;
          if (isWide) {
            postA.position.set(centerX - offset, floorBaseY + SLAB_THICKNESS * SCALE + postHeight / 2, centerZ);
            postB.position.set(centerX + offset, floorBaseY + SLAB_THICKNESS * SCALE + postHeight / 2, centerZ);
          } else {
            postA.position.set(centerX, floorBaseY + SLAB_THICKNESS * SCALE + postHeight / 2, centerZ - offset);
            postB.position.set(centerX, floorBaseY + SLAB_THICKNESS * SCALE + postHeight / 2, centerZ + offset);
          }
          group.add(postA, postB);

          const lintelGeo = new THREE.BoxGeometry(
            isWide ? span + postThickness : WALL_THICKNESS * SCALE,
            DOOR_LINTEL_THICKNESS * SCALE,
            isWide ? WALL_THICKNESS * SCALE : span + postThickness
          );
          const lintel = new THREE.Mesh(lintelGeo, doorMat);
          lintel.position.set(
            centerX,
            floorBaseY + SLAB_THICKNESS * SCALE + postHeight + (DOOR_LINTEL_THICKNESS * SCALE) / 2,
            centerZ
          );
          group.add(lintel);
          return;
        }

        // ---- room floor tint (visual only, sits just above the slab) ----
        const tintColor = ROOM_FLOOR_COLORS[room.type] ?? 0xdedad4;
        const tint = new THREE.Mesh(
          new THREE.PlaneGeometry(wFt - WALL_THICKNESS * SCALE, hFt - WALL_THICKNESS * SCALE),
          new THREE.MeshStandardMaterial({ color: tintColor, roughness: 1 })
        );
        tint.rotation.x = -Math.PI / 2;
        tint.position.set(centerX, floorBaseY + SLAB_THICKNESS * SCALE + 0.01, centerZ);
        group.add(tint);

        // ---- perimeter walls ----
        const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.7 });
        const wallHeightWorld = WALL_HEIGHT * SCALE;

        // north & south walls (run along X)
        const nsGeo = new THREE.BoxGeometry(wFt, wallHeightWorld, WALL_THICKNESS * SCALE);
        const northWall = new THREE.Mesh(nsGeo, wallMat);
        northWall.position.set(centerX, wallY, toWorldZ(room.y));
        const southWall = new THREE.Mesh(nsGeo, wallMat);
        southWall.position.set(centerX, wallY, toWorldZ(room.y + room.h));
        group.add(northWall, southWall);

        // east & west walls (run along Z)
        const ewGeo = new THREE.BoxGeometry(WALL_THICKNESS * SCALE, wallHeightWorld, hFt);
        const westWall = new THREE.Mesh(ewGeo, wallMat);
        westWall.position.set(toWorldX(room.x), wallY, centerZ);
        const eastWall = new THREE.Mesh(ewGeo, wallMat);
        eastWall.position.set(toWorldX(room.x + room.w), wallY, centerZ);
        group.add(westWall, eastWall);
      });

      floorGroups[floorIdx] = group;
      scene.add(group);
    });
    floorGroupsRef.current = floorGroups;

    // resize handling
    function handleResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", handleResize);

    let frameId: number;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      mount.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedState]);

  function toggleFloor(idx: number) {
    setFloorVisibility((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      const group = floorGroupsRef.current[idx];
      if (group) group.visible = next[idx];
      return next;
    });
  }

  function handleSaveCAD() {
    const scene = sceneRef.current;
    if (!scene) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        const output =
          result instanceof ArrayBuffer
            ? result
            : new TextEncoder().encode(JSON.stringify(result));
        const blob = new Blob([output], {
          type: result instanceof ArrayBuffer ? "application/octet-stream" : "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result instanceof ArrayBuffer ? "builderbharat-plan.glb" : "builderbharat-plan.gltf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      (error) => {
        console.error("GLTF export failed", error);
        window.alert("Export failed — check the console for details.");
      },
      { binary: true }
    );
  }

  if (notFound) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyTitle}>No saved design found</div>
          <div className={styles.emptyBody}>
            Build or open a floor plan in the 2D editor first — it saves automatically as you
            edit.
          </div>
          <button className={styles.primaryBtn} onClick={() => router.push("/plan-studio")}>
            ← Go to 2D Plan Studio
          </button>
        </div>
      </div>
    );
  }

  if (!savedState) return null;

  const category = savedState.categories[savedState.currentCategoryKey];

  return (
    <div className={styles.wrapper}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <button className={styles.backBtn} onClick={() => router.push("/plan-studio")}>
            ← Back to 2D Editor
          </button>
          <div>
            <div className={styles.brandName}>{category.name} — 3D Structure</div>
            <div className={styles.brandSub}>Extruded from your saved floor plan</div>
          </div>
        </div>
        <div className={styles.topbarRight}>
          <button className={styles.saveBtn} onClick={handleSaveCAD}>
            ⬇ Save 3D Plan (GLB / CAD)
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.sidebar}>
          <div className={styles.sectionLabel}>Floors</div>
          {category.floors.map((floor, idx) => (
            <label key={idx} className={styles.floorToggle}>
              <input
                type="checkbox"
                checked={floorVisibility[idx] ?? true}
                onChange={() => toggleFloor(idx)}
              />
              {floor.name}
            </label>
          ))}
          <div className={styles.hint}>
            Drag to orbit, scroll to zoom, right-drag to pan. Toggle floors above to isolate a
            level. Export produces a binary glTF (.glb) — opens directly in Blender, SketchUp,
            Unreal, Unity, and most CAD/BIM viewers.
          </div>
        </div>
        <div ref={mountRef} className={styles.canvas3d} />
      </div>
    </div>
  );
}