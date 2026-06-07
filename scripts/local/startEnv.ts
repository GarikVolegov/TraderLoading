export function buildFrontendDevEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    BASE_PATH: source["BASE_PATH"] ?? "/",
    PORT: source["PORT"] ?? "5173",
    VITE_API_BASE: source["VITE_API_BASE"] ?? "http://127.0.0.1:3001",
    VITE_CLERK_PUBLISHABLE_KEY: source["VITE_CLERK_PUBLISHABLE_KEY"] ?? source["CLERK_PUBLISHABLE_KEY"],
    VITE_CLERK_PROXY_URL: source["VITE_CLERK_PROXY_URL"],
  };
}

export function buildFrontendDevArgs(): string[] {
  return ["--filter", "@workspace/trader-dashboard", "run", "dev"];
}
