CREATE TABLE IF NOT EXISTS "candidate_applications" (
    "id" serial PRIMARY KEY NOT NULL,
    "candidate_code" text NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "contact_type" text DEFAULT 'whatsapp' NOT NULL,
    "contact_handle" text NOT NULL,
    "situation" text,
    "horizon" text,
    "obstacle" text,
    "commitment" text,
    "plan_chosen" text DEFAULT 'direct_150' NOT NULL,
    "referred_by" text,
    "status" text DEFAULT 'in_valutazione' NOT NULL,
    "notes" text,
    "user_id" text,
    "reviewed_by" text,
    "reviewed_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_applications_code_unique" ON "candidate_applications" ("candidate_code");
CREATE INDEX IF NOT EXISTS "candidate_applications_email_idx" ON "candidate_applications" ("email");
CREATE INDEX IF NOT EXISTS "candidate_applications_status_idx" ON "candidate_applications" ("status");
CREATE INDEX IF NOT EXISTS "candidate_applications_created_idx" ON "candidate_applications" ("created_at");

CREATE TABLE IF NOT EXISTS "system_feature_flags" (
    "key" text PRIMARY KEY NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "description" text,
    "updated_by" text,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Seed standard system flags
INSERT INTO "system_feature_flags" ("key", "enabled", "description", "updated_by")
VALUES
    ('maintenance_mode', false, 'Blocca l''accesso pubblico mostrando schermata di manutenzione', 'system'),
    ('allow_new_registrations', true, 'Consente la registrazione di nuovi utenti', 'system'),
    ('require_threshold_approval', true, 'Richiede approvazione admin per l''accesso al Laboratorio', 'system'),
    ('debug_logging', false, 'Attiva il log dettagliato delle chiamate e socket', 'system')
ON CONFLICT ("key") DO NOTHING;
