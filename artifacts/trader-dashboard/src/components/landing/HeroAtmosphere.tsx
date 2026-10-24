import React from "react";

/**
 * HeroAtmosphere
 * Monumental lateral colonnade background for LIMEN PROTOCOL Hero section.
 * Positions the 3D Blender + Nano Banana sculpted obsidian & burnished gold columns
 * strictly at the peripheral borders, framing the screen with generous open breathing
 * room around the central typography.
 */
export function HeroAtmosphere() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Deep Obsidian Gradient Base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_0%,#111116_0%,#08080B_55%,#050507_100%)]" />

      {/* 2. Zenith Light Oculus */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[880px] max-w-[100vw] h-[460px] bg-[radial-gradient(ellipse_at_top,rgba(197,160,89,0.14)_0%,rgba(197,160,89,0.04)_45%,transparent_75%)] blur-[60px]" />

      {/* 3. Ultra-fine Architectural Coordinate Grid (masked out in center) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(197,160,89,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(197,160,89,0.025)_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,transparent_40%,#000_100%)] opacity-50" />

      {/* 4. Left Monumental Column (Blender 4.5 + Nano Banana Relief) anchored to peripheral Left Border */}
      <div className="Builder-Column-Left absolute -left-20 sm:-left-12 lg:-left-8 2xl:left-0 top-0 w-[140px] sm:w-[190px] lg:w-[240px] xl:w-[270px] h-[720px] sm:h-[840px] lg:h-[980px] opacity-20 sm:opacity-40 lg:opacity-65 transition-opacity duration-500">
        <img
          src="/images/limen-column-left.webp?v=20261021d"
          alt=""
          className="w-full h-full object-contain object-left-top"
          decoding="async"
        />
      </div>

      {/* 5. Right Monumental Column (Blender 4.5 + Nano Banana Relief) anchored to peripheral Right Border */}
      <div className="Builder-Column-Right absolute -right-20 sm:-right-12 lg:-right-8 2xl:right-0 top-0 w-[140px] sm:w-[190px] lg:w-[240px] xl:w-[270px] h-[720px] sm:h-[840px] lg:h-[980px] opacity-20 sm:opacity-40 lg:opacity-65 transition-opacity duration-500">
        <img
          src="/images/limen-column-right.webp?v=20261021d"
          alt=""
          className="w-full h-full object-contain object-right-top"
          decoding="async"
        />
      </div>

      {/* 6. Central Legibility Shield & Bottom Transition */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_52%_at_50%_34%,rgba(6,7,9,0.85)_0%,transparent_82%)]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#060709] via-[#060709]/80 to-transparent" />
    </div>
  );
}
