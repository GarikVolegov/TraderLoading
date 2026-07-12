# Pre-launch page audit — piano di sistemazione a step (2026-07-11)

> **STATO (2026-07-12): FASI 1-4 COMPLETATE.** Fase 1 bug fix `ccbae77`. Fase 2 GDPR/legal/landing
> `741efdb`. Fase 3 i18n sweep (batch A/B/C1/C2) `9aed0bb`+`58cde17`+`cbf9d9d`+`66ee137` — 96+ nuove
> chiavi `auto.ui.*` in 5 lingue, verificate hash-esatte + accenti ES/FR/DE. Fase 4 mobile reachability
> + igiene minore `011771c`. Gate: typecheck ✓, 360/360 test ✓, parity 2301 chiavi × 5 lingue ✓.
> **Resta solo Fase 5** (smoke Playwright manuale) — nessun blocco noto, item di verifica finale.

> Audit pagina-per-pagina del frontend (tutte le ~24 pagine app + landing/auth/legal/admin/shell)
> in ottica "app pronta al pubblico". 3 agenti di esplorazione in parallelo + verifica manuale dei
> finding critici sul codice. **Non** ri-elenca ciò che l'audit di luglio (229 finding) ha già chiuso.
> Ogni finding qui sotto è stato verificato con riga di codice reale; i falsi positivi degli agenti
> sono stati scartati (v. "Scartati" in fondo).

## Sintesi

- **0 blocker architetturali** trovati: le fondamenta (auth, error boundary, routing, SEO, pivot
  marketplace, gating admin) sono a posto.
- **~10 bug reali** piccoli ma user-visible (label invertita, crash potenziale su JSON.parse,
  mutazione cache, fallback irraggiungibili, stati mancanti).
- **Il debito più grosso è i18n**: cluster estesi di italiano hardcoded in ~12 pagine — un utente
  EN/ES/FR/DE vede italiano in metà app. Più 2 gap GDPR/legal sulla superficie pubblica.
- **3 pagine irraggiungibili da mobile** (/clock del tutto; /library e /news senza entry globale).

---

## FASE 1 — Bug fix (correttezza, ordine di impatto)

Ogni item è piccolo e indipendente; TDD dove c'è logica pura.

1. **Broker: label stato trading invertita** — `components/broker-hub/BrokerHubWorkspace.tsx:88`
   `profile.tradingEnabled ? "Trading non disponibile" : "Trading bloccato"` → entrambi i rami
   negativi. Fix: `tradingEnabled ? "Trading attivo" : "Trading bloccato"` + chiavi i18n.
   Già che ci si è: riga 42 `format(Number(value))` renderizza `NaN` su metrica mancante → guard.
2. **Milestones: `JSON.parse(milestone.skills)` non guardato** — `pages/Milestones.tsx:343,666-668`.
   Dato malformato = crash del render. Fix: helper `parseSkills` con try/catch (stesso pattern di
   `Library.parseTags`).
3. **Chiamate/registrazioni Chat: cleanup su unmount** — `components/social/MessaggiTab.tsx:492-541`.
   Uscendo dalla pagina a chiamata attiva restano vivi mic, `RTCPeerConnection`, recorder e timer
   (solo il poll dei segnali viene pulito). Privacy + leak. Fix: effect di teardown che chiude
   stream/pc/recorder/timers.
4. **Stati errore ≠ stati vuoti** — Journal.tsx:277-291, Backtest.tsx:565-578, Wiki.tsx:46-57,
   Library.tsx:277, News.tsx:814-856: un fallimento API mostra l'empty state "non hai dati"
   (per un utente pagante sembra perdita dati). Fix: ramo `isError` con messaggio + retry
   (`refetch`); valutare un piccolo componente condiviso `QueryErrorState`.
5. **BillingReturn: manca lo stato annullato/fallito** — `pages/BillingReturn.tsx:77-109`. Senza
   pagamento completato l'utente resta su "in elaborazione" indefinito. Fix: dopo il timeout 30s
   (e/o su query param di cancel) messaggio chiaro "pagamento non completato" + CTA riprova/torna.
6. **ChannelUnlockPanel: spinner infinito** — `components/social/ChannelUnlockPanel.tsx:46-52`.
   `disabled={isPending || isSuccess}`: se il checkout risolve senza `url` il bottone resta
   disabilitato per sempre. Fix: se manca `url` → toast errore + reset.
