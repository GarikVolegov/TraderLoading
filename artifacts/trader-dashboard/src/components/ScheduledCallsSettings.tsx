import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetUserSettingsQueryKey, useGetUserSettings, useUpdateUserSettings } from "@workspace/api-client-react";
import { BellRing, Copy, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  createDefaultScheduledCall,
  parseScheduledCalls,
  serializeScheduledCalls,
  type ScheduledCallConfig,
  type ScheduledCallRingtone,
  type ScheduledCallVibration,
  type ScheduledCallVisualPreset,
} from "@/lib/scheduledCalls";
import { ScheduledCallOverlay } from "./ScheduledCallOverlay";
import { uiText } from "@/contexts/LanguageContext";

const DAYS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Gio" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sab" },
  { id: 0, label: "Dom" },
];

const PRESETS: ScheduledCallVisualPreset[] = ["bank", "broker", "risk", "custom"];
const RINGTONES: ScheduledCallRingtone[] = ["institutional", "digital", "gentle", "pulse"];
const VIBRATIONS: ScheduledCallVibration[] = ["standard", "urgent", "silent"];

function updateCall(calls: ScheduledCallConfig[], id: string, patch: Partial<ScheduledCallConfig>): ScheduledCallConfig[] {
  return calls.map((call) => (call.id === id ? { ...call, ...patch } : call));
}

