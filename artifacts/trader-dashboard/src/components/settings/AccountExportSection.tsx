import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export function AccountExportSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-5 h-5 text-primary" />
          Esporta dati
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scarica un file JSON con profilo, preferenze, journal, routine,
          backtest e dati trading collegati al tuo account. Segreti broker,
          password e log interni di sicurezza non vengono inclusi.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            window.location.href = "/api/account/export";
          }}
        >
          <FileText className="w-4 h-4" />
          Esporta dati
        </Button>
      </CardContent>
    </Card>
  );
}
