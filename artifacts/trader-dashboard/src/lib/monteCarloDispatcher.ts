import { monteCarloBands, type ProjectionBands } from "./equityProjection";

type MonteCarloOpts = {
  steps: number;
  start: number;
  sims?: number;
  seed?: number;
  samplePathCount?: number;
  riskMultiplier?: number;
};

let workerInstance: Worker | null = null;
const pendingCallbacks = new Map<
  string,
  {
    resolve: (bands: ProjectionBands) => void;
    reject: (err: unknown) => void;
  }
>();

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL("../workers/monteCarlo.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerInstance.onmessage = (event: MessageEvent) => {
        const { id, bands, error } = event.data;
        const cb = pendingCallbacks.get(id);
        if (cb) {
          pendingCallbacks.delete(id);
          if (error) {
            cb.reject(new Error(error));
          } else {
            cb.resolve(bands);
          }
        }
      };
      workerInstance.onerror = () => {
        // In case of worker failure, fallback to synchronous
        workerInstance?.terminate();
        workerInstance = null;
      };
    } catch {
      workerInstance = null;
    }
  }
  return workerInstance;
}

/**
 * Executes Monte Carlo projection computation asynchronously off the main thread.
 * Degrades synchronously if Web Worker cannot be instantiated.
 */
export async function computeMonteCarloBandsAsync(
  rSamples: number[],
  opts: MonteCarloOpts,
): Promise<ProjectionBands> {
  const worker = getWorker();
  if (!worker) {
    return monteCarloBands(rSamples, opts);
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return new Promise<ProjectionBands>((resolve, reject) => {
    // 5s timeout fallback
    const timer = setTimeout(() => {
      pendingCallbacks.delete(id);
      resolve(monteCarloBands(rSamples, opts));
    }, 5000);

    pendingCallbacks.set(id, {
      resolve: (bands) => {
        clearTimeout(timer);
        resolve(bands);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });

    worker.postMessage({ id, rSamples, opts });
  });
}
