/** Release browser resources independently of React's rendered connection state. */
export function disposeVoiceResources(resources: {
  stream: Pick<MediaStream, "getTracks"> | null;
  peers: Record<string, Pick<RTCPeerConnection, "close">>;
  audio: Record<string, Pick<HTMLAudioElement, "pause" | "srcObject">>;
}): void {
  resources.stream?.getTracks().forEach(track => track.stop());
  Object.values(resources.peers).forEach(peer => peer.close());
  Object.values(resources.audio).forEach(audio => { audio.pause(); audio.srcObject = null; });
}

/** A microphone permission request may resolve after its workspace was left. */
export function keepCurrentVoiceStream(stream: Pick<MediaStream, "getTracks">, current: boolean): boolean {
  if (!current) stream.getTracks().forEach(track => track.stop());
  return current;
}
