// Client off-contract del Blog (come torneiApi): tipi a mano + apiJSON.
import { apiJSON } from "./apiFetch";

export interface BlogPostSummary {
  id: number;
  slug: string;
  relatedLibraryContentId: number | null;
  orderIndex: number;
  title: string;
  metaDescription: string;
}

export interface BlogPostDetail {
  id: number;
  slug: string;
  relatedLibraryContentId: number | null;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  lang: string;
}

export interface BlogPostTranslationPayload {
  lang: string;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  published: boolean;
}

export interface BlogPostUpsertPayload {
  slug: string;
  relatedLibraryContentId: number | null;
  orderIndex: number;
  translations: BlogPostTranslationPayload[];
}

export function fetchBlogPosts(lang: string): Promise<BlogPostSummary[]> {
  return apiJSON(`blog/posts?lang=${encodeURIComponent(lang)}`);
}

export function fetchBlogPost(slug: string, lang: string): Promise<BlogPostDetail> {
  return apiJSON(`blog/posts/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`);
}

export function fetchBlogAdminStatus(): Promise<{ isAdmin: boolean }> {
  return apiJSON("blog/admin/status");
}

export function createBlogPost(payload: BlogPostUpsertPayload): Promise<{ id: number; slug: string }> {
  return apiJSON("blog/posts", { method: "POST", body: JSON.stringify(payload) });
}

export function updateBlogPost(id: number, payload: BlogPostUpsertPayload): Promise<{ id: number }> {
  return apiJSON(`blog/posts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteBlogPost(id: number): Promise<void> {
  return apiJSON(`blog/posts/${id}`, { method: "DELETE" });
}
