import type { ReactNode } from "react";
import { ImageIcon, FileText, File } from "lucide-react";

export function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function fileIcon(mimeType: string): ReactNode {
  if (mimeType.startsWith("image/"))
    return <ImageIcon className="w-4 h-4 text-blue-400" />;
  if (mimeType === "application/pdf")
    return <FileText className="w-4 h-4 text-red-400" />;
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  )
    return <File className="w-4 h-4 text-green-400" />;
  if (mimeType.includes("word"))
    return <FileText className="w-4 h-4 text-blue-300" />;
  if (mimeType.includes("zip"))
    return <File className="w-4 h-4 text-yellow-400" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}
