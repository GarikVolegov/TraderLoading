import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { apiJSON } from "@/lib/apiFetch";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { COMMUNITY_EMOJIS } from "./constants";

export function CreateCommunityModal({
  onClose,
  currentUserId,
}: {
  onClose: () => void;
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🏛️");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Il nome è obbligatorio");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiJSON("community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          iconEmoji: emoji,
        }),
      });
      qc.invalidateQueries({ queryKey: ["communities"] });
      onClose();
    } catch {
      setError("Errore durante la creazione");
    } finally {
      setLoading(false);
    }
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const { titleId, panelProps } = useDialogA11y({ isOpen: true, onClose, panelRef });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        ref={panelRef}
        {...panelProps}
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id={titleId} className="font-bold text-base">{uiText("auto.ui.5fff6009cd")}</h2>
          <button
            onClick={onClose}
            aria-label={uiText("common.close")}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Icona
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all border ${emoji === e ? "border-primary bg-primary/10 scale-110" : "border-border hover:border-primary/40"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Nome *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder={uiText("auto.ui.4b6bb9f3ee")}
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">{uiText("auto.ui.07dfa30eec")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder={uiText("auto.ui.4f747c4d42")}
              className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50 resize-none"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {loading ? "Creazione..." : "Crea Community"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
