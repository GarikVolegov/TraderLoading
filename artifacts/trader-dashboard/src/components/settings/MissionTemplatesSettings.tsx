import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Plus, Pencil, Trash2 } from "lucide-react";
import { useGetMissionTemplates, useCreateMissionTemplate, useUpdateMissionTemplate, useDeleteMissionTemplate, getGetMissionTemplatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { uiText } from "@/contexts/LanguageContext";

export function MissionTemplatesSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates, isLoading } = useGetMissionTemplates();
  const createMutation = useCreateMissionTemplate();
  const updateMutation = useUpdateMissionTemplate();
  const deleteMutation = useDeleteMissionTemplate();
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newXp, setNewXp] = useState("50");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editXp, setEditXp] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetMissionTemplatesQueryKey() });

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDesc.trim()) return;
    try {
      await createMutation.mutateAsync({
        data: {
          title: newTitle.trim(),
          description: newDesc.trim(),
          xpReward: Number(newXp) || 50,
        },
      });
      setNewTitle("");
      setNewDesc("");
      setNewXp("50");
      invalidate();
      toast({ description: "Missione aggiunta." });
    } catch {
      toast({ description: "Errore nell'aggiunta.", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          title: editTitle,
          description: editDesc,
          xpReward: Number(editXp) || 50,
        },
      });
      setEditingId(null);
      invalidate();
      toast({ description: "Missione aggiornata." });
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
      toast({ description: "Missione eliminata." });
    } catch {
      toast({
        description: "Errore nell'eliminazione.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (t: {
    id: number;
    title: string;
    description: string;
    xpReward: number;
  }) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditDesc(t.description);
    setEditXp(String(t.xpReward));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />{uiText("auto.ui.0a38d7a6de")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Personalizza le missioni giornaliere. Se non ne aggiungi, verranno
          usate quelle predefinite.
        </p>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input
            placeholder={uiText("auto.ui.120ae9b81a")}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="text-sm"
          />
          <Input
            placeholder={uiText("auto.ui.07dfa30eec")}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              placeholder="XP"
              value={newXp}
              onChange={(e) => setNewXp(e.target.value)}
              className="text-sm w-24"
            />
            <Button
              onClick={handleAdd}
              disabled={
                !newTitle.trim() || !newDesc.trim() || createMutation.isPending
              }
              size="sm"
              className="flex-1"
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
        ) : !templates || templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nessuna missione personalizzata. Verranno usate le 5 predefinite.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                {editingId === t.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={editXp}
                        onChange={(e) => setEditXp(e.target.value)}
                        className="text-sm w-24"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(t.id)}
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
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold truncate">
                          {t.title}
                        </h4>
                        <span className="text-xs font-mono text-accent bg-secondary/60 px-1.5 py-0.5 rounded">
                          {t.xpReward} XP
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {t.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => startEdit(t)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(t.id)}
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
