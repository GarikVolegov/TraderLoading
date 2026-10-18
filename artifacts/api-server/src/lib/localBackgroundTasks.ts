export function backgroundTasksEnabled(env: NodeJS.ProcessEnv): boolean {
  return !(env.NODE_ENV === "development" && env.LOCAL_BACKGROUND_TASKS === "0");
}
