import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { uiText } from "@/contexts/LanguageContext";
import { apiRequest as apiFetch } from "@/lib/apiFetch";
import { X, Clock, Reply, Send, Loader2, Camera, Mic } from "lucide-react";
import { Avatar } from "./Avatar";
import { fmtDur } from "./format";
import type { StoryGroup } from "./types";

export function StoryViewer({
  groups,
  startIndex,
  onClose,
}: {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
}) {
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  // Reply state
  const [showReply, setShowReply] = useState(false);
  const [replyTab, setReplyTab] = useState<
    "text" | "emoji" | "image" | "voice"
  >("text");
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);
  const [replyImgUploading, setReplyImgUploading] = useState(false);
  const [replyRecording, setReplyRecording] = useState(false);
  const [replyBlob, setReplyBlob] = useState<Blob | null>(null);
  const [replyDuration, setReplyDuration] = useState(0);
  const replyMrRef = useRef<MediaRecorder | null>(null);
  const replyChunksRef = useRef<Blob[]>([]);
  const replyTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const replyFileRef = useRef<HTMLInputElement>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const totalInGroup = group?.stories.length ?? 1;

  useEffect(() => {
    setProgress(0);
    clearInterval(intervalRef.current);
    if (paused || showReply) return;
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(intervalRef.current);
          advance();
          return 0;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [groupIdx, storyIdx, paused, showReply]);

  const advance = () => {
    if (storyIdx < totalInGroup - 1) setStoryIdx((s) => s + 1);
    else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else onClose();
  };

  if (!story) return null;
  const timeLeft = story.expiresAt
    ? Math.max(
        0,
        Math.floor(
          (new Date(story.expiresAt).getTime() - Date.now()) / 3600000,
        ),
      )
    : 0;

  const sendStoryReply = async (content: string, type = "text") => {
    try {
      await apiFetch(`social/story-reply/${story.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type }),
      });
      setReplySent(true);
      setTimeout(() => {
        setReplySent(false);
        setShowReply(false);
        setReplyText("");
        setReplyBlob(null);
      }, 1500);
    } catch (err) {
      console.error("Reply error:", err);
    }
  };

  const handleReplyImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplyImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiFetch("social/upload-image", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { imageUrl } = await res.json();
      await sendStoryReply(imageUrl, "image");
    } catch (err) {
      console.error("Story image reply error:", err);
    } finally {
      setReplyImgUploading(false);
      if (replyFileRef.current) replyFileRef.current.value = "";
    }
  };

  const startReplyRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      replyChunksRef.current = [];
      mr.ondataavailable = (e) => replyChunksRef.current.push(e.data);
      mr.onstop = () => {
        setReplyBlob(new Blob(replyChunksRef.current, { type: mimeType }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      replyMrRef.current = mr;
      setReplyRecording(true);
      setReplyDuration(0);
      replyTimerRef.current = setInterval(
        () => setReplyDuration((d) => d + 1),
        1000,
      );
    } catch {
      console.error("Mic error");
    }
  };

  const stopReplyRecording = () => {
    replyMrRef.current?.stop();
    clearInterval(replyTimerRef.current);
    setReplyRecording(false);
  };

  const sendReplyVoice = async () => {
    if (!replyBlob) return;
    const fd = new FormData();
    fd.append("audio", replyBlob, "reply.webm");
    // Recipient = the story owner, recorded server-side so only the two of us can
    // fetch the note (GET /uploads/voice is gated on participation).
    fd.append("toUserId", group.userId);
    try {
      const res = await apiFetch("social/upload-voice", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error();
      const { audioUrl } = await res.json();
      await sendStoryReply(audioUrl, "voice");
      setReplyBlob(null);
      setReplyDuration(0);
    } catch {
      console.error("Voice reply error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="w-full max-w-sm h-full max-h-[700px] relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 p-3 z-10 flex gap-1">
          {group.stories.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden"
            >
              <div
                className={`h-full bg-white rounded-full ${i < storyIdx ? "w-full" : i === storyIdx ? "" : "w-0"}`}
                style={
                  i === storyIdx
                    ? { width: `${progress}%`, transition: "width 0.1s linear" }
                    : {}
                }
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 p-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar
              name={group.userName}
              avatarUrl={group.avatarUrl}
              size="sm"
              ring="ring-white/50"
            />
            <div>
              <p className="text-white text-sm font-semibold">
                {group.userName}
              </p>
              <p className="text-white/60 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeLeft}h rimaste
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-full bg-white/10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Story content — tap to advance, but not on reply area */}
        <div
          className="absolute inset-0 flex items-center justify-center p-6 pt-24 pb-32"
          onClick={showReply ? undefined : advance}
        >
          {story.imageUrl ? (
            <img
              src={story.imageUrl}
              className="w-full h-full object-contain rounded-xl"
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : (
            <p className="text-white text-lg text-center leading-relaxed font-medium">
              {story.content}
            </p>
          )}
          {story.imageUrl && story.content && (
            <p className="absolute bottom-36 left-0 right-0 text-white/90 text-sm text-center px-4">
              {story.content}
            </p>
          )}
        </div>

        {/* Reply area */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {!showReply ? (
            <div className="p-4 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReply(true);
                  setPaused(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full text-white text-sm font-medium hover:bg-white/25 transition-colors"
              >
                <Reply className="w-4 h-4" /> Rispondi
              </button>
            </div>
          ) : (
            <div
              className="bg-black/80 backdrop-blur-md border-t border-white/10 p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              {replySent ? (
                <div className="text-center py-3 text-green-400 font-medium text-sm">
                  ✓ Risposta inviata!
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex gap-2">
                    {(["text", "emoji", "image", "voice"] as const).map(
                      (tab) => (
                        <button
                          key={tab}
                          onClick={() => setReplyTab(tab)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${replyTab === tab ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"}`}
                        >
                          {tab === "text"
                            ? "Testo"
                            : tab === "emoji"
                              ? "😊"
                              : tab === "image"
                                ? "📷"
                                : "🎤"}
                        </button>
                      ),
                    )}
                  </div>

                  {replyTab === "text" && (
                    <div className="flex gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          replyText.trim() &&
                          sendStoryReply(replyText.trim())
                        }
                        placeholder={uiText("auto.ui.a537239d12")}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/40"
                        autoFocus
                      />
                      <button
                        onClick={() =>
                          replyText.trim() && sendStoryReply(replyText.trim())
                        }
                        disabled={!replyText.trim()}
                        className="px-3 py-2 bg-white text-black rounded-xl disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {replyTab === "emoji" && (
                    <div className="space-y-2">
                      <EmojiPickerPanel
                        onSelect={(e) => sendStoryReply(e, "text")}
                      />
                    </div>
                  )}

                  {replyTab === "image" && (
                    <div className="flex items-center justify-center gap-3 py-2">
                      <button
                        onClick={() => replyFileRef.current?.click()}
                        disabled={replyImgUploading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/15 border border-white/20 rounded-xl text-white text-sm hover:bg-white/25 transition-colors disabled:opacity-50"
                      >
                        {replyImgUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                        {replyImgUploading ? "Caricamento..." : "Allega foto"}
                      </button>
                      <input
                        ref={replyFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleReplyImage}
                      />
                    </div>
                  )}

                  {replyTab === "voice" && (
                    <div className="flex items-center gap-3 py-1">
                      {!replyBlob ? (
                        <button
                          onClick={
                            replyRecording
                              ? stopReplyRecording
                              : startReplyRecording
                          }
                          className={`flex items-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${replyRecording ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/15 text-white border border-white/20 hover:bg-white/25"}`}
                        >
                          {replyRecording ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              <span>{fmtDur(replyDuration)}</span>
                              <span className="ml-auto text-xs opacity-70">
                                Tocca per fermare
                              </span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-4 h-4" /> Tieni premuto per
                              registrare
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <audio
                            controls
                            src={URL.createObjectURL(replyBlob)}
                            className="flex-1 h-8"
                          />
                          <button
                            onClick={() => {
                              setReplyBlob(null);
                              setReplyDuration(0);
                            }}
                            className="p-2 text-white/60 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={sendReplyVoice}
                            className="p-2 bg-white text-black rounded-lg"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowReply(false);
                      setPaused(false);
                      setReplyText("");
                      setReplyBlob(null);
                    }}
                    className="w-full text-center text-white/40 text-xs py-1 hover:text-white/60"
                  >{uiText("auto.ui.6c3de5381b")}</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
