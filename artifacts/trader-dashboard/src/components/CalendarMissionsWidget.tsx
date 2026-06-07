import { useMemo } from "react";
import { format, startOfWeek, addDays, isToday, isPast, isFuture } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, CheckCircle2, Circle, LayoutGrid } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGetMissions, useGetMissionTemplates } from "@workspace/api-client-react";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function CalendarMissionsWidget() {
  const { data: missions, isLoading: missionsLoading } = useGetMissions();
  const { data: templates, isLoading: templatesLoading } = useGetMissionTemplates();

  const weekDays = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, []);

  const isLoading = missionsLoading || templatesLoading;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-secondary/10">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="w-4 h-4 text-primary" />
          Calendario Missioni — Settimana
        </CardTitle>
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        {isLoading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-5 rounded bg-secondary/40 animate-pulse" />
                <div className="h-14 rounded-lg bg-secondary/30 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDays.map((day, i) => {
              const today = isToday(day);
              const past = isPast(day) && !today;

              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className={`text-center text-[10px] sm:text-xs font-semibold pb-1 border-b ${
                    today
                      ? "text-primary border-primary/40"
                      : "text-muted-foreground/60 border-border/30"
                  }`}>
                    <div>{DAY_LABELS[i]}</div>
                    <div className={`text-[9px] sm:text-[10px] font-normal mt-0.5 ${today ? "text-primary/70" : "text-muted-foreground/40"}`}>
                      {format(day, "d MMM", { locale: it })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 min-h-[80px]">
                    {today ? (
                      missions && missions.length > 0 ? (
                        missions.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded-md px-1.5 py-1 text-[9px] sm:text-[10px] leading-tight flex items-start gap-1 transition-colors ${
                              m.completed
                                ? "bg-primary/15 border border-primary/30 text-primary/80"
                                : "bg-secondary/50 border border-border/40 text-foreground/70"
                            }`}
                          >
                            {m.completed ? (
                              <CheckCircle2 className="w-2.5 h-2.5 shrink-0 mt-px text-primary" />
                            ) : (
                              <Circle className="w-2.5 h-2.5 shrink-0 mt-px text-muted-foreground" />
                            )}
                            <span className="line-clamp-2">{m.title}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[9px] text-muted-foreground/40 text-center pt-2">Nessuna missione</p>
                      )
                    ) : isFuture(day) ? (
                      templates && templates.length > 0 ? (
                        templates.slice(0, 3).map((t) => (
                          <div
                            key={t.id}
                            className="rounded-md px-1.5 py-1 text-[9px] sm:text-[10px] leading-tight bg-secondary/20 border border-border/20 text-muted-foreground/50"
                          >
                            <span className="line-clamp-2">{t.title}</span>
                          </div>
                        ))
                      ) : null
                    ) : (
                      <div className="flex items-center justify-center h-full opacity-20">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary/70" />
            <span className="text-[10px] text-muted-foreground/60">Completata</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary/70 border border-border" />
            <span className="text-[10px] text-muted-foreground/60">In corso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary/30 border border-border/40" />
            <span className="text-[10px] text-muted-foreground/60">Prossime</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
