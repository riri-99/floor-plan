export type RoomType =
  | "bedroom"
  | "living"
  | "kitchen"
  | "bathroom"
  | "balcony"
  | "office"
  | "dining"
  | "storage"
  | "entrance"
  | "door";

export interface RoomTypeDef {
  label: string;
  color: string; // CSS variable reference, e.g. "var(--room-bed)"
}

export interface RoomElement {
  id: number;
  type: RoomType;
  label: string;
  x: number; // ft
  y: number; // ft
  w: number; // ft
  h: number; // ft
}

export interface Floor {
  name: string;
  rooms: RoomElement[];
}

export interface CategoryPlan {
  key: string;
  name: string;
  meta: string;
  plot: { w: number; h: number }; // ft
  floors: Floor[];
}

export type CategoryMap = Record<string, CategoryPlan>;