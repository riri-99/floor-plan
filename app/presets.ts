import { CategoryMap, RoomType, RoomTypeDef, RoomElement } from "./types";

export const ROOM_TYPES: Record<RoomType, RoomTypeDef> = {
  bedroom: { label: "Bedroom", color: "var(--room-bed)" },
  living: { label: "Living Room", color: "var(--room-living)" },
  kitchen: { label: "Kitchen", color: "var(--room-kitchen)" },
  bathroom: { label: "Bathroom", color: "var(--room-bath)" },
  balcony: { label: "Balcony", color: "var(--room-balcony)" },
  office: { label: "Office/Cabin", color: "var(--room-office)" },
  dining: { label: "Dining", color: "var(--room-generic)" },
  storage: { label: "Storage/Utility", color: "var(--room-generic)" },
  entrance: { label: "Entrance/Foyer", color: "var(--room-generic)" },
  door: { label: "Door", color: "var(--orange)" },
};

// px per foot at default zoom
export const PPF = 12;

let seed = 100;
export function nextRoomId(): number {
  seed += 1;
  return seed;
}

function room(
  id: number,
  type: RoomType,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number
): RoomElement {
  return { id, type, label, x, y, w, h };
}

export const DEFAULT_CATEGORIES: CategoryMap = {
  villa: {
    key: "villa",
    name: "Villa",
    meta: "3-4 BHK",
    plot: { w: 60, h: 44 },
    floors: [
      {
        name: "Ground Floor",
        rooms: [
          room(1, "entrance", "Foyer", 2, 2, 8, 6),
          room(2, "living", "Living Room", 11, 2, 22, 14),
          room(3, "dining", "Dining", 34, 2, 14, 10),
          room(4, "kitchen", "Kitchen", 34, 13, 14, 11),
          room(5, "bedroom", "Guest Bedroom", 2, 10, 17, 14),
          room(6, "bathroom", "Bathroom", 2, 25, 9, 7),
          room(7, "balcony", "Front Balcony", 11, 17, 22, 7),
        ],
      },
      {
        name: "First Floor",
        rooms: [
          room(1, "bedroom", "Master Bedroom", 2, 2, 20, 16),
          room(2, "bathroom", "Attached Bath", 23, 2, 9, 8),
          room(3, "bedroom", "Bedroom 2", 33, 2, 15, 14),
          room(4, "bedroom", "Bedroom 3", 2, 19, 17, 13),
          room(5, "bathroom", "Common Bath", 20, 10, 9, 8),
          room(6, "balcony", "Rear Balcony", 33, 17, 15, 7),
        ],
      },
    ],
  },
  house: {
    key: "house",
    name: "Independent House",
    meta: "Single Floor",
    plot: { w: 48, h: 36 },
    floors: [
      {
        name: "Ground Floor",
        rooms: [
          room(1, "entrance", "Porch", 2, 2, 8, 5),
          room(2, "living", "Living Room", 11, 2, 18, 13),
          room(3, "bedroom", "Bedroom 1", 30, 2, 14, 12),
          room(4, "kitchen", "Kitchen", 2, 17, 13, 10),
          room(5, "bathroom", "Bathroom", 16, 17, 8, 7),
          room(6, "bedroom", "Bedroom 2", 25, 15, 19, 13),
        ],
      },
    ],
  },
  bhk2: {
    key: "bhk2",
    name: "2BHK Apartment",
    meta: "~950 sqft",
    plot: { w: 38, h: 30 },
    floors: [
      {
        name: "Unit Plan",
        rooms: [
          room(1, "living", "Living/Dining", 2, 2, 18, 14),
          room(2, "kitchen", "Kitchen", 21, 2, 13, 9),
          room(3, "bedroom", "Master Bedroom", 2, 17, 16, 11),
          room(4, "bedroom", "Bedroom 2", 19, 17, 15, 11),
          room(5, "bathroom", "Bathroom", 21, 12, 9, 7),
          room(6, "balcony", "Balcony", 35, 17, 3, 11),
        ],
      },
    ],
  },
  bhk3: {
    key: "bhk3",
    name: "3BHK Apartment",
    meta: "~1400 sqft",
    plot: { w: 44, h: 34 },
    floors: [
      {
        name: "Unit Plan",
        rooms: [
          room(1, "living", "Living/Dining", 2, 2, 20, 15),
          room(2, "kitchen", "Kitchen", 23, 2, 13, 10),
          room(3, "bedroom", "Master Bedroom", 2, 18, 16, 14),
          room(4, "bedroom", "Bedroom 2", 19, 18, 13, 14),
          room(5, "bedroom", "Bedroom 3", 33, 13, 9, 12),
          room(6, "bathroom", "Bath 1", 23, 13, 9, 7),
          room(7, "bathroom", "Bath 2", 33, 26, 9, 6),
          room(8, "balcony", "Balcony", 33, 2, 9, 9),
        ],
      },
    ],
  },
  apartment: {
    key: "apartment",
    name: "Studio Apartment",
    meta: "~550 sqft",
    plot: { w: 30, h: 24 },
    floors: [
      {
        name: "Unit Plan",
        rooms: [
          room(1, "living", "Living/Sleep Area", 2, 2, 20, 14),
          room(2, "kitchen", "Kitchenette", 23, 2, 6, 10),
          room(3, "bathroom", "Bathroom", 23, 13, 6, 8),
          room(4, "balcony", "Balcony", 2, 17, 20, 5),
        ],
      },
    ],
  },
  office: {
    key: "office",
    name: "Office Space",
    meta: "Commercial",
    plot: { w: 50, h: 36 },
    floors: [
      {
        name: "Floor Plan",
        rooms: [
          room(1, "entrance", "Reception", 2, 2, 12, 8),
          room(2, "office", "Open Workstations", 15, 2, 24, 20),
          room(3, "office", "Manager Cabin", 40, 2, 9, 10),
          room(4, "office", "Conference Room", 40, 13, 9, 11),
          room(5, "bathroom", "Restroom", 2, 11, 11, 7),
          room(6, "dining", "Pantry/Break Room", 2, 19, 11, 10),
        ],
      },
    ],
  },
};