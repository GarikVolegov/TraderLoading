import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Heart,
  MessageSquare,
  Loader2,
  Send,
  ShieldCheck,
  AlertCircle,
  BookOpen,
  Sparkles,
  Dumbbell,
  TrendingUp,
  Trophy,
  Maximize2,
  User,
} from "lucide-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { apiJSON } from "@/lib/apiFetch";
import { formatIntlRelativeTime } from "@/lib/relativeTime";
import { reportClientError } from "@/lib/clientErrorReporter";
import { Avatar } from "./Avatar";
import { usePostComments } from "./hooks";
import type { Post } from "./types";
import type { MediaLightboxItem } from "./MediaLightboxModal";

export type PostSphere = "vita" | "tempio" | "analisi" | "traguardo";

export interface ParsedPostMetadata {
  sphere: PostSphere;
  sphereLabel: string;
  custodeInfo: string | null;
  libroLesson: string | null;
  cleanContent: string;
}

export function resolveOperatorGradeBadge(level?: number, xp?: number) {
  const lvl = level ?? 1;
  const points = xp ?? 0;
  if (lvl >= 20 || points >= 10000) {
    return { roman: "V", code: "GRADO V", title: "L'Architetto dell'Eredità" };
  }
  if (lvl >= 12 || points >= 5000) {
    return { roman: "IV", code: "GRADO IV", title: "Maestro del Sigillo" };
  }
  if (lvl >= 7 || points >= 2000) {
    return { roman: "III", code: "GRADO III", title: "L'Osservatore Sovrano" };
  }
  if (lvl >= 3 || points >= 500) {
    return { roman: "II", code: "GRADO II", title: "Il Custode della Regola" };
  }
  return { roman: "I", code: "GRADO I", title: "Novizio Consapevole" };
}

export function parsePostMetadata(rawText: string | null | undefined, hasImage?: boolean): ParsedPostMetadata {
  let text = rawText || "";
  let custode: string | null = null;
  let libro: string | null = null;
  let explicitSphere: PostSphere | null = null;

  const sphereRegex = /\[SFERA:\s*(VITA\s*&\s*STILE|VITA|TEMPIO\s*FISICO|TEMPIO|ANALISI|TRAGUARDO)\]/i;
  const sMatch = text.match(sphereRegex);
  if (sMatch) {
    const token = sMatch[1].toUpperCase();
    if (token.includes("VITA")) explicitSphere = "vita";
    else if (token.includes("TEMPIO")) explicitSphere = "tempio";
    else if (token.includes("TRAGUARDO")) explicitSphere = "traguardo";
    else explicitSphere = "analisi";
    text = text.replace(sphereRegex, "").trim();
  }

  const custodeRegex = /\[CUSTODE DELLA SOGLIA:\s*(.*?)\]/i;
  const cMatch = text.match(custodeRegex);
  if (cMatch) {
    custode = cMatch[1].trim();
    text = text.replace(custodeRegex, "").trim();
  }

  const libroRegex = /\[LIBRO DELLA VERITÀ · LEZIONE\]:\s*([\s\S]*?)(?=\n\n|$)/i;
  const lMatch = text.match(libroRegex);
  if (lMatch) {
    libro = lMatch[1].trim();
    text = text.replace(libroRegex, "").trim();
  }

  let sphere: PostSphere = explicitSphere ?? "vita";
  if (!explicitSphere) {
    const lower = text.toLowerCase();
    if (
      lower.includes("allenamento") ||
      lower.includes("palestra") ||
      lower.includes("tempio") ||
      lower.includes("routine") ||
      lower.includes("sveglia") ||
      lower.includes("corsa") ||
      lower.includes("meditazione")
    ) {
      sphere = "tempio";
    } else if (
      lower.includes("traguardo") ||
      lower.includes("payout") ||
      lower.includes("obiettivo") ||
      lower.includes("milestone") ||
      lower.includes("grado")
    ) {
      sphere = "traguardo";
    } else if (
      custode ||
      libro ||
      lower.includes("tp ") ||
      lower.includes("sl ") ||
      lower.includes("setup") ||
      lower.includes("long") ||
      lower.includes("short") ||
      lower.includes("htf") ||
      lower.includes("m1") ||
      lower.includes("sweep") ||
      hasImage
    ) {
      sphere = "analisi";
    } else {
      sphere = "vita";
    }
  }

  const labels: Record<PostSphere, string> = {
    vita: "Vita & Stile",
    tempio: "Tempio Fisico & Routine",
    analisi: "Analisi & Visione",
    traguardo: "Traguardo & Eredità",
  };

  return {
    sphere,
    sphereLabel: labels[sphere],
    custodeInfo: custode,
    libroLesson: libro,
    cleanContent: text,
  };
}

