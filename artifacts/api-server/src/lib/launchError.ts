/** Explicitly safe messages for launch endpoints; provider details never reach the browser. */
export class LaunchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
