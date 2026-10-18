import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Volume2, Headphones } from "lucide-react";
import { apiJSON } from "@/lib/apiFetch";
import { getClientErrorMessage, reportClientError } from "@/lib/clientErrorReporter";
import { ICE_SERVERS } from "./constants";
import { useVoicePresence } from "./hooks";
import type { VoiceSignal, ChannelType } from "./types";
import { disposeVoiceResources, keepCurrentVoiceStream } from "./voiceResources";
import { useLanguage } from "@/contexts/LanguageContext";
import { socialText } from "@/lib/i18n/reorganizationSocial";

export function VoiceChannelView({
  channel,
  currentUserId,
  currentUserName,
}: {
  channel: ChannelType;
  currentUserId: string;
  currentUserName: string;
}) {
  const { language } = useLanguage();
  const [inChannel, setInChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { data: participants = [], refetch: refreshPresence } = useVoicePresence(channel.id, true);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const mountedRef = useRef(true);
  const activeRef = useRef(false);
  const joinEpochRef = useRef(0);
  const pendingIceRef = useRef<Record<string, (RTCIceCandidateInit & { voiceSession?: string })[]>>({});
  const negotiationRef = useRef<Record<string, string>>({});
  const peerEpochRef = useRef<Record<string, string | undefined>>({});

  const createPeer = useCallback(
    (peerId: string, isInitiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnsRef.current[peerId] = pc;
      if (isInitiator) negotiationRef.current[peerId] = crypto.randomUUID();
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((t) => pc.addTrack(t, streamRef.current!));
      }
      pc.onicecandidate = async (e) => {
        if (e.candidate && activeRef.current) {
          try { await apiJSON(`community/voice/${channel.id}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: peerId,
              type: "ice",
              data: JSON.stringify({ ...e.candidate.toJSON(), voiceSession: negotiationRef.current[peerId] }),
            }),
          }); } catch (error) {
            reportClientError(error, { context: "community voice ICE send", notify: false });
            if (activeRef.current && peerConnsRef.current[peerId] === pc) setErrorMessage(getClientErrorMessage(error));
          }
        }
      };
      pc.ontrack = (e) => {
        if (!activeRef.current) return;
        let audio = audioRefs.current[peerId];
        if (!audio) {
          audio = new Audio();
          audioRefs.current[peerId] = audio;
          audio.autoplay = true;
        }
        audio.srcObject = e.streams[0];
      };
      if (isInitiator) {
        pc.createOffer().then(async (offer) => {
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
        }).catch(error => {
          reportClientError(error, { context: "community voice offer", notify: false });
          if (activeRef.current && peerConnsRef.current[peerId] === pc) setErrorMessage(getClientErrorMessage(error));
        });
      }
      return pc;
    },
    [channel.id],
  );

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
        stream.getTracks().forEach(track => track.stop());
        await apiJSON(`community/voice/${channel.id}/leave`, { method: "DELETE" });
        return;
      }
      activeRef.current = true;
      setInChannel(true);
      pingIntervalRef.current = setInterval(async () => {
        try { await apiJSON(`community/voice/${channel.id}/ping`, {
          method: "POST",
        }); } catch (error) {
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
            if (sig.type === "offer") {
              if (currentUserId < sig.from) continue;
              const offer = JSON.parse(sig.data) as RTCSessionDescriptionInit & { voiceSession?: string };
              if (pc && offer.voiceSession && negotiationRef.current[sig.from] && offer.voiceSession !== negotiationRef.current[sig.from]) {
                pc.close();
                const audio = audioRefs.current[sig.from];
                if (audio) { audio.pause(); audio.srcObject = null; }
                delete audioRefs.current[sig.from];
                delete peerConnsRef.current[sig.from];
                pc = undefined;
              }
              if (!pc) pc = createPeer(sig.from, false);
              if (typeof offer.voiceSession === "string") negotiationRef.current[sig.from] = offer.voiceSession;
              await pc.setRemoteDescription(
                new RTCSessionDescription(offer),
              );
              for (const candidate of pendingIceRef.current[sig.from] ?? []) {
                if (!candidate.voiceSession || candidate.voiceSession === negotiationRef.current[sig.from]) await pc.addIceCandidate(candidate);
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
              if (pc.signalingState !== "have-local-offer" || answer.voiceSession && answer.voiceSession !== negotiationRef.current[sig.from]) continue;
              await pc.setRemoteDescription(
                new RTCSessionDescription(answer),
              );
              for (const candidate of pendingIceRef.current[sig.from] ?? []) {
                if (!candidate.voiceSession || candidate.voiceSession === negotiationRef.current[sig.from]) await pc.addIceCandidate(candidate);
              }
              delete pendingIceRef.current[sig.from];
            } else if (sig.type === "ice") {
              try {
                const candidate = JSON.parse(sig.data) as RTCIceCandidateInit & { voiceSession?: string };
                if (pc?.remoteDescription) {
                  if (!candidate.voiceSession || candidate.voiceSession === negotiationRef.current[sig.from]) await pc.addIceCandidate(candidate);
                  else pendingIceRef.current[sig.from] = [...(pendingIceRef.current[sig.from] ?? []), candidate].slice(-64);
                }
                else pendingIceRef.current[sig.from] = [...(pendingIceRef.current[sig.from] ?? []), candidate].slice(-64);
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
      disposeVoiceResources({ stream: streamRef.current, peers: peerConnsRef.current, audio: audioRefs.current });
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
    disposeVoiceResources({ stream: streamRef.current, peers: peerConnsRef.current, audio: audioRefs.current });
    peerConnsRef.current = {};
    audioRefs.current = {};
    streamRef.current = null;
    pendingIceRef.current = {};
    negotiationRef.current = {};
    peerEpochRef.current = {};
    if (mountedRef.current) {
      setInChannel(false);
      setIsMuted(false);
      setConnecting(false);
    }
    try {
      if (wasActive) await apiJSON(`community/voice/${channel.id}/leave`, {
        method: "DELETE",
        keepalive: true,
      });
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
    const prevParticipants = participants.filter(
      (p) => p.userId !== currentUserId,
    );
    const present = new Set(prevParticipants.map(p => p.userId));
    for (const [peerId, pc] of Object.entries(peerConnsRef.current)) {
      if (present.has(peerId)) continue;
      pc.close();
      const audio = audioRefs.current[peerId];
      if (audio) { audio.pause(); audio.srcObject = null; }
      delete peerConnsRef.current[peerId];
      delete audioRefs.current[peerId];
      delete pendingIceRef.current[peerId];
      delete negotiationRef.current[peerId];
      delete peerEpochRef.current[peerId];
    }
    prevParticipants.forEach((p) => {
      const pc = peerConnsRef.current[p.userId];
      if (pc && peerEpochRef.current[p.userId] && p.joinedAt && peerEpochRef.current[p.userId] !== p.joinedAt) {
        pc.close();
        const audio = audioRefs.current[p.userId];
        if (audio) { audio.pause(); audio.srcObject = null; }
        delete peerConnsRef.current[p.userId];
        delete audioRefs.current[p.userId];
        delete negotiationRef.current[p.userId];
      }
      peerEpochRef.current[p.userId] = p.joinedAt;
      // Both browsers discover each other: only one may initiate the offer.
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

  const others = participants.filter((p) => p.userId !== currentUserId);
  const meInChannel = participants.some((p) => p.userId === currentUserId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-card/30">
        <Volume2 className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">{channel.name}</span>
        {participants.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground bg-secondary/50 border border-border px-2 py-0.5 rounded-full">
            {participants.length} connessi
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {errorMessage && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p>}
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-6">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${inChannel ? "bg-primary/20 border-2 border-primary shadow-lg shadow-primary/20" : "bg-secondary/40 border-2 border-border"}`}
          >
            <Headphones
              className={`w-10 h-10 ${inChannel ? "text-primary" : "text-muted-foreground"}`}
            />
          </div>

          {!inChannel ? (
            <div className="text-center space-y-3">
              <p className="font-semibold text-base">{channel.name}</p>
              <p className="text-sm text-muted-foreground">
                {participants.length === 0
                  ? "Nessuno ancora in questo canale"
                  : `${participants.length} trader ${participants.length === 1 ? "connesso" : "connessi"}`}
              </p>
              <button
                onClick={joinChannel}
                disabled={connecting}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-lg shadow-primary/20"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                {connecting ? "Connessione..." : "Entra nel canale"}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div>
                <p className="font-semibold text-base text-primary">
                  Connesso in {channel.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isMuted ? "Microfono disattivato" : "Microfono attivo"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  aria-label={socialText(language, isMuted ? "voiceUnmute" : "voiceMute")}
                  aria-pressed={isMuted}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors border ${isMuted ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-secondary/60 border-border text-foreground hover:bg-secondary"}`}
                >
                  {isMuted ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={leaveChannel}
                  aria-label={socialText(language, "voiceLeave")}
                  className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400 transition-colors shadow-lg shadow-red-500/20"
                >
                  <PhoneOff className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>

        {participants.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In ascolto
            </p>
            <div className="space-y-1.5">
              {participants.map((p) => (
                <div
                  key={p.userId}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${p.userId === currentUserId ? "border-primary/30 bg-primary/5" : "border-border/40 bg-secondary/20"}`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-secondary border border-border overflow-hidden shrink-0">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.userName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                          {p.userName[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                  </div>
                  <span
                    className={`text-sm font-medium ${p.userId === currentUserId ? "text-primary" : ""}`}
                  >
                    {p.userName}
                    {p.userId === currentUserId && " (tu)"}
                  </span>
                  {p.userId !== currentUserId && (
                    <Headphones className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
