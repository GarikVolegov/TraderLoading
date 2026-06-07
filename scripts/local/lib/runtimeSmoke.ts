export type RuntimeSmokeReachability = {
  apiReachable: boolean;
  frontendReachable: boolean;
};

export type RuntimeSmokeService = {
  name: "api" | "frontend";
};

export function createRuntimeSmokePlan(reachability: RuntimeSmokeReachability): RuntimeSmokeService[] {
  const services: RuntimeSmokeService[] = [];

  if (!reachability.apiReachable) {
    services.push({ name: "api" });
  }

  if (!reachability.frontendReachable) {
    services.push({ name: "frontend" });
  }

  return services;
}
