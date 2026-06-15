import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Heart, MessageSquare, Loader2, Send } from "lucide-react";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { apiJSON } from "@/lib/apiFetch";
import { formatIntlRelativeTime } from "@/lib/relativeTime";
import { reportClientError } from "@/lib/clientErrorReporter";
import { Avatar } from "./Avatar";
import { usePostComments } from "./hooks";
import type { Post } from "./types";

export function PostCard({
  post,
  currentUserId,
  onViewProfile,
}: {
  post: Post & { likedByMe: boolean; isOwnPost: boolean };
  currentUserId: string;
  onViewProfile: (id: string) => void;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social/feed"] }),
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <button
            onClick={() => onViewProfile(post.userId)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <Avatar name={post.userName} avatarUrl={post.avatarUrl} size="sm" />
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight">
                {post.userName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatIntlRelativeTime(post.createdAt, language)}
              </p>
            </div>
          </button>
          {post.isOwnPost && (
            <button
              onClick={() => deletePost.mutate()}
              disabled={deletePost.isPending}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed mb-3">
          {post.content}
        </p>
        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt="post"
            className="w-full rounded-xl mb-3 object-cover max-h-64"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={() => like.mutate()}
            className={`flex items-center gap-1.5 text-sm transition-all ${liked ? "text-red-400" : "text-muted-foreground hover:text-red-400"}`}
          >
            <motion.div
              animate={{ scale: liked ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.2 }}
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
            </motion.div>
            <span className="font-medium">{count}</span>
          </button>
          <button
            onClick={() => setShowComments((s) => !s)}
            className={`flex items-center gap-1.5 text-sm transition-all ${showComments ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium">
              {comments.length > 0 ? comments.length : "Commenti"}
            </span>
          </button>
        </div>
      </div>

      {showComments && (
        <div className="border-t border-border/50 bg-secondary/10">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          ) : (
            <div className="px-4 py-3 space-y-3">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-2">
                  Nessun commento ancora — scrivi il primo!
                </p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 group">
                  <div className="w-6 h-6 rounded-full bg-secondary border border-border overflow-hidden shrink-0 mt-0.5">
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] font-bold">
                        {c.userName[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-xs font-semibold ${c.userId === currentUserId ? "text-primary" : ""}`}
                      >
                        {c.userName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {formatIntlRelativeTime(c.createdAt, language)}
                      </span>
                      {c.userId === currentUserId && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="opacity-0 group-hover:opacity-100 ml-auto p-0.5 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed mt-0.5 break-words">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 bg-secondary/30 border border-border rounded-xl px-3 py-1.5">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), submitComment())
                }
                placeholder={uiText("auto.ui.0541ef2209")}
                className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/50 min-w-0"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                className="w-5 h-5 rounded-md bg-primary/20 hover:bg-primary/40 text-primary flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
              >
                {submittingComment ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
