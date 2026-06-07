import { createAccountBridgeService, type AccountBridgeService } from "./accountBridgeService.js";
import { parseBridgeConfig } from "./validation.js";
import type {
  AccountBridgeConfig,
  AccountBridgeEvent,
  AccountOrderResult,
  AccountSnapshot,
} from "./types.js";

type Listener = (event: AccountBridgeEvent) => void;

export interface AccountBridgeRuntime extends AccountBridgeService {
  activateConfig(config: AccountBridgeConfig): Promise<AccountSnapshot>;
  getConfig(): AccountBridgeConfig;
}

function cloneConfig(config: AccountBridgeConfig): AccountBridgeConfig {
  return { ...config };
}

export function createAccountBridgeRuntime(initialConfig: AccountBridgeConfig = parseBridgeConfig(process.env)): AccountBridgeRuntime {
  const listeners = new Set<Listener>();
  let config = cloneConfig(initialConfig);
  let service = createAccountBridgeService(config);
  let unsubscribeService: (() => void) | null = null;
  let started = false;

  function emit(event: AccountBridgeEvent): void {
    for (const listener of Array.from(listeners)) {
      try {
        listener(event);
      } catch (error) {
        console.error("[accountBridge:runtime] listener error", error);
      }
    }
  }

  function wireService(): void {
    unsubscribeService?.();
    unsubscribeService = service.onEvent(emit);
  }

  wireService();

  return {
    async start(): Promise<void> {
      if (started) return;
      started = true;
      await service.start();
    },

    async stop(): Promise<void> {
      started = false;
      unsubscribeService?.();
      unsubscribeService = null;
      await service.stop();
    },

    async getSnapshot(): Promise<AccountSnapshot> {
      return service.getSnapshot();
    },

    async placeOrder(raw: unknown, requestId?: string): Promise<AccountOrderResult> {
      return service.placeOrder(raw, requestId);
    },

    onEvent(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async activateConfig(nextConfig: AccountBridgeConfig): Promise<AccountSnapshot> {
      const shouldStart = started;
      if (started) {
        await service.stop();
      }

      unsubscribeService?.();
      config = cloneConfig(nextConfig);
      service = createAccountBridgeService(config);
      wireService();

      if (shouldStart) {
        await service.start();
      }

      const snapshot = await service.getSnapshot();
      emit({ type: "snapshot", snapshot });
      return snapshot;
    },

    getConfig(): AccountBridgeConfig {
      return cloneConfig(config);
    },
  };
}
