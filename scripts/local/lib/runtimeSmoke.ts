export type RuntimeSmokeReachability = {
  apiReachable: boolean;
  frontendReachable: boolean;
};

export type RuntimeSmokeService = {
  name: "api" | "frontend";
};

export type PostCodegenSettleInput = {
  frontendReachableBeforeCodegen: boolean;
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

export function getPostCodegenSettleDelayMs(input: PostCodegenSettleInput): number {
  return input.frontendReachableBeforeCodegen ? 1_500 : 0;
}
