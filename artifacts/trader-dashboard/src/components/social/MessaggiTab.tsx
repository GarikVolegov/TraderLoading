import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent, type ReactNode } from "react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { EmojiPickerPanel } from "@/components/EmojiPickerPanel";
import { useE2EEKeys } from "@/hooks/useE2EEKeys";
import { useIsDesktop, useMediaQuery } from "@/hooks/use-media-query";
import { useToast } from "@/hooks/use-toast";
import { getSharedKey, encryptMessage, decryptMessage } from "@/lib/e2ee";
import { useGetPublicKey, useSendChatMessage, useGetChatMessages, useGetUnreadCount, getGetChatMessagesQueryKey, getGetPublicKeyQueryKey, getGetUnreadCountQueryKey, useGetFriends, type FriendListItem } from "@workspace/api-client-react";
import { Send, Shield, Loader2, Lock, MessageCircle, X, ArrowLeft, UserCheck, ChevronRight, Smile, Mic, MicOff, Phone, PhoneOff, PhoneCall, StopCircle, Download, Paperclip } from "lucide-react";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { formatFileSize } from "@/lib/fileFormatting";
import { reportClientError } from "@/lib/clientErrorReporter";
import { keepCurrentVoiceStream } from "./voiceResources";
import { socialText } from "@/lib/i18n/reorganizationSocial";
import { getAttachmentDraft, keepAttachmentDraft, clearAttachmentDraft, type AttachmentPayload } from "./attachmentDrafts";
import { ICE_SERVERS } from "./constants";
import { fmtDur, fileIcon } from "./format";
import { Avatar } from "./Avatar";
import { useMutualFollowers } from "./hooks";
import { LimenPageEmblem } from "@/components/ui/LimenPageEmblem";
import type { DecryptedMsg, SocialUser, CallSignal } from "./types";

