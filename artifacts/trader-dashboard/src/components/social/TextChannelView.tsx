import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { uiText } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Trash2, Hash, Settings2, Download, Paperclip, ToggleLeft, ToggleRight, FolderOpen, Flag, Check } from "lucide-react";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { formatFileSize } from "@/lib/fileFormatting";
import { reportClientError } from "@/lib/clientErrorReporter";
import { fileIcon } from "./format";
import { useCommunityFiles, useCommunityMessages } from "./hooks";
import { useSocialSocket } from "./useSocialSocket";
import type { ChannelType, CommunityMsg } from "./types";

export function TextChannelView({
  channel,
  currentUserId,
  isOwnerOrAdmin,
}: {
  channel: ChannelType;
  currentUserId: string;
  isOwnerOrAdmin: boolean;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useCommunityMessages(channel.id);
  // Real-time push: refresh the messages immediately on a new message instead of
  // waiting for the poll. Polling stays as the guaranteed fallback (see hook).
  useSocialSocket(channel.id, () => {
    void qc.invalidateQueries({ queryKey: ["communityMessages", channel.id] });
  });
  const { data: files = [] } = useCommunityFiles(channel.id);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMsg = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText("");
    setSending(true);
    try {
      await apiJSON(`community/channels/${channel.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      qc.invalidateQueries({ queryKey: ["communityMessages", channel.id] });
    } catch (error) {
      reportClientError(error, {
        context: "community message send",
        notify: false,
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await apiFetch(`community/channels/${channel.id}/files`, {
        method: "POST",
        body: fd,
      });
      qc.invalidateQueries({ queryKey: ["communityFiles", channel.id] });
      setActiveTab("files");
    } catch (error) {
      reportClientError(error, {
        context: "community file upload",
        notify: false,
      });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleDownloadable = async (fileId: number, current: boolean) => {
    try {
      await apiJSON(`community/files/${fileId}/downloadable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadable: !current }),
      });
      qc.invalidateQueries({ queryKey: ["communityFiles", channel.id] });
    } catch (error) {
      reportClientError(error, {
        context: "community file downloadable toggle",
        notify: false,
      });
    }
  };

  const deleteFile = async (fileId: number) => {
    try {
      await apiFetch(`community/files/${fileId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["communityFiles", channel.id] });
    } catch (error) {
      reportClientError(error, {
        context: "community file delete",
        notify: false,
      });
    }
  };

  // Delete a message: your own, or (as owner/moderator) anyone's.
  const deleteMessage = async (id: number) => {
    if (!window.confirm(uiText("community.msg.delete_confirm"))) return;
    try {
      await apiFetch(`community/messages/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["communityMessages", channel.id] });
    } catch (error) {
      reportClientError(error, { context: "community message delete", notify: false });
    }
  };

  // Report someone else's message to the moderators (idempotent per member).
  const reportMessage = async (id: number) => {
    if (reportedIds.has(id)) return;
    if (!window.confirm(uiText("community.msg.report_confirm"))) return;
    try {
      await apiJSON(`community/messages/${id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "other" }),
      });
      setReportedIds((prev) => new Set(prev).add(id));
    } catch (error) {
      reportClientError(error, { context: "community message report", notify: false });
    }
  };

  const groupedMessages = messages.reduce<
    { date: string; msgs: CommunityMsg[] }[]
  >((acc, msg) => {
    const date = new Date(msg.createdAt).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
    });
    const last = acc[acc.length - 1];
    if (last?.date === date) last.msgs.push(msg);
    else acc.push({ date, msgs: [msg] });
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-0 px-4 border-b border-border shrink-0 bg-card/30">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all ${activeTab === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Hash className="w-3.5 h-3.5" /> {channel.name}
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all ${activeTab === "files" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          File
          {files.length > 0 && (
            <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px]">
              {files.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "chat" ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
                <Hash className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-sm font-medium">{uiText("auto.ui.a975eec877")}</p>
                <p className="text-xs mt-1">
                  Sii il primo a scrivere in #{channel.name}!
                </p>
              </div>
            ) : (
              groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                      {group.date}
                    </span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                  <div className="space-y-1">
                    {group.msgs.map((msg, i) => {
                      const prev = group.msgs[i - 1];
                      const isGrouped =
                        prev?.userId === msg.userId &&
                        new Date(msg.createdAt).getTime() -
                          new Date(prev.createdAt).getTime() <
                          300_000;
                      const isMe = msg.userId === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={`group flex gap-2.5 ${isGrouped ? "ml-9" : ""}`}
                        >
                          {!isGrouped && (
                            <div className="w-8 h-8 rounded-full bg-secondary border border-border overflow-hidden shrink-0 mt-0.5">
                              {msg.avatarUrl ? (
                                <img
                                  src={msg.avatarUrl}
                                  alt={msg.userName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                                  {msg.userName[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {!isGrouped && (
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span
                                  className={`text-xs font-semibold ${isMe ? "text-primary" : ""}`}
                                >
                                  {msg.userName}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50">
                                  {new Date(msg.createdAt).toLocaleTimeString(
                                    "it-IT",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                              </div>
                            )}
                            {msg.imageUrl && (
                              <img
                                src={msg.imageUrl}
                                alt=""
                                className="max-w-xs rounded-xl mb-1 border border-border"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                            {msg.content && (
                              <p className="text-sm leading-relaxed break-words text-foreground/90">
                                {msg.content}
                              </p>
                            )}
                          </div>
                          <div className="self-start flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                            {(isMe || isOwnerOrAdmin) && (
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                title={uiText("community.msg.delete")}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isMe && (
                              <button
                                onClick={() => reportMessage(msg.id)}
                                disabled={reportedIds.has(msg.id)}
                                title={uiText(reportedIds.has(msg.id) ? "community.msg.reported" : "community.msg.report")}
                                className="p-1 text-muted-foreground hover:text-warning transition-colors disabled:text-success disabled:opacity-100"
                              >
                                {reportedIds.has(msg.id) ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Flag className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 px-4 py-3 border-t border-border bg-card/20">
            <div className="flex items-center gap-2 bg-secondary/30 border border-border rounded-xl px-3 py-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                title={uiText("auto.ui.2b269b1b68")}
                className="text-muted-foreground hover:text-primary transition-colors shrink-0 disabled:opacity-40"
              >
                {uploadingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), sendMsg())
                }
                placeholder={`Messaggio in #${channel.name}`}
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50 min-w-0"
              />
              <button
                onClick={sendMsg}
                disabled={!text.trim() || sending}
                className="w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary/40 text-primary flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
              <FolderOpen className="w-12 h-12 opacity-20 mb-3" />
              <p className="text-sm font-medium">{uiText("chat.files.empty_title")}</p>
              <p className="text-xs mt-1">
                Usa l'icona 📎 nella chat per caricare file
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {isOwnerOrAdmin && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-secondary/20 mb-3">
                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Come owner/admin puoi controllare se ogni file è scaricabile
                    dai membri.
                  </p>
                </div>
              )}
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/40 group"
                >
                  <div className="shrink-0">{fileIcon(f.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {f.fileName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(f.fileSize)} · {f.userName} ·{" "}
                      {new Date(f.createdAt).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => toggleDownloadable(f.id, f.downloadable)}
                        title={
                          f.downloadable
                            ? "Scaricabile — clicca per bloccare"
                            : "Non scaricabile — clicca per abilitare"
                        }
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${f.downloadable ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"}`}
                      >
                        {f.downloadable ? (
                          <ToggleRight className="w-3.5 h-3.5" />
                        ) : (
                          <ToggleLeft className="w-3.5 h-3.5" />
                        )}
                        {f.downloadable ? "DL" : "NO"}
                      </button>
                    )}
                    {f.downloadable ? (
                      <a
                        href={f.fileUrl}
                        download={f.fileName}
                        className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
                        title={uiText("auto.ui.bf03edb19e")}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-lg bg-secondary/30 text-muted-foreground/30 flex items-center justify-center"
                        title={uiText("auto.ui.a75476af96")}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {(f.userId === currentUserId || isOwnerOrAdmin) && (
                      <button
                        onClick={() => deleteFile(f.id)}
                        className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
