-- Remove the Brain AI feature and simplify the Wiki into a plain notes archive.
--
-- Brain AI (autonomous scanner + on-demand chart analysis + knowledge graph) is
-- being removed entirely. The Wiki keeps notes/files/URLs + folders but drops its
-- GraphRAG layer (embeddings, knowledge graph, communities, saved Q&A answers).
-- Tables are dropped child-first so FK constraints don't block the DROP.

-- Brain tables (FK order: edges -> nodes -> feedback -> analyses -> knowledge -> config -> strategies).
DROP TABLE IF EXISTS "brain_graph_edges";
--> statement-breakpoint
DROP TABLE IF EXISTS "brain_graph_nodes";
--> statement-breakpoint
DROP TABLE IF EXISTS "brain_feedback";
--> statement-breakpoint
DROP TABLE IF EXISTS "brain_analyses";
--> statement-breakpoint
DROP TABLE IF EXISTS "brain_knowledge_sources";
--> statement-breakpoint
DROP TABLE IF EXISTS "brain_scan_config";
--> statement-breakpoint
DROP TABLE IF EXISTS "brain_strategies";
--> statement-breakpoint
-- Wiki AI tables (FK order: edges -> nodes -> communities -> chunks -> saved answers).
DROP TABLE IF EXISTS "wiki_graph_edges";
--> statement-breakpoint
DROP TABLE IF EXISTS "wiki_graph_nodes";
--> statement-breakpoint
DROP TABLE IF EXISTS "wiki_communities";
--> statement-breakpoint
DROP TABLE IF EXISTS "wiki_chunks";
--> statement-breakpoint
DROP TABLE IF EXISTS "wiki_saved_answers";
--> statement-breakpoint
-- Graph-extraction scratch column on the retained wiki_sources table.
ALTER TABLE "wiki_sources" DROP COLUMN IF EXISTS "graphify_json";
