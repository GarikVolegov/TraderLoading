import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Seo } from "@/components/Seo";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/i18n";
import { absoluteUrl, blogIndexAlternates, blogIndexPath } from "@/lib/seo";
import {
  fetchBlogPosts,
  fetchBlogAdminStatus,
  createBlogPost,
  deleteBlogPost,
  type BlogPostSummary,
  type BlogPostUpsertPayload,
  type BlogPostTranslationPayload,
} from "@/lib/blogApi";

const BLOG_LANGS: Language[] = ["it", "en", "es", "fr", "de"];

function emptyTranslation(lang: Language): BlogPostTranslationPayload {
  return { lang, title: "", metaDescription: "", bodyMarkdown: "", published: false };
}

// ─── Admin: create/edit form ────────────────────────────────────────────────
function PostForm({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [slug, setSlug] = useState("");
  const [relatedLibraryContentId, setRelatedLibraryContentId] = useState("");
  const [orderIndex, setOrderIndex] = useState(0);
  const [activeLang, setActiveLang] = useState<Language>("it");
  const [translations, setTranslations] = useState<Record<Language, BlogPostTranslationPayload>>(() => {
    const initial = {} as Record<Language, BlogPostTranslationPayload>;
    for (const lang of BLOG_LANGS) initial[lang] = emptyTranslation(lang);
    return initial;
  });

  const save = useMutation({
    mutationFn: () => {
      const payload: BlogPostUpsertPayload = {
        slug,
        relatedLibraryContentId: relatedLibraryContentId ? Number(relatedLibraryContentId) : null,
        orderIndex,
        translations: BLOG_LANGS.map((lang) => translations[lang]).filter((tr) => tr.title.trim()),
      };
      return createBlogPost(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog", "posts"] });
      onClose();
    },
  });

  function updateActiveTranslation(patch: Partial<BlogPostTranslationPayload>) {
    setTranslations((prev) => ({ ...prev, [activeLang]: { ...prev[activeLang], ...patch } }));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle>{t("blog.index.newPost")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            className="tl-input"
            placeholder={t("blog.admin.slugLabel")}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="tl-input"
              placeholder={t("blog.admin.relatedLibraryLabel")}
              value={relatedLibraryContentId}
              onChange={(e) => setRelatedLibraryContentId(e.target.value)}
            />
            <input
              type="number"
              className="tl-input"
              placeholder={t("blog.admin.orderLabel")}
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
            />
          </div>

          <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as Language)}>
            <TabsList>
              {BLOG_LANGS.map((lang) => (
                <TabsTrigger key={lang} value={lang}>
                  {lang.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
            {BLOG_LANGS.map((lang) => (
              <TabsContent key={lang} value={lang} className="space-y-2">
                <input
                  className="tl-input"
                  placeholder={t("blog.admin.titleLabel")}
                  value={translations[lang].title}
                  onChange={(e) => updateActiveTranslation({ title: e.target.value })}
                />
                <textarea
                  className="tl-input min-h-16"
                  placeholder={t("blog.admin.metaDescriptionLabel")}
                  value={translations[lang].metaDescription}
                  onChange={(e) => updateActiveTranslation({ metaDescription: e.target.value })}
                />
                <textarea
                  className="tl-input min-h-40"
                  placeholder={t("blog.admin.bodyLabel")}
                  value={translations[lang].bodyMarkdown}
                  onChange={(e) => updateActiveTranslation({ bodyMarkdown: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={translations[lang].published}
                    onChange={(e) => updateActiveTranslation({ published: e.target.checked })}
                  />
                  {t("blog.admin.publishedLabel")}
                </label>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("blog.admin.cancel")}
            </Button>
            <Button size="sm" disabled={!slug.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {t("blog.admin.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BlogIndexPage({ lang }: { lang: Language }) {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const { data: admin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["blog", "admin"],
    queryFn: fetchBlogAdminStatus,
  });
  const isAdmin = admin?.isAdmin ?? false;

  const { data: posts = [] } = useQuery<BlogPostSummary[]>({
    queryKey: ["blog", "posts", lang],
    queryFn: () => fetchBlogPosts(lang),
  });

  const [showForm, setShowForm] = useState(false);
  const delPost = useMutation({
    mutationFn: (id: number) => deleteBlogPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog", "posts"] }),
  });

  return (
    <PageLayout>
      <Seo
        title={t("blog.index.title")}
        description={t("blog.index.subtitle")}
        lang={lang}
        canonical={absoluteUrl(blogIndexPath(lang))}
        alternates={blogIndexAlternates()}
      />
      <PageHeader
        title={t("blog.index.title")}
        subtitle={t("blog.index.subtitle")}
        action={
          isAdmin ? (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              {t("blog.index.newPost")}
            </Button>
          ) : undefined
        }
      />

      {posts.length === 0 && (
        <div className="tl-panel p-10 sm:p-16 text-center">
          <h3 className="text-xl font-bold mb-2">{t("blog.index.empty.title")}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t("blog.index.empty.body")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <div key={post.id} className="tl-panel p-4 flex flex-col gap-2 border-border/40">
            <h3 className="font-bold text-sm leading-snug">{post.title}</h3>
            {post.metaDescription && (
              <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{post.metaDescription}</p>
            )}
            <div className="flex items-center gap-2 mt-auto">
              <Link href={lang === "en" ? `/blog/${post.slug}` : `/${lang}/blog/${post.slug}`}>
                <Button variant="default" size="sm">
                  {t("blog.index.readMore")}
                </Button>
              </Link>
              {isAdmin && (
                <button
                  onClick={() => delPost.mutate(post.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-400"
                  aria-label={t("blog.admin.delete")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && <PostForm onClose={() => setShowForm(false)} />}
    </PageLayout>
  );
}
