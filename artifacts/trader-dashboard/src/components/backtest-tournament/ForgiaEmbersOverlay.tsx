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
    let isVisible = true;
    let width = (canvas.width = canvas.offsetWidth || 300);
    let height = (canvas.height = canvas.offsetHeight || 200);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 300;
      height = canvas.height = canvas.offsetHeight || 200;
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Particelle dorate leggere (ridotte su mobile per fluidità GPU e batteria)
    const isMobileViewport = window.innerWidth < 768;
    const count = isMobileViewport ? 8 : 16;
    const embers = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 0.8 + Math.random() * 1.5,
      speedY: 0.2 + Math.random() * 0.45,
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: 0.15 + Math.random() * 0.55,
      fadeSpeed: 0.003 + Math.random() * 0.005,
    }));

    let lastTime = performance.now();

    const render = (now: number) => {
      animId = 0;
      if (document.hidden || !isVisible) return;
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

      animId = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (!animId && !document.hidden && isVisible) {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? true;
        if (isVisible) startLoop();
        else if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
        }
      },
      { threshold: 0.01 },
    );
    io.observe(canvas);

    startLoop();

    const onVisibility = () => {
      if (!document.hidden) startLoop();
      else if (animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      io.disconnect();
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
