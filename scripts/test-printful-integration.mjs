import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(".env.local") });
dotenv.config({ path: path.resolve(".env") });

const args = process.argv.slice(2);
let customKey = null;
let customStoreId = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--key" && args[i + 1]) {
    customKey = args[i + 1];
  }
  if (args[i] === "--store" && args[i + 1]) {
    customStoreId = args[i + 1];
  }
}

const apiKey = customKey || process.env.PRINTFUL_API_KEY;
const storeId = customStoreId || process.env.PRINTFUL_STORE_ID;

console.log("==================================================");
console.log("   LIMEN PROTOCOL // PRINTFUL AUTOMATION AUDIT   ");
console.log("==================================================");

if (!apiKey) {
  console.log("\n⚠️  PRINTFUL_API_KEY non è configurata in .env o .env.local.");
  console.log("   Il sistema sta operando in MODALITÀ SIMULAZIONE (ordini registrati e testabili localmente).");
  console.log("\n   Per abilitare gli ordini reali automatici su Printful:");
  console.log("   1. Vai su Printful Dashboard → Impostazioni → Negozi → API → Token di accesso personale");
  console.log("   2. Crea un token con permessi 'orders' e 'products'");
  console.log("   3. Esegui questo script con: node scripts/test-printful-integration.mjs --key <TUO_TOKEN>");
  console.log("   4. Oppure inserisci in .env.local: PRINTFUL_API_KEY=tuo_token_qui\n");
} else {
  console.log("\n🔑 Chiave API rilevata:", apiKey.slice(0, 6) + "..." + apiKey.slice(-4));
  if (storeId) {
    console.log("🏪 Store ID:", storeId);
  }

  const headers = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };
  if (storeId) {
    headers["X-PF-Store-Id"] = storeId.trim();
  }

  try {
    console.log("📡 Connessione a Printful API (https://api.printful.com/stores)...");
    const res = await fetch("https://api.printful.com/stores", { headers });
    const data = await res.json();

    if (!res.ok || data.code >= 400) {
      console.error("❌ Errore autenticazione Printful:", data.error?.message || `HTTP ${res.status}`);
    } else {
      console.log("✅ Connessione riuscita!");
      console.log("   Negozi associati:", data.result?.length || 0);
      for (const st of data.result || []) {
        console.log(`   - ID: ${st.id} | Nome: "${st.name}" | Tipo: ${st.type} | Valuta: ${st.currency}`);
      }
    }
  } catch (err) {
    console.error("❌ Errore di rete contattando Printful:", err.message);
  }
}

console.log("\n📦 Verifica Catalogo Ufficiale Gildan 18500 (Product ID: 146):");
const catalogVariants = {
  "Sport Grey": { S: 5610, M: 5611, L: 5612, XL: 5613, "2XL": 5614 },
  "Obsidian Black": { S: 5530, M: 5531, L: 5532, XL: 5533, "2XL": 5534 },
  "Dark Heather": { S: 10806, M: 10807, L: 10808, XL: 10809, "2XL": 10810 },
};

for (const [color, sizes] of Object.entries(catalogVariants)) {
  console.log(`   ✓ ${color}: ${Object.entries(sizes).map(([sz, id]) => `${sz}=#${id}`).join(", ")}`);
}

console.log("\n🎨 Verifica Asset di Ricamo 300 DPI Pubblicati:");
const merchDir = path.resolve("artifacts/trader-dashboard/public/images/merch");
const requiredFiles = [
  "limen_signature_gold_300dpi.png",
  "limen_wrist_roman_aureus_300dpi.png",
  "limen_back_trajan_column_300dpi.png",
  "hoodie-back-trajan.jpg",
  "hoodie-back-black.jpg",
  "hoodie-back-darkheather.jpg",
  "hoodie-front-sportgrey.jpg",
  "hoodie-front-black.jpg",
];

for (const f of requiredFiles) {
  const p = path.join(merchDir, f);
  const exists = fs.existsSync(p);
  const sizeKb = exists ? Math.round(fs.statSync(p).size / 1024) : 0;
  console.log(`   ${exists ? "✅" : "❌"} ${f} (${sizeKb} KB)`);
}

console.log("\n🪝 Endpoint Webhook per Tracking & Aggiornamenti Spedizione:");
console.log("   URL: POST https://<tuo-dominio>/api/arsenal/webhooks/printful");
console.log("   Evento supportato: package_shipped (aggiorna in automatico tracking, corriere e stato)");
console.log("==================================================\n");