export function ScheduledCallsSettings() {
  const { data: settings } = useGetUserSettings();
  const updateSettings = useUpdateUserSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const push = usePushNotifications();
  const [calls, setCalls] = useState<ScheduledCallConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewCall, setPreviewCall] = useState<ScheduledCallConfig | null>(null);

  useEffect(() => {
    const parsed = parseScheduledCalls(settings?.alarmConfigs);
    setCalls(parsed);
    setSelectedId((current) => current ?? parsed[0]?.id ?? null);
  }, [settings?.alarmConfigs]);

  const selected = useMemo(
    () => calls.find((call) => call.id === selectedId) ?? calls[0] ?? null,
    [calls, selectedId],
  );

  const saveCalls = async (nextCalls: ScheduledCallConfig[]) => {
    setCalls(nextCalls);
    await updateSettings.mutateAsync({
      data: { alarmConfigs: JSON.parse(serializeScheduledCalls(nextCalls)) },
    });
    await queryClient.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
    toast({ description: "Chiamate programmate salvate." });
  };

  const addCall = async () => {
    const next = createDefaultScheduledCall({ id: `call-${Date.now().toString(36)}` });
    setSelectedId(next.id);
    await saveCalls([...calls, next]);
  };

  const patchSelected = (patch: Partial<ScheduledCallConfig>) => {
    if (!selected) return;
    setCalls((current) => updateCall(current, selected.id, patch));
  };

  const persistSelected = async () => {
    await saveCalls(calls);
  };

  const duplicateSelected = async () => {
    if (!selected) return;
    const copy = { ...selected, id: `call-${Date.now().toString(36)}`, callerName: `${selected.callerName} Copy` };
    setSelectedId(copy.id);
    await saveCalls([...calls, copy]);
  };

  const deleteSelected = async () => {
    if (!selected) return;
    const next = calls.filter((call) => call.id !== selected.id);
    setSelectedId(next[0]?.id ?? null);
    await saveCalls(next);
  };

  const toggleDay = (day: number) => {
    if (!selected) return;
    const hasDay = selected.days.includes(day);
    patchSelected({ days: hasDay ? selected.days.filter((value) => value !== day) : [...selected.days, day].sort() });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber-300" />
            Chiamate programmate
          </span>
          <Button size="sm" onClick={addCall} isLoading={updateSettings.isPending}>
            <Plus className="h-4 w-4" />
            Aggiungi
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-muted-foreground">
          Fuori dall'app il browser mostra una push personalizzata; quando la apri compare la chiamata con design banca.
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
          <span className="text-sm">
            Push esterne
            <span className="block text-xs text-muted-foreground">
              {push.isSubscribed ? "Dispositivo registrato" : "Attiva le push sopra per riceverle fuori dall'app"}
            </span>
          </span>
          <Switch checked={push.isSubscribed} onCheckedChange={() => void (push.isSubscribed ? push.unsubscribe() : push.subscribe())} />
        </div>

        {calls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {calls.map((call) => (
              <button
                key={call.id}
                onClick={() => setSelectedId(call.id)}
                className={`min-w-[10rem] rounded-lg border px-3 py-2 text-left text-sm transition ${
                  call.id === selected?.id ? "border-amber-300/60 bg-amber-300/10" : "border-border/50 bg-secondary/25"
                }`}
              >
                <span className="block truncate font-semibold">{call.callerName}</span>
                <span className="block text-xs text-muted-foreground">{call.time} - {call.days.length ? `${call.days.length} giorni` : "Ogni giorno"}</span>
              </button>
            ))}
          </div>
        )}

        {!selected ? (
          <div className="rounded-lg border border-dashed border-border/50 py-8 text-center text-sm text-muted-foreground">
            Crea la prima chiamata programmata.
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">{uiText("auto.ui.97ec36f1ec")}</label>
              <Switch checked={selected.enabled} onCheckedChange={(enabled) => patchSelected({ enabled })} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                Nome chiamante
                <Input value={selected.callerName} onChange={(event) => patchSelected({ callerName: event.target.value })} />
              </label>
              <label className="space-y-1.5 text-sm">
                Reparto
                <Input value={selected.department} onChange={(event) => patchSelected({ department: event.target.value })} />
              </label>
              <label className="space-y-1.5 text-sm">
                Titolo push
                <Input value={selected.notificationTitle} onChange={(event) => patchSelected({ notificationTitle: event.target.value })} />
              </label>
              <label className="space-y-1.5 text-sm">{uiText("auto.ui.9386b1dfe1")}<Input type="time" value={selected.time} onChange={(event) => patchSelected({ time: event.target.value })} />
              </label>
            </div>

            <label className="space-y-1.5 text-sm">
              Messaggio push
              <Input value={selected.notificationBody} onChange={(event) => patchSelected({ notificationBody: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm">
              Messaggio chiamata
              <Input value={selected.callMessage} onChange={(event) => patchSelected({ callMessage: event.target.value })} />
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium">{uiText("auto.ui.2ff1f1cfe6")}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    className={`h-9 rounded-md border text-xs font-bold transition ${
                      selected.days.includes(day.id) ? "border-amber-300/70 bg-amber-300/15 text-amber-200" : "border-border/50 text-muted-foreground"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-sm">
                Preset
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selected.visualPreset} onChange={(event) => patchSelected({ visualPreset: event.target.value as ScheduledCallVisualPreset })}>
                  {PRESETS.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                ringtone
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selected.ringtone} onChange={(event) => patchSelected({ ringtone: event.target.value as ScheduledCallRingtone })}>
                  {RINGTONES.map((ringtone) => <option key={ringtone} value={ringtone}>{ringtone}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                vibration
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selected.vibration} onChange={(event) => patchSelected({ vibration: event.target.value as ScheduledCallVibration })}>
                  {VIBRATIONS.map((vibration) => <option key={vibration} value={vibration}>{vibration}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-sm">
                accentColor
                <Input type="color" value={selected.accentColor} onChange={(event) => patchSelected({ accentColor: event.target.value })} />
              </label>
              <label className="space-y-1.5 text-sm">
                Logo
                <Input value={selected.logoText ?? ""} maxLength={4} onChange={(event) => patchSelected({ logoText: event.target.value })} />
              </label>
              <label className="space-y-1.5 text-sm">
                Snooze min
                <Input type="number" min="0" max="120" value={selected.snoozeMins} onChange={(event) => patchSelected({ snoozeMins: Number(event.target.value) })} />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">{uiText("auto.ui.e3c8ef7152")}</label>
              <Switch checked={selected.requireInteraction} onCheckedChange={(requireInteraction) => patchSelected({ requireInteraction })} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={persistSelected} isLoading={updateSettings.isPending}>{uiText("auto.ui.c5965db5f2")}</Button>
              <Button size="sm" variant="outline" onClick={() => setPreviewCall(selected)}>
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button size="sm" variant="outline" onClick={duplicateSelected}>
                <Copy className="h-4 w-4" />
                Duplica
              </Button>
              <Button size="sm" variant="destructive" onClick={deleteSelected}>
                <Trash2 className="h-4 w-4" />{uiText("auto.ui.6b177bdf78")}</Button>
            </div>
          </div>
        )}
      </CardContent>
      <ScheduledCallOverlay call={previewCall} onDismiss={() => setPreviewCall(null)} onSnooze={() => setPreviewCall(null)} />
    </Card>
  );
}
