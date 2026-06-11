CREATE TABLE "account_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket" text NOT NULL,
	"source" text NOT NULL,
	"symbol" text NOT NULL,
	"direction" text NOT NULL,
	"volume" numeric(12, 2) NOT NULL,
	"open_time" text NOT NULL,
	"close_time" text,
	"entry_price" numeric(14, 5) NOT NULL,
	"exit_price" numeric(14, 5),
	"stop_loss" numeric(14, 5),
	"take_profit" numeric(14, 5),
	"profit" numeric(14, 2),
	"commission" numeric(14, 2),
	"swap" numeric(14, 2),
	"status" text DEFAULT 'open' NOT NULL,
	"broker_profile_id" text,
	"broker_account_id" text,
	"risk_price_distance" numeric(14, 5),
	"return_pct" numeric(12, 4),
	"journal_entry_id" integer,
	"user_id" text DEFAULT 'guest' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "backtest_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pair" text NOT NULL,
	"timeframe" text DEFAULT 'H1' NOT NULL,
	"strategy" text,
	"notes" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"direction" text NOT NULL,
	"entry_price" numeric(12, 5) NOT NULL,
	"exit_price" numeric(12, 5) NOT NULL,
	"stop_loss" numeric(12, 5),
	"take_profit" numeric(12, 5),
	"lot_size" numeric(8, 2) DEFAULT '0.01' NOT NULL,
	"result" text NOT NULL,
	"pips" numeric(10, 1),
	"notes" text,
	"trade_date" text NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"strategy_id" integer,
	"symbol" text NOT NULL,
	"interval" text DEFAULT 'H1' NOT NULL,
	"mode" text NOT NULL,
	"image_ref" text,
	"direction" text NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"reasoning" text NOT NULL,
	"entry_price" numeric(18, 8),
	"stop_loss" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"context" text,
	"zones_json" text,
	"raw_model" text,
	"raw_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"analysis_id" integer NOT NULL,
	"vote" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_graph_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"strategy_id" integer,
	"from_node_id" integer NOT NULL,
	"to_node_id" integer NOT NULL,
	"relation" text NOT NULL,
	"weight" numeric(6, 3) DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_graph_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"strategy_id" integer,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"attrs" text,
	"source_id" integer,
	"weight" numeric(6, 3) DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_knowledge_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"strategy_id" integer,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"raw_text" text DEFAULT '' NOT NULL,
	"file_ref" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_scan_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"pairs" text DEFAULT '[]' NOT NULL,
	"timeframes" text DEFAULT '["H1"]' NOT NULL,
	"interval_minutes" integer DEFAULT 30 NOT NULL,
	"min_confidence" numeric(5, 2) DEFAULT '70' NOT NULL,
	"strategy_id" integer,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"rules" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"read" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_e2ee_key_backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"public_key_jwk" text NOT NULL,
	"private_key_jwk" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_public_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"public_key_jwk" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon_emoji" text DEFAULT '🏛️' NOT NULL,
	"creator_id" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"file_name" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" text NOT NULL,
	"file_url" text NOT NULL,
	"downloadable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"content" text NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_presence" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_ping" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"mood" text NOT NULL,
	"session_name" text NOT NULL,
	"note" text,
	"user_id" text,
	"date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'idea' NOT NULL,
	"content" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"reminder_time" text,
	"cadence" text,
	"recurrence" boolean DEFAULT false NOT NULL,
	"importance" text DEFAULT 'medium',
	"deadline_date" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"author" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"background_url" text,
	"background_type" text DEFAULT 'default' NOT NULL,
	"font_choice" text DEFAULT 'inter' NOT NULL,
	"background_darkness" integer DEFAULT 60 NOT NULL,
	"user_id" text,
	"trading_sessions" text,
	"lot_divisor" integer DEFAULT 11 NOT NULL,
	"calendar_currencies" text,
	"calendar_impacts" text,
	"daily_reminder_time" text,
	"pre_macro_minutes" integer DEFAULT 15 NOT NULL,
	"max_daily_loss" integer,
	"selected_pairs" text,
	"notification_prefs" text,
	"alarm_configs" text
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Trader' NOT NULL,
	"avatar_url" text,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"last_active_date" text,
	"user_id" text,
	"years_experience" integer,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mission_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"xp_reward" integer DEFAULT 50 NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"xp_reward" integer DEFAULT 50 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"mission_date" text NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"trade_date" text NOT NULL,
	"result" text DEFAULT 'none' NOT NULL,
	"tags" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" serial NOT NULL,
	"file_path" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_recaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"overall_judgment" text DEFAULT '' NOT NULL,
	"went_well" text DEFAULT '' NOT NULL,
	"went_wrong" text DEFAULT '' NOT NULL,
	"improvements" text DEFAULT '' NOT NULL,
	"patterns" text DEFAULT '' NOT NULL,
	"focus_areas" text DEFAULT '' NOT NULL,
	"next_period_expectations" text DEFAULT '' NOT NULL,
	"next_period_goals" text DEFAULT '' NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journal_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag" text NOT NULL,
	"tag_key" text NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"content" text NOT NULL,
	"image_url" text,
	"is_story" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"level" integer NOT NULL,
	"level_name" text NOT NULL,
	"milestone_title" text DEFAULT '' NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_milestone_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" text NOT NULL,
	"downloadable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"skills" text DEFAULT '[]' NOT NULL,
	"badge_emoji" text DEFAULT '🏆' NOT NULL,
	"badge_color" text DEFAULT '#22c55e' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"routine_id" text NOT NULL,
	"routine_title" text NOT NULL,
	"template" text NOT NULL,
	"answers_json" text DEFAULT '{}' NOT NULL,
	"quality_score" integer DEFAULT 0 NOT NULL,
	"completion_date" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"article_key" text NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"vote" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"keywords" text DEFAULT '[]' NOT NULL,
	"profile" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"recipient_id" text NOT NULL,
	"from_id" text NOT NULL,
	"call_id" text,
	"type" text NOT NULL,
	"data" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_image_url" text,
	"category" text DEFAULT '' NOT NULL,
	"required_level" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" integer,
	"type" text DEFAULT 'document' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"body_markdown" text DEFAULT '' NOT NULL,
	"file_url" text,
	"file_name" text,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" text,
	"embed_url" text,
	"mindmap" jsonb,
	"tags" text DEFAULT '[]' NOT NULL,
	"required_level" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_trades" ADD CONSTRAINT "account_trades_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_session_id_backtest_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."backtest_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_analyses" ADD CONSTRAINT "brain_analyses_strategy_id_brain_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."brain_strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_feedback" ADD CONSTRAINT "brain_feedback_analysis_id_brain_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."brain_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_graph_edges" ADD CONSTRAINT "brain_graph_edges_strategy_id_brain_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."brain_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_graph_edges" ADD CONSTRAINT "brain_graph_edges_from_node_id_brain_graph_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."brain_graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_graph_edges" ADD CONSTRAINT "brain_graph_edges_to_node_id_brain_graph_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."brain_graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_graph_nodes" ADD CONSTRAINT "brain_graph_nodes_strategy_id_brain_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."brain_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_graph_nodes" ADD CONSTRAINT "brain_graph_nodes_source_id_brain_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."brain_knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_knowledge_sources" ADD CONSTRAINT "brain_knowledge_sources_strategy_id_brain_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."brain_strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_scan_config" ADD CONSTRAINT "brain_scan_config_strategy_id_brain_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."brain_strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_images" ADD CONSTRAINT "journal_images_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_trades_source_ticket_user_unique" ON "account_trades" USING btree ("source","ticket","user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "brain_analyses_user_created_idx" ON "brain_analyses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "brain_graph_edges_user_strategy_from_idx" ON "brain_graph_edges" USING btree ("user_id","strategy_id","from_node_id");--> statement-breakpoint
