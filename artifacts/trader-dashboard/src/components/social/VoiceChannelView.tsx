import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Volume2, Headphones } from "lucide-react";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { ICE_SERVERS } from "./constants";
import { useVoicePresence } from "./hooks";
import type { VoiceSignal, ChannelType } from "./types";

export function VoiceChannelView({
  channel,
  currentUserId,
  currentUserName,
}: {
  channel: ChannelType;
  currentUserId: string;
  currentUserName: string;
}) {
  const [inChannel, setInChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const { data: participants = [] } = useVoicePresence(channel.id, true);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const createPeer = useCallback(
    (peerId: string, isInitiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnsRef.current[peerId] = pc;
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((t) => pc.addTrack(t, streamRef.current!));
      }
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          await apiFetch(`community/voice/${channel.id}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: peerId,
              type: "ice",
              data: JSON.stringify(e.candidate),
            }),
          });
        }
      };
      pc.ontrack = (e) => {
        let audio = audioRefs.current[peerId];
        if (!audio) {
          audio = new Audio();
          audioRefs.current[peerId] = audio;
          audio.autoplay = true;
        }
        audio.srcObject = e.streams[0];
      };
      if (isInitiator) {
        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          apiFetch(`community/voice/${channel.id}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: peerId,
              type: "offer",
              data: JSON.stringify(offer),
            }),
          });
        });
      }
      return pc;
    },
    [channel.id],
  );

  const joinChannel = async () => {
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      await apiJSON(`community/voice/${channel.id}/join`, { method: "POST" });
      setInChannel(true);
      pingIntervalRef.current = setInterval(async () => {
        await apiFetch(`community/voice/${channel.id}/ping`, {
          method: "POST",
        });
      }, 8_000);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const { signals } = await apiJSON<{ signals: VoiceSignal[] }>(
            `community/voice/${channel.id}/signals`,
          );
          for (const sig of signals ?? []) {
            let pc = peerConnsRef.current[sig.from];
            if (sig.type === "offer") {
              if (!pc) pc = createPeer(sig.from, false);
              await pc.setRemoteDescription(
                new RTCSessionDescription(JSON.parse(sig.data)),
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await apiFetch(`community/voice/${channel.id}/signal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: sig.from,
                  type: "answer",
                  data: JSON.stringify(answer),
                }),
              });
            } else if (sig.type === "answer" && pc) {
              await pc.setRemoteDescription(
                new RTCSessionDescription(JSON.parse(sig.data)),
              );
            } else if (sig.type === "ice" && pc) {
              try {
                await pc.addIceCandidate(
                  new RTCIceCandidate(JSON.parse(sig.data)),
                );
              } catch (error) {
                reportClientError(error, {
                  context: "community voice ICE candidate",
                  notify: false,
                });
              }
            }
          }
        } catch (error) {
          reportClientError(error, {
            context: "community voice signal polling",
            notify: false,
          });
        }
      }, 2_000);
    } catch (err) {
      console.error("Voice join error:", err);
    } finally {
      setConnecting(false);
    }
  };

  const leaveChannel = useCallback(async () => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    Object.values(peerConnsRef.current).forEach((pc) => pc.close());
    peerConnsRef.current = {};
    Object.values(audioRefs.current).forEach((a) => {
      a.pause();
      a.srcObject = null;
    });
    audioRefs.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      await apiFetch(`community/voice/${channel.id}/leave`, {
        method: "DELETE",
      });
    } catch (error) {
      reportClientError(error, {
        context: "community voice leave",
        notify: false,
      });
    }
    setInChannel(false);
    setIsMuted(false);
  }, [channel.id]);

  useEffect(() => {
    if (!inChannel) return;
    const prevParticipants = participants.filter(
      (p) => p.userId !== currentUserId,
    );
    prevParticipants.forEach((p) => {
      if (!peerConnsRef.current[p.userId]) createPeer(p.userId, true);
    });
  }, [participants, inChannel, currentUserId, createPeer]);

  useEffect(
    () => () => {
      if (inChannel) leaveChannel();
    },
    [],
  );

  const toggleMute = () => {
    if (!streamRef.current) return;
    const enabled = !isMuted;
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
