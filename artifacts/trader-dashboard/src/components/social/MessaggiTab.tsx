import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent } from "react";
import { uiText } from "@/contexts/LanguageContext";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { useE2EEKeys } from "@/hooks/useE2EEKeys";
import { useToast } from "@/hooks/use-toast";
import { getSharedKey, encryptMessage, decryptMessage } from "@/lib/e2ee";
import { useGetPublicKey, useSendChatMessage, useGetChatMessages, useGetUnreadCount, getGetChatMessagesQueryKey, getGetPublicKeyQueryKey, getGetUnreadCountQueryKey, useGetFriends, type FriendListItem } from "@workspace/api-client-react";
import { Send, Shield, Loader2, Lock, X, ArrowLeft, UserCheck, ChevronRight, Smile, Mic, MicOff, Phone, PhoneOff, PhoneCall, StopCircle, Download, Paperclip } from "lucide-react";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { formatFileSize } from "@/lib/fileFormatting";
import { reportClientError } from "@/lib/clientErrorReporter";
import { ICE_SERVERS } from "./constants";
import { fmtDur, fileIcon } from "./format";
import { Avatar } from "./Avatar";
import { useMutualFollowers } from "./hooks";
import type { DecryptedMsg, SocialUser, CallSignal } from "./types";

