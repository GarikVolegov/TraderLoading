import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Headphones,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Disc,
  CircleDot,
  Download,
  X,
  Maximize2,
  Minimize2,
  Radio,
  ExternalLink,
  CloudUpload,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Crosshair,
  Zap,
  Sparkles,
  FolderArchive,
  FileText,
} from "lucide-react";
import { apiJSON } from "@/lib/apiFetch";
import { getClientErrorMessage, reportClientError } from "@/lib/clientErrorReporter";
import { ICE_SERVERS } from "./constants";
import { useVoicePresence } from "./hooks";
import type { VoiceSignal, ChannelType } from "./types";
import { disposeVoiceResources, keepCurrentVoiceStream } from "./voiceResources";
import { useLanguage } from "@/contexts/LanguageContext";
import { socialText } from "@/lib/i18n/reorganizationSocial";

type ReactionType = "flame" | "shield" | "target" | "zap";

interface ChannelFileItem {
  id: number;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  userName: string;
  createdAt: string;
}

function VideoStreamTile({
  stream,
  muted = false,
  className = "",
  onVideoRef,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={(el) => {
        videoRef.current = el;
        if (onVideoRef) onVideoRef(el);
      }}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full object-cover rounded-xl ${className}`}
    />
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setPeerVideoTrack(pc: RTCPeerConnection, track: MediaStreamTrack | null): void {
  const videoTransceiver = pc.getTransceivers().find(
    (t) => t.sender.track?.kind === "video" || t.receiver.track?.kind === "video"
  );
  if (videoTransceiver) {
    void videoTransceiver.sender.replaceTrack(track);
    return;
  }
  const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (videoSender) {
    void videoSender.replaceTrack(track);
  }
}

export function VoiceChannelView({
  channel,
  currentUserId,
  currentUserName: _currentUserName,
}: {
  channel: ChannelType;
  currentUserId: string;
  currentUserName: string;
}) {
  const { language } = useLanguage();
  const [inChannel, setInChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [isUploadingArchive, setIsUploadingArchive] = useState(false);
  const [archiveUploaded, setArchiveUploaded] = useState(false);
  const [activeStagePeerId, setActiveStagePeerId] = useState<string | null>(null);
  const [isStageFullScreen, setIsStageFullScreen] = useState(false);
  const [stageVideoEl, setStageVideoEl] = useState<HTMLVideoElement | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reazioni live
  const [reactions, setReactions] = useState<Record<string, { type: ReactionType; id: string }>>({});
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);

  // Atti e File del Canale
  const [showFilesDrawer, setShowFilesDrawer] = useState(false);
  const [channelFiles, setChannelFiles] = useState<ChannelFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const { data: participants = [], refetch: refreshPresence } = useVoicePresence(channel.id, true);

  const streamRef = useRef<MediaStream | null>(null);
  const localVideoStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});

  const [remoteMediaStates, setRemoteMediaStates] = useState<Record<string, { isVideo: boolean; isScreen: boolean }>>({});
  const remoteMediaStatesRef = useRef<Record<string, { isVideo: boolean; isScreen: boolean }>>({});

  const peerConnsRef = useRef<Record<string, RTCPeerConnection>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const activeRef = useRef(false);
  const joinEpochRef = useRef(0);
  const pendingIceRef = useRef<Record<string, (RTCIceCandidateInit & { voiceSession?: string })[]>>({});
  const negotiationRef = useRef<Record<string, string>>({});
  const peerEpochRef = useRef<Record<string, string | undefined>>({});

  const broadcastMediaState = useCallback(async (video: boolean, screen: boolean) => {
    if (!activeRef.current) return;
    const others = participants.filter((p) => p.userId !== currentUserId);
    for (const p of others) {
      try {
        await apiJSON(`community/voice/${channel.id}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: p.userId,
            type: "media-state",
            data: JSON.stringify({ isVideo: video, isScreen: screen }),
          }),
        });
      } catch {
        /* ignore individual send transient error */
      }
    }
  }, [channel.id, currentUserId, participants]);

  const triggerReaction = async (type: ReactionType) => {
    const reactionId = crypto.randomUUID();
    setReactions((prev) => ({ ...prev, [currentUserId]: { type, id: reactionId } }));
    setShowReactionsMenu(false);

    setTimeout(() => {
      setReactions((prev) => {
        if (prev[currentUserId]?.id === reactionId) {
          const next = { ...prev };
          delete next[currentUserId];
          return next;
        }
        return prev;
      });
    }, 3500);

    if (!activeRef.current) return;
    const others = participants.filter((p) => p.userId !== currentUserId);
    for (const p of others) {
      try {
        await apiJSON(`community/voice/${channel.id}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: p.userId,
            type: "reaction",
            data: JSON.stringify({ type, from: currentUserId }),
          }),
        });
      } catch {
        /* ignore */
      }
    }
  };

  const loadChannelFiles = async () => {
    setLoadingFiles(true);
    try {
      const files = await apiJSON<ChannelFileItem[]>(`community/channels/${channel.id}/files`);
      setChannelFiles(files || []);
    } catch (err) {
      reportClientError(err, { context: "load community voice files", notify: false });
    } finally {
      setLoadingFiles(false);
    }
  };

  const toggleFilesDrawer = () => {
    if (!showFilesDrawer) {
      void loadChannelFiles();
    }
    setShowFilesDrawer(!showFilesDrawer);
  };

  const createPeer = useCallback(
    (peerId: string, isInitiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnsRef.current[peerId] = pc;
      if (isInitiator) negotiationRef.current[peerId] = crypto.randomUUID();

      const audioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
      const videoTransceiver = pc.addTransceiver("video", { direction: "sendrecv" });

      if (streamRef.current) {
        const audioTrack = streamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          void audioTransceiver.sender.replaceTrack(audioTrack);
        }
      }

      const activeVideoTrack =
        screenStreamRef.current?.getVideoTracks()[0] ||
        localVideoStreamRef.current?.getVideoTracks()[0];
      if (activeVideoTrack) {
        void videoTransceiver.sender.replaceTrack(activeVideoTrack);
      }

      pc.onicecandidate = async (e) => {
        if (e.candidate && activeRef.current) {
          try {
            await apiJSON(`community/voice/${channel.id}/signal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: peerId,
                type: "ice",
                data: JSON.stringify({ ...e.candidate.toJSON(), voiceSession: negotiationRef.current[peerId] }),
              }),
            });
          } catch (error) {
            reportClientError(error, { context: "community voice ICE send", notify: false });
            if (activeRef.current && peerConnsRef.current[peerId] === pc) {
              setErrorMessage(getClientErrorMessage(error));
            }
          }
        }
      };

      pc.ontrack = (e) => {
        if (!activeRef.current) return;
        if (e.track.kind === "audio") {
          let audio = audioRefs.current[peerId];
          if (!audio) {
            audio = new Audio();
            audioRefs.current[peerId] = audio;
            audio.autoplay = true;
          }
          audio.srcObject = e.streams[0] || new MediaStream([e.track]);
        } else if (e.track.kind === "video") {
          const vStream = e.streams[0] || new MediaStream([e.track]);
          remoteStreamsRef.current[peerId] = vStream;
          setRemoteStreams((prev) => ({ ...prev, [peerId]: vStream }));

          e.track.onended = () => {
            if (remoteStreamsRef.current[peerId] === vStream) {
              delete remoteStreamsRef.current[peerId];
              setRemoteStreams((prev) => {
                const next = { ...prev };
                delete next[peerId];
                return next;
              });
            }
          };
        }
      };

      if (isInitiator) {
        pc.createOffer()
          .then(async (offer) => {
            if (!activeRef.current || peerConnsRef.current[peerId] !== pc) return;
            await pc.setLocalDescription(offer);
            if (!activeRef.current || peerConnsRef.current[peerId] !== pc) return;
            await apiJSON(`community/voice/${channel.id}/signal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: peerId,
                type: "offer",
                data: JSON.stringify({ ...offer, voiceSession: negotiationRef.current[peerId] }),
              }),
            });
          })
          .catch((error) => {
            reportClientError(error, { context: "community voice offer", notify: false });
            if (activeRef.current && peerConnsRef.current[peerId] === pc) {
              setErrorMessage(getClientErrorMessage(error));
            }
          });
      }
      return pc;
    },
    [channel.id],
  );

  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    setActiveStagePeerId((curr) => (curr === currentUserId ? null : curr));

    const fallbackVideoTrack =
      isVideoEnabled && localVideoStreamRef.current
        ? localVideoStreamRef.current.getVideoTracks()[0]
        : null;

    for (const pc of Object.values(peerConnsRef.current)) {
      setPeerVideoTrack(pc, fallbackVideoTrack);
    }
    await broadcastMediaState(isVideoEnabled, false);
  }, [broadcastMediaState, currentUserId, isVideoEnabled]);

  const toggleCamera = async () => {
    if (isVideoEnabled) {
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
        localVideoStreamRef.current = null;
      }
      setIsVideoEnabled(false);
      if (!isScreenSharing) {
        for (const pc of Object.values(peerConnsRef.current)) {
          setPeerVideoTrack(pc, null);
        }
      }
      await broadcastMediaState(false, isScreenSharing);
    } else {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        localVideoStreamRef.current = vStream;
        setIsVideoEnabled(true);
        if (!isScreenSharing) {
          const videoTrack = vStream.getVideoTracks()[0];
          for (const pc of Object.values(peerConnsRef.current)) {
            if (videoTrack) setPeerVideoTrack(pc, videoTrack);
          }
        }
        await broadcastMediaState(true, isScreenSharing);
      } catch (err) {
        reportClientError(err, { context: "camera toggle", notify: false });
        setErrorMessage("Permesso videocamera negato o dispositivo non disponibile");
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = sStream;
        setIsScreenSharing(true);
        setActiveStagePeerId(currentUserId);

        const screenTrack = sStream.getVideoTracks()[0];
        if (screenTrack) {
          screenTrack.onended = () => {
            void stopScreenShare();
          };
          for (const pc of Object.values(peerConnsRef.current)) {
            setPeerVideoTrack(pc, screenTrack);
          }
        }
        await broadcastMediaState(isVideoEnabled, true);
      } catch (err) {
        reportClientError(err, { context: "screen share toggle", notify: false });
        const isCancel = (err as Error)?.name === "NotAllowedError";
        if (!isCancel) {
          setErrorMessage("Impossibile avviare la condivisione dello schermo");
        }
      }
    }
  };

  const startRecording = async () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
      const dest = audioContext.createMediaStreamDestination();

      if (streamRef.current && streamRef.current.getAudioTracks().length > 0) {
        try {
          const localSource = audioContext.createMediaStreamSource(streamRef.current);
          localSource.connect(dest);
        } catch (err) {
          console.warn("Could not attach local mic to recording:", err);
        }
      }

      for (const audioEl of Object.values(audioRefs.current)) {
        if (audioEl && audioEl.srcObject instanceof MediaStream) {
          try {
            const peerSource = audioContext.createMediaStreamSource(audioEl.srcObject);
            peerSource.connect(dest);
          } catch {
            /* ignore individual peer audio source error */
          }
        }
      }

      let videoTrack: MediaStreamTrack | null = null;
      if (screenStreamRef.current?.getVideoTracks()[0]?.readyState === "live") {
        videoTrack = screenStreamRef.current.getVideoTracks()[0];
      } else if (localVideoStreamRef.current?.getVideoTracks()[0]?.readyState === "live") {
        videoTrack = localVideoStreamRef.current.getVideoTracks()[0];
      } else if (activeStagePeerId && remoteStreams[activeStagePeerId]?.getVideoTracks()[0]?.readyState === "live") {
        videoTrack = remoteStreams[activeStagePeerId].getVideoTracks()[0];
      } else {
        for (const st of Object.values(remoteStreams)) {
          if (st.getVideoTracks()[0]?.readyState === "live") {
            videoTrack = st.getVideoTracks()[0];
            break;
          }
        }
      }

      const tracksToRecord: MediaStreamTrack[] = [...dest.stream.getAudioTracks()];
      if (videoTrack) {
        tracksToRecord.push(videoTrack);
      }

      const recordStream = new MediaStream(tracksToRecord);

      let mimeType = "video/webm;codecs=vp9,opus";
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = MediaRecorder.isTypeSupported("video/webm")
            ? "video/webm"
            : MediaRecorder.isTypeSupported("video/mp4")
            ? "video/mp4"
            : "";
        }
      }

      recordedChunksRef.current = [];
      const recorder = mimeType ? new MediaRecorder(recordStream, { mimeType }) : new MediaRecorder(recordStream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || "video/webm" });
        recordedBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
        setShowRecordingModal(true);
        setArchiveUploaded(false);
        setIsRecording(false);
        setRecordingDuration(0);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      reportClientError(err, { context: "start community voice recording", notify: false });
      setErrorMessage("Impossibile avviare la registrazione del concilio");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {
        /* ignore */
      }
      audioContextRef.current = null;
    }
  };

  const uploadRecordingToChannel = async () => {
    if (!recordedBlobRef.current) return;
    setIsUploadingArchive(true);
    try {
      const fileName = `concilio-${channel.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${new Date()
        .toISOString()
        .slice(0, 10)}.webm`;
      const file = new File([recordedBlobRef.current], fileName, { type: "video/webm" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("downloadable", "true");

      const res = await fetch(`/api/community/channels/${channel.id}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Caricamento fallito");
      setArchiveUploaded(true);
      void loadChannelFiles();
    } catch (err) {
      reportClientError(err, { context: "upload recording to community channel", notify: false });
      setErrorMessage("Impossibile archiviare la registrazione nel canale");
    } finally {
      setIsUploadingArchive(false);
    }
  };

  const handleTogglePip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (stageVideoEl && document.pictureInPictureEnabled) {
        await stageVideoEl.requestPictureInPicture();
      }
    } catch (err) {
      reportClientError(err, { context: "voice stage pip", notify: false });
    }
  };

  const joinChannel = async () => {
    const epoch = ++joinEpochRef.current;
    setErrorMessage(null);
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!keepCurrentVoiceStream(stream, mountedRef.current && joinEpochRef.current === epoch)) return;
      streamRef.current = stream;
      await apiJSON(`community/voice/${channel.id}/join`, { method: "POST" });
      await refreshPresence({ throwOnError: true });
      if (!mountedRef.current || joinEpochRef.current !== epoch) {
        stream.getTracks().forEach((track) => track.stop());
        await apiJSON(`community/voice/${channel.id}/leave`, { method: "DELETE" });
        return;
      }
      activeRef.current = true;
      setInChannel(true);

      // Acoustic Speech Activity Detector
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const localAudioCtx = new AudioCtx();
        const analyser = localAudioCtx.createAnalyser();
        analyser.fftSize = 256;
        const source = localAudioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const checkVolume = () => {
          if (!activeRef.current) {
            void localAudioCtx.close();
            return;
          }
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          setIsSpeaking(avg > 14);
          requestAnimationFrame(checkVolume);
        };
        requestAnimationFrame(checkVolume);
      } catch {
        /* ignore audio telemetry error */
      }

      pingIntervalRef.current = setInterval(async () => {
        try {
          await apiJSON(`community/voice/${channel.id}/ping`, {
            method: "POST",
          });
        } catch (error) {
          if (!activeRef.current || joinEpochRef.current !== epoch) return;
          setErrorMessage(getClientErrorMessage(error));
          reportClientError(error, { context: "community voice keepalive", notify: false });
          if ([401, 402, 403, 404].includes((error as { status?: number }).status ?? 0)) void leaveChannel();
        }
      }, 8_000);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const { signals } = await apiJSON<{ signals: VoiceSignal[] }>(
            `community/voice/${channel.id}/signals`,
          );
          if (!activeRef.current || joinEpochRef.current !== epoch) return;
          for (const sig of signals ?? []) {
            if (!activeRef.current || joinEpochRef.current !== epoch) return;
            let pc: RTCPeerConnection | undefined = peerConnsRef.current[sig.from];

            if (sig.type === "reaction") {
              try {
                const meta = JSON.parse(sig.data) as { type: ReactionType; from?: string };
                const senderId = meta.from || sig.from;
                const reactionId = crypto.randomUUID();
                setReactions((prev) => ({ ...prev, [senderId]: { type: meta.type, id: reactionId } }));
                setTimeout(() => {
                  setReactions((prev) => {
                    if (prev[senderId]?.id === reactionId) {
                      const next = { ...prev };
                      delete next[senderId];
                      return next;
                    }
                    return prev;
                  });
                }, 3500);
              } catch {
                /* ignore */
              }
              continue;
            }

            if (sig.type === "media-state") {
              try {
                const meta = JSON.parse(sig.data) as { isVideo?: boolean; isScreen?: boolean };
                const state = { isVideo: !!meta.isVideo, isScreen: !!meta.isScreen };
                remoteMediaStatesRef.current[sig.from] = state;
                setRemoteMediaStates((prev) => ({ ...prev, [sig.from]: state }));
                if (state.isScreen) {
                  setActiveStagePeerId(sig.from);
                } else {
                  setActiveStagePeerId((curr) => (curr === sig.from ? null : curr));
                }
              } catch {
                /* ignore */
              }
              continue;
            }

            if (sig.type === "offer") {
              if (currentUserId < sig.from) continue;
              const offer = JSON.parse(sig.data) as RTCSessionDescriptionInit & { voiceSession?: string };
              if (
                pc &&
                offer.voiceSession &&
                negotiationRef.current[sig.from] &&
                offer.voiceSession !== negotiationRef.current[sig.from]
              ) {
                pc.close();
                const audio = audioRefs.current[sig.from];
                if (audio) {
                  audio.pause();
                  audio.srcObject = null;
                }
                delete audioRefs.current[sig.from];
                delete peerConnsRef.current[sig.from];
                pc = undefined;
              }
              if (!pc) pc = createPeer(sig.from, false);
              if (typeof offer.voiceSession === "string") negotiationRef.current[sig.from] = offer.voiceSession;
              await pc.setRemoteDescription(new RTCSessionDescription(offer));
              for (const candidate of pendingIceRef.current[sig.from] ?? []) {
                if (!candidate.voiceSession || candidate.voiceSession === negotiationRef.current[sig.from]) {
                  await pc.addIceCandidate(candidate);
                }
              }
              delete pendingIceRef.current[sig.from];
              const answer = await pc.createAnswer();
              if (!activeRef.current || joinEpochRef.current !== epoch) return;
              await pc.setLocalDescription(answer);
              await apiJSON(`community/voice/${channel.id}/signal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: sig.from,
                  type: "answer",
                  data: JSON.stringify({ ...answer, voiceSession: negotiationRef.current[sig.from] }),
                }),
              });
            } else if (sig.type === "answer" && pc) {
              const answer = JSON.parse(sig.data) as RTCSessionDescriptionInit & { voiceSession?: string };
              if (
                pc.signalingState !== "have-local-offer" ||
                (answer.voiceSession && answer.voiceSession !== negotiationRef.current[sig.from])
              )
                continue;
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              for (const candidate of pendingIceRef.current[sig.from] ?? []) {
                if (!candidate.voiceSession || candidate.voiceSession === negotiationRef.current[sig.from]) {
                  await pc.addIceCandidate(candidate);
                }
              }
              delete pendingIceRef.current[sig.from];
            } else if (sig.type === "ice") {
              try {
                const candidate = JSON.parse(sig.data) as RTCIceCandidateInit & { voiceSession?: string };
                if (pc?.remoteDescription) {
                  if (!candidate.voiceSession || candidate.voiceSession === negotiationRef.current[sig.from]) {
                    await pc.addIceCandidate(candidate);
                  } else {
                    pendingIceRef.current[sig.from] = [
                      ...(pendingIceRef.current[sig.from] ?? []),
                      candidate,
                    ].slice(-64);
                  }
                } else {
                  pendingIceRef.current[sig.from] = [
                    ...(pendingIceRef.current[sig.from] ?? []),
                    candidate,
                  ].slice(-64);
                }
              } catch (error) {
                reportClientError(error, {
                  context: "community voice ICE candidate",
                  notify: false,
                });
              }
            }
          }
        } catch (error) {
          if (!activeRef.current || joinEpochRef.current !== epoch) return;
          setErrorMessage(getClientErrorMessage(error));
          reportClientError(error, {
            context: "community voice signal polling",
            notify: false,
          });
          if ([401, 402, 403, 404].includes((error as { status?: number }).status ?? 0)) void leaveChannel();
        }
      }, 2_000);
    } catch (err) {
      disposeVoiceResources({
        stream: streamRef.current,
        peers: peerConnsRef.current,
        audio: audioRefs.current,
        videoStream: localVideoStreamRef.current,
        screenStream: screenStreamRef.current,
        recorder: mediaRecorderRef.current,
      });
      streamRef.current = null;
      if (mountedRef.current && joinEpochRef.current === epoch) setErrorMessage(getClientErrorMessage(err));
      reportClientError(err, { context: "community voice join", notify: false });
    } finally {
      if (mountedRef.current && joinEpochRef.current === epoch) setConnecting(false);
    }
  };

  const leaveChannel = useCallback(async () => {
    ++joinEpochRef.current;
    const wasActive = activeRef.current;
    activeRef.current = false;
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pingIntervalRef.current = null;
    pollIntervalRef.current = null;

    stopRecording();

    disposeVoiceResources({
      stream: streamRef.current,
      peers: peerConnsRef.current,
      audio: audioRefs.current,
      videoStream: localVideoStreamRef.current,
      screenStream: screenStreamRef.current,
      recorder: mediaRecorderRef.current,
    });

    peerConnsRef.current = {};
    audioRefs.current = {};
    streamRef.current = null;
    localVideoStreamRef.current = null;
    screenStreamRef.current = null;
    remoteStreamsRef.current = {};
    remoteMediaStatesRef.current = {};
    pendingIceRef.current = {};
    negotiationRef.current = {};
    peerEpochRef.current = {};

    if (mountedRef.current) {
      setInChannel(false);
      setIsMuted(false);
      setIsSpeaking(false);
      setIsVideoEnabled(false);
      setIsScreenSharing(false);
      setIsRecording(false);
      setRecordingDuration(0);
      setConnecting(false);
      setRemoteStreams({});
      setRemoteMediaStates({});
      setActiveStagePeerId(null);
      setReactions({});
      setShowReactionsMenu(false);
      setShowFilesDrawer(false);
    }

    try {
      if (wasActive) {
        await apiJSON(`community/voice/${channel.id}/leave`, {
          method: "DELETE",
          keepalive: true,
        });
      }
    } catch (error) {
      if (mountedRef.current) setErrorMessage(getClientErrorMessage(error));
      reportClientError(error, {
        context: "community voice leave",
        notify: false,
      });
    }
  }, [channel.id]);

  useEffect(() => {
    if (!inChannel) return;
    const prevParticipants = participants.filter((p) => p.userId !== currentUserId);
    const present = new Set(prevParticipants.map((p) => p.userId));
    for (const [peerId, pc] of Object.entries(peerConnsRef.current)) {
      if (present.has(peerId)) continue;
      pc.close();
      const audio = audioRefs.current[peerId];
      if (audio) {
        audio.pause();
        audio.srcObject = null;
      }
      delete peerConnsRef.current[peerId];
      delete audioRefs.current[peerId];
      delete pendingIceRef.current[peerId];
      delete negotiationRef.current[peerId];
      delete peerEpochRef.current[peerId];
      delete remoteStreamsRef.current[peerId];
      delete remoteMediaStatesRef.current[peerId];
    }
    prevParticipants.forEach((p) => {
      const pc = peerConnsRef.current[p.userId];
      if (
        pc &&
        peerEpochRef.current[p.userId] &&
        p.joinedAt &&
        peerEpochRef.current[p.userId] !== p.joinedAt
      ) {
        pc.close();
        const audio = audioRefs.current[p.userId];
        if (audio) {
          audio.pause();
          audio.srcObject = null;
        }
        delete peerConnsRef.current[p.userId];
        delete audioRefs.current[p.userId];
        delete negotiationRef.current[p.userId];
        delete remoteStreamsRef.current[p.userId];
        delete remoteMediaStatesRef.current[p.userId];
      }
      peerEpochRef.current[p.userId] = p.joinedAt;
      if (!peerConnsRef.current[p.userId]) createPeer(p.userId, currentUserId < p.userId);
    });
  }, [participants, inChannel, currentUserId, createPeer]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; void leaveChannel(); };
  }, [leaveChannel]);

  const toggleMute = () => {
    if (!streamRef.current) return;
    const enabled = isMuted;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
    setIsMuted(!enabled);
  };

  const activeStageStream =
    activeStagePeerId === currentUserId
      ? screenStreamRef.current || localVideoStreamRef.current
      : activeStagePeerId
      ? remoteStreams[activeStagePeerId] ?? null
      : null;

  const activeStageParticipant = participants.find((p) => p.userId === activeStagePeerId);

  return (
    <div className="flex flex-col h-full bg-[#07080B] text-slate-200">
      {/* Testata della Sala Vocale */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#C5A059]/20 shrink-0 bg-[#0A0B10]">
        <Volume2 className="w-4 h-4 text-[#C5A059]" />
        <span className="font-mono text-sm font-bold text-white tracking-wide">{channel.name}</span>

        {isRecording && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 font-mono text-[11px] font-bold animate-pulse">
            <Radio className="w-3 h-3 text-red-500" />
            <span className="whitespace-nowrap">REC {formatDuration(recordingDuration)}</span>
          </div>
        )}

        {/* Pulsante Atti del Concilio (File/Registrazioni) */}
        <button
          onClick={toggleFilesDrawer}
          title="Atti e Documenti del Concilio"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-[11px] border transition-all ${
            showFilesDrawer
              ? "bg-[#C5A059]/20 border-[#E8C56A] text-[#E8C56A]"
              : "bg-[#12131A] border-[#C5A059]/25 hover:border-[#C5A059]/50 text-slate-300"
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5 text-[#E8C56A]" />
          <span className="whitespace-nowrap hidden sm:inline">Atti del Concilio</span>
        </button>

        {participants.length > 0 && (
          <span className="ml-auto font-mono text-[11px] text-[#E8C56A] bg-[#C5A059]/10 border border-[#C5A059]/30 px-2.5 py-0.5 rounded-full whitespace-nowrap">
            {participants.length} {participants.length === 1 ? "Operatore" : "Operatori"}
          </span>
        )}
      </div>

      {/* Corpo Principale con Area Palco e Cassetto File */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Contenuto Video/Audio */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 gap-3">
          {errorMessage && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive shrink-0"
            >
              {errorMessage}
            </p>
          )}

          {!inChannel ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[260px] gap-6 py-6">
              <div className="w-28 h-28 rounded-full flex items-center justify-center transition-all bg-[#12131A] border-2 border-[#C5A059]/30 shadow-[0_0_20px_rgba(197,160,89,0.1)]">
                <Headphones className="w-12 h-12 text-slate-500" />
              </div>

              <div className="text-center space-y-3 max-w-md">
                <p className="font-display text-lg font-bold text-white tracking-wide">{channel.name}</p>
                <p className="text-xs text-slate-400 font-sans">
                  {participants.length === 0
                    ? "Nessun iniziato connesso. Varca la soglia per avviare il concilio vocale."
                    : `${participants.length} iniziati presenti nel concilio della fratellanza.`}
                </p>
                <button
                  onClick={joinChannel}
                  disabled={connecting}
                  className="flex items-center gap-2 mx-auto px-6 py-2.5 bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black rounded-xl font-mono text-xs font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-60 transition-all shadow-md shadow-[#C5A059]/20"
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-black" />
                  )}
                  <span className="whitespace-nowrap">
                    {connecting ? "Sintonizzazione..." : "Entra nel Concilio Vocale"}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 gap-3">
              {/* Visualizzatore Palco Principale (Stage Mode per Schermo o Video Focus) */}
              {activeStagePeerId && activeStageStream ? (
                <div
                  ref={stageContainerRef}
                  className={`relative flex-1 min-h-0 rounded-2xl bg-[#0D0F14] border border-[#C5A059]/30 overflow-hidden flex items-center justify-center ${
                    isStageFullScreen ? "fixed inset-0 z-50 rounded-none bg-black" : ""
                  }`}
                >
                  <VideoStreamTile
                    stream={activeStageStream}
                    muted={activeStagePeerId === currentUserId}
                    onVideoRef={(el) => setStageVideoEl(el)}
                    className="w-full h-full object-contain bg-black/90"
                  />

                  {/* Badge Presentatore e Controlli Stage */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-[#07080B]/85 backdrop-blur-md border border-[#C5A059]/40 px-3 py-1.5 rounded-xl">
                    <Monitor className="w-3.5 h-3.5 text-[#E8C56A]" />
                    <span className="font-mono text-xs text-white font-bold whitespace-nowrap">
                      {activeStagePeerId === currentUserId
                        ? "La Tua Proiezione"
                        : `Proiezione: ${activeStageParticipant?.userName ?? "Operatore"}`}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    {document.pictureInPictureEnabled && (
                      <button
                        onClick={handleTogglePip}
                        title="Picture-in-Picture"
                        className="p-2 rounded-xl bg-[#07080B]/85 hover:bg-[#1A1D27] text-slate-200 border border-[#C5A059]/30 transition-all"
                      >
                        <ExternalLink className="w-4 h-4 text-[#E8C56A]" />
                      </button>
                    )}
                    <button
                      onClick={() => setIsStageFullScreen(!isStageFullScreen)}
                      title={isStageFullScreen ? "Riduci Finestra" : "Schermo Intero"}
                      className="p-2 rounded-xl bg-[#07080B]/85 hover:bg-[#1A1D27] text-slate-200 border border-[#C5A059]/30 transition-all"
                    >
                      {isStageFullScreen ? (
                        <Minimize2 className="w-4 h-4 text-[#E8C56A]" />
                      ) : (
                        <Maximize2 className="w-4 h-4 text-[#E8C56A]" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveStagePeerId(null)}
                      title="Chiudi Palco"
                      className="p-2 rounded-xl bg-[#07080B]/85 hover:bg-red-500/20 text-slate-200 border border-[#C5A059]/30 transition-all"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Griglia Partecipanti (Bento Grid) */}
              <div
                className={`grid gap-3 overflow-y-auto ${
                  activeStagePeerId
                    ? "flex-shrink-0 h-28 grid-flow-col auto-cols-[140px] overflow-x-auto overflow-y-hidden"
                    : "flex-1 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-fr"
                }`}
              >
                {/* Card Utente Locale */}
                <div
                  onClick={() => {
                    if (isVideoEnabled || isScreenSharing) setActiveStagePeerId(currentUserId);
                  }}
                  className={`group relative rounded-xl border transition-all overflow-hidden flex flex-col items-center justify-center p-3 cursor-pointer ${
                    activeStagePeerId === currentUserId
                      ? "border-[#E8C56A] shadow-[0_0_15px_rgba(232,197,106,0.25)]"
                      : isSpeaking && !isMuted
                      ? "border-[#E8C56A] ring-2 ring-[#E8C56A]/50 bg-[#0D0F14] shadow-[0_0_15px_rgba(232,197,106,0.3)]"
                      : "border-[#C5A059]/25 hover:border-[#C5A059]/50 bg-[#0D0F14]"
                  }`}
                >
                  {/* Floating Live Reaction */}
                  {reactions[currentUserId] && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 animate-bounce">
                      <div className="p-3 rounded-full bg-[#07080B]/90 border border-[#C5A059] shadow-[0_0_25px_rgba(232,197,106,0.6)]">
                        {reactions[currentUserId].type === "flame" && (
                          <Flame className="w-8 h-8 text-amber-500 fill-amber-500" />
                        )}
                        {reactions[currentUserId].type === "shield" && (
                          <ShieldCheck className="w-8 h-8 text-emerald-400 fill-emerald-400" />
                        )}
                        {reactions[currentUserId].type === "target" && (
                          <Crosshair className="w-8 h-8 text-red-400" />
                        )}
                        {reactions[currentUserId].type === "zap" && (
                          <Zap className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                        )}
                      </div>
                    </div>
                  )}

                  {isVideoEnabled && localVideoStreamRef.current ? (
                    <VideoStreamTile
                      stream={localVideoStreamRef.current}
                      muted={true}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center font-mono text-lg font-bold transition-all ${
                        isSpeaking && !isMuted
                          ? "bg-[#C5A059]/30 border-2 border-[#E8C56A] text-white shadow-[0_0_15px_rgba(232,197,106,0.5)] scale-105"
                          : "bg-[#151722] border border-[#C5A059]/40 text-[#E8C56A]"
                      }`}
                    >
                      TU
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-[#07080B]/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-[#C5A059]/20">
                    <span className="font-mono text-xs text-white truncate">Tu (Iniziato)</span>
                    <div className="flex items-center gap-1">
                      {isScreenSharing && (
                        <span title="Stai condividendo lo schermo">
                          <Monitor className="w-3 h-3 text-[#E8C56A]" />
                        </span>
                      )}
                      {isMuted ? (
                        <MicOff className="w-3 h-3 text-red-400" />
                      ) : (
                        <Mic
                          className={`w-3 h-3 ${isSpeaking ? "text-[#E8C56A] animate-pulse" : "text-emerald-400"}`}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Partecipanti Remoti */}
                {participants
                  .filter((p) => p.userId !== currentUserId)
                  .map((p) => {
                    const remoteStream = remoteStreams[p.userId];
                    const remoteState = remoteMediaStates[p.userId];
                    const hasVideo = remoteState?.isVideo && remoteStream;
                    const hasScreen = remoteState?.isScreen;
                    const participantReaction = reactions[p.userId];

                    return (
                      <div
                        key={p.userId}
                        onClick={() => {
                          if (remoteStream || hasScreen) setActiveStagePeerId(p.userId);
                        }}
                        className={`group relative rounded-xl border transition-all overflow-hidden flex flex-col items-center justify-center p-3 cursor-pointer ${
                          activeStagePeerId === p.userId
                            ? "border-[#E8C56A] shadow-[0_0_15px_rgba(232,197,106,0.25)]"
                            : "border-[#C5A059]/20 hover:border-[#C5A059]/50 bg-[#0D0F14]"
                        }`}
                      >
                        {/* Floating Live Reaction */}
                        {participantReaction && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 animate-bounce">
                            <div className="p-3 rounded-full bg-[#07080B]/90 border border-[#C5A059] shadow-[0_0_25px_rgba(232,197,106,0.6)]">
                              {participantReaction.type === "flame" && (
                                <Flame className="w-8 h-8 text-amber-500 fill-amber-500" />
                              )}
                              {participantReaction.type === "shield" && (
                                <ShieldCheck className="w-8 h-8 text-emerald-400 fill-emerald-400" />
                              )}
                              {participantReaction.type === "target" && (
                                <Crosshair className="w-8 h-8 text-red-400" />
                              )}
                              {participantReaction.type === "zap" && (
                                <Zap className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                              )}
                            </div>
                          </div>
                        )}

                        {hasVideo ? (
                          <VideoStreamTile
                            stream={remoteStream}
                            muted={false}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 rounded-full bg-[#151722] border border-[#C5A059]/30 flex items-center justify-center text-slate-300 font-mono text-lg font-bold overflow-hidden">
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt={p.userName} className="w-full h-full object-cover" />
                              ) : (
                                p.userName[0]?.toUpperCase() ?? "O"
                              )}
                            </div>
                          </div>
                        )}

                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-[#07080B]/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-[#C5A059]/20">
                          <span className="font-mono text-xs text-white truncate">{p.userName}</span>
                          <div className="flex items-center gap-1.5">
                            {hasScreen && (
                              <span title="Condivisione Schermo attiva">
                                <Monitor className="w-3 h-3 text-[#E8C56A]" />
                              </span>
                            )}
                            <Headphones className="w-3 h-3 text-slate-400" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Cassetto Laterale Atti e File del Canale */}
        {showFilesDrawer && (
          <div className="w-80 border-l border-[#C5A059]/25 bg-[#0A0B10] flex flex-col shrink-0">
            <div className="flex items-center justify-between p-3 border-b border-[#C5A059]/20 bg-[#0D0F14]">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-[#E8C56A]" />
                <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  Atti del Concilio
                </h4>
              </div>
              <button
                onClick={() => setShowFilesDrawer(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingFiles ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400 font-mono text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-[#E8C56A]" />
                  <span>Caricamento atti...</span>
                </div>
              ) : channelFiles.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-mono text-xs text-slate-400 font-bold">Nessun atto archiviato</p>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Le registrazioni archiviate durante i concili compariranno in questo registro.
                  </p>
                </div>
              ) : (
                channelFiles.map((file) => {
                  const isVideo = file.fileUrl.endsWith(".webm") || file.fileUrl.endsWith(".mp4");
                  return (
                    <div
                      key={file.id}
                      className="p-2.5 rounded-xl border border-[#C5A059]/20 bg-[#0D0F14] hover:border-[#C5A059]/40 transition-all flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isVideo ? (
                            <Disc className="w-4 h-4 text-[#E8C56A] shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="font-mono text-xs text-white truncate font-medium">
                            {file.fileName}
                          </span>
                        </div>
                        <a
                          href={file.fileUrl}
                          download={file.fileName}
                          title="Scarica Atto"
                          className="p-1 rounded-lg bg-[#151722] hover:bg-[#1F2230] text-[#E8C56A] transition-all shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>{file.userName}</span>
                        <span className="whitespace-nowrap">{formatFileSize(file.fileSize)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Barra dei Controlli Sovrana */}
      {inChannel && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-[#0A0B10] border-t border-[#C5A059]/20 shrink-0 relative">
          {/* Microfono */}
          <button
            onClick={toggleMute}
            aria-label={socialText(language, isMuted ? "voiceUnmute" : "voiceMute")}
            aria-pressed={isMuted}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${
              isMuted
                ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                : "bg-[#151722] border-[#C5A059]/30 text-white hover:border-[#C5A059] shadow-[0_0_10px_rgba(197,160,89,0.15)]"
            }`}
            title={isMuted ? "Attiva Microfono" : "Disattiva Microfono"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#E8C56A]" />}
          </button>

          {/* Videocamera */}
          <button
            onClick={toggleCamera}
            aria-pressed={isVideoEnabled}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${
              isVideoEnabled
                ? "bg-[#C5A059]/25 border-[#E8C56A] text-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.3)]"
                : "bg-[#151722] border-[#C5A059]/30 text-slate-400 hover:text-white hover:border-[#C5A059]"
            }`}
            title={isVideoEnabled ? "Disattiva Videocamera" : "Attiva Videocamera"}
          >
            {isVideoEnabled ? <Video className="w-5 h-5 text-[#E8C56A]" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Condivisione Schermo */}
          <button
            onClick={toggleScreenShare}
            aria-pressed={isScreenSharing}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${
              isScreenSharing
                ? "bg-[#10b981]/25 border-[#10b981] text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "bg-[#151722] border-[#C5A059]/30 text-slate-400 hover:text-white hover:border-[#C5A059]"
            }`}
            title={isScreenSharing ? "Interrompi Condivisione" : "Condividi Schermo"}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5 text-[#10b981]" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Reazioni del Concilio */}
          <div className="relative">
            {showReactionsMenu && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-[#0D0F14] border border-[#C5A059]/50 rounded-2xl shadow-2xl backdrop-blur-md z-30">
                <button
                  onClick={() => triggerReaction("flame")}
                  title="Fuoco / Convinzione"
                  className="p-2 rounded-xl hover:bg-[#1A1D27] text-amber-500 hover:scale-110 transition-all"
                >
                  <Flame className="w-5 h-5 fill-amber-500" />
                </button>
                <button
                  onClick={() => triggerReaction("shield")}
                  title="Disciplina / Scudo"
                  className="p-2 rounded-xl hover:bg-[#1A1D27] text-emerald-400 hover:scale-110 transition-all"
                >
                  <ShieldCheck className="w-5 h-5 fill-emerald-400" />
                </button>
                <button
                  onClick={() => triggerReaction("target")}
                  title="Precisione / Target"
                  className="p-2 rounded-xl hover:bg-[#1A1D27] text-red-400 hover:scale-110 transition-all"
                >
                  <Crosshair className="w-5 h-5" />
                </button>
                <button
                  onClick={() => triggerReaction("zap")}
                  title="Esecuzione / Rapidità"
                  className="p-2 rounded-xl hover:bg-[#1A1D27] text-yellow-400 hover:scale-110 transition-all"
                >
                  <Zap className="w-5 h-5 fill-yellow-400" />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowReactionsMenu(!showReactionsMenu)}
              aria-pressed={showReactionsMenu}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${
                showReactionsMenu
                  ? "bg-[#C5A059]/25 border-[#E8C56A] text-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.3)]"
                  : "bg-[#151722] border-[#C5A059]/30 text-slate-400 hover:text-white hover:border-[#C5A059]"
              }`}
              title="Reazioni del Concilio"
            >
              <Sparkles className="w-5 h-5 text-[#E8C56A]" />
            </button>
          </div>

          {/* Registrazione Sessione */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            aria-pressed={isRecording}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${
              isRecording
                ? "bg-red-500/25 border-red-500 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                : "bg-[#151722] border-[#C5A059]/30 text-slate-400 hover:text-white hover:border-[#C5A059]"
            }`}
            title={isRecording ? "Interrompi Registrazione" : "Registra Concilio"}
          >
            {isRecording ? <CircleDot className="w-5 h-5 text-red-500" /> : <Disc className="w-5 h-5" />}
          </button>

          {/* Abbandona Canale */}
          <button
            onClick={leaveChannel}
            aria-label={socialText(language, "voiceLeave")}
            className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white transition-all shadow-lg shadow-red-600/30 border border-red-400/50"
            title="Abbandona Concilio"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Modale Registrazione Terminata (Archivio del Concilio) */}
      {showRecordingModal && recordedBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl bg-[#0D0F14] border border-[#C5A059]/40 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-3">
              <div className="flex items-center gap-2">
                <Disc className="w-5 h-5 text-[#E8C56A]" />
                <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                  Archivio del Concilio Vocale
                </h3>
              </div>
              <button
                onClick={() => setShowRecordingModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-300 font-sans">
                La registrazione della sessione è stata finalizzata con successo. Puoi visualizzare l'anteprima,
                scaricare il filmato o archiviarlo direttamente negli atti del canale per la Fratellanza.
              </p>
              <div className="rounded-xl overflow-hidden border border-[#C5A059]/30 bg-black">
                <video src={recordedBlobUrl} controls className="w-full max-h-[300px] object-contain" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRecordingModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-500 font-mono text-xs text-slate-300"
              >
                Chiudi
              </button>

              {archiveUploaded ? (
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-mono text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="whitespace-nowrap font-bold">Atto Archiviato nel Canale</span>
                </div>
              ) : (
                <button
                  onClick={uploadRecordingToChannel}
                  disabled={isUploadingArchive}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151722] border border-[#C5A059]/40 hover:border-[#C5A059] text-white font-mono text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all shadow-md shadow-[#C5A059]/10"
                >
                  {isUploadingArchive ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E8C56A]" />
                  ) : (
                    <CloudUpload className="w-4 h-4 text-[#E8C56A]" />
                  )}
                  <span className="whitespace-nowrap">
                    {isUploadingArchive ? "Archiviazione..." : "Archivia nel Canale"}
                  </span>
                </button>
              )}

              <a
                href={recordedBlobUrl}
                download={`concilio-${channel.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${new Date()
                  .toISOString()
                  .slice(0, 10)}.webm`}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-mono text-xs font-bold uppercase hover:brightness-110 shadow-lg shadow-[#C5A059]/20 transition-all"
              >
                <Download className="w-4 h-4 text-black" />
                <span className="whitespace-nowrap">Scarica Registrazione</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
