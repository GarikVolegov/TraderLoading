export type DatabaseTarget = {
  url: string;
  host: string;
  port: number;
  managed: boolean;
};

type ResolveDatabaseTargetOptions = {
  localDefaultPortOccupied: boolean;
  managedPort: number;
};

function managedDatabaseUrl(port: number): string {
  return `postgres://trader:trader@127.0.0.1:${port}/traderloadings`;
}

export function resolveDatabaseTarget(rawUrl: string, options: ResolveDatabaseTargetOptions): DatabaseTarget {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname;
  const port = Number(parsed.port || "5432");
  const isDefaultLocalPostgres = (host === "127.0.0.1" || host === "localhost") && port === 5432;

  if (isDefaultLocalPostgres && options.localDefaultPortOccupied) {
    return {
      url: managedDatabaseUrl(options.managedPort),
      host: "127.0.0.1",
      port: options.managedPort,
      managed: true,
    };
  }

  return {
    url: rawUrl,
    host,
    port,
    managed: isDefaultLocalPostgres,
  };
}
