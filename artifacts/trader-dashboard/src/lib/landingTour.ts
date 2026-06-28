export const TOUR_SCENE_COUNT = 4;

export type TourStatus = "playing" | "paused" | "ended";

export interface TourState {
  index: number;
  status: TourStatus;
}

export type TourAction =
  | { type: "tick" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "replay" }
  | { type: "goto"; index: number };

export const initialTourState: TourState = { index: 0, status: "playing" };

const LAST = TOUR_SCENE_COUNT - 1;
const clamp = (i: number): number => Math.max(0, Math.min(LAST, i));

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case "tick":
      if (state.status !== "playing") return state;
      return state.index >= LAST
        ? { index: LAST, status: "ended" }
        : { index: state.index + 1, status: "playing" };
    case "next":
      return state.index >= LAST
        ? { index: LAST, status: "ended" }
        : { index: state.index + 1, status: "playing" };
    case "prev":
      return state.status === "ended"
        ? { index: LAST, status: "playing" }
        : { index: clamp(state.index - 1), status: "playing" };
    case "pause":
      return state.status === "playing" ? { ...state, status: "paused" } : state;
    case "resume":
      return state.status === "paused" ? { ...state, status: "playing" } : state;
    case "replay":
      return { index: 0, status: "playing" };
    case "goto":
      return { index: clamp(action.index), status: "playing" };
    default:
      return state;
  }
}
