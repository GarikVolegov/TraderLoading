import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Terminal,
  Activity,
  Upload,
  FileVideo,
  Settings2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export interface CaseStudyChapter {
  id: string;
  timestamp: number; // in seconds
  title: string;
  tag: string;
  description: string;
  telemetryType: "context" | "sweep" | "structure" | "execution";
  videoSrc?: string;
}

export interface StealthVideoPlayerProps {
  initialVideoSrc?: string;
  initialPosterSrc?: string;
  title?: string;
  className?: string;
}

const STORAGE_CUSTOM_VIDEO_KEY = "limen_stealth_custom_video_url";

export const LIMEN_CHAPTERS: CaseStudyChapter[] = [
  {
    id: "chap-1",
    timestamp: 0,
    title: "01. IL SONNO",
    tag: "LA DERIVA & IL RUMORE",
    description: "00:00 - 00:04 // Dissolvenza del rumore emotivo nella quiete del respiro",
    telemetryType: "context",
    videoSrc: "/videos/limen-act1.mp4",
  },
  {
    id: "chap-2",
    timestamp: 4.5,
    title: "02. IL RISVEGLIO",
    tag: "LA SOGLIA / IL VARCO",
    description: "00:04 - 00:08 // Santuario d'ossidiana e cattedrale di luce volumetrica",
    telemetryType: "sweep",
    videoSrc: "/videos/limen-act2.mp4",
  },
  {
    id: "chap-3",
    timestamp: 8.5,
    title: "03. IL MONOLITO",
    tag: "GEOMETRIA & PROTOCOLLO",
    description: "00:08 - 00:12 // Volume Profile aureo e decodifica dei volumi istituzionali",
    telemetryType: "structure",
    videoSrc: "/videos/limen-act3.mp4",
  },
  {
    id: "chap-4",
    timestamp: 12.5,
    title: "04. IL SIGILLO",
    tag: "AUREUS",
    description: "00:12 - 00:18 // Consacrazione del Codice della Presenza e dell'Eredità",
    telemetryType: "execution",
    videoSrc: "/videos/limen-act4.mp4",
  },
];

export const AUREUS_CHAPTERS = LIMEN_CHAPTERS;

