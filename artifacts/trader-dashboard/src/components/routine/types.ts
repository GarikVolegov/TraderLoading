import type { ElementType } from "react";

export type Program = "morning" | "evening";

export type StepType =
  | "emotion-quiz"
  | "breathing"
  | "gratitude"
  | "visualization"
  | "checklist"
  | "goals"
  | "trade-review"
  | "reflection"
  | "tomorrow"
  | "complete";

export interface SessionStep {
  type: StepType;
  title: string;
  subtitle: string;
  icon: ElementType;
  skippable?: boolean;
}

export type Answers = Record<string, unknown>;

export interface ActiveRoutineSession {
  program: Program;
  routineId: string;
  routineTitle: string;
  markDailyProgram: boolean;
}
