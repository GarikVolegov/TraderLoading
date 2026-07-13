import { useState, useRef, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { uiText } from "@/contexts/LanguageContext";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import {
  X,
  FileText,
  Clock,
  ImageIcon,
  Loader2,
  Smile,
  Send,
} from "lucide-react";

export function CreatePostModal({
  onClose,
  currentUserId,
}: {
  onClose: () => void;
  currentUserId: string;
}) {
  const [content, setContent] = useState("");
  const [isStory, setIsStory] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const createPost = useMutation({
    mutationFn: (data: {
      content: string;
      isStory: boolean;
      imageUrl?: string;
    }) =>
      apiJSON("social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social/feed"] });
      qc.invalidateQueries({ queryKey: ["social/stories"] });
      onClose();
    },
  });

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiFetch("social/upload-image", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { imageUrl: url } = await res.json();
      setImageUrl(url);
    } catch {
      // silently fail
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    });
    setShowEmoji(false);
  };

  const handleSubmit = () => {
    if (!content.trim() && !imageUrl) return;
    createPost.mutate({
      content: content.trim(),
      isStory,
      imageUrl: imageUrl ?? undefined,
    });
  };

  const panelRef = useRef<HTMLDivElement>(null);
  // Focus the textarea (its pre-existing autoFocus) instead of the hook's
  // default "first focusable in DOM order" pick, which would land on the X
  // close button rendered before it.
  const { titleId, panelProps } = useDialogA11y({ isOpen: true, onClose, panelRef, initialFocusRef: textareaRef });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        {...panelProps}
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="font-bold text-lg">
            Nuovo {isStory ? "storia" : "post"}
          </h2>
          <button
            onClick={onClose}
            aria-label={uiText("common.close")}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsStory(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${!isStory ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"}`}
          >
            <FileText className="w-4 h-4" />{uiText("auto.ui.7858ac3ff6")}</button>
          <button
            onClick={() => setIsStory(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${isStory ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"}`}
          >
            <Clock className="w-4 h-4" /> Storia 24h
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isStory ? "Cosa vuoi condividere?" : "Cosa stai pensando?"
          }
          rows={4}
          maxLength={2000}
          className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary resize-none transition-colors"
          autoFocus
        />

        {imageUrl && (
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img
              src={imageUrl}
              alt="preview"
              className="w-full max-h-56 object-cover"
            />
            <button
              onClick={() => setImageUrl(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showEmoji && <EmojiPickerPanel onSelect={insertEmoji} />}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading || !!imageUrl}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
              title={uiText("auto.ui.5d4e2a46f6")}
            >
              {imageUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setShowEmoji((s) => !s)}
              className={`p-2 rounded-lg transition-colors ${showEmoji ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
              title={uiText("auto.ui.5090a9e78c")}
            >
              <Smile className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground ml-1">
              {content.length}/2000
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={(!content.trim() && !imageUrl) || createPost.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createPost.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Pubblica
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        {isStory && (
          <p className="text-xs flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-400">
            <Clock className="w-3.5 h-3.5" /> La storia scomparirà
            automaticamente dopo 24 ore
          </p>
        )}
      </motion.div>
    </div>
  );
}
