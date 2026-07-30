import { CategoryMap } from "./types";

export const STORAGE_KEY = "builderbharat-plan-studio-state";

export interface SavedPlanState {
  categories: CategoryMap;
  currentCategoryKey: string;
  currentFloorIdx: number;
  savedAt: number;
}

export function savePlanState(
  categories: CategoryMap,
  currentCategoryKey: string,
  currentFloorIdx: number
): void {
  if (typeof window === "undefined") return;
  const payload: SavedPlanState = {
    categories,
    currentCategoryKey,
    currentFloorIdx,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to save plan state", err);
  }
}

export function loadPlanState(): SavedPlanState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedPlanState;
  } catch (err) {
    console.error("Failed to load plan state", err);
    return null;
  }
}

export function clearPlanState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}