export function MessaggiTab({
  currentUser,
  initialPeer,
  embedded = false,
  onBack,
  navigation,
}: {
  currentUser: { id: string };
  initialPeer?: SocialUser | null;
  embedded?: boolean;
  onBack?: () => void;
  navigation?: ReactNode;
}) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isDesktop = useIsDesktop();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const {
    keyPair,
    isReady: e2eeReady,
    error: e2eeError,
  } = useE2EEKeys(currentUser.id);
  const [selectedFriend, setSelectedFriend] = useState<SocialUser | null>(initialPeer ?? null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [messageInput, setMessageInput] = useState("");
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMsg[]>(
    [],
  );
  const [showEmojiDM, setShowEmojiDM] = useState(false);
  const [dmImgUploading, setDmImgUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);

  const mountedRef = useRef(true);
  const recordingEpochRef = useRef(0);
  const callEpochRef = useRef(0);
  const sendBusyRef = useRef(false);
  const uploadBusyRef = useRef(false);
  const conversationIdentity = JSON.stringify([currentUser.id, selectedFriend?.userId]);
  const activeConversationRef = useRef(conversationIdentity);
  activeConversationRef.current = conversationIdentity;
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentPayload | null>(() =>
    initialPeer?.userId ? getAttachmentDraft(currentUser.id, initialPeer.userId) : null);
  useEffect(() => {
    setPendingAttachment(selectedFriend?.userId ? getAttachmentDraft(currentUser.id, selectedFriend.userId) : null);
  }, [currentUser.id, selectedFriend?.userId]);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  // Un solo object URL per blob registrato: creato una volta e revocato al
  // cambio/unmount, invece di rigenerarlo (e perderlo) a ogni render.
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!recordedBlob) {
      setRecordedBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(recordedBlob);
    setRecordedBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedBlob]);

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
    query: { queryKey: getGetUnreadCountQueryKey(), refetchInterval: 45000 },
  });
  const { data: friendPublicKeyData, refetch: refetchFriendKey, isFetching: peerKeyFetching } = useGetPublicKey(
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
        refetchInterval: 30000,
      },
    },
  );
  // handleSendText/handleDmAttachment/sendVoiceMessage each already catch and
  // toast their own error via reportClientError — opt out of the global
  // mutation-error toast to avoid double-toasting a failed DM send.
  const sendMessageMutation = useSendChatMessage({ mutation: { meta: { suppressGlobalError: true } } });
  const canSendMessage = Boolean(selectedFriend?.userId && keyPair && friendPublicKeyData?.publicKeyJwk);

  // Decrypt messages
  useEffect(() => {
    if (
      !messagesData?.messages ||
      !keyPair ||
      !friendPublicKeyData?.publicKeyJwk
    )
      return;
    let current = true;
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
        if (current) setDecryptedMessages(decrypted);
      } catch (err) {
        reportClientError(err, { context: "DM decrypt", notify: false });
      }
    };
    decrypt();
    return () => { current = false; };
  }, [messagesData?.messages, keyPair, friendPublicKeyData?.publicKeyJwk]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (reduceMotion) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [decryptedMessages, reduceMotion]);

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
      if (sendBusyRef.current || !mountedRef.current || activeConversationRef.current !== conversationIdentity) return false;
      if (
        !selectedFriend?.userId ||
        !keyPair ||
        !friendPublicKeyData?.publicKeyJwk
      )
        throw new Error(socialText(language, "chatNotReady"));
      sendBusyRef.current = true;
      try {
        const sharedKey = await getSharedKey(keyPair.privateKey, friendPublicKeyData.publicKeyJwk as JsonWebKey);
        const { ciphertext, iv } = await encryptMessage(JSON.stringify(payload), sharedKey);
        if (!mountedRef.current || activeConversationRef.current !== conversationIdentity) return false;
        await sendMessageMutation.mutateAsync({ data: { receiverId: selectedFriend.userId, ciphertext, iv } });
        if (mountedRef.current && activeConversationRef.current === conversationIdentity) refetchMessages();
        return true;
      } finally { sendBusyRef.current = false; }
    },
    [
      selectedFriend,
      keyPair,
      friendPublicKeyData,
      sendMessageMutation,
      refetchMessages,
      language,
      conversationIdentity,
    ],
  );

  const handleSendText = useCallback(async () => {
    if (!messageInput.trim() || !canSendMessage) return;
    const submittedDraft = messageInput;
    try {
      if (await sendE2EE({ type: "text", content: submittedDraft.trim() }) && mountedRef.current && activeConversationRef.current === conversationIdentity) {
        setMessageInput(current => current === submittedDraft ? "" : current);
        setShowEmojiDM(false);
      }
    } catch (err) {
      if (mountedRef.current && activeConversationRef.current === conversationIdentity) reportClientError(err, {
        context: "DM send",
        fallbackMessage: "Invio messaggio non riuscito.",
        toast,
      });
    }
  }, [messageInput, canSendMessage, sendE2EE, toast, conversationIdentity]);

  const deliverAttachment = async (payload: AttachmentPayload) => {
    const peerId = selectedFriend?.userId;
    if (!peerId || !mountedRef.current || activeConversationRef.current !== conversationIdentity) return;
    if (await sendE2EE(payload)) {
      clearAttachmentDraft(currentUser.id, peerId, payload.url);
      if (mountedRef.current && activeConversationRef.current === conversationIdentity) setPendingAttachment(null);
    }
  };
  const retryAttachment = async () => {
    if (!pendingAttachment || uploadBusyRef.current || sendBusyRef.current || !canSendMessage) return;
    uploadBusyRef.current = true;
    setDmImgUploading(true);
    try { await deliverAttachment(pendingAttachment); }
    catch (error) { if (mountedRef.current && activeConversationRef.current === conversationIdentity) reportClientError(error, { context: "DM attachment retry", toast }); }
    finally { uploadBusyRef.current = false; if (mountedRef.current) setDmImgUploading(false); }
  };

  // Attachment DM
  const handleDmAttachment = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadBusyRef.current || sendBusyRef.current || pendingAttachment) return;
    if (!canSendMessage) {
      reportClientError(new Error(socialText(language, "chatNotReady")), { context: "DM attachment readiness", toast });
      return;
    }
    uploadBusyRef.current = true;
    setDmImgUploading(true);
    const peerId = selectedFriend!.userId!;
    try {
      const fd = new FormData();
      fd.append("file", file);
      // All DM attachments use participant access, including images.
      fd.append("toUserId", peerId);
      const res = await apiFetch("social/upload-file", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload fallito");
      const { fileUrl, fileName, mimeType, size } = await res.json();
      const payload: AttachmentPayload = {
        type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file",
        url: fileUrl, fileName, mimeType, size,
      };
      // Retain the original recipient even if navigation happened during upload.
      keepAttachmentDraft(currentUser.id, peerId, payload);
      if (!mountedRef.current || activeConversationRef.current !== conversationIdentity) return;
      setPendingAttachment(payload);
      await deliverAttachment(payload);
    } catch (err) {
      if (mountedRef.current && activeConversationRef.current === conversationIdentity) reportClientError(err, {
        context: "DM attachment upload",
        fallbackMessage: "Upload file non riuscito.",
        toast,
      });
    } finally {
      uploadBusyRef.current = false;
      if (mountedRef.current) setDmImgUploading(false);
      if (dmFileInputRef.current) dmFileInputRef.current.value = "";
    }
  };

  // Voice recording
  const startRecording = async () => {
    const epoch = ++recordingEpochRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!keepCurrentVoiceStream(stream, mountedRef.current && recordingEpochRef.current === epoch)) return;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => recordChunksRef.current.push(e.data);
      mr.onstop = () => {
        if (mountedRef.current && recordingEpochRef.current === epoch) setRecordedBlob(new Blob(recordChunksRef.current, { type: mimeType }));
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
      reportClientError(err, {
        context: "DM voice recording start",
        fallbackMessage: "Impossibile accedere al microfono.",
        toast,
      });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
  };
  const cancelRecording = () => {
    ++recordingEpochRef.current;
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
      // Recipient of the voice note — recorded server-side so only the two of us
      // can fetch it (GET /uploads/voice is gated on participation).
      fd.append("toUserId", selectedFriend?.userId ?? "");
      const res = await apiFetch("social/upload-voice", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { audioUrl } = await res.json();
      const sent = await sendE2EE({
        type: "voice",
        url: audioUrl,
        duration: recordDuration,
      });
      if (sent && mountedRef.current && activeConversationRef.current === conversationIdentity) { setRecordedBlob(null); setRecordDuration(0); }
    } catch (err) {
      reportClientError(err, {
        context: "DM voice send",
        fallbackMessage: "Invio messaggio vocale non riuscito.",
        toast,
      });
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
    ++callEpochRef.current;
    peerConnRef.current?.close();
    peerConnRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    if (!mountedRef.current) return;
    setCallState("idle");
    setCallId(null);
    setCallPeer(null);
    setIsMuted(false);
    setPendingOffer(null);
  }, []);

  // Teardown su unmount: lasciare la pagina a chiamata o registrazione attiva
  // non deve lasciare vivi microfono, RTCPeerConnection o timer.
  useEffect(() => {
    mountedRef.current = true;
    const recordingEpoch = recordingEpochRef;
    return () => {
      mountedRef.current = false;
      ++recordingEpoch.current;
      cleanupCall();
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {
            // recorder già fermo
          }
        }
        recorder.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
      }
      clearInterval(recordTimerRef.current);
    };
  }, [cleanupCall]);

  const startCall = async () => {
    if (!selectedFriend?.userId) return;
    const epoch = ++callEpochRef.current;
    const cid = newCallId();
    setCallId(cid);
    setCallPeer(selectedFriend);
    setCallState("calling");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!keepCurrentVoiceStream(stream, mountedRef.current && callEpochRef.current === epoch)) return;
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = async (e) => {
        if (e.candidate && mountedRef.current && callEpochRef.current === epoch)
          await sendSignal(
            selectedFriend.userId!,
            "ice",
            JSON.stringify(e.candidate),
            cid,
          );
      };
      pc.ontrack = (e) => {
        if (!mountedRef.current || callEpochRef.current !== epoch) return;
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
      if (!mountedRef.current || callEpochRef.current !== epoch) return;
      await sendSignal(
        selectedFriend.userId!,
        "offer",
        JSON.stringify({ sdp: offer.sdp, type: offer.type }),
        cid,
      );
    } catch (err) {
      if (!mountedRef.current || callEpochRef.current !== epoch) return;
      reportClientError(err, {
        context: "direct call start",
        fallbackMessage: "Impossibile avviare la chiamata.",
        toast,
      });
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!pendingOffer) return;
    const epoch = ++callEpochRef.current;
    const { sdp: rawSdp, callId: cid, from } = pendingOffer;
    const peer =
      messageContacts.find((u) => u.userId === from) ??
      ({ userId: from, name: "Trader", avatarUrl: null } as SocialUser);
    setCallId(cid);
    setCallPeer(peer);
    setCallState("connected");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!keepCurrentVoiceStream(stream, mountedRef.current && callEpochRef.current === epoch)) return;
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = async (e) => {
        if (e.candidate && mountedRef.current && callEpochRef.current === epoch)
          await sendSignal(from, "ice", JSON.stringify(e.candidate), cid);
      };
      pc.ontrack = (e) => {
        if (!mountedRef.current || callEpochRef.current !== epoch) return;
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
      if (!mountedRef.current || callEpochRef.current !== epoch) return;
      await sendSignal(
        from,
        "answer",
        JSON.stringify({ sdp: answer.sdp, type: answer.type }),
        cid,
      );
      setPendingOffer(null);
    } catch (err) {
      if (!mountedRef.current || callEpochRef.current !== epoch) return;
      reportClientError(err, {
        context: "direct call accept",
        fallbackMessage: "Impossibile rispondere alla chiamata.",
        toast,
      });
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

  // The workspace resolves the URL peer before mounting this session.
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
        {new Date(msg.createdAt).toLocaleTimeString(language, {
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
            aria-label={msg.fileName ?? uiText("auto.ui.b6e35988de")}
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
                {msg.fileName ?? uiText("auto.ui.e1d31d101d")}
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
            {callPeer?.name ?? uiText("auto.ui.2c16453638")}
          </p>
          <p className="text-white/60 text-sm mt-1">
            {callState === "calling"
              ? uiText("auto.ui.763d15b850")
              : callState === "incoming"
                ? uiText("auto.ui.ca90ebdac5")
                : uiText("auto.ui.ead33bc883")}
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

  const embeddedLayout = (area: ReactNode) => <div className="relative flex h-full min-h-0">
    {(isDesktop || !initialPeer) && navigation}
    {(isDesktop || initialPeer) && <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">{area}</div>}
    {!isDesktop && !initialPeer && callOverlay}
  </div>;

  if (e2eeError)
    return embedded ? embeddedLayout(<div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{uiText("auto.ui.6f9df8e4ac")}</div>) : (
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
    return embedded ? embeddedLayout(<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>) : (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">
            {uiText("auto.ui.d8059d85da")}
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
              <PhoneCall className="w-3.5 h-3.5" /> {uiText("auto.ui.ac7a6591d5")}
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
              {uiText("auto.ui.ef32130649")}
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
                    <UserCheck className="w-3 h-3" /> {u.isMutual ? "Mutual" : uiText("auto.ui.b2ae4f16d1")}
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
          <div className="p-3.5 border-b border-[#C5A059]/20 flex items-center gap-3 shrink-0 bg-[#0A0B10]">
            <button
              type="button"
              aria-label={uiText("common.back")}
              onClick={() => {
                if (onBack) { onBack(); return; }
                setSelectedFriend(null);
                setMobileView("list");
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/5 text-slate-400 lg:hidden"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="relative shrink-0">
              <Avatar
                name={selectedFriend.name}
                avatarUrl={selectedFriend.avatarUrl}
                size="md"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#10B981] border border-[#0A0B10]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm truncate text-white">
                {selectedFriend.name}
              </p>
              <p className="font-mono text-[11px] text-[#E8C56A] flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-[#C5A059]" /> {uiText("chat.encrypted_badge")}
              </p>
            </div>
            {callState === "idle" && (
              <button
                type="button"
                aria-label={uiText("chat.voice_call")}
                onClick={startCall}
                title={uiText("auto.ui.99608682c6")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] hover:bg-[#C5A059]/20 hover:border-[#C5A059]/60 transition-all"
              >
                <Phone className="w-4 h-4" />
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

          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
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
                      {uiText("auto.ui.f1f16a5abb")}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={uiText("common.cancel")}
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
                    aria-label={uiText("auto.ui.fe60a4fba4")}
                    controls
                    src={recordedBlobUrl ?? undefined}
                    className="min-w-0 flex-1 h-8"
                  />
                  <button
                    type="button"
                    aria-label={uiText("common.cancel")}
                    onClick={cancelRecording}
                    className="p-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={uiText("chat.send")}
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
            {pendingAttachment && !dmImgUploading && (
              <div role="status" className="mb-2 rounded-lg border border-border p-3 text-xs">
                <p>{socialText(language, "attachmentPending")}</p>
                <p className="my-1 break-all">{pendingAttachment.fileName}</p>
                <button type="button" disabled={!canSendMessage || sendMessageMutation.isPending} onClick={() => void retryAttachment()} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-50">{socialText(language, "retry")}</button>
              </div>
            )}
            {!canSendMessage && (
              <div role="status" className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>{socialText(language, "chatNotReady")}</p>
                <button type="button" disabled={peerKeyFetching} onClick={() => void refetchFriendKey()} className="min-h-11 shrink-0 rounded-lg border border-border px-3 disabled:opacity-50">
                  {socialText(language, "retry")}
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={uiText("auto.ui.5090a9e78c")}
                aria-expanded={showEmojiDM}
                onClick={() => setShowEmojiDM((s) => !s)}
                title={uiText("auto.ui.5090a9e78c")}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${showEmojiDM ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label={uiText("auto.ui.2b269b1b68")}
                onClick={() => dmFileInputRef.current?.click()}
                disabled={dmImgUploading || !canSendMessage || !!pendingAttachment || sendMessageMutation.isPending}
                title={uiText("auto.ui.2b269b1b68")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
              >
                {dmImgUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                aria-label={isRecording ? uiText("auto.ui.bce10aee8e") : uiText("auto.ui.38fbbb0c51")}
                aria-pressed={isRecording}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!!recordedBlob}
                title={isRecording ? uiText("auto.ui.bce10aee8e") : uiText("auto.ui.38fbbb0c51")}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${isRecording ? "text-red-400 bg-red-500/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"} disabled:opacity-40`}
              >
                <Mic className="w-4 h-4" />
              </button>
              <input
                ref={msgInputRef}
                type="text"
                aria-label={uiText("chat.send_placeholder")}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSendText()
                }
                placeholder={uiText("auto.ui.3e714ce7ae")}
                className="min-h-10 min-w-0 flex-1 px-3 py-2 bg-[#12131A] border border-[#C5A059]/25 rounded-xl text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:border-[#C5A059] focus-visible:ring-1 focus-visible:ring-[#C5A059]/30 transition-all font-sans"
                disabled={isRecording || !!recordedBlob}
              />
              <button
                type="button"
                aria-label={uiText("chat.send")}
                onClick={handleSendText}
                disabled={
                  !messageInput.trim() ||
                  !canSendMessage ||
                  sendMessageMutation.isPending ||
                  isRecording ||
                  !!recordedBlob
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-bold rounded-xl hover:brightness-110 disabled:opacity-40 transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={dmFileInputRef}
              type="file"
              accept="*"
              disabled={!canSendMessage || dmImgUploading || !!pendingAttachment || sendMessageMutation.isPending}
              className="hidden"
              onChange={handleDmAttachment}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#090A0F] via-[#0B0C12] to-[#07080B] text-slate-200 select-none">
          <div className="max-w-md w-full flex flex-col items-center space-y-4">
            {/* Sigillo Architettonico LIMEN 2D */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 -m-3 rounded-2xl bg-[#C5A059]/10 blur-xl pointer-events-none" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-[#C5A059]/40 bg-gradient-to-b from-[#161822] to-[#0E1017] p-3 shadow-[0_0_25px_rgba(197,160,89,0.18)]">
                <LimenPageEmblem
                  variant="fratellanza"
                  size={54}
                  className="filter drop-shadow-[0_0_12px_rgba(212,175,55,0.6)]"
                />
              </div>
            </div>

            {/* Testata Solenne */}
            <div className="space-y-1.5">
              <h2 className="font-display text-2xl font-black uppercase tracking-wider text-[#F4F4F6]">
                L&apos;Agorà dell&apos;Ordine
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Piazza d&apos;armi protetta e cifrata end-to-end. Confronto operativo tra pari: zero rumore, solo metodo e verifica oggettiva.
              </p>
            </div>

            {/* Status Chips Standard LIMEN */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 font-mono text-[9px] uppercase font-bold tracking-wider">
              <span className="inline-flex items-center gap-1.5 rounded border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 text-[#10b981]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
                Presidio Attivo
              </span>
              <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/35 bg-[#C5A059]/10 px-2 py-0.5 text-[#E8C56A]">
                Cifratura E2EE
              </span>
            </div>

            {/* Micro Prompt Operativo */}
            <div className="w-full mt-2 rounded-lg border border-[#C5A059]/20 bg-[#10121A]/70 px-3.5 py-2.5 text-center text-xs font-mono text-slate-400">
              <span className="text-[#E8C56A] font-semibold">
                {socialText(language, "empty")}
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                {socialText(language, "emptyHint")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return embeddedLayout(chatArea);

  return (
    <div className="h-full min-h-0">
      {isDesktop ? <div className="grid grid-cols-[280px_1fr] h-full min-h-0">
        <div className="border-r border-border">{list}</div>
        <div className="relative min-h-0 overflow-hidden">{chatArea}</div>
      </div> : <div className="h-full min-h-0 relative overflow-hidden">
        {mobileView === "list" ? list : chatArea}
      </div>}
    </div>
  );
}
