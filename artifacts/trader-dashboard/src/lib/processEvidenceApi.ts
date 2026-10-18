import { apiJSON } from "./apiFetch";
import type { ProcessImprovement } from "../../../../contracts/trader-process";

export function saveProcessImprovement(data: {
  methodVersionId: string; recapId: number; action: string; criterion: string; requestId: string;
}) {
  return apiJSON<ProcessImprovement>("process/improvements", { method: "POST", body: JSON.stringify(data) });
}
