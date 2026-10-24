import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { uiText } from "@/contexts/LanguageContext";
import { apiRequest as apiFetch } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { useToast } from "@/hooks/use-toast";
import { useE2EEKeys } from "@/hooks/useE2EEKeys";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/react";
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
  const { userId } = useAuth();
  const { isReady: chatReady, error: chatError } = useE2EEKeys(userId ?? null);
  const { toast } = useToast();
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
  const [replyError, setReplyError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [replySending, setReplySending] = useState(false);
  const replySendingRef = useRef(false);
  const replyUploadRef = useRef(false);
  const voiceUploadedRef = useRef<{ blob: Blob; url: string } | null>(null);
  const [replyImageUrl, setReplyImageUrl] = useState<string | null>(null);
  const [replyImgUploading, setReplyImgUploading] = useState(false);
  const [replyRecording, setReplyRecording] = useState(false);
  const [replyBlob, setReplyBlob] = useState<Blob | null>(null);
  const [replyBlobUrl, setReplyBlobUrl] = useState<string | null>(null);
  const [replyDuration, setReplyDuration] = useState(0);
  const replyMrRef = useRef<MediaRecorder | null>(null);
  const mountedRef = useRef(true);
  const recordingGenerationRef = useRef(0);
  const micRequestRef = useRef(false);
  const [micRequestPending, setMicRequestPending] = useState(false);
  const replyTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const replyFileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!replyBlob) { setReplyBlobUrl(null); return; }
    const url = URL.createObjectURL(replyBlob);
    setReplyBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [replyBlob]);
  const discardRecording = useCallback(() => {
    recordingGenerationRef.current++;
    clearInterval(replyTimerRef.current);
    const recorder = replyMrRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    recorder?.stream.getTracks().forEach((track) => track.stop());
    replyMrRef.current = null;
    if (mountedRef.current) setReplyRecording(false);
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; clearTimeout(successTimerRef.current); discardRecording(); };
  }, [discardRecording]);
  useEffect(() => {
    if (!showReply || replyTab !== "voice") discardRecording();
  }, [showReply, replyTab, discardRecording]);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const totalInGroup = group?.stories.length ?? 1;
  const { titleId, panelProps } = useDialogA11y({ isOpen: Boolean(story), onClose, panelRef });

  const advance = useCallback(() => {
    if (storyIdx < totalInGroup - 1) setStoryIdx((s) => s + 1);
    else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else onClose();
  }, [storyIdx, totalInGroup, groupIdx, groups.length, onClose]);

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
  }, [groupIdx, storyIdx, paused, showReply, advance]);

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
    if (!mountedRef.current) return false;
    if (replySendingRef.current || (replyUploadRef.current && type === "text")) return false;
    if (!chatReady) {
      toast({ description: uiText(chatError ? "auto.ui.6f9df8e4ac" : "auto.ui.d8059d85da"), variant: "destructive" });
      return false;
    }
    replySendingRef.current = true;
    setReplySending(true);
    setReplyError(null);
    try {
      const response = await apiFetch(`social/story-reply/${story.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || uiText("support.error.generic"));
      }
      if (!mountedRef.current) return true;
      setReplySent(true);
      clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setReplySent(false);
        setShowReply(false);
        setPaused(false);
        discardRecording();
        setReplyText("");
        setReplyBlob(null);
        setReplyImageUrl(null);
        voiceUploadedRef.current = null;
      }, 1500);
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      setReplyError(err instanceof Error ? err.message : uiText("support.error.generic"));
      reportClientError(err, { context: "story reply", toast });
      return false;
    } finally {
      replySendingRef.current = false;
      if (mountedRef.current) setReplySending(false);
    }
  };

  const handleReplyImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replyUploadRef.current || replySendingRef.current || !chatReady) return;
    replyUploadRef.current = true;
    setReplyImgUploading(true);
    setReplyError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("toUserId", group.userId);
      const res = await apiFetch("social/upload-file", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { fileUrl } = await res.json();
      if (!mountedRef.current) return;
      setReplyImageUrl(fileUrl);
      await sendStoryReply(fileUrl, "image");
    } catch (err) {
      if (!mountedRef.current) return;
      setReplyError(err instanceof Error ? err.message : uiText("support.error.generic"));
      reportClientError(err, { context: "story image reply", toast });
    } finally {
      setReplyImgUploading(false);
      replyUploadRef.current = false;
      if (replyFileRef.current) replyFileRef.current.value = "";
    }
  };

  const startReplyRecording = async () => {
    if (micRequestRef.current || replyMrRef.current) return;
    micRequestRef.current = true;
    setMicRequestPending(true);
    const generation = recordingGenerationRef.current;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || generation !== recordingGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop()); return;
      }
      const recordingStream = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        if (mountedRef.current && generation === recordingGenerationRef.current) setReplyBlob(new Blob(chunks, { type: mimeType }));
        recordingStream.getTracks().forEach((t) => t.stop());
        if (replyMrRef.current === mr) replyMrRef.current = null;
      };
      mr.start();
      replyMrRef.current = mr;
      setReplyRecording(true);
      setReplyDuration(0);
      replyTimerRef.current = setInterval(
        () => setReplyDuration((d) => d + 1),
        1000,
      );
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      reportClientError(err, { context: "story reply mic", toast });
    } finally {
      micRequestRef.current = false;
      if (mountedRef.current) setMicRequestPending(false);
    }
  };

  const stopReplyRecording = () => {
    if (replyMrRef.current?.state === "recording") replyMrRef.current.stop();
    clearInterval(replyTimerRef.current);
    setReplyRecording(false);
  };

  const sendReplyVoice = async () => {
    if (!replyBlob || replyUploadRef.current || replySendingRef.current || !chatReady) return;
    replyUploadRef.current = true;
    setReplyImgUploading(true);
    setReplyError(null);
    try {
      let audioUrl = voiceUploadedRef.current?.blob === replyBlob ? voiceUploadedRef.current.url : null;
      if (!audioUrl) {
        const fd = new FormData();
        fd.append("audio", replyBlob, "reply.webm");
        fd.append("toUserId", group.userId);
        const res = await apiFetch("social/upload-voice", { method: "POST", body: fd });
        if (!res.ok) throw new Error(uiText("support.error.generic"));
        audioUrl = (await res.json()).audioUrl as string;
        if (!mountedRef.current) return;
        voiceUploadedRef.current = { blob: replyBlob, url: audioUrl };
      }
      if (await sendStoryReply(audioUrl, "voice")) {
        setReplyBlob(null);
        setReplyDuration(0);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setReplyError(err instanceof Error ? err.message : uiText("support.error.generic"));
      reportClientError(err, { context: "story voice reply", toast });
    } finally {
      replyUploadRef.current = false;
      setReplyImgUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div ref={panelRef} {...panelProps} className="w-full max-w-sm h-full max-h-[700px] relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col">
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
              <p id={titleId} className="text-white text-sm font-semibold">
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
            aria-label={uiText("backtest_terminal.close")}
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
              alt={uiText("social.story.alt", { name: group.userName })}
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
                  {!chatReady && (
                    <p role={chatError ? "alert" : "status"} className="text-sm text-white/70">
                      {uiText(chatError ? "auto.ui.6f9df8e4ac" : "auto.ui.d8059d85da")}
                    </p>
                  )}
                  {replyError && <p role="alert" className="text-sm text-red-300">{replyError}</p>}
                  {/* Tabs */}
                  <div className="flex gap-2">
                    {(["text", "emoji", "image", "voice"] as const).map(
                      (tab) => (
                        <button
                          key={tab}
                          disabled={replySending || replyImgUploading}
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
                        disabled={replySending || replyImgUploading}
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
                        disabled={!replyText.trim() || replySending || replyImgUploading || !chatReady}
                        aria-label={uiText("admin.tickets.reply.send")}
                        className="px-3 py-2 bg-white text-black rounded-xl disabled:opacity-40"
                      >
                        {replySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
                      {replyImageUrl && (
                        <button type="button" onClick={() => sendStoryReply(replyImageUrl, "image")} disabled={replySending || replyImgUploading} className="px-3 py-2 bg-white text-black rounded-xl disabled:opacity-40">
                          {uiText("admin.tickets.reply.send")}
                        </button>
                      )}
                      <button
                        onClick={() => replyFileRef.current?.click()}
                        disabled={replyImgUploading || replySending || !chatReady}
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
                          disabled={micRequestPending || replySending || replyImgUploading || !chatReady}
                          aria-label={uiText(replyRecording ? "auto.ui.bce10aee8e" : "auto.ui.38fbbb0c51")}
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
                              <Mic className="w-4 h-4" /> {uiText("auto.ui.38fbbb0c51")}
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <audio
                            controls
                            src={replyBlobUrl ?? undefined}
                            className="flex-1 h-8"
                          />
                          <button
                            aria-label={uiText("auto.ui.6c3de5381b")}
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
                            aria-label={uiText("admin.tickets.reply.send")}
                            disabled={replySending || replyImgUploading || !chatReady}
                            className="p-2 bg-white text-black rounded-lg"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    disabled={replySending || replyImgUploading}
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
    </div>, document.body
  );
}
