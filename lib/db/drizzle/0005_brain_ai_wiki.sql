CREATE TABLE "wiki_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"original_url" text,
	"storage_provider" text,
	"storage_key" text,
	"file_url" text,
	"file_name" text,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" text,
	"extracted_text" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"graphify_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_id" integer NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"token_estimate" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_graph_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_id" integer,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"attrs" text,
	"weight" numeric(6, 3) DEFAULT '1' NOT NULL,
	"community_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_graph_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_id" integer,
	"from_node_id" integer NOT NULL,
	"to_node_id" integer NOT NULL,
	"relation" text NOT NULL,
	"confidence" text DEFAULT 'EXTRACTED' NOT NULL,
	"confidence_score" numeric(4, 3) DEFAULT '1' NOT NULL,
	"weight" numeric(6, 3) DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_communities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"node_count" integer DEFAULT 0 NOT NULL,
	"cohesion" numeric(5, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_ingest_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_id" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_saved_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"cited_sources" text DEFAULT '[]' NOT NULL,
	"cited_node_ids" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wiki_chunks" ADD CONSTRAINT "wiki_chunks_source_id_wiki_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."wiki_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wiki_graph_nodes" ADD CONSTRAINT "wiki_graph_nodes_source_id_wiki_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."wiki_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wiki_graph_edges" ADD CONSTRAINT "wiki_graph_edges_source_id_wiki_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."wiki_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wiki_graph_edges" ADD CONSTRAINT "wiki_graph_edges_from_node_id_wiki_graph_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."wiki_graph_nodes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wiki_graph_edges" ADD CONSTRAINT "wiki_graph_edges_to_node_id_wiki_graph_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."wiki_graph_nodes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wiki_ingest_jobs" ADD CONSTRAINT "wiki_ingest_jobs_source_id_wiki_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."wiki_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "wiki_sources_user_status_idx" ON "wiki_sources" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "wiki_sources_user_created_idx" ON "wiki_sources" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "wiki_chunks_source_idx" ON "wiki_chunks" USING btree ("source_id","chunk_index");
--> statement-breakpoint
CREATE INDEX "wiki_chunks_user_idx" ON "wiki_chunks" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "wiki_graph_nodes_user_label_idx" ON "wiki_graph_nodes" USING btree ("user_id","label");
--> statement-breakpoint
CREATE INDEX "wiki_graph_nodes_source_idx" ON "wiki_graph_nodes" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX "wiki_graph_nodes_user_community_idx" ON "wiki_graph_nodes" USING btree ("user_id","community_id");
--> statement-breakpoint
CREATE INDEX "wiki_graph_edges_user_from_idx" ON "wiki_graph_edges" USING btree ("user_id","from_node_id");
--> statement-breakpoint
CREATE INDEX "wiki_graph_edges_user_to_idx" ON "wiki_graph_edges" USING btree ("user_id","to_node_id");
--> statement-breakpoint
CREATE INDEX "wiki_graph_edges_source_idx" ON "wiki_graph_edges" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX "wiki_communities_user_idx" ON "wiki_communities" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "wiki_ingest_jobs_user_status_idx" ON "wiki_ingest_jobs" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "wiki_ingest_jobs_source_idx" ON "wiki_ingest_jobs" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX "wiki_saved_answers_user_idx" ON "wiki_saved_answers" USING btree ("user_id","created_at");
