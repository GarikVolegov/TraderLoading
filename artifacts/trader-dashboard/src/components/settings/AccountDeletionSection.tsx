import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uiText } from "@/contexts/LanguageContext";
import { reportClientError } from "@/lib/clientErrorReporter";

export function AccountDeletionSection({ onDeleted }: { onDeleted: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmation.trim().toUpperCase() === "ELIMINA";

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Non siamo riusciti a eliminare l'account.",
        );
      }
      toast({ description: "Account eliminato. I dati collegati sono stati rimossi." });
      setOpen(false);
      onDeleted();
    } catch (error) {
      reportClientError(error, {
        context: "account deletion",
        fallbackMessage:
          "Non siamo riusciti a eliminare l'account. Contatta il supporto.",
        toast,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/35 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <Trash2 className="w-5 h-5" />
          Elimina account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Cancella profilo, diario, dati di trading, notifiche, social, chat e
          connessioni broker collegate al tuo account. Alcuni log tecnici minimi
          possono restare per sicurezza, antifrode o obblighi legali.
        </p>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <Button
            type="button"
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Elimina account
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{uiText("auto.ui.f5e7dd8614")}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <span className="block">
                  Questa azione elimina in modo permanente profilo, preferenze,
                  journal, immagini, backtest, messaggi, notifiche push e
                  connessioni broker salvate.
                </span>
                <span className="block">
                  {uiText("settings.delete.confirm_before")} <span className="font-mono text-foreground">{uiText("settings.delete.confirm_token")}</span>.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={uiText("auto.ui.d4d34d9f18")}
              aria-label={uiText("auto.ui.527bbda0b4")}
              autoComplete="off"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{uiText("auto.ui.6c3de5381b")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={!canDelete || deleting}
                onClick={(event) => {
                  event.preventDefault();
                  void handleDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Eliminazione..." : "Elimina definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
