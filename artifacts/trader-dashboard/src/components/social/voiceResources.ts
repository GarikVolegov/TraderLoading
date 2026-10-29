/** Release browser resources independently of React's rendered connection state. */
export function disposeVoiceResources(resources: {
  stream: Pick<MediaStream, "getTracks"> | null;
  peers: Record<string, Pick<RTCPeerConnection, "close">>;
  audio: Record<string, Pick<HTMLAudioElement, "pause" | "srcObject">>;
  videoStream?: Pick<MediaStream, "getTracks"> | null;
  screenStream?: Pick<MediaStream, "getTracks"> | null;
  recorder?: Pick<MediaRecorder, "state" | "stop"> | null;
}): void {
  resources.stream?.getTracks().forEach(track => track.stop());
  resources.videoStream?.getTracks().forEach(track => track.stop());
  resources.screenStream?.getTracks().forEach(track => track.stop());
  if (resources.recorder && resources.recorder.state !== "inactive") {
    try { resources.recorder.stop(); } catch { /* ignore */ }
  }
  Object.values(resources.peers).forEach(peer => peer.close());
  Object.values(resources.audio).forEach(audio => { audio.pause(); audio.srcObject = null; });
}

/** A microphone permission request may resolve after its workspace was left. */
export function keepCurrentVoiceStream(stream: Pick<MediaStream, "getTracks">, current: boolean): boolean {
  if (!current) stream.getTracks().forEach(track => track.stop());
  return current;
}
