import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Seo } from "@/components/Seo";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/i18n";
import { absoluteUrl, articleJsonLd, blogIndexPath, blogPostAlternates, blogPostPath } from "@/lib/seo";
import { fetchBlogPost, type BlogPostDetail } from "@/lib/blogApi";

export default function BlogArticlePage({ lang, slug }: { lang: Language; slug: string }) {
  const { t } = useLanguage();

  const { data: post, isLoading, isError } = useQuery<BlogPostDetail>({
    queryKey: ["blog", "post", lang, slug],
    queryFn: () => fetchBlogPost(slug, lang),
    retry: false,
  });

  if (isLoading) return null;
  if (isError || !post) return <BlogArticleNotFound lang={lang} />;

  const canonical = absoluteUrl(blogPostPath(post.slug, lang));

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <Seo
        title={post.title}
        description={post.metaDescription}
        lang={lang}
        canonical={canonical}
        ogType="article"
        alternates={blogPostAlternates(post.slug, [lang])}
        jsonLd={[articleJsonLd(post.title, post.metaDescription, canonical, lang)]}
      />
      <Link href={blogIndexPath(lang)} className="text-sm text-primary hover:underline">
        {t("blog.article.back")}
      </Link>
      <h1 className="mt-4 text-3xl font-bold leading-tight">{post.title}</h1>
      <div className="mt-6 whitespace-pre-wrap leading-relaxed text-foreground/90">{post.bodyMarkdown}</div>

      {post.relatedLibraryContentId != null && (
        <div className="mt-10 tl-panel p-6">
          <h2 className="font-bold text-lg mb-2">{t("blog.article.relatedLibrary.title")}</h2>
          <Link href={`/library?open=${post.relatedLibraryContentId}`} className="text-primary font-semibold hover:underline">
            {t("blog.article.relatedLibrary.action")} →
          </Link>
        </div>
      )}
    </div>
  );
}

function BlogArticleNotFound({ lang }: { lang: Language }) {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
      <h1 className="text-2xl font-bold mb-3">{t("blog.index.empty.title")}</h1>
      <Link href={blogIndexPath(lang)} className="text-primary hover:underline">
        {t("blog.article.back")}
      </Link>
    </div>
  );
}
