export interface MyfxbookSymbol {
  name: string;
  longPercentage: number;
  shortPercentage: number;
  longVolume: number;
  shortVolume: number;
  longPositions: number;
  shortPositions: number;
}

let sessionCache: { token: string; expiresAt: number } | null = null;

export function buildMyfxbookLoginUrl(email: string, password: string): string {
  return `https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
}

export function buildMyfxbookOutlookUrl(session: string): string {
  return `https://www.myfxbook.com/api/get-community-outlook.json?session=${session}`;
}

export function clearMyfxbookSession(): void {
  sessionCache = null;
}

export async function getMyfxbookSession(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (sessionCache && Date.now() < sessionCache.expiresAt) {
    return sessionCache.token;
  }

  const email = env.MYFXBOOK_EMAIL;
  const password = env.MYFXBOOK_PASSWORD;
  if (!email || !password) return null;

  const res = await fetch(buildMyfxbookLoginUrl(email, password), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Myfxbook login HTTP ${res.status}`);
  const data = await res.json() as { error: boolean; message?: string; session: string };
  if (data.error || !data.session) throw new Error(data.message ?? "Login fallito");

  sessionCache = { token: data.session, expiresAt: Date.now() + 55 * 60 * 1000 };
  console.log("[myfxbook] Sessione ottenuta");
  return sessionCache.token;
}

export async function fetchMyfxbookOutlook(env: NodeJS.ProcessEnv = process.env): Promise<MyfxbookSymbol[]> {
  const session = await getMyfxbookSession(env);
  if (!session) throw new Error("No credentials");

  const res = await fetch(buildMyfxbookOutlookUrl(session), {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Myfxbook outlook HTTP ${res.status}`);
  const data = await res.json() as { error: boolean; message?: string; symbols?: MyfxbookSymbol[] };
  if (data.error) {
    clearMyfxbookSession();
    throw new Error(data.message ?? "Outlook error");
  }
  return data.symbols ?? [];
}
