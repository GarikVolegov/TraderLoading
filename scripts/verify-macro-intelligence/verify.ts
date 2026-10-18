import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnvLocal, repoRoot } from "../local/lib/env.js";
import { runCommand } from "../local/lib/process.js";
// Only the public frontend key enters this gate; private integrations stay unloaded.
const key=process.env.VITE_CLERK_PUBLISHABLE_KEY??parseEnvLocal(readFileSync(join(repoRoot,".env.local"),"utf8")).get("VITE_CLERK_PUBLISHABLE_KEY");
if(!key||!/^pk_(test|live)_/.test(key))throw new Error("A valid public Clerk build key is required");
await runCommand("pnpm",["verify"],{env:{VITE_CLERK_PUBLISHABLE_KEY:key}});
