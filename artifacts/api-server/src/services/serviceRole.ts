export type ServiceRole = "all" | "api" | "gateway" | "worker";

/**
 * Returns the operative workload role of the current API server process.
 * Defaults to "all" for backwards compatibility and single-instance local deployments.
 */
export function getServiceRole(env: NodeJS.ProcessEnv = process.env): ServiceRole {
  const role = env["SERVICE_ROLE"]?.trim().toLowerCase();
  if (role === "api" || role === "gateway" || role === "worker") {
    return role;
  }
  return "all";
}

export function shouldRunHttpApi(role: ServiceRole): boolean {
  return role === "all" || role === "api";
}

export function shouldRunWebSockets(role: ServiceRole): boolean {
  return role === "all" || role === "gateway";
}

export function shouldRunSchedulers(role: ServiceRole): boolean {
  return role === "all" || role === "worker";
}
