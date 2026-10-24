import React from "react";

/**
 * PricingAtmosphere
 * Monumental cathedral fresco vault and lateral colonnade background
 * for the Pricing section ("Il Tributo d'Ingresso").
 * Combines an ultra-high-definition Renaissance fresco painting with a
 * multi-layered soft diffused lighting system (zenith oculus, warm candlelight pulse,
 * lateral golden rim haze) and peripheral 3D sculpted obsidian & gold columns.
 * Crucially, a central deep obsidian legibility shield ensures that 100% of the
 * typography ("Il Tributo d'Ingresso", subtitle, checklist items and card) remains
 * completely unobstructed, high-contrast and razor-sharp.
 */
export function PricingAtmosphere() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Deep Obsidian Base Foundation */}
      <div className="absolute inset-0 bg-[#060709]" />

      {/* 2. Classical Cathedral Fresco Vault Layer (4K Master) */}
      <div className="absolute inset-0 overflow-hidden">
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet="/images/backgrounds/mobile/limen-fresco-sanctuary-4k.webp"
          />
          <img
            src="/images/backgrounds/desktop/limen-fresco-sanctuary-4k.webp"
            alt=""
            className="w-full h-full object-cover object-top opacity-60 sm:opacity-75 filter contrast-[1.10] brightness-[0.92] transition-opacity duration-700"
            decoding="async"
          />
        </picture>
      </div>

      {/* 3. Primary Soft Diffused Zenith Oculus Light (Warm Golden/Amber) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1120px] max-w-[100vw] h-[580px] bg-[radial-gradient(ellipse_at_top,rgba(225,185,110,0.22)_0%,rgba(197,160,89,0.08)_45%,transparent_80%)] blur-[95px] pointer-events-none" />

      {/* 4. Secondary Soft Candlelight Pulse (Slow Sacred Breathing) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[760px] max-w-[95vw] h-[380px] bg-[radial-gradient(ellipse_at_center,rgba(255,220,140,0.15)_0%,rgba(210,165,85,0.05)_55%,transparent_75%)] blur-[80px] animate-zenith-breathe pointer-events-none" />

      {/* 5. Lateral Diffused Ambient Rays / Side Haze (Grazing lateral columns from Pricing to FAQ) */}
      <div className="absolute -left-12 top-1/4 w-[380px] h-[680px] bg-[radial-gradient(ellipse_at_center,rgba(197,160,89,0.14)_0%,rgba(197,160,89,0.04)_50%,transparent_75%)] blur-[90px] pointer-events-none" />
      <div className="absolute -right-12 top-1/4 w-[380px] h-[680px] bg-[radial-gradient(ellipse_at_center,rgba(197,160,89,0.14)_0%,rgba(197,160,89,0.04)_50%,transparent_75%)] blur-[90px] pointer-events-none" />
      <div className="absolute -left-12 top-2/3 w-[380px] h-[680px] bg-[radial-gradient(ellipse_at_center,rgba(197,160,89,0.11)_0%,rgba(197,160,89,0.03)_50%,transparent_75%)] blur-[90px] pointer-events-none" />
      <div className="absolute -right-12 top-2/3 w-[380px] h-[680px] bg-[radial-gradient(ellipse_at_center,rgba(197,160,89,0.11)_0%,rgba(197,160,89,0.03)_50%,transparent_75%)] blur-[90px] pointer-events-none" />

      {/* 6. ABSOLUTE CENTRAL & LOWER LEGIBILITY SHIELD:
          Protects 100% of the text area and the card from background visual noise,
          and seamlessly deepens into solid deep obsidian behind the FAQ section. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_28%,#060709_36%,rgba(6,7,9,0.85)_60%,rgba(6,7,9,0.25)_85%,transparent_100%)] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 top-[48%] bg-gradient-to-b from-transparent via-[#060709]/85 to-[#060709] pointer-events-none" />

      {/* 7. Left Monumental Column (Blender 4.5 3D Sculpted Obsidian & Gold) - Continuous Colonnade through Pricing & entire FAQ */}
      <div className="Builder-Pricing-Column-Left absolute -left-20 sm:-left-12 lg:-left-6 2xl:left-2 top-2 bottom-4 h-[calc(100%-24px)] w-[130px] sm:w-[180px] lg:w-[240px] xl:w-[280px] 2xl:w-[310px] opacity-40 sm:opacity-60 lg:opacity-85 transition-opacity duration-500 pointer-events-none select-none">
        <img
          src="/images/limen-column-left.webp?v=20261022_tall"
          alt=""
          className="w-full h-full object-fill object-left-top"
          decoding="async"
        />
      </div>

      {/* 8. Right Monumental Column (Blender 4.5 3D Sculpted Obsidian & Gold) - Continuous Colonnade through Pricing & entire FAQ */}
      <div className="Builder-Pricing-Column-Right absolute -right-20 sm:-right-12 lg:-right-6 2xl:right-2 top-2 bottom-4 h-[calc(100%-24px)] w-[130px] sm:w-[180px] lg:w-[240px] xl:w-[280px] 2xl:w-[310px] opacity-40 sm:opacity-60 lg:opacity-85 transition-opacity duration-500 pointer-events-none select-none">
        <img
          src="/images/limen-column-right.webp?v=20261022_tall"
          alt=""
          className="w-full h-full object-fill object-right-top"
          decoding="async"
        />
      </div>

      {/* 9. Seamless Top & Bottom Section Transitions */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#060709] via-[#060709]/80 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#060709] via-[#060709]/85 to-transparent pointer-events-none" />
    </div>
  );
}
