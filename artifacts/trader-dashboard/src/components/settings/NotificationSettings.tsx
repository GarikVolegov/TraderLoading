import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bell, ShieldAlert, Siren } from "lucide-react";
import { useGetUserSettings, useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage, uiText } from "@/contexts/LanguageContext";
import { ScheduledCallsSettings } from "@/components/ScheduledCallsSettings";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getNotificationCopy, NOTIFICATION_PREF_ORDER } from "@/lib/notifications";

export function NotificationSettings() {
  const { data: settings, isLoading } = useGetUserSettings();
  // The save handler's own catch already shows its own toast below — opt out
  // of App.tsx's global mutation-error toast to avoid a double toast.
  const updateMutation = useUpdateUserSettings({ mutation: { meta: { suppressGlobalError: true } } });
  const qc = useQueryClient();
  const { toast } = useToast();
  const { language } = useLanguage();
  const notificationCopy = getNotificationCopy(language);
  const push = usePushNotifications();
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const [reminderTime, setReminderTime] = useState("");
  const [preMacro, setPreMacro] = useState("15");
  const [maxLoss, setMaxLoss] = useState("");
  const [rgStreak, setRgStreak] = useState("");
  const [rgTrades, setRgTrades] = useState("");
  const [rgLossR, setRgLossR] = useState("");
  const ui = {
    it: {
      saved: "Impostazioni notifiche salvate.",
      saveError: "Errore nel salvataggio.",
      pushOff: "Notifiche push disattivate.",
      pushOn: "Notifiche push attivate.",
      pushUnavailable:
        "Notifiche push non configurate sul server. Gli avvisi in-app restano attivi.",
      deniedToast:
        "Permesso notifiche negato. Abilita dalle impostazioni del browser.",
      title: "Notifiche Push",
      unsupported: "Le notifiche push non sono supportate da questo browser.",
      denied:
        "Il permesso e stato negato. Abilita le notifiche dalle impostazioni del browser e ricarica la pagina.",
      background: "Notifiche in background",
      backgroundDesc: "Ricevi notifiche anche ad app chiusa.",
      choose: "Scegli cosa ricevere",
      alerts: "Promemoria e alert",
      dailyTime: "Orario promemoria giornaliero",
      dailyDesc:
        "Ricevi ogni giorno una notifica con il riepilogo delle missioni.",
      macroLead: "Anticipo alert eventi macro",
      macroDesc:
        "Quanto prima ricevere la notifica per eventi ad alto impatto.",
      maxLoss: "Max loss giornaliero",
      maxLossDesc: "Ricevi un avviso alla sessione se hai impostato un limite.",
      maxLossPlaceholder: "es. 200",
      rgTitle: "Soglie Risk guard",
      rgDesc: "Personalizza quando scatta il circuit-breaker. Vuoto = default.",
      rgStreak: "Perdite di fila",
      rgTrades: "Trade al giorno",
      rgLossR: "Perdita giorno (R)",
      save: "Salva",
    },
    en: {
      saved: "Notification settings saved.",
      saveError: "Save error.",
      pushOff: "Push notifications disabled.",
      pushOn: "Push notifications enabled.",
      pushUnavailable:
        "Push notifications are not configured on the server. In-app alerts remain active.",
      deniedToast:
        "Notification permission denied. Enable it in browser settings.",
      title: "Push Notifications",
      unsupported: "Push notifications are not supported by this browser.",
      denied:
        "Permission was denied. Enable notifications in browser settings and reload the page.",
      background: "Background notifications",
      backgroundDesc: "Receive notifications even when the app is closed.",
      choose: "Choose what to receive",
      alerts: "Reminders and alerts",
      dailyTime: "Daily reminder time",
      dailyDesc: "Receive a daily notification with your mission summary.",
      macroLead: "Macro event alert lead time",
      macroDesc: "How early to receive high-impact event alerts.",
      maxLoss: "Daily max loss",
      maxLossDesc: "Receive a session warning when you set a limit.",
      maxLossPlaceholder: "e.g. 200",
      rgTitle: "Risk guard thresholds",
      rgDesc: "Tune when the circuit-breaker fires. Empty = default.",
      rgStreak: "Losses in a row",
      rgTrades: "Trades per day",
      rgLossR: "Daily loss (R)",
      save: "Save",
    },
    es: {
      saved: "Ajustes de notificaciones guardados.",
      saveError: "Error al guardar.",
      pushOff: "Notificaciones push desactivadas.",
      pushOn: "Notificaciones push activadas.",
      pushUnavailable:
        "Las notificaciones push no estan configuradas en el servidor. Las alertas dentro de la app siguen activas.",
      deniedToast:
        "Permiso de notificaciones denegado. Activalo en el navegador.",
      title: "Notificaciones Push",
      unsupported: "Este navegador no admite notificaciones push.",
      denied:
        "Permiso denegado. Activa las notificaciones en el navegador y recarga la pagina.",
      background: "Notificaciones en segundo plano",
      backgroundDesc: "Recibe notificaciones incluso con la app cerrada.",
      choose: "Elige que recibir",
      alerts: "Recordatorios y alertas",
      dailyTime: "Hora del recordatorio diario",
      dailyDesc: "Recibe un resumen diario de tus misiones.",
      macroLead: "Anticipo de eventos macro",
      macroDesc: "Cuanto antes recibir alertas de alto impacto.",
      maxLoss: "Perdida maxima diaria",
      maxLossDesc: "Recibe un aviso de sesion cuando configures un limite.",
      maxLossPlaceholder: "ej. 200",
      rgTitle: "Umbrales del Risk guard",
      rgDesc: "Ajusta cuándo se activa el circuit breaker. Vacío = por defecto.",
      rgStreak: "Pérdidas seguidas",
      rgTrades: "Operaciones por día",
      rgLossR: "Pérdida diaria (R)",
      save: "Guardar",
    },
    fr: {
      saved: "Parametres de notifications enregistres.",
      saveError: "Erreur d'enregistrement.",
      pushOff: "Notifications push desactivees.",
      pushOn: "Notifications push activees.",
      pushUnavailable:
        "Les notifications push ne sont pas configurees sur le serveur. Les alertes dans l'app restent actives.",
      deniedToast: "Autorisation refusee. Activez-la dans le navigateur.",
      title: "Notifications Push",
      unsupported:
        "Ce navigateur ne prend pas en charge les notifications push.",
      denied:
        "Autorisation refusee. Activez les notifications dans le navigateur puis rechargez.",
      background: "Notifications en arriere-plan",
      backgroundDesc: "Recevez des notifications meme quand l'app est fermee.",
      choose: "Choisir quoi recevoir",
      alerts: "Rappels et alertes",
      dailyTime: "Heure du rappel quotidien",
      dailyDesc: "Recevez chaque jour un resume de vos missions.",
      macroLead: "Delai des evenements macro",
      macroDesc: "Quand recevoir les alertes a fort impact.",
      maxLoss: "Perte max quotidienne",
      maxLossDesc:
        "Recevez un avertissement de session si une limite est definie.",
      maxLossPlaceholder: "ex. 200",
      rgTitle: "Seuils du Risk guard",
      rgDesc: "Règle quand le circuit breaker se déclenche. Vide = défaut.",
      rgStreak: "Pertes d'affilée",
      rgTrades: "Trades par jour",
      rgLossR: "Perte du jour (R)",
      save: "Enregistrer",
    },
    de: {
      saved: "Benachrichtigungseinstellungen gespeichert.",
      saveError: "Fehler beim Speichern.",
      pushOff: "Push-Benachrichtigungen deaktiviert.",
      pushOn: "Push-Benachrichtigungen aktiviert.",
      pushUnavailable:
        "Push-Benachrichtigungen sind auf dem Server nicht konfiguriert. In-App-Hinweise bleiben aktiv.",
      deniedToast:
        "Benachrichtigungserlaubnis verweigert. Im Browser aktivieren.",
      title: "Push-Benachrichtigungen",
      unsupported: "Dieser Browser unterstuetzt keine Push-Benachrichtigungen.",
      denied:
        "Erlaubnis verweigert. Aktiviere Benachrichtigungen im Browser und lade neu.",
      background: "Hintergrundbenachrichtigungen",
      backgroundDesc: "Erhalte Benachrichtigungen auch bei geschlossener App.",
      choose: "Auswaehlen, was du erhalten willst",
      alerts: "Erinnerungen und Alerts",
      dailyTime: "Zeit der Tageserinnerung",
      dailyDesc: "Erhalte taeglich eine Zusammenfassung deiner Missionen.",
      macroLead: "Vorlauf fuer Makroevents",
      macroDesc: "Wie frueh du Alerts vor wichtigen Ereignissen erhaelst.",
      maxLoss: "Tages-Max-Loss",
      maxLossDesc: "Erhalte eine Session-Warnung, wenn ein Limit gesetzt ist.",
      maxLossPlaceholder: "z.B. 200",
      rgTitle: "Risk-Guard-Schwellen",
      rgDesc: "Lege fest, wann der Circuit Breaker auslöst. Leer = Standard.",
      rgStreak: "Verluste in Folge",
      rgTrades: "Trades pro Tag",
      rgLossR: "Tagesverlust (R)",
      save: "Speichern",
    },
  }[language];

  useEffect(() => {
    if (!settings) return;
    setReminderTime(settings.dailyReminderTime ?? "");
    setPreMacro(String(settings.preMacroMinutes ?? 15));
    setMaxLoss(settings.maxDailyLoss ? String(settings.maxDailyLoss) : "");
    setRgStreak(settings.riskGuard?.maxConsecutiveLosses != null ? String(settings.riskGuard.maxConsecutiveLosses) : "");
    setRgTrades(settings.riskGuard?.maxDailyTrades != null ? String(settings.riskGuard.maxDailyTrades) : "");
    setRgLossR(settings.riskGuard?.maxDailyLossR != null ? String(settings.riskGuard.maxDailyLossR) : "");
  }, [settings]);

  const save = async () => {
    try {
      await updateMutation.mutateAsync({
        data: {
          dailyReminderTime: reminderTime || undefined,
          preMacroMinutes: Number(preMacro),
          maxDailyLoss: maxLoss ? Number(maxLoss) : undefined,
          riskGuard: {
            maxConsecutiveLosses: rgStreak ? Number(rgStreak) : null,
            maxDailyTrades: rgTrades ? Number(rgTrades) : null,
            maxDailyLossR: rgLossR ? Number(rgLossR) : null,
          },
        },
      });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      toast({ description: ui.saved });
    } catch {
      toast({ description: ui.saveError, variant: "destructive" });
    }
  };

  const handleTogglePush = async () => {
    if (push.isSubscribed) {
      await push.unsubscribe();
      toast({ description: ui.pushOff });
    } else {
      setShowPushPrompt(true);
    }
  };

  const confirmPushActivation = async () => {
    setShowPushPrompt(false);
    const ok = await push.subscribe();
    if (ok) toast({ description: ui.pushOn });
    else if (
      push.permission === "denied" ||
      ("Notification" in window && Notification.permission === "denied")
    ) {
      toast({ description: ui.deniedToast, variant: "destructive" });
    } else {
      toast({ description: ui.pushUnavailable, variant: "destructive" });
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-4">
      <AlertDialog open={showPushPrompt} onOpenChange={setShowPushPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("auto.ui.98661e9e19")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Vuoi ricevere alert utili sulle sessioni, le missioni e gli
                eventi macro? Puoi scegliere quali notifiche ricevere e
                disattivarle in qualsiasi momento.
              </span>
              <span className="block">
                TraderLoading userà il permesso solo per avvisi operativi
                collegati alla tua routine, non per pubblicità.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{uiText("settings.push.not_now")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPushActivation}>
              Attiva notifiche
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Push notifications master toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-400" />
            {ui.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!push.isSupported && (
            <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              {ui.unsupported}
            </p>
          )}

          {push.isSupported && (
            <>
              {push.permission === "denied" && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {ui.denied}
                </p>
              )}

              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">{ui.background}</p>
                  <p className="text-xs text-muted-foreground">
                    {ui.backgroundDesc}
                  </p>
                </div>
                <Switch
                  checked={push.isSubscribed}
                  onCheckedChange={handleTogglePush}
                  disabled={push.loading || push.permission === "denied"}
                />
              </div>

              {push.isSubscribed && push.prefs && (
                <div className="space-y-1 pt-1 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 pb-1">
                    {ui.choose}
                  </p>
                  {NOTIFICATION_PREF_ORDER.map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 py-2 px-1 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {notificationCopy.prefs[key].label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {notificationCopy.prefs[key].description}
                        </span>
                      </span>
                      <Switch
                        checked={push.prefs[key]}
                        onCheckedChange={(v) => push.updatePref(key, v)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ScheduledCallsSettings />

      {/* Reminder & alert settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {ui.alerts}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{ui.dailyTime}</p>
            <p className="text-xs text-muted-foreground">{ui.dailyDesc}</p>
            <Input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{ui.macroLead}</p>
            <p className="text-xs text-muted-foreground">{ui.macroDesc}</p>
            <div className="flex gap-2">
              {["5", "10", "15", "30"].map((v) => (
                <button
                  key={v}
                  onClick={() => setPreMacro(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    preMacro === v
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {v} min
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              {ui.maxLoss} (EUR)
            </p>
            <p className="text-xs text-muted-foreground">{ui.maxLossDesc}</p>
            <Input
              type="number"
              min="0"
              placeholder={ui.maxLossPlaceholder}
              value={maxLoss}
              onChange={(e) => setMaxLoss(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="space-y-3 pt-1 border-t border-border">
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Siren className="w-4 h-4 text-destructive" />
                {ui.rgTitle}
              </p>
              <p className="text-xs text-muted-foreground">{ui.rgDesc}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">{ui.rgStreak}</span>
                <Input type="number" min="1" placeholder="3" value={rgStreak} onChange={(e) => setRgStreak(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">{ui.rgTrades}</span>
                <Input type="number" min="1" placeholder="6" value={rgTrades} onChange={(e) => setRgTrades(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">{ui.rgLossR}</span>
                <Input type="number" min="0.5" step="0.5" placeholder="3" value={rgLossR} onChange={(e) => setRgLossR(e.target.value)} />
              </label>
            </div>
          </div>

          <Button size="sm" onClick={save} disabled={updateMutation.isPending}>
            {ui.save}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Login Access History ─────────────────────────────────────────────────────
