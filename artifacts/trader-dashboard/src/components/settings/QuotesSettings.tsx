import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Quote, Sparkles, BookOpen } from "lucide-react";
import { useGetQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote, getGetQuotesQueryKey, getGetRandomQuoteQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { uiText } from "@/contexts/LanguageContext";

export function QuotesSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: quotes, isLoading } = useGetQuotes();
  const suppress = { mutation: { meta: { suppressGlobalError: true } } };
  const createMutation = useCreateQuote(suppress);
  const updateMutation = useUpdateQuote(suppress);
  const deleteMutation = useDeleteQuote(suppress);
  const [newText, setNewText] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editAuthor, setEditAuthor] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetQuotesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRandomQuoteQueryKey() });
  };

  const handleAdd = async () => {
    if (!newText.trim()) return;
    try {
      await createMutation.mutateAsync({
        data: { text: newText.trim(), author: newAuthor.trim() || undefined },
      });
      setNewText("");
      setNewAuthor("");
      invalidate();
      toast({ description: "Sentenza aggiunta all'archivio d'Ordine." });
    } catch {
      toast({ description: "Errore durante l'aggiunta.", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: { text: editText, author: editAuthor },
      });
      setEditingId(null);
      invalidate();
      toast({ description: "Sentenza aggiornata con successo." });
    } catch {
      toast({
        description: "Errore durante l'aggiornamento.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      invalidate();
      toast({ description: "Sentenza rimossa." });
    } catch {
      toast({
        description: "Errore durante l'eliminazione.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (q: {
    id: number;
    text: string;
    author?: string | null;
  }) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditAuthor(q.author ?? "");
  };

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-6 space-y-5 shadow-xl shadow-black/40">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
            <Quote className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              Sentenze & Filosofia d&apos;Ordine
            </h3>
            <p className="text-xs font-mono text-muted-foreground/80">
              Massime stoiche e precetti di disciplina che governano la lucidità al Varco.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2.5 py-1 font-mono text-[10px] uppercase font-bold tracking-wider text-[#E8C56A] self-start sm:self-center">
          <span>{quotes?.length ?? 0} Sentenze Registrate</span>
        </span>
      </div>

      {/* Add New Quote Form */}
      <div className="rounded-xl border border-[#C5A059]/20 bg-[#11131c]/70 p-4 space-y-3">
        <label className="text-[11px] font-mono uppercase tracking-wider text-[#C5A059] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
          Aggiungi Nuova Sentenza
        </label>
        <Input
          placeholder={uiText("auto.ui.1d52ab1e92")}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="bg-[#07080b] border-[#C5A059]/30 font-mono text-xs text-[#F4F4F6] focus:border-[#C5A059]"
        />
        <div className="flex gap-2">
          <Input
            placeholder={uiText("auto.ui.a6403a2baa")}
            value={newAuthor}
            onChange={(e) => setNewAuthor(e.target.value)}
            className="bg-[#07080b] border-[#C5A059]/30 font-mono text-xs text-[#F4F4F6] flex-1 focus:border-[#C5A059]"
          />
          <Button
            onClick={handleAdd}
            disabled={!newText.trim() || createMutation.isPending}
            className="bg-[#C5A059] hover:bg-[#E8C56A] text-black font-mono text-xs font-bold px-4"
          >
            <Plus className="w-4 h-4 mr-1 text-black" />
            Incidi
          </Button>
        </div>
      </div>

      {/* Quotes List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !quotes || quotes.length === 0 ? (
        <div className="rounded-xl border border-[#26262E] bg-[#07080b]/60 p-8 text-center space-y-1">
          <BookOpen className="w-6 h-6 text-[#C5A059]/60 mx-auto mb-2" />
          <p className="text-xs font-mono text-muted-foreground">
            Nessuna sentenza personalizzata memorizzata.
          </p>
          <p className="text-[11px] font-mono text-muted-foreground/60">
            Il sistema utilizzerà gli aforismi classici della dottrina LIMEN (Marco Aurelio, Seneca, Epitteto).
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {quotes.map((q) => (
            <div
              key={q.id}
              className="p-4 rounded-xl border border-[#26262E] bg-[#07080b]/90 hover:border-[#C5A059]/35 hover:bg-[#11131c]/60 transition-all group"
            >
              {editingId === q.id ? (
                <div className="space-y-3">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="bg-[#07080b] border-[#C5A059]/40 font-mono text-xs text-[#F4F4F6]"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={editAuthor}
                      onChange={(e) => setEditAuthor(e.target.value)}
                      className="bg-[#07080b] border-[#C5A059]/40 font-mono text-xs text-[#F4F4F6] flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(q.id)}
                      disabled={updateMutation.isPending}
                      className="bg-[#C5A059] hover:bg-[#E8C56A] text-black font-mono text-xs font-bold"
                    >
                      {uiText("auto.ui.c5965db5f2")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      className="border-[#26262E] font-mono text-xs text-muted-foreground"
                    >
                      {uiText("auto.ui.6c3de5381b")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-display text-xs italic text-[#F4F4F6] leading-relaxed">
                      &ldquo;{q.text}&rdquo;
                    </p>
                    {q.author && (
                      <p className="font-mono text-[11px] text-[#C5A059]">
                        — {q.author}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-[#C5A059] hover:bg-[#C5A059]/10"
                      onClick={() => startEdit(q)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-[#ef4444] hover:bg-[#ef4444]/10"
                      onClick={() => handleDelete(q.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
