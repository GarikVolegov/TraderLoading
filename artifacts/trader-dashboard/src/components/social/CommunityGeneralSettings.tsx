import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ImagePlus, Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiJSON, apiUpload } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { COMMUNITY_EMOJIS } from "./constants";
import type { CommunityDetail } from "./types";

const DEFAULT_ACCENT = "#51a488";

export function CommunityGeneralSettings({ detail }: { detail: CommunityDetail }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState(detail.description ?? "");
  const [emoji, setEmoji] = useState(detail.iconEmoji);
  const [accentColor, setAccentColor] = useState(detail.accentColor ?? DEFAULT_ACCENT);
  const [rules, setRules] = useState(detail.rules ?? "");
  const [welcome, setWelcome] = useState(detail.welcomeMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["community", detail.id] });
    qc.invalidateQueries({ queryKey: ["communities"] });
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiJSON(`community/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, iconEmoji: emoji, accentColor, rules, welcomeMessage: welcome }),
      });
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community settings save", notify: false });
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (kind: "avatar" | "banner", file: File | undefined) => {
    if (!file) return;
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append("image", file);
      await apiUpload(`community/${detail.id}/${kind}`, fd);
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community image upload", notify: false });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner + avatar */}
      <div>
        <div
          className="relative h-24 rounded-xl border border-border overflow-hidden bg-secondary/30 flex items-center justify-center"
          style={detail.bannerUrl ? { backgroundImage: `url(${detail.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <button
            onClick={() => bannerInput.current?.click()}
            disabled={uploading === "banner"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 text-white text-xs font-semibold hover:bg-black/70 transition-colors disabled:opacity-50"
          >
            {uploading === "banner" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
            {t("community.settings.banner")}
          </button>
          <input
            ref={bannerInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => uploadImage("banner", e.target.files?.[0])}
          />
        </div>
        <div className="flex items-center gap-3 -mt-6 ml-3">
          <div className="w-14 h-14 rounded-2xl border-2 border-card bg-secondary flex items-center justify-center text-2xl overflow-hidden shrink-0">
            {detail.avatarUrl ? <img src={detail.avatarUrl} alt="" className="w-full h-full object-cover" /> : emoji}
          </div>
          <button
            onClick={() => avatarInput.current?.click()}
            disabled={uploading === "avatar"}
            className="mt-6 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/40 text-xs font-semibold hover:bg-secondary/60 transition-colors disabled:opacity-50"
          >
            {uploading === "avatar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
            {t("community.settings.avatar")}
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => uploadImage("avatar", e.target.files?.[0])}
          />
        </div>
      </div>

      {/* Emoji */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t("community.settings.icon")}</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMUNITY_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all border ${emoji === e ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Name + accent */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t("community.settings.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t("community.settings.accent")}</label>
          <input
            type="color"
            aria-label={t("community.settings.accent")}
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="w-10 h-10 rounded-xl border border-border bg-transparent cursor-pointer"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t("community.settings.description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={2}
          className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none"
        />
      </div>

      {/* Welcome */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t("community.settings.welcome")}</label>
        <textarea
          value={welcome}
          onChange={(e) => setWelcome(e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none"
        />
      </div>

      {/* Rules */}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">{t("community.settings.rules")}</label>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          maxLength={4000}
          rows={5}
          className="w-full bg-secondary/30 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none"
        />
      </div>

      <button
        onClick={save}
        disabled={saving || !name.trim()}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {t("community.settings.save")}
      </button>
    </div>
  );
}
