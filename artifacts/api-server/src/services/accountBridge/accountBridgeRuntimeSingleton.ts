import { createAccountBridgeRuntime } from "./accountBridgeRuntime.js";
import { parseBridgeConfig } from "./validation.js";

export const accountBridgeRuntime = createAccountBridgeRuntime(parseBridgeConfig(process.env));
