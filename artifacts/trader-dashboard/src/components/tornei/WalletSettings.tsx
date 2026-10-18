import { useEffect, useRef, useState } from "react";
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
  const dirty = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const walletQuery = useQuery({ queryKey: torneiWalletKey(), queryFn: () => fetchTorneiWallet() });

  useEffect(() => {
    if (walletQuery.data && !dirty.current) setValue(walletQuery.data.walletAddress ?? "");
  }, [walletQuery.data]);

  const trimmed = value.trim();
  const invalid = trimmed !== "" && !EVM_ADDRESS_RE.test(trimmed);

  const save = useMutation({
    mutationFn: (submitted: string) => saveTorneiWallet(submitted),
    onSuccess: (res, submitted) => {
      if (res.ok) {
        // A delayed save/refetch must not erase a newer draft in the input.
        if (valueRef.current.trim() === submitted) {
          dirty.current = false;
          setValue(res.walletAddress ?? "");
        }
        toast({ title: t("tornei.wallet.saved") });
        qc.invalidateQueries({ queryKey: torneiWalletKey() });
      } else {
        toast({ title: t(res.status === 400 ? "tornei.wallet.invalid" : "errors.mutation.generic"), variant: "destructive" });
      }
    },
    onError: () => toast({ title: t("errors.mutation.generic"), variant: "destructive" }),
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
        onChange={(e) => { dirty.current = true; setValue(e.target.value); }}
        aria-label={t("tornei.wallet.title")}
        aria-invalid={invalid}
        placeholder={t("tornei.wallet.placeholder")}
        spellCheck={false}
        autoComplete="off"
      />
      {invalid && <p className="text-xs text-red-400">{t("tornei.wallet.invalid")}</p>}
      <Button onClick={() => save.mutate(trimmed)} disabled={save.isPending || invalid} className="w-full justify-center">
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {t("tornei.wallet.save")}
      </Button>
    </div>
  );
}