7. **Sync lingua cross-device rotto (solo scrittura)** — App.tsx:265-281 `LanguageServerSync`
   scrive la lingua client nei settings a ogni load, ma nessuno rilegge `settings.language`:
   un nuovo device sovrascrive silenziosamente la preferenza salvata. Fix: al bootstrap, se non
   c'è preferenza locale esplicita, applicare quella del server prima di scrivere.
8. **Tornei: fallback errore enroll irraggiungibile** — `pages/Tornei.tsx:59` ternario
   sempre-vero → può mostrare la raw key. Fix: `const title = t(key); title === key ? t("…generic") : title`.
9. **ZenZone MoodCheckIn: feedback finto** — `components/routine/ZenZone.tsx:142-179`: mostra
   "mood registrato" ma non persiste nulla. Fix minimo: persistere in localStorage con il pattern
   versionato di `Routine.storage.ts` (`_v1`); in alternativa rimuovere la copy "registrato".
10. **Journal: `.sort()` muta la cache React Query** — `pages/Journal.tsx:198-199` → `[...entries].sort(…)`.
11. **Chat: sostituire lo shim auth legacy** — `pages/Chat.tsx:9,21`: `@workspace/replit-auth-web`
    funziona (il backend shimma Clerk) ma fa una fetch auth ridondante a ogni mount e, su fetch
    fallita, mostra una CTA login → `/api/login` OIDC morto (503 in prod). Fix: Clerk `useUser()`
    come già fatto in Settings; estendere il divieto d'import di `Settings.auth.static.test.ts`
    anche a Chat. (Verificato: NON è un blocker — Chat monta solo dentro `Show when="signed-in"`.)
12. **News: irrobustire il test dei filtri** — `News.filters.static.test.ts:8-12` è grep-only
    (passerebbe anche a feature scollegata). Il filtro OGGI funziona (verificato: render a
    News.tsx:816-817, lista su `filteredArticles` a 849-852), ma il test va ancorato al wiring
    (es. assert che il blocco lista referenzi `filteredArticles.map`).

## FASE 2 — Superficie pubblica / conformità (pre-lancio)

1. **Cookie banner: manca "Rifiuta" + copy solo italiana** — `components/CookieConsentPopup.tsx:21-41`.
   Con `VITE_GA_MEASUREMENT_ID` attivo un banner accept-only non è GDPR-ok. Fix: bottone
   rifiuta (GA resta spento), copy via `t()` in 5 lingue.
2. **Pagine legali solo in italiano, senza SEO** — `pages/LegalPage.tsx:9,135-185`: corpo
   hardcoded IT, H1 misto ("Privacy Policy" vs "Termini di Servizio"), `UPDATED_AT` italiana,
   nessun `<Seo>`/canonical. Fix minimo lancio: EN + IT via i18n, `<Seo>` con canonical.
3. **Landing mobile: Sign-in nascosto <640px** — `LandingPage.tsx:1035-1040` (`hidden sm:block`):
   l'utente di ritorno da telefono non trova l'accesso. Fix: mostrare anche su mobile (o icona).
4. **Footer: link "Blog" e "Status" puntano entrambi a /guide** — `LandingPage.tsx:210,212`:
   etichette fuorvianti. Fix: rimuoverli finché non esistono le pagine reali (il blog pubblico è
   la Fase 2 SEO/GEO, spec separata). Social icons decorativi non-link (1474-1478): idem.
5. *(opzionale)* Soft-404: path root EN sconosciuto da signed-out renderizza la landing invece di
   NotFound — App.tsx:560. Basso impatto, decidere se vale il cambio.

## FASE 3 — Sweep i18n (il debito più grosso, meccanico)

Cluster di italiano hardcoded in UI renderizzata, pagina per pagina (aggiungere chiavi a TUTTE e
5 le lingue; attenti al test mojibake per il francese; date via `useDateLocale()`):

- **News.tsx** — label impatto ALTO/MEDIO/BASSO, freshness Live/Nuova/…, label opzioni filtro
  (124-135), "Aggiornamento tra", sezioni deep-dive, "Apri articolo", "Perché rilevante", ecc.
