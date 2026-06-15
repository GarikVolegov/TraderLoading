import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Quote } from "lucide-react";
import { useGetQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote, getGetQuotesQueryKey, getGetRandomQuoteQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { uiText } from "@/contexts/LanguageContext";

export function QuotesSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: quotes, isLoading } = useGetQuotes();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const deleteMutation = useDeleteQuote();
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
      toast({ description: "Citazione aggiunta." });
    } catch {
      toast({ description: "Errore nell'aggiunta.", variant: "destructive" });
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
      toast({ description: "Citazione aggiornata." });
    } catch {
      toast({
        description: "Errore nell'aggiornamento.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      invalidate();
      toast({ description: "Citazione eliminata." });
    } catch {
      toast({
        description: "Errore nell'eliminazione.",
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="w-5 h-5 text-primary" />
          Citazioni Motivazionali
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Aggiungi le tue citazioni preferite. Se non ne aggiungi, verranno
          mostrate quelle predefinite.
        </p>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input
            placeholder={uiText("auto.ui.1d52ab1e92")}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Input
              placeholder={uiText("auto.ui.a6403a2baa")}
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              className="text-sm flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={!newText.trim() || createMutation.isPending}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Aggiungi
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-4 flex justify-center">
            <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : !quotes || quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nessuna citazione personalizzata. Verranno usate quelle predefinite.
          </p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <div key={q.id} className="rounded-lg border border-border p-3">
                {editingId === q.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={editAuthor}
                        onChange={(e) => setEditAuthor(e.target.value)}
                        className="text-sm flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(q.id)}
                        disabled={updateMutation.isPending}
                      >{uiText("auto.ui.c5965db5f2")}</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >{uiText("auto.ui.6c3de5381b")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm italic truncate">
                        &ldquo;{q.text}&rdquo;
                      </p>
                      {q.author && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          — {q.author}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => startEdit(q)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
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
      </CardContent>
    </Card>
  );
}