export function MessaggiTab({
  currentUser,
  initialPeer,
}: {
  currentUser: { id: string };
  initialPeer?: SocialUser | null;
}) {
  const { toast } = useToast();
  const {
    keyPair,
    isReady: e2eeReady,
    error: e2eeError,
  } = useE2EEKeys(currentUser.id);
  const [selectedFriend, setSelectedFriend] = useState<SocialUser | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [messageInput, setMessageInput] = useState("");
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMsg[]>(
    [],
  );
  const [showEmojiDM, setShowEmojiDM] = useState(false);
  const [dmImgUploading, setDmImgUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  // Voice call (WebRTC)
  const [callState, setCallState] = useState<
    "idle" | "calling" | "incoming" | "connected"
  >("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [callPeer, setCallPeer] = useState<SocialUser | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [pendingOffer, setPendingOffer] = useState<{
    sdp: string;
    callId: string;
    from: string;
  } | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const { data: mutualFollowers = [], isLoading } = useMutualFollowers();
  const { data: acceptedFriends = [], isLoading: friendsLoading } = useGetFriends();
  const messageContacts = useMemo<SocialUser[]>(() => {
    const contacts = new Map<string, SocialUser>();
    for (const user of mutualFollowers as SocialUser[]) {
      if (user.userId) contacts.set(user.userId, { ...user, isMutual: true });
    }
    for (const friend of acceptedFriends as FriendListItem[]) {
      contacts.set(friend.friendUserId, {
        userId: friend.friendUserId,
        name: friend.name,
        avatarUrl: friend.avatarUrl ?? null,
        hasKey: true,
        isMutual: contacts.get(friend.friendUserId)?.isMutual,
      });
    }
    return Array.from(contacts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [acceptedFriends, mutualFollowers]);
  const { data: unreadData } = useGetUnreadCount({
    query: { queryKey: getGetUnreadCountQueryKey(), refetchInterval: 15000 },
  });
  const { data: friendPublicKeyData } = useGetPublicKey(
    selectedFriend?.userId ?? "",
    {
      query: {
        queryKey: getGetPublicKeyQueryKey(selectedFriend?.userId ?? ""),
        enabled: !!selectedFriend?.userId,
      },
    },
  );
  const { data: messagesData, refetch: refetchMessages } = useGetChatMessages(
    selectedFriend?.userId ?? "",
    {},
    {
      query: {
        queryKey: getGetChatMessagesQueryKey(selectedFriend?.userId ?? "", {}),
        enabled: !!selectedFriend?.userId,
        refetchInterval: 8000,
      },
    },
  );
  const sendMessageMutation = useSendChatMessage();

  // Decrypt messages
  useEffect(() => {
    if (
      !messagesData?.messages ||
      !keyPair ||
      !friendPublicKeyData?.publicKeyJwk
    )
      return;
    const decrypt = async () => {
      try {
        const sharedKey = await getSharedKey(
          keyPair.privateKey,
          friendPublicKeyData.publicKeyJwk as JsonWebKey,
        );
        const decrypted = await Promise.all(
          messagesData.messages.map(async (msg): Promise<DecryptedMsg> => {
            const raw = await decryptMessage(msg.ciphertext, msg.iv, sharedKey);
            try {
              const obj = JSON.parse(raw);
              return {
                id: msg.id,
                senderId: msg.senderId,
                type: obj.type ?? "text",
                content: obj.content ?? obj.url ?? raw,
                fileName: obj.fileName,
                mimeType: obj.mimeType,
                size: obj.size,
                createdAt: msg.createdAt,
              };
            } catch {
              return {
                id: msg.id,
                senderId: msg.senderId,
                type: "text",
                content: raw,
                createdAt: msg.createdAt,
              };
            }
          }),
        );
        setDecryptedMessages(decrypted);
      } catch (err) {
        console.error("Decrypt error:", err);
      }
    };
    decrypt();
  }, [messagesData?.messages, keyPair, friendPublicKeyData?.publicKeyJwk]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [decryptedMessages]);

  // E2EE send helper
  const sendE2EE = useCallback(
    async (payload: {
      type: string;
      content?: string;
      url?: string;
      duration?: number;
      fileName?: string;
      mimeType?: string;
      size?: number;
    }) => {
      if (
        !selectedFriend?.userId ||
        !keyPair ||
        !friendPublicKeyData?.publicKeyJwk
      )
        return;
      const sharedKey = await getSharedKey(
        keyPair.privateKey,
        friendPublicKeyData.publicKeyJwk as JsonWebKey,
      );
      const { ciphertext, iv } = await encryptMessage(
        JSON.stringify(payload),
        sharedKey,
      );
      await sendMessageMutation.mutateAsync({
        data: { receiverId: selectedFriend.userId, ciphertext, iv },
      });
      refetchMessages();
    },
    [
      selectedFriend,
      keyPair,
      friendPublicKeyData,
      sendMessageMutation,
      refetchMessages,
    ],
  );

  const handleSendText = useCallback(async () => {
    if (!messageInput.trim()) return;
    try {
      await sendE2EE({ type: "text", content: messageInput.trim() });
      setMessageInput("");
      setShowEmojiDM(false);
    } catch (err) {
      console.error("Send error:", err);
    }
  }, [messageInput, sendE2EE]);

  // Attachment DM
  const handleDmAttachment = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDmImgUploading(true);
    try {
      const fd = new FormData();
      if (file.type.startsWith("image/")) {
        fd.append("image", file);
        const res = await apiFetch("social/upload-image", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error("Upload fallito");
        const { imageUrl } = await res.json();
        await sendE2EE({ type: "image", url: imageUrl });
      } else {
        fd.append("file", file);
        const res = await apiFetch("social/upload-file", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error("Upload fallito");
        const { fileUrl, fileName, mimeType, size } = await res.json();
        await sendE2EE({
          type: file.type.startsWith("video/") ? "video" : "file",
          url: fileUrl,
          fileName,
          mimeType,
          size,
        });
      }
    } catch (err) {
      reportClientError(err, {
        context: "DM attachment upload",
        fallbackMessage: "Upload file non riuscito.",
        toast,
      });
    } finally {
      setDmImgUploading(false);
      if (dmFileInputRef.current) dmFileInputRef.current.value = "";
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => recordChunksRef.current.push(e.data);
      mr.onstop = () => {
        setRecordedBlob(new Blob(recordChunksRef.current, { type: mimeType }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(
        () => setRecordDuration((d) => d + 1),
        1000,
      );
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
  };
  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordedBlob(null);
    setRecordDuration(0);
  };

  const sendVoiceMessage = async () => {
    if (!recordedBlob) return;
    try {
      const fd = new FormData();
      fd.append("audio", recordedBlob, "voice.webm");
      const res = await apiFetch("social/upload-voice", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { audioUrl } = await res.json();
      await sendE2EE({
        type: "voice",
        url: audioUrl,
        duration: recordDuration,
      });
      setRecordedBlob(null);
      setRecordDuration(0);
    } catch (err) {
      console.error("Voice send error:", err);
    }
  };

  // Emoji DM
  const insertEmojiDM = (emoji: string) => {
    const el = msgInputRef.current;
    if (!el) {
      setMessageInput((m) => m + emoji);
      return;
    }
    const start = el.selectionStart ?? messageInput.length;
    const end = el.selectionEnd ?? messageInput.length;
    setMessageInput(
      messageInput.slice(0, start) + emoji + messageInput.slice(end),
    );
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    });
    setShowEmojiDM(false);
  };

  // ─── WebRTC Voice Call ────────────────────────────────────────────────────────
  const newCallId = () =>
    `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const sendSignal = useCallback(
    async (to: string, type: string, data: string, cid: string) => {
      await apiFetch("social/calls/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, type, data, callId: cid }),
      });
    },
    [],
  );

  const cleanupCall = useCallback(() => {
    peerConnRef.current?.close();
    peerConnRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    setCallState("idle");
    setCallId(null);
    setCallPeer(null);
    setIsMuted(false);
    setPendingOffer(null);
  }, []);

  const startCall = async () => {
    if (!selectedFriend?.userId) return;
    const cid = newCallId();
    setCallId(cid);
    setCallPeer(selectedFriend);
    setCallState("calling");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = async (e) => {
        if (e.candidate)
          await sendSignal(
            selectedFriend.userId!,
            "ice",
            JSON.stringify(e.candidate),
            cid,
          );
      };
      pc.ontrack = (e) => {
        const a = new Audio();
        remoteAudioRef.current = a;
        a.srcObject = e.streams[0];
        a.play().catch((error) =>
          reportClientError(error, {
            context: "direct call remote audio playback",
            notify: false,
          }),
        );
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(
        selectedFriend.userId!,
        "offer",
        JSON.stringify({ sdp: offer.sdp, type: offer.type }),
        cid,
      );
    } catch (err) {
      console.error("Call error:", err);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!pendingOffer) return;
    const { sdp: rawSdp, callId: cid, from } = pendingOffer;
    const peer =
      messageContacts.find((u) => u.userId === from) ??
      ({ userId: from, name: "Trader", avatarUrl: null } as SocialUser);
    setCallId(cid);
    setCallPeer(peer);
    setCallState("connected");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = async (e) => {
        if (e.candidate)
          await sendSignal(from, "ice", JSON.stringify(e.candidate), cid);
      };
      pc.ontrack = (e) => {
        const a = new Audio();
        remoteAudioRef.current = a;
        a.srcObject = e.streams[0];
        a.play().catch((error) =>
          reportClientError(error, {
            context: "direct call remote audio playback",
            notify: false,
          }),
        );
      };
      const offerObj = JSON.parse(rawSdp);
      await pc.setRemoteDescription(new RTCSessionDescription(offerObj));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(
        from,
        "answer",
        JSON.stringify({ sdp: answer.sdp, type: answer.type }),
        cid,
      );
      setPendingOffer(null);
    } catch (err) {
      console.error("Accept call error:", err);
      cleanupCall();
    }
  };

  const hangup = async () => {
    if (callPeer?.userId && callId) {
      try {
        await sendSignal(callPeer.userId, "hangup", "", callId);
      } catch (error) {
        reportClientError(error, {
          context: "direct call hangup signal",
          notify: false,
        });
      }
    }
    cleanupCall();
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted((m) => !m);
  };

  // Poll for signals
  useEffect(() => {
    if (!e2eeReady) return;
    const poll = async () => {
      try {
        const data = await apiJSON<{ signals: CallSignal[] }>(
          "social/calls/signals",
        );
        for (const sig of data.signals ?? []) {
          const pc = peerConnRef.current;
          if (sig.type === "offer" && callState === "idle") {
            setPendingOffer({
              sdp: sig.data,
              callId: sig.callId,
              from: sig.from,
            });
            setCallState("incoming");
          } else if (
            sig.type === "answer" &&
            pc &&
            pc.signalingState === "have-local-offer"
          ) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(JSON.parse(sig.data)),
            );
            setCallState("connected");
          } else if (sig.type === "ice" && pc) {
            try {
              await pc.addIceCandidate(
                new RTCIceCandidate(JSON.parse(sig.data)),
              );
            } catch (error) {
              reportClientError(error, {
                context: "direct call ICE candidate",
                notify: false,
              });
            }
          } else if (sig.type === "hangup") {
            cleanupCall();
          }
        }
      } catch (error) {
        reportClientError(error, {
          context: "direct call signal polling",
          notify: false,
        });
      }
    };
    const interval = setInterval(poll, callState !== "idle" ? 800 : 4000);
    return () => clearInterval(interval);
  }, [e2eeReady, callState, cleanupCall]);

  const handleSelect = (u: SocialUser) => {
    setSelectedFriend(u);
    setDecryptedMessages([]);
    setMobileView("chat");
  };

  // Open the conversation requested from another tab (e.g. "Messaggio" on a
  // profile). pendingChat is a one-shot prop cleared by the parent after use.
  useEffect(() => {
    if (!initialPeer) return;
    setSelectedFriend(initialPeer);
    setDecryptedMessages([]);
    setMobileView("chat");
  }, [initialPeer]);

  // Render message bubble
  const renderBubble = (msg: DecryptedMsg) => {
    const isMine = msg.senderId !== selectedFriend?.userId;
    const base = `max-w-[78%] rounded-2xl text-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card/80 border border-border rounded-bl-md"}`;
    const timeEl = (
      <p
        className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}
      >
        {new Date(msg.createdAt).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    );
    if (msg.type === "image")
      return (
        <div className={`${base} overflow-hidden p-0`}>
          <img
            src={msg.content}
            alt="img"
            className="max-w-[240px] max-h-44 w-full object-cover"
          />
          <div className="px-3 py-1.5">{timeEl}</div>
        </div>
      );
    if (msg.type === "voice")
      return (
        <div className={`${base} min-w-[260px] px-3 py-2.5`}>
          <audio
            aria-label={uiText("auto.ui.fe60a4fba4")}
            controls
            src={msg.content}
            className="h-9 w-full"
            style={{ accentColor: "currentColor" }}
          />
          {timeEl}
        </div>
      );
    if (msg.type === "video")
      return (
        <div className={`${base} overflow-hidden p-0 min-w-[260px]`}>
          {msg.fileName && (
            <p className="px-3 pt-2 text-xs font-medium truncate">
              {msg.fileName}
            </p>
          )}
          <video
            aria-label={msg.fileName ?? "Video allegato"}
            controls
            src={msg.content}
            className="max-w-[320px] max-h-64 w-full bg-black"
          />
          <div className="px-3 py-1.5">{timeEl}</div>
        </div>
      );
    if (msg.type === "file")
      return (
        <div className={`${base} min-w-[260px] px-3 py-2.5`}>
          <div className="flex items-center gap-3">
            {fileIcon(msg.mimeType ?? "")}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {msg.fileName ?? "File allegato"}
              </p>
              <p className="text-[11px] opacity-70 truncate">
                {(msg.mimeType || "file").split(";")[0]}
                {typeof msg.size === "number" ? ` · ${formatFileSize(msg.size)}` : ""}
              </p>
            </div>
            <a
              href={msg.content}
              target="_blank"
              rel="noreferrer"
              download={msg.fileName}
              className="p-2 rounded-lg bg-black/10 hover:bg-black/20 transition-colors"
              title={uiText("auto.ui.5fe28723c7")}
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
          {timeEl}
        </div>
      );
    return (
      <div className={`${base} px-4 py-2.5`}>
        <p className="break-words whitespace-pre-wrap">{msg.content}</p>
        {timeEl}
      </div>
    );
  };

  // Call overlay
  const callOverlay = callState !== "idle" && (
    <div className="absolute inset-0 z-30 bg-black/92 backdrop-blur-sm flex items-center justify-center rounded-inherit">
      <div className="text-center space-y-5 px-6">
        {callPeer && (
          <div className="mx-auto">
            <Avatar
              name={callPeer.name}
              avatarUrl={callPeer.avatarUrl}
              size="lg"
              ring="ring-primary ring-4"
            />
          </div>
        )}
        <div>
          <p className="text-white font-semibold text-lg">
            {callPeer?.name ?? "Chiamata..."}
          </p>
          <p className="text-white/60 text-sm mt-1">
            {callState === "calling"
              ? "In chiamata..."
              : callState === "incoming"
                ? "Chiamata in arrivo"
                : "● Connesso"}
          </p>
        </div>
        <div className="flex items-center justify-center gap-5">
          {callState === "incoming" && (
            <button
              onClick={acceptCall}
              className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-400 transition-colors shadow-lg shadow-green-500/30"
            >
              <Phone className="w-6 h-6 text-white" />
            </button>
          )}
          {callState === "connected" && (
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-500" : "bg-white/20 hover:bg-white/30"}`}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5 text-white" />
              )}
            </button>
          )}
          <button
            onClick={hangup}
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );

  if (e2eeError)
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 mx-auto text-destructive opacity-40" />
          <p className="text-muted-foreground text-sm">{uiText("auto.ui.6f9df8e4ac")}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm"
          >{uiText("auto.ui.f360775cb8")}</button>
        </div>
      </div>
    );

  if (!e2eeReady)
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">
            Inizializzazione crittografia...
          </p>
        </div>
      </div>
    );

  const list = (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">{uiText("auto.ui.5196dca303")}</p>
        </div>
        <div className="flex items-center gap-2">
          {callState === "incoming" && (
            <button
              onClick={() => setCallState("incoming")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium animate-pulse"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Chiamata
            </button>
          )}
          {(unreadData?.count ?? 0) > 0 && (
            <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full font-bold">
              {unreadData?.count}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading || friendsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messageContacts.length === 0 ? (
          <div className="text-center py-12 px-4 text-muted-foreground space-y-3">
            <UserCheck className="w-12 h-12 mx-auto opacity-20" />
            <p className="font-medium text-sm">{uiText("auto.ui.76d784258a")}</p>
            <p className="text-xs leading-relaxed">
              Seguiti e seguaci possono chattare. Vai nel tab Social per trovare
              altri trader!
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {messageContacts.map((u) => (
              <div
                key={u.userId}
                onClick={() => handleSelect(u)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedFriend?.userId === u.userId ? "bg-primary/10 border border-primary/30" : "hover:bg-white/5 border border-transparent"}`}
              >
                <Avatar name={u.name} avatarUrl={u.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-primary flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> {u.isMutual ? "Mutual" : "Amico"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const chatArea = (
    <div className="flex flex-col h-full min-h-0 overflow-hidden relative">
      {callOverlay}
      {selectedFriend ? (
        <>
          <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setSelectedFriend(null);
                setMobileView("list");
              }}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground lg:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Avatar
              name={selectedFriend.name}
              avatarUrl={selectedFriend.avatarUrl}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {selectedFriend.name}
              </p>
              <p className="text-xs text-primary flex items-center gap-1">
                <Shield className="w-3 h-3" /> E2EE
              </p>
            </div>
            {callState === "idle" && (
              <button
                onClick={startCall}
                title={uiText("auto.ui.99608682c6")}
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Phone className="w-5 h-5" />
              </button>
            )}
            {callState === "incoming" && (
              <button
                onClick={acceptCall}
                className="p-2 rounded-lg bg-green-500/20 text-green-400 animate-pulse"
              >
                <PhoneCall className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {decryptedMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-12">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{uiText("auto.ui.58974f8c19")}</p>
              </div>
            ) : (
              decryptedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId !== selectedFriend.userId ? "justify-end" : "justify-start"}`}
                >
                  {renderBubble(msg)}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {showEmojiDM && (
            <div className="border-t border-border bg-card/50 p-3 shrink-0">
              <EmojiPickerPanel onSelect={insertEmojiDM} />
            </div>
          )}

          {(isRecording || recordedBlob) && (
            <div className="border-t border-border bg-card/50 px-4 py-3 flex items-center gap-3 shrink-0">
              {isRecording ? (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-mono text-red-400">
                      {fmtDur(recordDuration)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Registrazione in corso...
                    </span>
                  </div>
                  <button
                    onClick={cancelRecording}
                    className="p-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs flex items-center gap-1.5"
                  >
                    <StopCircle className="w-3.5 h-3.5" />{uiText("auto.ui.9e253470c8")}</button>
                </>
              ) : (
                <>
                  <audio
                    controls
                    src={URL.createObjectURL(recordedBlob!)}
                    className="flex-1 h-8"
                  />
                  <button
                    onClick={cancelRecording}
                    className="p-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={sendVoiceMessage}
                    className="p-2 bg-primary text-primary-foreground rounded-lg"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}

          <div className="p-3 border-t border-border shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowEmojiDM((s) => !s)}
                title={uiText("auto.ui.5090a9e78c")}
                className={`p-2 rounded-lg transition-colors ${showEmojiDM ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                onClick={() => dmFileInputRef.current?.click()}
                disabled={dmImgUploading}
                title={uiText("auto.ui.2b269b1b68")}
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
              >
                {dmImgUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!!recordedBlob}
                title={isRecording ? "Ferma registrazione" : "Registra vocale"}
                className={`p-2 rounded-lg transition-colors ${isRecording ? "text-red-400 bg-red-500/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"} disabled:opacity-40`}
              >
                <Mic className="w-4 h-4" />
              </button>
              <input
                ref={msgInputRef}
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSendText()
                }
                placeholder={uiText("auto.ui.3e714ce7ae")}
                className="flex-1 px-3 py-2.5 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                disabled={isRecording || !!recordedBlob}
              />
              <button
                onClick={handleSendText}
                disabled={
                  !messageInput.trim() ||
                  sendMessageMutation.isPending ||
                  isRecording ||
                  !!recordedBlob
                }
                className="px-3 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={dmFileInputRef}
              type="file"
              accept="*"
              className="hidden"
              onChange={handleDmAttachment}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground space-y-3">
            <Lock className="w-16 h-16 mx-auto opacity-20" />
            <p className="text-sm">{uiText("auto.ui.234ba7ea7e")}</p>
            <p className="text-xs">{uiText("auto.ui.f78de8917d")}</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <div className="hidden lg:grid grid-cols-[280px_1fr] h-full min-h-0">
        <div className="border-r border-border">{list}</div>
        <div className="relative min-h-0 overflow-hidden">{chatArea}</div>
      </div>
      <div className="lg:hidden h-full min-h-0 relative overflow-hidden">
        {mobileView === "list" ? list : chatArea}
      </div>
    </div>
  );
}