export function StealthVideoPlayer({
  initialVideoSrc,
  initialPosterSrc,
  title = "DISPOSITIVO_OPERATIVO_AUREUS // REPLAY_M15_M1",
  className,
}: StealthVideoPlayerProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(18); // Default 18s duration matching the Straight Line storyboard
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSourceConfig, setShowSourceConfig] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize custom video from localStorage or props
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_CUSTOM_VIDEO_KEY);
      if (stored) {
        setVideoSrc(stored);
        setCustomUrlInput(stored);
      } else if (initialVideoSrc) {
        setVideoSrc(initialVideoSrc);
      }
    }
  }, [initialVideoSrc]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (video.duration && Number.isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    const handleEnded = () => {
      if (activeChapterIndex < LIMEN_CHAPTERS.length - 1) {
        const nextIdx = activeChapterIndex + 1;
        const nextChap = LIMEN_CHAPTERS[nextIdx];
        if (nextChap?.videoSrc) {
          setActiveChapterIndex(nextIdx);
          setVideoSrc(nextChap.videoSrc);
          setCurrentTime(0);
          setIsPlaying(true);
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              videoRef.current.play().catch(() => {});
            }
          }, 60);
          return;
        }
      }
      setIsPlaying(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [videoSrc]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) {
      setIsPlaying((prev) => !prev);
      return;
    }

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const isMasterTrailer =
    !videoSrc ||
    videoSrc.includes("limen-scene1") ||
    videoSrc.includes("limen-trailer-full") ||
    videoSrc.includes("limen-trailer");

  const handleSelectChapter = (idx: number) => {
    setActiveChapterIndex(idx);
    const chapter = LIMEN_CHAPTERS[idx];
    if (!chapter) return;

    if (isMasterTrailer) {
      handleSeek(chapter.timestamp);
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    } else if (chapter.videoSrc) {
      setVideoSrc(chapter.videoSrc);
      setCurrentTime(0);
      setIsPlaying(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    }
  };

  const handleSeekToChapter = (timestamp: number) => {
    handleSeek(timestamp);
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
    setIsMuted(newVol === 0);
  };

  const toggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setVideoSrc(objectUrl);
      setFileName(file.name);
      setShowSourceConfig(false);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }, 300);
    }
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrlInput.trim()) {
      setVideoSrc(customUrlInput.trim());
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_CUSTOM_VIDEO_KEY, customUrlInput.trim());
      }
      setFileName("Sorgente Remota");
      setShowSourceConfig(false);
    }
  };

  const handleResetVideo = () => {
    setVideoSrc(null);
    setFileName(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_CUSTOM_VIDEO_KEY);
    }
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const currentChapterIndex = isMasterTrailer
    ? LIMEN_CHAPTERS.reduce((acc, chap, idx) => {
        if (currentTime >= chap.timestamp) {
          return idx;
        }
        return acc;
      }, 0)
    : activeChapterIndex;

  const activeChapter = LIMEN_CHAPTERS[currentChapterIndex] ?? LIMEN_CHAPTERS[0];

  return (
    <div
      ref={playerContainerRef}
      className={`w-full rounded-2xl border border-[#24242C] bg-[#0A0A0C] shadow-[0_30px_90px_rgba(0,0,0,0.92)] overflow-hidden transition-all duration-300 hover:border-[#C5A059]/40 relative group ${className || ""}`}
    >
      {/* Ambient Radial Backlight Glow */}
      <div
        className="absolute -inset-1 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(197,160,89,0.12)_0%,rgba(10,10,12,0)_70%)] blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        aria-hidden="true"
      />

      {/* =========================================================================
          1. CHROME SUPERIORE ARCHITETTONICO (SOVEREIGN DARK-TECH BAR)
          ========================================================================= */}
      <div className="border-b border-[#24242C] bg-[#121216] px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Sovereign Status Glyph + Terminal Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            {/* Architectural Diamond Mark in Brushed Gold */}
            <div className="h-3.5 w-3.5 rotate-45 border border-[#C5A059] bg-[#C5A059]/20 flex items-center justify-center shadow-[0_0_10px_rgba(197,160,89,0.4)]">
              <span className="h-1 w-1 rounded-full bg-[#C5A059]" />
            </div>
            <span className="hidden sm:inline-block h-3 w-px bg-[#26262E]" />
          </div>

          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-[11px] sm:text-xs font-bold tracking-[0.18em] text-[#F4F4F6] uppercase truncate whitespace-nowrap">
              {fileName || title}
            </span>
          </div>
        </div>

        {/* Right Badges: Status & Config */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Status Badge 1: Protocollo Attivo in Jade Green */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#3AA974]/40 bg-[#3AA974]/10 px-2.5 py-0.5 whitespace-nowrap">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3AA974] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3AA974]"></span>
            </span>
            <span className="font-mono text-[10px] font-bold tracking-widest text-[#3AA974] uppercase">
              PROTOCOLLO ATTIVO
            </span>
          </div>

          {/* Status Badge 2: 4K Native Audio */}
          <div className="hidden md:flex items-center gap-1 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#C5A059] uppercase">
            <Sparkles className="h-3 w-3 text-[#C5A059]" />
            <span>KLING 3.0 4K // AUDIO ON</span>
          </div>

          {/* Minimalist Settings Gear for Devs / Source Config */}
          <button
            type="button"
            onClick={() => setShowSourceConfig(!showSourceConfig)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#26262E] bg-[#141418] text-[#8E8E99] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors shrink-0"
            title="Configura sorgente video"
            aria-label="Configura sorgente video"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. DRAWER DI CONFIGURAZIONE SORGENTE (SVILUPPO / CARICAMENTO LOCALE)
          ========================================================================= */}
      {showSourceConfig && (
        <div className="border-b border-[#24242C] bg-[#0E0E12] p-4 sm:p-5 font-mono text-xs text-[#F4F4F6] space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#C5A059] uppercase tracking-wider flex items-center gap-2">
              <Upload className="h-4 w-4" />
              SORGENTE VIDEO DIMOSTRATIVA
            </span>
            <button
              type="button"
              onClick={() => setShowSourceConfig(false)}
              className="text-[#8E8E99] hover:text-white"
            >
              Chiudi
            </button>
          </div>

          <p className="text-[11px] text-[#8E8E99]">
            Inserisci l'URL di un video generato con Higgsfield (Kling 3.0 4K o Seedance 2.5) oppure carica un file locale.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#24242C] bg-[#141418] p-4 space-y-3">
              <span className="font-semibold text-white block">Opzione 1: Carica file locale (MP4 / WebM)</span>
              <input
                type="file"
                ref={fileInputRef}
                accept="video/mp4,video/webm,video/quicktime,video/m4v"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 py-2.5 text-[#C5A059] font-bold hover:bg-[#C5A059]/25 transition-colors"
              >
                <FileVideo className="h-4 w-4" />
                SELEZIONA VIDEO DAL DISCO
              </button>
            </div>

            <form onSubmit={handleApplyCustomUrl} className="rounded-xl border border-[#24242C] bg-[#141418] p-4 space-y-3">
              <span className="font-semibold text-white block">Opzione 2: URL Diretto (CDN / S3)</span>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://.../video.mp4"
                  className="flex-1 rounded-lg border border-[#24242C] bg-[#0A0A0C] px-3 py-1.5 text-xs text-white placeholder-[#8E8E99]/50 focus:border-[#C5A059] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#C5A059] px-3 py-1.5 font-bold text-[#0A0A0C] hover:brightness-110"
                >
                  Applica
                </button>
              </div>
            </form>
          </div>

          {videoSrc && (
            <div className="flex items-center justify-between pt-1 border-t border-[#24242C] text-[11px]">
              <span className="text-[#3AA974]">Sorgente attiva: {fileName || videoSrc}</span>
              <button
                type="button"
                onClick={handleResetVideo}
                className="text-red-400 hover:underline"
              >
                Rimuovi sorgente personalizzata
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          3. AREA VIDEO SCREEN (16:9 CINEMATICO CON BLUEPRINT FALLBACK)
          ========================================================================= */}
      <div className="relative aspect-video w-full bg-[#070709] overflow-hidden select-none">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={initialPosterSrc}
            playsInline
            className="absolute inset-0 h-full w-full object-contain bg-black"
            onClick={togglePlay}
          />
        ) : (
          /* Canvas Grafico Architettonico LIMEN ad Altissima Risoluzione */
          <div className="absolute inset-0 flex flex-col justify-between" onClick={togglePlay}>
            {/* Grid Pattern Subliminale */}
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #C5A059 1px, transparent 1px), linear-gradient(to bottom, #C5A059 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />

            {/* Silhouette Geometrica del Portale LIMEN come Filigrana */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
              <svg width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="1">
                <line x1="2" y1="20.5" x2="22" y2="20.5" />
                <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
                <path d="M5.5 20.5V6.5L12 2.5L18.5 6.5V20.5" />
                <path d="M8.5 20.5V11L12 8.5L15.5 11V20.5" />
                <polygon points="12,10.5 14.5,13.25 12,16 9.5,13.25" fill="#C5A059" fillOpacity="0.3" />
                <line x1="12" y1="2.5" x2="12" y2="8.5" />
                <line x1="12" y1="16" x2="12" y2="20.5" />
              </svg>
            </div>

            {/* Blueprint Vector per Replay Strutturale */}
            <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 800 450">
              {/* Asian Session Consolidation Box */}
              <rect
                x="40"
                y="170"
                width="170"
                height="130"
                fill="#C5A059"
                fillOpacity="0.04"
                stroke="#C5A059"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x="50" y="190" className="fill-[#C5A059]/80 font-mono text-[10px] font-bold tracking-wider">
                ASIAN RANGE // LIQUIDITY POOL
              </text>

              {/* BSL Purge Line in Crimson */}
              <line x1="40" y1="165" x2="760" y2="165" stroke="#8B1E1E" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.8" />
              <rect x="610" y="152" width="150" height="22" rx="4" fill="#141418" stroke="#8B1E1E" strokeWidth="1" />
              <text x="620" y="167" className="fill-red-400 font-mono text-[10px] font-bold">
                BSL // 1.08450 (SWEEP COMPLETO)
              </text>

              {/* Sweep Circle Marker in Gold */}
              <circle cx="280" cy="145" r="7" fill="#C5A059" fillOpacity="0.25" stroke="#C5A059" strokeWidth="2" />
              <rect x="220" y="110" width="160" height="24" rx="4" fill="#141418" stroke="#C5A059" strokeWidth="1" />
              <text x="230" y="126" className="fill-[#C5A059] font-mono text-[10px] font-bold">
                LIQUIDITY SWEEP // H1 ASSORBITO
              </text>

              {/* M15 MSS Confirmation Line */}
              <line x1="310" y1="260" x2="480" y2="260" stroke="#3AA974" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="330" y="254" className="fill-[#3AA974] font-mono text-[10px] font-bold">
                M15 MSS // DISPLACEMENT CONFERMATO
              </text>

              {/* Surgical Execution Trajectory Curve */}
              <path
                d="M 40 240 L 80 220 L 120 250 L 160 200 L 200 230 L 250 170 L 280 140 L 305 220 L 335 275 L 370 265 L 420 305 L 445 270 L 490 250 L 540 210 L 600 160 L 680 100"
                fill="none"
                stroke="#C5A059"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Institutional Target Achieved */}
              <line x1="440" y1="100" x2="760" y2="100" stroke="#3AA974" strokeWidth="1.5" strokeDasharray="4 4" />
              <text x="630" y="94" className="fill-[#3AA974] font-mono text-[10px] font-bold">
                TARGET REACHED: +1:3.8 R:R
              </text>
            </svg>
          </div>
        )}

        {/* HUD Top-Right Badge: Metriche di Performance Istituzionali */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 font-mono text-xs z-20 pointer-events-none">
          <div className="rounded-lg border border-[#24242C] bg-[#0A0A0C]/90 px-3 py-1.5 backdrop-blur-md shadow-lg flex items-center gap-2">
            <span className="text-[#8E8E99]">ESITO REPLAY: </span>
            <span className="font-bold text-[#3AA974]">+38.4 PIPS // VALIDATO</span>
          </div>
          <div className="rounded-lg border border-[#24242C] bg-[#0A0A0C]/90 px-3 py-1 backdrop-blur-md text-[11px] shadow-lg flex items-center gap-2">
            <span className="text-[#8E8E99]">EXPECTANCY: </span>
            <span className="font-bold text-[#C5A059]">+1:3.8 R:R</span>
          </div>
        </div>

        {/* Center Play Overlay when paused */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[3px] cursor-pointer z-20 transition-all hover:bg-black/35"
          >
            <div className="group/play relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#C5A059] bg-[#0A0A0C]/95 text-[#C5A059] shadow-[0_0_45px_rgba(197,160,89,0.45)] transition-all group-hover/play:scale-110 group-hover/play:bg-[#C5A059] group-hover/play:text-[#0A0A0C]">
              <Play className="h-8 w-8 ml-1 transition-transform group-hover/play:scale-110" />
            </div>
            <span className="mt-4 font-mono text-xs font-bold tracking-[0.2em] text-[#F4F4F6] uppercase bg-[#121216]/90 px-4 py-1.5 rounded-full border border-[#C5A059]/40 shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
              {videoSrc ? "CLICCA PER RIPRODURRE IL VIDEO" : "VARCA LA SOGLIA // AVVIA DIMOSTRAZIONE"}
            </span>
          </div>
        )}

        {/* Active Phase Pill Overlay at bottom of screen */}
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between rounded-lg border border-[#24242C] bg-[#0A0A0C]/90 px-4 py-2 backdrop-blur-md z-20 pointer-events-none">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Activity className="h-4 w-4 shrink-0 text-[#C5A059]" />
            <span className="font-mono text-xs text-[#F4F4F6] truncate">
              <strong className="text-[#C5A059]">{activeChapter.title}</strong> — {activeChapter.description}
            </span>
          </div>
          <div className="font-mono text-xs text-[#8E8E99] shrink-0 ml-3 font-semibold">
            FASE {currentChapterIndex + 1}/{LIMEN_CHAPTERS.length}
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. NAVIGAZIONE INTERATTIVA A CAPITOLI (STRAIGHT LINE SYSTEM)
          ========================================================================= */}
      <div className="border-t border-[#24242C] bg-[#0E0E12] px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {LIMEN_CHAPTERS.map((chap, idx) => {
          const isActive = idx === currentChapterIndex;
          return (
            <button
              key={chap.id}
              type="button"
              onClick={() => handleSelectChapter(idx)}
              className={`flex flex-col text-left px-2.5 py-1.5 rounded-lg border transition-all text-xs font-mono ${
                isActive
                  ? "border-[#C5A059] bg-[#C5A059]/10 text-white shadow-[0_0_15px_rgba(197,160,89,0.15)]"
                  : "border-[#24242C] bg-[#141418] text-[#8E8E99] hover:text-white hover:border-[#C5A059]/40"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-[10px] font-bold ${isActive ? "text-[#C5A059]" : ""}`}>
                  {chap.title}
                </span>
                <span className={`text-[9px] ${isActive ? "text-[#C5A059] font-bold" : "text-[#8E8E99]"}`}>
                  {formatTime(chap.timestamp)}
                </span>
              </div>
              <span className="text-[10px] truncate text-[#8E8E99] group-hover:text-white">
                {chap.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          5. CONTROLLI DI PRECISIONE & SCRUBBER IN ORO BRUNITO
          ========================================================================= */}
      <div className="border-t border-[#24242C] bg-[#121216] p-3.5 space-y-3">
        {/* Scrubber dorato */}
        <div className="relative flex items-center gap-3">
          <span className="font-mono text-[11px] text-[#8E8E99] w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <div
            className="relative h-2 flex-1 cursor-pointer rounded-full bg-[#1C1C24]"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPos = (e.clientX - rect.left) / rect.width;
              handleSeek(clickPos * duration);
            }}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#C5A059] via-[#E2C78E] to-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.5)] transition-all duration-75"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -mt-2 -ml-2 h-4 w-4 rounded-full border-2 border-[#C5A059] bg-[#0A0A0C] shadow-[0_0_8px_rgba(197,160,89,0.8)]"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-[#8E8E99] w-12">
            {formatTime(duration)}
          </span>
        </div>

        {/* Riga dei controlli: Play, Mute, Sessione, Velocità, Fullscreen */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#24242C] bg-[#181820] text-[#F4F4F6] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors"
              aria-label={isPlaying ? "Metti in pausa" : "Riproduci"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => handleSeek(0)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#24242C] bg-[#181820] text-[#8E8E99] hover:text-[#F4F4F6] transition-colors"
              title="Riavvia"
              aria-label="Riavvia video"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#24242C] bg-[#181820] text-[#8E8E99] hover:text-[#C5A059] transition-colors"
              aria-label={isMuted || volume === 0 ? "Attiva audio" : "Disattiva audio"}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1.5 rounded-lg appearance-none cursor-pointer bg-[#24242C] accent-[#C5A059] hidden sm:inline-block"
              aria-label="Regola volume"
            />
          </div>

          {/* Badge Sessione di Mercato */}
          <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-[#8E8E99] bg-[#141418] px-3 py-1 rounded-md border border-[#24242C]">
            <Terminal className="h-3 w-3 text-[#C5A059]" />
            <span>SESSIONE: LONDON OPEN // MERCATO REALE</span>
          </div>

          {/* Velocità & Fullscreen */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#8E8E99] mr-1 hidden sm:inline text-[11px]">VELOCITÀ:</span>
            {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => handleSpeedChange(speed)}
                className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                  playbackSpeed === speed
                    ? "border-[#C5A059] bg-[#C5A059]/20 text-[#C5A059] font-bold"
                    : "border-[#24242C] bg-[#16161E] text-[#8E8E99] hover:text-[#F4F4F6]"
                }`}
              >
                {speed}x
              </button>
            ))}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#24242C] bg-[#181820] text-[#8E8E99] hover:text-white transition-colors ml-1"
              title={isFullscreen ? "Esci da Schermo Intero" : "Schermo Intero"}
              aria-label="Schermo intero"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          6. FEED CLINICO DI TELEMETRIA IN TEMPO REALE (DISCIPLINA RIGIDA)
          ========================================================================= */}
      <div className="border-t border-[#24242C] bg-[#0A0A0C] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#3AA974]" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#F4F4F6]">
              REGISTRO CLINICO DI DISCIPLINA E REGOLE DI SISTEMA
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#8E8E99] tracking-wider uppercase border border-[#24242C] px-2 py-0.5 rounded bg-[#121216]">
            CIRCUITO DI SICUREZZA: ZERO VIOLAZIONI
          </span>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {LIMEN_CHAPTERS.map((chap, idx) => {
            const isPassed = currentTime >= chap.timestamp;
            const isCurrent = idx === currentChapterIndex;
            return (
              <div
                key={chap.id}
                onClick={() => handleSeekToChapter(chap.timestamp)}
                className={`flex items-start gap-3 rounded-lg p-2.5 transition-all cursor-pointer ${
                  isCurrent
                    ? "border border-[#C5A059]/60 bg-[#C5A059]/10 text-white font-semibold shadow-[0_0_15px_rgba(197,160,89,0.12)]"
                    : isPassed
                      ? "border border-[#24242C]/80 bg-[#121216]/60 text-[#F4F4F6] opacity-90 hover:border-[#C5A059]/30"
                      : "border border-transparent bg-transparent text-[#8E8E99]/50 opacity-40 hover:opacity-70"
                }`}
              >
                <span className="shrink-0 text-[#8E8E99]">
                  [{formatTime(chap.timestamp)}]
                </span>

                <span className="shrink-0 font-bold">
                  {chap.telemetryType === "context" && <span className="text-[#8E8E99]">[CONTESTO]</span>}
                  {chap.telemetryType === "sweep" && <span className="text-[#C5A059]">[LIQUIDITY_SWEEP]</span>}
                  {chap.telemetryType === "structure" && <span className="text-[#3AA974]">[RISK_GUARD]</span>}
                  {chap.telemetryType === "execution" && <span className="text-[#E2C78E]">[TARGET_HIT]</span>}
                </span>

                <span className="flex-1 text-[11px] sm:text-xs">
                  {chap.description}
                </span>

                {isPassed && (
                  <span className="flex items-center gap-1 text-[#3AA974] text-[10px] font-bold shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>VALIDATO</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
