import { CalendarDays } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { CalendarPlannerWorkspace } from "@/components/dashboard-workspaces/CalendarPlannerWorkspace";

export default function Calendar() {
  return (
    <PageLayout>
      <PageHeader
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <CalendarDays className="h-4.5 w-4.5" />
          </div>
        }
        title="Calendario Avanzato"
        subtitle="Agenda, appuntamenti, obiettivi ed eventi macro di mercato"
      />
      <CalendarPlannerWorkspace />
    </PageLayout>
  );
}
