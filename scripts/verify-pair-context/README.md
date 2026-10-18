# Verifica della home sintetica

Dalla radice: `node scripts/verify-pair-context/run.mjs`.

Vite su 127.0.0.1:5180, Chromium Playwright/Puppeteer, contesto isolato in italiano
Europe/Rome. API in memoria e alias Clerk esclusivo dei test, nessun database,
richieste esterne bloccate. Non eseguire durante codegen/typecheck/verify.

Output in `artifacts.local/verify-pair-context/`: report.json, desktop.png,
mobile.png, insufficient.png. Il runner chiude server e browser e fallisce su
asserzioni o eccezioni JavaScript. Testa la UI con fixture, non i provider reali.
Il calcolo vero è verificato separatamente dai test TypeScript del backend.