CREATE INDEX "brain_graph_edges_to_idx" ON "brain_graph_edges" USING btree ("to_node_id");--> statement-breakpoint
CREATE INDEX "brain_graph_nodes_user_strategy_label_idx" ON "brain_graph_nodes" USING btree ("user_id","strategy_id","label");--> statement-breakpoint
CREATE INDEX "brain_graph_nodes_source_idx" ON "brain_graph_nodes" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "brain_knowledge_sources_user_strategy_idx" ON "brain_knowledge_sources" USING btree ("user_id","strategy_id");--> statement-breakpoint
CREATE INDEX "brain_scan_config_enabled_last_run_idx" ON "brain_scan_config" USING btree ("enabled","last_run_at");--> statement-breakpoint
CREATE INDEX "brain_scan_config_user_idx" ON "brain_scan_config" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "brain_strategies_user_active_idx" ON "brain_strategies" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "idx_chat_sender_receiver" ON "chat_messages" USING btree ("sender_id","receiver_id");--> statement-breakpoint
CREATE INDEX "idx_chat_receiver_read" ON "chat_messages" USING btree ("receiver_id","read");--> statement-breakpoint
CREATE INDEX "idx_friendships_user" ON "friendships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_friendships_friend" ON "friendships" USING btree ("friend_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_friendships_pair" ON "friendships" USING btree ("user_id","friend_id");--> statement-breakpoint
CREATE INDEX "idx_global_chat_created" ON "global_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_e2ee_key_backups_user" ON "user_e2ee_key_backups" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_public_keys_user" ON "user_public_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "communities_creator_idx" ON "communities" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "communities_public_idx" ON "communities" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "community_channels_community_idx" ON "community_channels" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "community_files_channel_idx" ON "community_files" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "community_files_community_idx" ON "community_files" USING btree ("community_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_members_pair_idx" ON "community_members" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "community_members_community_idx" ON "community_members" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "community_members_user_idx" ON "community_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "community_messages_channel_idx" ON "community_messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "community_messages_created_idx" ON "community_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "voice_presence_pair_idx" ON "voice_presence" USING btree ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX "voice_presence_channel_idx" ON "voice_presence" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "login_access_user_created_idx" ON "login_access" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_sub_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_idx" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profile_user_idx" ON "profile" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_name_unique_authenticated" ON "profile" USING btree (lower("name")) WHERE "profile"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "mission_templates_user_idx" ON "mission_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "missions_user_date_completed_idx" ON "missions" USING btree ("user_id","mission_date","completed");--> statement-breakpoint
CREATE INDEX "journal_entries_user_created_idx" ON "journal_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "journal_images_entry_idx" ON "journal_images" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_recaps_user_kind_period_idx" ON "journal_recaps" USING btree ("user_id","kind","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_tags_user_tag_key_idx" ON "journal_tags" USING btree ("user_id","tag_key");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_pair_idx" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "follows_follower_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "post_comments_post_idx" ON "post_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_comments_created_idx" ON "post_comments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "post_likes_pair_idx" ON "post_likes" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "post_likes_post_idx" ON "post_likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "posts_user_idx" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_created_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_story_idx" ON "posts" USING btree ("is_story","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "level_certificates_user_level_idx" ON "level_certificates" USING btree ("user_id","level");--> statement-breakpoint
CREATE INDEX "level_certificates_user_idx" ON "level_certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "level_milestone_files_level_idx" ON "level_milestone_files" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX "level_milestones_level_idx" ON "level_milestones" USING btree ("level");--> statement-breakpoint
CREATE INDEX "routine_completions_user_idx" ON "routine_completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "routine_completions_date_idx" ON "routine_completions" USING btree ("completion_date");--> statement-breakpoint
CREATE UNIQUE INDEX "news_feedback_user_article_idx" ON "news_feedback" USING btree ("user_id","article_key");--> statement-breakpoint
CREATE INDEX "news_feedback_user_idx" ON "news_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_preferences_user_idx" ON "news_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_snapshots_cache_key_idx" ON "news_snapshots" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "signals_recipient_scope_idx" ON "signals" USING btree ("recipient_id","scope");--> statement-breakpoint
CREATE INDEX "signals_created_idx" ON "signals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "library_collections_order_idx" ON "library_collections" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX "library_contents_collection_idx" ON "library_contents" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "library_contents_order_idx" ON "library_contents" USING btree ("order_index");