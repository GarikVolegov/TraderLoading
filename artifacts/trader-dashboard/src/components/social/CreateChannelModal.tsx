import { useState } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { X, Hash, Volume2 } from "lucide-react";
import { apiJSON } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";

export function CreateChannelModal({
  communityId,
  onClose,
}: {
  communityId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await apiJSON(`community/${communityId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      qc.invalidateQueries({ queryKey: ["community", communityId] });
      onClose();
    } catch (error) {
      reportClientError(error, {
        context: "community channel create",
        notify: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base">{uiText("auto.ui.0a38396995")}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["text", "voice"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
              >
                {t === "text" ? (
                  <Hash className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
                <span className="text-xs font-semibold">
                  {t === "text" ? "Testo" : "Voce"}
                </span>
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder={
              type === "text" ? "es. analisi-tecnica" : "es. Sala Vocale"
            }
            className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creazione..." : "Crea canale"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
