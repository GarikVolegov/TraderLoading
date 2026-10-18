import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ProcessPhase } from "@/lib/traderProcessApi";
import type { ProcessCopyKey } from "@/lib/processCopy";
import type { ProcessSceneController } from "./processSceneEngine";

export type ProcessVisualStage = ProcessPhase | "prepare" | "operate" | "close" | "complete";

/** A complementary view of the real state; rotating the model never changes progress. */
export function ProcessScene({
  stage,
  copy,
}: {
  stage: ProcessVisualStage;
  copy: (key: ProcessCopyKey) => string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ProcessSceneController | null>(null);
  const latestStage = useRef(stage);
  latestStage.current = stage;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = copy(
    stage === "prepare"
      ? "dailyPrepare"
      : stage === "operate"
        ? "dailyOperate"
        : stage === "close"
          ? "dailyClose"
          : stage === "complete"
            ? "done"
            : stage,
  );

  useEffect(() => {
    let cancelled = false;
    const element = host.current;
    if (!element) return;
    // The renderer is loaded only on process pages, never on the public landing.
    void import("./processSceneEngine")
      .then(({ createProcessScene }) => {
        if (cancelled) return;
        controller.current = createProcessScene(element, latestStage.current, reducedMotion, () => {
          if (!cancelled) {
            setReady(false);
            setFailed(true);
          }
        });
        if (controller.current) setReady(true);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, [reducedMotion]);
  useEffect(() => {
    controller.current?.setStage(stage);
  }, [stage]);

  return (
    <figure
      className="process-scene"
      data-stage={stage}
      data-renderer={ready ? "webgl" : failed ? "fallback" : "loading"}
      data-motion={reducedMotion ? "reduced" : "full"}
    >
      <div
        ref={host}
        className="process-scene-model"
        role={ready ? "group" : "img"}
        aria-label={`${label}${ready ? `. ${copy("rotateScene")}` : ""}`}
        tabIndex={ready ? 0 : undefined}
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-0.2, 0],
            ArrowRight: [0.2, 0],
            ArrowUp: [0, -0.12],
            ArrowDown: [0, 0.12],
          };
          if (event.key === "Home") {
            event.preventDefault();
            controller.current?.reset();
          } else if (moves[event.key]) {
            event.preventDefault();
            controller.current?.rotate(...moves[event.key]);
          }
        }}
      >
        {!ready && (
          <svg className="process-scene-fallback" viewBox="0 0 320 200" aria-hidden="true">
            <ellipse cx="160" cy="154" rx="106" ry="30" />
            <path d="M160 28 229 66 160 106 91 66Z M91 66v70l69 40 69-40V66 M160 106v70" />
            <path d="m111 104 49 28 49-28 M111 122l49 28 49-28" />
            <circle cx="160" cy="66" r="12" />
          </svg>
        )}
      </div>
      <figcaption>
        <span className="process-scene-dot" aria-hidden />
        {label}
      </figcaption>
      {ready && (
        <span className="process-scene-hint" aria-hidden>
          {copy("exploreScene")}
        </span>
      )}
    </figure>
  );
}
