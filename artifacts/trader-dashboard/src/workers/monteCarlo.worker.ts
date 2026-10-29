import { monteCarloBands, type ProjectionBands } from "../lib/equityProjection";

export interface MonteCarloWorkerMessage {
  id: string;
  rSamples: number[];
  opts: {
    steps: number;
    start: number;
    sims?: number;
    seed?: number;
    samplePathCount?: number;
    riskMultiplier?: number;
  };
}

export interface MonteCarloWorkerResponse {
  id: string;
  bands: ProjectionBands;
}

self.onmessage = (event: MessageEvent<MonteCarloWorkerMessage>) => {
  const { id, rSamples, opts } = event.data;
  try {
    const bands = monteCarloBands(rSamples, opts);
    self.postMessage({ id, bands } satisfies MonteCarloWorkerResponse);
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
