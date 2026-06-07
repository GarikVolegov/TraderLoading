import { Router, type IRouter } from "express";
import { createConnection } from "node:net";
import { accountBridgeRuntime } from "../services/accountBridge/accountBridgeRuntimeSingleton.js";
import type { AccountBridgeRuntime } from "../services/accountBridge/accountBridgeRuntime.js";
import {
  createAccountProfileStore,
  profileToBridgeConfig,
  type AccountConnectionProfile,
  type AccountProfileStore,
} from "../services/accountBridge/profileStore.js";

interface AccountBridgeRouterOptions {
  store?: AccountProfileStore;
  runtime?: AccountBridgeRuntime;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Account bridge request failed";
}

async function testTcp(profile: AccountConnectionProfile): Promise<{ reachable: boolean; message: string }> {
  if (profile.adapter === "demo") {
    return { reachable: true, message: "Demo adapter disponibile" };
  }

  return new Promise((resolve) => {
    const socket = createConnection({ host: profile.host, port: profile.port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ reachable: false, message: `Nessuna risposta da ${profile.host}:${profile.port}` });
    }, 800);
    timer.unref?.();

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve({ reachable: true, message: `Bridge raggiungibile su ${profile.host}:${profile.port}` });
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ reachable: false, message: error.message });
    });
  });
}

export function createAccountBridgeRouter(options: AccountBridgeRouterOptions = {}): IRouter {
  const router = Router();
  const store = options.store ?? createAccountProfileStore();
  const runtime = options.runtime ?? accountBridgeRuntime;

  router.get("/account/connections", async (_req, res) => {
    try {
      res.json(await store.listProfiles());
    } catch (error) {
      res.status(500).json({ error: messageFrom(error) });
    }
  });

  router.post("/account/connections", async (req, res) => {
    try {
      const profile = await store.saveProfile(req.body);
      const list = await store.listProfiles();
      res.status(201).json({ profile, activeProfileId: list.activeProfileId });
    } catch (error) {
      res.status(400).json({ error: messageFrom(error) });
    }
  });

  router.post("/account/connections/:id/activate", async (req, res) => {
    try {
      const profile = await store.activateProfile(req.params.id);
      await runtime.activateConfig(profileToBridgeConfig(profile));
      await runtime.start();
      res.json({
        activeProfileId: profile.id,
        profile,
        snapshot: await runtime.getSnapshot(),
      });
    } catch (error) {
      res.status(404).json({ error: messageFrom(error) });
    }
  });

  router.post("/account/connections/:id/test", async (req, res) => {
    try {
      const list = await store.listProfiles();
      const profile = list.profiles.find((item) => item.id === req.params.id);
      if (!profile) {
        res.status(404).json({ error: "Account profile not found" });
        return;
      }

      res.json(await testTcp(profile));
    } catch (error) {
      res.status(500).json({ error: messageFrom(error) });
    }
  });

  router.delete("/account/connections/:id", async (req, res) => {
    try {
      await store.deleteProfile(req.params.id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: messageFrom(error) });
    }
  });

  return router;
}

export default createAccountBridgeRouter();
