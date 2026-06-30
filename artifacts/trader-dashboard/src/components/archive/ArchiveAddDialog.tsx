import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Globe2, Loader2, Upload, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onClose: () => void;
  onUploadFiles: (files: File[]) => void;
  onAddNote: (title: string, content: string) => void;
  onAddUrl: (url: string) => void;
  pending: boolean;
  error: string | null;
}

export function ArchiveAddDialog(props: Props) {
  const { open, onClose } = props;
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [url, setUrl] = useState("");

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({
    onDrop: (files) => props.onUploadFiles(files),
    multiple: true,
    noClick: true,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-[min(560px,100%)] overflow-auto rounded-2xl border border-border/60 bg-card p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{uiText("archive.add.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={uiText("archive.close")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {props.error && (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {props.error}
          </p>
        )}

        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors ${
              isDragActive ? "border-primary bg-primary/10" : "border-border/50 bg-card/40 hover:border-primary/40"
            }`}
          >
            <input {...getInputProps()} />
            {props.pending ? (
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            ) : (
              <Upload className="h-7 w-7 text-primary" />
            )}
            <p className="text-sm font-medium text-foreground">{uiText("archive.add.drop_title")}</p>
            <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={props.pending}>
              {uiText("archive.add.browse")}
            </Button>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {uiText("archive.add.note_label")}
            </span>
            <Input
              placeholder={uiText("wiki.note.title_placeholder")}
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={uiText("wiki.note.placeholder")}
              className="min-h-[80px] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <Button
              className="w-full"
              disabled={!noteText.trim() || props.pending}
              onClick={() => {
                props.onAddNote(noteTitle.trim(), noteText.trim());
                setNoteTitle("");
                setNoteText("");
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              {uiText("archive.add.note_cta")}
            </Button>
          </div>

          <div className="space-y-2">
            <Input placeholder={uiText("wiki.url.placeholder")} value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button
              variant="outline"
              className="w-full"
              disabled={!url.trim() || props.pending}
              onClick={() => {
                props.onAddUrl(url.trim());
                setUrl("");
              }}
            >
              <Globe2 className="mr-2 h-4 w-4" />
              {uiText("archive.add.url_cta")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