export function SphereBadge({ sphere }: { sphere: PostSphere }) {
  if (sphere === "vita") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#C5A059]/40 bg-[#C5A059]/12 text-[#E8C56A] font-mono text-[9px] font-bold uppercase tracking-wider">
        <Sparkles className="w-2.5 h-2.5 text-[#E8C56A]" />
        <span>Vita &amp; Stile</span>
      </span>
    );
  }
  if (sphere === "tempio") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 font-mono text-[9px] font-bold uppercase tracking-wider">
        <Dumbbell className="w-2.5 h-2.5 text-emerald-400" />
        <span>Tempio Fisico</span>
      </span>
    );
  }
  if (sphere === "traguardo") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-300 font-mono text-[9px] font-bold uppercase tracking-wider">
        <Trophy className="w-2.5 h-2.5 text-amber-300" />
        <span>Traguardo</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-500/35 bg-sky-500/10 text-sky-300 font-mono text-[9px] font-bold uppercase tracking-wider">
      <TrendingUp className="w-2.5 h-2.5 text-sky-400" />
      <span>Analisi &amp; Mercato</span>
    </span>
  );
}

export function PostCard({
  post,
  currentUserId,
  onViewProfile,
  onInspectProfile,
  onOpenLightbox,
  compact = false,
}: {
  post: Post & { likedByMe: boolean; isOwnPost: boolean };
  currentUserId: string;
  onViewProfile: (id: string) => void;
  onInspectProfile?: (id: string) => void;
  onOpenLightbox?: (item: MediaLightboxItem) => void;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(post.likedByMe);
  const [count, setCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const { data: comments = [], isLoading: loadingComments } = usePostComments(
    showComments ? post.id : null,
  );

  const like = useMutation({
    mutationFn: () =>
      apiJSON<{ liked: boolean }>(`social/posts/${post.id}/like`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      setLiked(data.liked);
      setCount((c) => (data.liked ? c + 1 : c - 1));
    },
  });

  const deletePost = useMutation({
    mutationFn: () => apiJSON(`social/posts/${post.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/feed"] });
      qc.invalidateQueries({ queryKey: ["social/profile"] });
    },
  });

  const submitComment = async () => {
    const content = commentText.trim();
    if (!content || submittingComment) return;
    setSubmittingComment(true);
    try {
      await apiJSON(`social/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    } catch (error) {
      reportClientError(error, {
        context: "social comment submit",
        notify: false,
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    try {
      await apiJSON(`social/posts/${post.id}/comments/${commentId}`, {
        method: "DELETE",
      });
      qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
    } catch (error) {
      reportClientError(error, {
        context: "social comment delete",
        notify: false,
      });
    }
  };

  const { sphere, sphereLabel, custodeInfo, libroLesson, cleanContent } = useMemo(
    () => parsePostMetadata(post.content, Boolean(post.imageUrl)),
    [post.content, post.imageUrl],
  );

  const handleProfileClick = () => {
    if (onInspectProfile) {
      onInspectProfile(post.userId);
    } else {
      onViewProfile(post.userId);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group/card bg-gradient-to-b from-[#0C0D14] to-[#090A0F] border border-[#C5A059]/25 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-all hover:border-[#C5A059]/50 text-slate-200 flex flex-col"
    >
      {/* Top accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#C5A059]/45 to-transparent" />

      <div className={compact ? "p-3.5 space-y-2.5 flex-1 flex flex-col" : "p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col"}>
        {/* Author Public Profile Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleProfileClick}
              className="relative shrink-0 group/avatar"
              title={`Vedi profilo pubblico di ${post.userName}`}
            >
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#C5A059] via-[#E8C56A] to-[#8A6D2F] group-hover/avatar:scale-105 transition-transform">
                <Avatar name={post.userName} avatarUrl={post.avatarUrl} size="sm" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#10B981] border-2 border-[#0A0B10]" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="font-display text-sm font-bold leading-tight text-white hover:text-[#E8C56A] transition-colors truncate"
                >
                  {post.userName}
                </button>
                <SphereBadge sphere={sphere} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[10px] text-slate-400">
                  {formatIntlRelativeTime(post.createdAt, language)}
                </span>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={() => onViewProfile(post.userId)}
                  className="font-mono text-[9px] uppercase tracking-wider text-[#C5A059]/85 hover:text-[#E8C56A] transition-colors"
                >
                  Profilo Pubblico
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {post.isOwnPost && (
              <button
                type="button"
                onClick={() => deletePost.mutate()}
                disabled={deletePost.isPending}
                aria-label={uiText("common.delete")}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-slate-500 hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Optional Protocol Seals (only when attached) */}
        {(custodeInfo || libroLesson) && (
          <div className="space-y-2">
            {custodeInfo && (
              <div>
                {custodeInfo.includes("100%") || custodeInfo.includes("LUCIDITÀ") ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#10B981]/30 bg-[#10B981]/10 text-[#34D399] font-mono text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>CUSTODE: {custodeInfo}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>CUSTODE: {custodeInfo}</span>
                  </span>
                )}
              </div>
            )}

            {libroLesson && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl border-l-2 border-[#C5A059] bg-[#C5A059]/10 text-xs">
                <BookOpen className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                <div>
                  <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-[#C5A059]">
                    Riflessione · Il Libro della Verità
                  </span>
                  <p className="text-[#F4F4F6] italic font-serif leading-relaxed mt-0.5">
                    &ldquo;{libroLesson}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Post Text */}
        {cleanContent && (
          <p
            className={`text-slate-100 whitespace-pre-wrap leading-relaxed font-sans ${
              compact ? "text-xs line-clamp-4" : "text-sm"
            }`}
          >
            {cleanContent}
          </p>
        )}

        {/* Full Aspect Ratio Media Showcase (No forced vertical crop!) */}
        {post.imageUrl && (
          <div className="relative group/media rounded-xl overflow-hidden border border-[#C5A059]/25 bg-[#06070A] shadow-inner mt-auto">
            <img
              src={post.imageUrl}
              alt={cleanContent || `Foto di ${post.userName}`}
              onClick={() =>
                onOpenLightbox?.({
                  imageUrl: post.imageUrl!,
                  userId: post.userId,
                  userName: post.userName,
                  avatarUrl: post.avatarUrl,
                  content: cleanContent,
                  sphereLabel,
                  createdAt: post.createdAt,
                  likesCount: count,
                })
              }
              className={`w-full cursor-zoom-in transition-transform duration-300 group-hover/media:scale-[1.01] ${
                compact
                  ? "max-h-64 object-contain bg-[#06070A]"
                  : "max-h-[520px] object-contain bg-[#06070A]"
              }`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            {onOpenLightbox && (
              <button
                type="button"
                onClick={() =>
                  onOpenLightbox({
                    imageUrl: post.imageUrl!,
                    userId: post.userId,
                    userName: post.userName,
                    avatarUrl: post.avatarUrl,
                    content: cleanContent,
                    sphereLabel,
                    createdAt: post.createdAt,
                    likesCount: count,
                  })
                }
                className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-[#C5A059]/40 text-[#E8C56A] font-mono text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Schermo Intero</span>
              </button>
            )}
          </div>
        )}

        {/* Footer Interactions */}
        <div className="flex items-center justify-between gap-2 pt-2.5 mt-auto border-t border-[#C5A059]/15">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => like.mutate()}
              className={`flex items-center gap-1.5 text-xs font-mono transition-all ${
                liked ? "text-red-400 font-bold" : "text-slate-400 hover:text-red-400"
              }`}
            >
              <motion.div
                animate={{ scale: liked ? [1, 1.3, 1] : 1 }}
                transition={{ duration: 0.2 }}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
              </motion.div>
              <span>{count}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComments((s) => !s)}
              className={`flex items-center gap-1.5 text-xs font-mono transition-all ${
                showComments
                  ? "text-[#E8C56A] font-bold"
                  : "text-slate-400 hover:text-[#E8C56A]"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>
                {comments.length > 0 ? `${comments.length} commenti` : "Commenti"}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleProfileClick}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#C5A059]/25 bg-[#C5A059]/8 text-[#E8C56A] hover:bg-[#C5A059]/18 font-mono text-[10px] uppercase tracking-wider transition-colors"
          >
            <User className="w-3 h-3" />
            <span>Vetrina Trader</span>
          </button>
        </div>
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <div className="border-t border-[#C5A059]/20 bg-[#0A0B11]/95">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
            </div>
          ) : (
            <div className="px-4 py-3 space-y-2.5 max-h-60 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-xs text-slate-500 font-mono text-center py-1.5">
                  Nessun commento ancora &mdash; lascia un pensiero al confratello.
                </p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 group">
                  <button
                    type="button"
                    onClick={() => onViewProfile(c.userId)}
                    className="w-6 h-6 rounded-full bg-[#12131A] border border-[#C5A059]/30 overflow-hidden shrink-0 mt-0.5"
                  >
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-[#E8C56A]">
                        {c.userName[0]?.toUpperCase()}
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <button
                        type="button"
                        onClick={() => onViewProfile(c.userId)}
                        className={`text-xs font-semibold hover:underline ${
                          c.userId === currentUserId ? "text-[#E8C56A]" : "text-white"
                        }`}
                      >
                        {c.userName}
                      </button>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatIntlRelativeTime(c.createdAt, language)}
                      </span>
                      {c.userId === currentUserId && (
                        <button
                          type="button"
                          onClick={() => deleteComment(c.id)}
                          aria-label={uiText("common.delete")}
                          className="touch-actions opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ml-auto p-0.5 text-slate-500 hover:text-destructive transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-0.5 break-words font-sans">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-[#12131A] border border-[#C5A059]/25 rounded-xl px-3 py-1.5 focus-within:border-[#C5A059] focus-within:ring-1 focus-within:ring-[#C5A059]/30 transition-all">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), submitComment())
                }
                placeholder={uiText("auto.ui.0541ef2209")}
                className="flex-1 bg-transparent text-xs text-white focus:outline-none placeholder:text-slate-500 min-w-0 font-sans"
              />
              <button
                type="button"
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                className="w-6 h-6 rounded-md bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-bold flex items-center justify-center disabled:opacity-40 transition-all shrink-0 hover:brightness-110"
              >
                {submittingComment ? (
                  <Loader2 className="w-3 h-3 animate-spin text-black" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.article>
  );
}
