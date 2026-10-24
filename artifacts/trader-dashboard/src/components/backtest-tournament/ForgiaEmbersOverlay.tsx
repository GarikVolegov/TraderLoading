import React, { useEffect, useRef } from "react";

/**
 * ForgiaEmbersOverlay (Limen Protocol)
 * Pulviscolo solenne di braci e scintille dorate procedurali.
 * Sostituisce i vecchi neon arcade con un'atmosfera calda, stoica e monastica.
 */
export function ForgiaEmbersOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = canvas.offsetWidth || 300);
    let height = (canvas.height = canvas.offsetHeight || 200);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 300;
      height = canvas.height = canvas.offsetHeight || 200;
    };
    window.addEventListener("resize", onResize);

    // 20 particelle dorate leggere
    const count = 20;
    const embers = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 0.8 + Math.random() * 1.6,
      speedY: 0.2 + Math.random() * 0.45,
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: 0.15 + Math.random() * 0.55,
      fadeSpeed: 0.003 + Math.random() * 0.005,
    }));

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.66, 2);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      for (const e of embers) {
        e.y -= e.speedY * dt;
        e.x += e.speedX * dt;
        e.opacity -= e.fadeSpeed * dt;

        if (e.y < -10 || e.opacity <= 0) {
          e.y = height + 10;
          e.x = Math.random() * width;
          e.opacity = 0.2 + Math.random() * 0.5;
        }

        ctx.fillStyle = `rgba(212, 175, 55, ${e.opacity.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!document.hidden) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    const onVisibility = () => {
      if (!document.hidden && !animId) {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        opacity: 0.85,
      }}
      aria-hidden="true"
    />
  );
}
