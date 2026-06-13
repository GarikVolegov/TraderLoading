export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Open Relay (metered.ca) free TURN — required for NAT traversal when a peer
  // is behind symmetric NAT / mobile / corporate firewall (STUN alone fails).
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export const COMMUNITY_EMOJIS = [
  "🏛️",
  "📊",
  "💹",
  "🎯",
  "🧠",
  "⚡",
  "🔥",
  "🚀",
  "💎",
  "🌐",
  "📈",
  "🏆",
  "🤝",
  "🛡️",
  "⚙️",
];
