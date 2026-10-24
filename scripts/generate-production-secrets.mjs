#!/usr/bin/env node
import crypto from "node:crypto";

console.log("\n========================================================");
console.log("   LIMEN PROTOCOL — POST-BREACH KEY ROTATION GENERATOR   ");
console.log("========================================================\n");

const generateHexKey = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
const generateBase64Key = (bytes = 32) => crypto.randomBytes(bytes).toString("base64");

console.log("# Copia e incolla queste variabili d'ambiente nel nuovo provider di hosting:\n");
console.log(`JWT_SECRET=${generateHexKey(32)}`);
console.log(`BROKER_VAULT_KEY=${generateHexKey(32)}`);
console.log(`SESSION_SECRET=${generateHexKey(32)}`);
console.log(`ENCRYPTION_KEY=${generateHexKey(32)}`);

console.log("\n# Note per le API di terze parti (da ruotare sulle rispettive console):");
console.log("- Clerk Secret Key: https://dashboard.clerk.com");
console.log("- Stripe Secret Key & Webhook Secret: https://dashboard.stripe.com/apikeys");
console.log("- Resend API Key: https://resend.com/api-keys");
console.log("- Finnhub / CoinGecko API Key: sui rispettivi portali sviluppatori\n");
console.log("========================================================\n");
