import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchTorneiWallet,
  saveTorneiWallet,
  torneiWalletKey,
  EVM_ADDRESS_RE,
} from "@/lib/torneiApi";

export function WalletSettings() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState("");

  const walletQuery = useQuery({ queryKey: torneiWalletKey(), queryFn: () => fetchTorneiWallet() });

  useEffect(() => {
    if (walletQuery.data) setValue(walletQuery.data.walletAddress ?? "");
  }, [walletQuery.data]);

  const trimmed = value.trim();
  const invalid = trimmed !== "" && !EVM_ADDRESS_RE.test(trimmed);

  const save = useMutation({
    mutationFn: () => saveTorneiWallet(trimmed),
    onSuccess: (res) => {
      if (res.ok) {
        toast({ title: t("tornei.wallet.saved") });
        qc.invalidateQueries({ queryKey: torneiWalletKey() });
      } else {
        toast({ title: t("tornei.wallet.invalid"), variant: "destructive" });
      }
    },
    onError: () => toast({ title: t("tornei.wallet.invalid"), variant: "destructive" }),
  });

  return (
    <div className="tl-panel rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-accent-jade-soft" />
        <h2 className="text-base font-bold">{t("tornei.wallet.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("tornei.wallet.desc")}</p>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("tornei.wallet.placeholder")}
        spellCheck={false}
        autoComplete="off"
      />
      {invalid && <p className="text-xs text-red-400">{t("tornei.wallet.invalid")}</p>}
      <Button onClick={() => save.mutate()} disabled={save.isPending || invalid} className="w-full justify-center">
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {t("tornei.wallet.save")}
      </Button>
    </div>
  );
}
