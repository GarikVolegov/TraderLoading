import { Button } from "@/components/ui/button";
import { useProcessCopy } from "./ProcessUI";
export function SessionDraftStatus({
  status,
  retry,
  reload,
  scope = "session",
}: {
  status: "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict";
  retry: () => Promise<unknown>;
  reload: () => Promise<void>;
  scope?: "session" | "method";
}) {
  const copy = useProcessCopy();
  if (status === "idle") return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      role={status === "conflict" || status === "error" ? "alert" : "status"}
    >
      <span>
        {copy(
          status === "conflict"
            ? scope === "method"
              ? "methodDraftConflict"
              : "draftConflict"
            : status === "error"
              ? "draftError"
              : status === "saving"
                ? "draftSaving"
                : status === "unsaved"
                  ? "draftUnsaved"
                  : scope === "method"
                    ? "methodDraftSaved"
                    : "draftSaved",
        )}
      </span>
      {status === "error" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => void retry().catch(() => undefined)}
        >
          {copy("retry")}
        </Button>
      )}
      {status === "conflict" && (
        <Button
          type="button"
          variant="default"
          size="sm"
          className="min-h-11"
          onClick={() => void reload().catch(() => undefined)}
        >
          {copy("draftReload")}
        </Button>
      )}
    </div>
  );
}