- **Backtest.tsx** — ~20 stringhe/toast ("Sessione creata.", "Replay Grafico", StatBox, empty
  state) **+ date-fns locale `it` fisso (righe 5,452,633)** → usare il locale dell'utente.
- **Chat cluster** — CommunityTab (143-463), MessaggiTab (605-939 + `toLocaleTimeString("it-IT")`
  a 566), SocialTab (143-344).
- **Dashboard.tsx** — WIDGET_DEFS labels 77-88 (finiscono anche negli `aria-label`), tooltip
  274/450/461.
- **Clock.tsx** — 92,95,106,112,155,157. · **Library.tsx** — 40-42,107-396 (form admin + feed).
- **Milestones.tsx** — editor admin + label utente (438-1009) + data certificato `it-IT` (171).
- **Missions.tsx** — toast level-up/labels (56-206). · **Settings.tsx** — tile 159-160,250-324.
- **Routine.tsx/ZenZone** — MOODS (134-140), ProgramCard/quote (55-156).
- **Journal.tsx** — "Commenta" (266), stringhe ICS (449-450,525). · **Support.tsx:41** locale
  mancante. · **BrokerHubWorkspace** — 74-107.
- Dopo ogni pagina ripulita: valutare l'aggiunta del file al perimetro del production-copy test
  per blindarla contro regressioni.

## FASE 4 — UX / mobile

1. **Raggiungibilità mobile**: `/clock` orfana (zero link in-app, solo Cmd+K desktop), `/library`
   e `/news` senza entry globale mobile — `BottomNav.tsx:16-29`, `CommandPalette.tsx:42-51`.
   Decisione prodotto: aggiungerle a un hub/overflow del BottomNav o dare al CommandPalette un
   trigger touch. (News è già widget Dashboard? verificare; Clock no.)
2. **Igiene minore**: `console.error` diretti → `reportClientError` (MessaggiTab 154-465,
   StoryViewer, VoiceChannelView); `URL.createObjectURL` mai revocato (MessaggiTab:895);
   toast errore mancanti su Checklist delete (41) e Library upload (164-172); reject-reason
   admin condiviso tra righe (AdminReviewsPage:97-104); flash italiano pre-caricamento dict
   lazy per utenti EN (i18n.ts:30-40 — valutare fallback EN o dict per-lingua nel prerender).

## FASE 5 — Verifica

- `pnpm verify` (gate) dopo ogni fase; suite attesa ≥348 verdi.
- Test nuovi: parseSkills guard, QueryErrorState, LanguageServerSync read-back, ternario Tornei,
  News.filters rafforzato, divieto import replit-auth-web esteso a Chat.
- Smoke manuale con il driver Playwright esistente (pattern `scripts/verify-nav-hubs/drive.mjs`):
  broker badge, error states (API spenta), cookie banner reject, mobile nav, BillingReturn cancel.
- **Reminder item solo-utente (fuori scope codice, già noti)**: GA4 measurement id, flag email
  lifecycle, merge PR #6 Sentry + rotazione token, QA visuale device, env Stripe/Payout.

## Scartati (falsi positivi degli agenti, verificati a mano)

- ~~"Filtro News è dead code"~~ — FALSO: i `SegmentedControl` sono renderizzati (News.tsx:816-817)
  e la lista mappa `filteredArticles` (849-852). Resta solo il test debole (Fase 1.12).
- ~~"Chat inaccessibile: auth Replit vs Clerk = launch blocker"~~ — FALSO: `authMiddleware`
  backend shimma `req.isAuthenticated()`/`req.user` da Clerk, quindi `/api/auth/user` funziona;
  Chat monta solo da signed-in. Declassato a cleanup (Fase 1.11).

## Pagine risultate pulite

Calendar, Tornei views, JournalOverview/EdgeQualityCard/RiskOfRuinCard, Wiki/archive components,
ProPage, Support, Checklist, CreatorPayoutSettings, ChannelPricingModal, NicknameOnboarding,
error boundary/Suspense/chunk-reload, hreflang/canonical/JSON-LD, gating admin, PWA safe-area,
hub overflow BottomNav. Zero console.log/TODO nel perimetro trading; zero residui UI del vecchio
modello crediti (pivot marketplace completo lato FE).
