import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DICT_DIR = path.resolve(__dirname, "../../artifacts/trader-dashboard/src/lib/i18n");

const keysData: Record<string, Record<string, string>> = {
  it: {
    "seo.tradezella-vs-edgewonk.eyebrow": "Analisi Comparativa Ufficiale · TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.h1": "TradeZella vs Edgewonk nel 2026: Confronto Completo e Perché i Trader Scelgono AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.h1.kw": "TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.meta.title": "TradeZella vs Edgewonk (2026): Quale Scegliere e l'Alternativa Sovrana AUREUS",
    "seo.tradezella-vs-edgewonk.meta.description": "Confronto tra TradeZella ed Edgewonk: prezzi, sincronizzazione MT4/MT5, replay e psicologia. Scopri perché AUREUS PROTOCOL unisce il meglio di entrambi a 0 €.",
    "seo.tradezella-vs-edgewonk.meta.keywords": "TradeZella vs Edgewonk, confronto trading journal, miglior diario di trading, Edgewonk alternativa, TradeZella alternativa, diario MT4 MT5, AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.intro": "La scelta tra TradeZella ed Edgewonk divide i trader: grafica moderna e replay a canone mensile elevato contro psicologia e licenza annuale ma con inserimenti manuali. AUREUS PROTOCOL supera questo compromesso fondendo diario automatico MT4/MT5 in sola lettura, replay candela per candela e circuito anti-deriva pre-trade da 0 €.",
    "seo.tradezella-vs-edgewonk.s1.title": "TradeZella vs Edgewonk: Workflow e Sincronizzazione",
    "seo.tradezella-vs-edgewonk.s1.body": "TradeZella punta sulla sincronizzazione automatica ma vincola a un abbonamento ricorrente fino a 49 $/mese. Edgewonk costa meno nel lungo termine ma richiede laboriosi caricamenti CSV o inserimenti manuali. AUREUS OS offre sync automatica in sola lettura via FX Blue protetta da crittografia notarile SHA-256 fin dal piano Base gratuito.",
    "seo.tradezella-vs-edgewonk.s2.title": "Replay e Backtest contro Analisi Psicologica",
    "seo.tradezella-vs-edgewonk.s2.body": "Mentre TradeZella eccelle nel replay visivo ma offre solo note psicologiche passive, Edgewonk monitora il tilt ma e privo di un simulatore replay candela per candela. AUREUS unisce la Forgia del Passato (replay M5-D1 su dati Dukascopy/Binance) e il Custode della Soglia (blocco attivo pre-trade).",
    "seo.tradezella-vs-edgewonk.s3.title": "Il Modello Sovrano: Zero Costi Fissi e 20% Royalty",
    "seo.tradezella-vs-edgewonk.s3.body": "Ne TradeZella ne Edgewonk redistribuiscono valore agli utenti virtuosi. AUREUS premia la costanza con l'accesso gratuito al diario e garantisce ai Custodi della Regola un Mandato d'Espansione con il 20% di royalty ricorrente su ogni membro attivo invitato.",
    "seo.tradezella-vs-edgewonk.faq.q1": "Qual e la differenza principale tra TradeZella ed Edgewonk?",
    "seo.tradezella-vs-edgewonk.faq.a1": "TradeZella e una web-app moderna con replay e abbonamento mensile (29-49 $/mese); Edgewonk e focalizzato su MAE/MFE e psicologia con licenza annuale ma richiede importazioni manuali. AUREUS OS integra entrambe le funzionalita a 0 €.",
    "seo.tradezella-vs-edgewonk.faq.q2": "Quale piattaforma e migliore per gestire le emozioni e il tilt?",
    "seo.tradezella-vs-edgewonk.faq.a2": "Edgewonk offre il Tiltmeter ma si limita a registrare gli errori a posteriori. AUREUS PROTOCOL introduce il Custode della Soglia, un vero circuito pre-trade che blocca fisicamente l'accesso al terminale in caso di perdita di lucidita.",
    "seo.tradezella-vs-edgewonk.faq.q3": "AUREUS PROTOCOL puo sostituire sia TradeZella che Edgewonk?",
    "seo.tradezella-vs-edgewonk.faq.a3": "Si. AUREUS unisce la sincronizzazione MT4/MT5, il replay candela per candela, il calcolo della position size, l'analisi psicologica bio-emotiva e il notariato SHA-256 in un'unica plancia operativa.",
    "seo.tradezella-vs-edgewonk.cta.title": "Scegli la Terza Via Sovrana: Prova AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.cta.body": "Non scegliere tra un simulatore costoso e un diario manuale. Unisci diario, replay e circuito anti-tilt in un unico cockpit da 0 €.",
  },
  en: {
    "seo.tradezella-vs-edgewonk.eyebrow": "Official In-Depth Breakdown · TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.h1": "TradeZella vs Edgewonk in 2026: Head-to-Head Comparison & The Sovereign AUREUS OS Alternative",
    "seo.tradezella-vs-edgewonk.h1.kw": "TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.meta.title": "TradeZella vs Edgewonk (2026): Which Should You Pick? | AUREUS OS",
    "seo.tradezella-vs-edgewonk.meta.description": "TradeZella vs Edgewonk compared: pricing, MT4/MT5 sync, chart replay, and psychology. See why disciplined traders switch to AUREUS PROTOCOL at 0 €.",
    "seo.tradezella-vs-edgewonk.meta.keywords": "TradeZella vs Edgewonk, trading journal comparison, best trading journal 2026, TradeZella alternative, Edgewonk alternative, MT4 MT5 journal, AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.intro": "Choosing between TradeZella and Edgewonk forces traders into a compromise: modern visual replay with expensive recurring subscriptions vs deep psychological metrics burdened by manual CSV logging. AUREUS PROTOCOL eliminates this trade-off by combining automated read-only MT4/MT5 syncing, native candle-by-candle replay, and pre-trade anti-tilt execution firewalls from 0 €.",
    "seo.tradezella-vs-edgewonk.s1.title": "TradeZella vs Edgewonk: Workflow & Broker Sync",
    "seo.tradezella-vs-edgewonk.s1.body": "TradeZella leads with automated cloud syncing but locks advanced metrics behind steep monthly fees up to $49/mo. Edgewonk is more economical over time but requires cumbersome manual CSV imports. AUREUS OS provides seamless read-only MT4/MT5 syncing via FX Blue anchored by cryptographic SHA-256 notarial seals on the free Base plan.",
    "seo.tradezella-vs-edgewonk.s2.title": "Chart Replay vs Psychological Tilt Control",
    "seo.tradezella-vs-edgewonk.s2.body": "While TradeZella excels at visual chart replays with passive psychological tagging, Edgewonk monitors tilt but lacks a native candle-by-candle tick simulator. AUREUS unifies The Forge of the Past (M5-D1 historical replay on Dukascopy and Binance feeds) with The Guardian of the Threshold (pre-trade lockout circuit breaker).",
    "seo.tradezella-vs-edgewonk.s3.title": "The Sovereign Model: Zero Paywalls & 20% Recurring Royalty",
    "seo.tradezella-vs-edgewonk.s3.body": "Neither TradeZella nor Edgewonk rewards disciplined operators. AUREUS provides free lifetime access to core journaling tools and unlocks an Expansion Mandate for verified Rule Custodians offering a 20% recurring royalty on active members.",
    "seo.tradezella-vs-edgewonk.faq.q1": "What is the main difference between TradeZella and Edgewonk?",
    "seo.tradezella-vs-edgewonk.faq.a1": "TradeZella is a modern SaaS with chart replay and monthly billing ($29-$49/mo); Edgewonk specializes in MAE/MFE analytics and psychology via an annual fee but relies on manual uploads. AUREUS OS integrates both toolsets at 0 €.",
    "seo.tradezella-vs-edgewonk.faq.q2": "Which platform is superior for trading psychology and tilt control?",
    "seo.tradezella-vs-edgewonk.faq.a2": "Edgewonk features the Tiltmeter but only tracks emotional damage after the fact. AUREUS PROTOCOL provides an active pre-trade circuit breaker that physically blocks revenge trades and oversize lots before orders reach the broker.",
    "seo.tradezella-vs-edgewonk.faq.q3": "Can AUREUS PROTOCOL replace both TradeZella and Edgewonk?",
    "seo.tradezella-vs-edgewonk.faq.a3": "Yes. AUREUS consolidates automated MT4/MT5 journaling, candle-by-candle replay, position sizing, bio-emotional state tracking, and SHA-256 cryptographic proof into a unified cockpit.",
    "seo.tradezella-vs-edgewonk.cta.title": "Choose The Sovereign Third Path: Experience AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.cta.body": "Stop paying for fragmented software tools. Unite journaling, chart replay, and tilt firewalls in one institutional platform starting at 0 €.",
  },
  es: {
    "seo.tradezella-vs-edgewonk.eyebrow": "Analisis Comparativo Oficial · TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.h1": "TradeZella vs Edgewonk en 2026: Comparativa Completa y la Alternativa Soberana AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.h1.kw": "TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.meta.title": "TradeZella vs Edgewonk (2026): ¿Cual Elegir? | AUREUS OS",
    "seo.tradezella-vs-edgewonk.meta.description": "TradeZella vs Edgewonk: precios, sincronizacion MT4/MT5, replay y psicologia. Descubre por que los traders eligen AUREUS PROTOCOL a 0 €.",
    "seo.tradezella-vs-edgewonk.meta.keywords": "TradeZella vs Edgewonk, comparativa diario trading, mejor diario de trading, alternativa TradeZella, alternativa Edgewonk, diario MT4 MT5, AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.intro": "Elegir entre TradeZella y Edgewonk obliga a un compromiso: diseno moderno con replay a precio mensual alto frente a psicologia y pago anual pero con importacion manual. AUREUS PROTOCOL une diario automatico MT4/MT5 en solo lectura, replay vela por vela y filtro anti-tilt pre-trade desde 0 €.",
    "seo.tradezella-vs-edgewonk.s1.title": "TradeZella vs Edgewonk: Flujo de Trabajo y Sincronizacion",
    "seo.tradezella-vs-edgewonk.s1.body": "TradeZella destaca por su sincronizacion automatica en la nube pero con suscripciones mensuales elevadas. Edgewonk es mas economico a largo plazo pero requiere CSV manuales. AUREUS OS ofrece sync automatica via FX Blue con certificacion notarial SHA-256 gratis.",
    "seo.tradezella-vs-edgewonk.s2.title": "Replay Grafico frente a Control Emocional",
    "seo.tradezella-vs-edgewonk.s2.body": "TradeZella ofrece repeticion grafica pero notas psicologicas pasivas; Edgewonk mide el tilt pero carece de simulador vela por vela. AUREUS combina La Forja del Pasado (replay M5-D1 con datos Dukascopy/Binance) y El Custodio de la Puerta (bloqueo activo pre-trade).",
    "seo.tradezella-vs-edgewonk.s3.title": "El Modelo Soberano: Sin Costes Ocultos y 20% Royalty",
    "seo.tradezella-vs-edgewonk.s3.body": "Ni TradeZella ni Edgewonk premian la consistencia. AUREUS recompensa a los operadores disciplinados con acceso gratuito y un Mandato de Expansion con 20% de royalty recurrente.",
    "seo.tradezella-vs-edgewonk.faq.q1": "¿Cual es la diferencia principal entre TradeZella y Edgewonk?",
    "seo.tradezella-vs-edgewonk.faq.a1": "TradeZella es una aplicacion web con replay y coste mensual (29-49 $/mes); Edgewonk se centra en MAE/MFE y psicologia con licencia anual pero entradas manuales. AUREUS unifica ambas herramientas a 0 €.",
    "seo.tradezella-vs-edgewonk.faq.q2": "¿Que plataforma es mejor para controlar el tilt y la psicologia?",
    "seo.tradezella-vs-edgewonk.faq.a2": "Edgewonk mide el tilt a posteriori. AUREUS PROTOCOL introduce El Custodio de la Puerta, bloqueando activamente el exceso de lotes o el trading de venganza antes de ejecutar.",
    "seo.tradezella-vs-edgewonk.faq.q3": "¿Puede AUREUS PROTOCOL sustituir a TradeZella y Edgewonk?",
    "seo.tradezella-vs-edgewonk.faq.a3": "Si. AUREUS unifica sincronizacion MT4/MT5, replay historico, calculadora de lotes, telemetria bio-emocional y sello notarial SHA-256.",
    "seo.tradezella-vs-edgewonk.cta.title": "Elige la Tercera Via Soberana: Prueba AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.cta.body": "No elijas entre software caro y registros manuales. Unifica diario, replay y cortafuegos de riesgo en un solo panel desde 0 €.",
  },
  fr: {
    "seo.tradezella-vs-edgewonk.eyebrow": "Analyse Comparative Officielle · TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.h1": "TradeZella vs Edgewonk en 2026 : Comparatif Complet et l'Alternative Souveraine AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.h1.kw": "TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.meta.title": "TradeZella vs Edgewonk (2026) : Quel Choix Faire ? | AUREUS OS",
    "seo.tradezella-vs-edgewonk.meta.description": "Comparatif TradeZella vs Edgewonk : prix, synchronisation MT4/MT5, replay et psychologie. Decouvrez pourquoi les traders choisissent AUREUS a 0 €.",
    "seo.tradezella-vs-edgewonk.meta.keywords": "TradeZella vs Edgewonk, comparatif journal de trading, meilleur journal de trading, alternative TradeZella, alternative Edgewonk, journal MT4 MT5, AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.intro": "Choisir entre TradeZella et Edgewonk impose un compromis : interface moderne avec replay a abonnement mensuel eleve contre psychologie et licence annuelle mais avec imports manuels. AUREUS PROTOCOL fusionne journal automatique MT4/MT5 en lecture seule, replay bougie par bougie et coupe-circuit anti-tilt des 0 €.",
    "seo.tradezella-vs-edgewonk.s1.title": "TradeZella vs Edgewonk : Flux de Travail et Synchronisation",
    "seo.tradezella-vs-edgewonk.s1.body": "TradeZella mise sur la synchronisation automatique mais impose un abonnement recurrent couteux. Edgewonk est plus economique a long terme mais exige des fichiers CSV manuels. AUREUS OS offre une synchronisation automatique via FX Blue certifiee par notariat SHA-256 gratuitement.",
    "seo.tradezella-vs-edgewonk.s2.title": "Replay Graphique contre Maîtrise Psychologique",
    "seo.tradezella-vs-edgewonk.s2.body": "TradeZella brille par son replay graphique mais propose des notes psychologiques passives ; Edgewonk analyse le tilt mais ne dispose pas de simulateur bougie par bougie. AUREUS unit La Forge du Passe (replay M5-D1 sur donnees Dukascopy/Binance) et Le Gardien du Seuil (verrouillage actif pre-trade).",
    "seo.tradezella-vs-edgewonk.s3.title": "Le Modele Souverain : Aucun Abonnement Imposé et 20% de Redevance",
    "seo.tradezella-vs-edgewonk.s3.body": "Ni TradeZella ni Edgewonk ne redistribuent de valeur aux traders reguliers. AUREUS recompense la constance avec un acces gratuit au journal et un Mandat d'Expansion offrant 20% de redevance recurrente.",
    "seo.tradezella-vs-edgewonk.faq.q1": "Quelle est la difference principale entre TradeZella et Edgewonk ?",
    "seo.tradezella-vs-edgewonk.faq.a1": "TradeZella est une application web avec replay a abonnement mensuel (29-49 $/mois) ; Edgewonk est axe sur le MAE/MFE et la psychologie a licence annuelle mais avec imports manuels. AUREUS combine les deux a 0 €.",
    "seo.tradezella-vs-edgewonk.faq.q2": "Quelle plateforme est la meilleure pour gerer les emotions et le tilt ?",
    "seo.tradezella-vs-edgewonk.faq.a2": "Edgewonk propose le Tiltmeter apres coup. AUREUS PROTOCOL integre Le Gardien du Seuil, bloquant activement l'overtrading et le revenge trading avant l'execution.",
    "seo.tradezella-vs-edgewonk.faq.q3": "AUREUS PROTOCOL peut-il remplacer a la fois TradeZella et Edgewonk ?",
    "seo.tradezella-vs-edgewonk.faq.a3": "Oui. AUREUS unifie synchronisation MT4/MT5, replay bougie par bougie, calcul de taille de position, telemetrie bio-emotionnelle et preuve notariale SHA-256.",
    "seo.tradezella-vs-edgewonk.cta.title": "Choisissez la Troisieme Voie Souveraine : Essayez AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.cta.body": "Ne choisissez plus entre outils couteux et saisies manuelles. Regroupez journal, replay et circuit anti-tilt dans un cockpit des 0 €.",
  },
  de: {
    "seo.tradezella-vs-edgewonk.eyebrow": "Offizieller Detailvergleich · TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.h1": "TradeZella vs Edgewonk 2026: Kompletter Vergleich und die Souveräne AUREUS PROTOCOL Alternative",
    "seo.tradezella-vs-edgewonk.h1.kw": "TradeZella vs Edgewonk",
    "seo.tradezella-vs-edgewonk.meta.title": "TradeZella vs Edgewonk (2026): Welche Wahl Treffen? | AUREUS OS",
    "seo.tradezella-vs-edgewonk.meta.description": "TradeZella vs Edgewonk im Vergleich: Preise, MT4/MT5-Sync, Chart-Replay und Psychologie. Erfahre, warum Trader zu AUREUS PROTOCOL ab 0 € wechseln.",
    "seo.tradezella-vs-edgewonk.meta.keywords": "TradeZella vs Edgewonk, Trading Tagebuch Vergleich, bestes Trading Journal, TradeZella Alternative, Edgewonk Alternative, MT4 MT5 Journal, AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.intro": "Die Wahl zwischen TradeZella und Edgewonk verlangt Kompromisse: modernes UI mit Replay bei hohen monatlichen Kosten gegen tiefgehende Psychologie bei jahrlicher Lizenz mit manuellen CSV-Uploads. AUREUS PROTOCOL vereint automatisierte MT4/MT5-Sync, Kerzen-Replay und Vor-Trade Anti-Tilt-Schutz ab 0 €.",
    "seo.tradezella-vs-edgewonk.s1.title": "TradeZella vs Edgewonk: Workflow und Broker-Synchronisation",
    "seo.tradezella-vs-edgewonk.s1.body": "TradeZella bietet Cloud-Sync gegen teure monatliche Gebuehren. Edgewonk ist langfristig guenstiger, erfordert jedoch zeitraubende manuelle Imports. AUREUS OS liefert nahtlose Nur-Lese-Sync via FX Blue mit SHA-256 Notarsiegel bereits im kostenlosen Basisplan.",
    "seo.tradezella-vs-edgewonk.s2.title": "Chart-Replay gegen Psychologie und Tilt-Kontrolle",
    "seo.tradezella-vs-edgewonk.s2.body": "TradeZella glaenzt beim visuellen Replay mit passiven Notizen; Edgewonk trackt Tilt, bietet jedoch kein Kerzen-Replay. AUREUS vereint Die Schmiede der Vergangenheit (M5-D1 Replay auf Dukascopy/Binance-Daten) und Den Hueter der Schwelle (aktiver Pre-Trade Circuit-Breaker).",
    "seo.tradezella-vs-edgewonk.s3.title": "Das Souveraene Modell: Keine Fixkosten und 20% Royalty",
    "seo.tradezella-vs-edgewonk.s3.body": "Weder TradeZella noch Edgewonk belohnen disziplinierte Trader. AUREUS belohnt Bestaendigkeit mit kostenlosem Journal-Zugang und einem Expansionsmandat mit 20% wiederkehrender Verguetung.",
    "seo.tradezella-vs-edgewonk.faq.q1": "Was ist der Hauptunterschied zwischen TradeZella und Edgewonk?",
    "seo.tradezella-vs-edgewonk.faq.a1": "TradeZella ist eine Web-App mit Replay und Monatsabo (29-49 $/Monat); Edgewonk ist auf MAE/MFE und Psychologie fokussiert mit Jahreslizenz und manuellem Import. AUREUS OS vereint beide Welten ab 0 €.",
    "seo.tradezella-vs-edgewonk.faq.q2": "Welche Plattform schuetzt besser vor Tilt und emotionalen Fehlern?",
    "seo.tradezella-vs-edgewonk.faq.a2": "Edgewonk erfasst Fehler erst im Nachhinein. AUREUS PROTOCOL fuehrt Den Hueter der Schwelle ein, der Revenge-Trading und uebergrosse Lots physisch vor der Ordererteilung blockiert.",
    "seo.tradezella-vs-edgewonk.faq.q3": "Kann AUREUS PROTOCOL sowohl TradeZella als auch Edgewonk ersetzen?",
    "seo.tradezella-vs-edgewonk.faq.a3": "Ja. AUREUS vereint MT4/MT5-Sync, Kerzen-Replay, Positionsgroessenrechner, bio-emotionale Telemetrie und SHA-256 Notarsiegel in einem Cockpit.",
    "seo.tradezella-vs-edgewonk.cta.title": "Waehle den Souveraenen Weg: Teste AUREUS PROTOCOL",
    "seo.tradezella-vs-edgewonk.cta.body": "Entscheide dich nicht zwischen teuren Abos und manueller Tipparbeit. Vereine Journal, Replay und Risiko-Firewall in einem Cockpit ab 0 €.",
  },
};

for (const lang of ["it", "en", "es", "fr", "de"]) {
  const filePath = path.join(DICT_DIR, `dict.${lang}.ts`);
  let content = fs.readFileSync(filePath, "utf-8");

  // Format keys
  const linesToAdd: string[] = [];
  for (const [k, v] of Object.entries(keysData[lang])) {
    // Check if key already exists
    if (!content.includes(`"${k}":`)) {
      linesToAdd.push(`  "${k}": ${JSON.stringify(v)},`);
    }
  }

  if (linesToAdd.length > 0) {
    const target = "};\n\nexport default dict;";
    const replacement = linesToAdd.join("\n") + "\n" + target;
    if (content.includes(target)) {
      content = content.replace(target, replacement);
    } else {
      // Try alt ending
      const altTarget = "};";
      const lastIndex = content.lastIndexOf(altTarget);
      if (lastIndex !== -1) {
        content = content.slice(0, lastIndex) + linesToAdd.join("\n") + "\n" + content.slice(lastIndex);
      }
    }
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`Updated dict.${lang}.ts with ${linesToAdd.length} keys`);
  } else {
    console.log(`dict.${lang}.ts already has all keys`);
  }
}
