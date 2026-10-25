BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE users (
    email VARCHAR(320) NOT NULL, 
    password_hash VARCHAR(255) NOT NULL, 
    display_name VARCHAR(120), 
    role VARCHAR(20) DEFAULT 'user' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_users PRIMARY KEY (id), 
    CONSTRAINT ck_users_role_valido CHECK (role IN ('user', 'admin'))
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE password_resets (
    user_id UUID NOT NULL, 
    token_hash VARCHAR(64) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    used_at TIMESTAMP WITH TIME ZONE, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    CONSTRAINT pk_password_resets PRIMARY KEY (id), 
    CONSTRAINT fk_password_resets_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_password_resets_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_password_resets_user_id ON password_resets (user_id);

CREATE TABLE subjects (
    user_id UUID NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    color VARCHAR(7), 
    description TEXT, 
    is_archived BOOLEAN DEFAULT 'false' NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_subjects PRIMARY KEY (id), 
    CONSTRAINT ck_subjects_nome_nao_vazio CHECK (length(trim(name)) > 0), 
    CONSTRAINT fk_subjects_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_subjects_id_user UNIQUE (id, user_id), 
    CONSTRAINT uq_subjects_user_name UNIQUE (user_id, name)
);

CREATE INDEX ix_subjects_user_id ON subjects (user_id);

CREATE TABLE user_preferences (
    user_id UUID NOT NULL, 
    theme VARCHAR(10) DEFAULT 'system' NOT NULL, 
    default_detail_level VARCHAR(12) DEFAULT 'medio' NOT NULL, 
    daily_ai_limit INTEGER DEFAULT '20' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_user_preferences PRIMARY KEY (user_id), 
    CONSTRAINT ck_user_preferences_nivel_valido CHECK (default_detail_level IN ('curto', 'medio', 'detalhado')), 
    CONSTRAINT ck_user_preferences_tema_valido CHECK (theme IN ('light', 'dark', 'system')), 
    CONSTRAINT ck_user_preferences_limite_ia_nao_negativo CHECK (daily_ai_limit >= 0), 
    CONSTRAINT fk_user_preferences_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE user_sessions (
    user_id UUID NOT NULL, 
    token_hash VARCHAR(64) NOT NULL, 
    csrf_token VARCHAR(64) NOT NULL, 
    ip_address INET, 
    user_agent VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    CONSTRAINT pk_user_sessions PRIMARY KEY (id), 
    CONSTRAINT fk_user_sessions_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_user_sessions_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_user_sessions_expires_at ON user_sessions (expires_at);

CREATE INDEX ix_user_sessions_user_id ON user_sessions (user_id);

CREATE TABLE folders (
    user_id UUID NOT NULL, 
    subject_id UUID NOT NULL, 
    parent_id UUID, 
    name VARCHAR(120) NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_folders PRIMARY KEY (id), 
    CONSTRAINT ck_folders_nome_nao_vazio CHECK (length(trim(name)) > 0), 
    CONSTRAINT ck_folders_sem_auto_pai CHECK (parent_id IS NULL OR parent_id <> id), 
    CONSTRAINT fk_folders_parent_user FOREIGN KEY(parent_id, user_id) REFERENCES folders (id, user_id), 
    CONSTRAINT fk_folders_subject_user FOREIGN KEY(subject_id, user_id) REFERENCES subjects (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_folders_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_folders_id_user UNIQUE (id, user_id)
);

CREATE INDEX ix_folders_user_id ON folders (user_id);

CREATE INDEX ix_folders_user_subject ON folders (user_id, subject_id);

CREATE TABLE lessons (
    user_id UUID NOT NULL, 
    subject_id UUID NOT NULL, 
    folder_id UUID, 
    title VARCHAR(200) NOT NULL, 
    lesson_date DATE, 
    observations TEXT, 
    is_favorite BOOLEAN DEFAULT 'false' NOT NULL, 
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(title, ''))) STORED NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_lessons PRIMARY KEY (id), 
    CONSTRAINT ck_lessons_titulo_nao_vazio CHECK (length(trim(title)) > 0), 
    CONSTRAINT fk_lessons_folder_user FOREIGN KEY(folder_id, user_id) REFERENCES folders (id, user_id), 
    CONSTRAINT fk_lessons_subject_user FOREIGN KEY(subject_id, user_id) REFERENCES subjects (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_lessons_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_lessons_id_user UNIQUE (id, user_id)
);

CREATE INDEX ix_lessons_search ON lessons USING gin (search_vector);

CREATE INDEX ix_lessons_user_id ON lessons (user_id);

CREATE INDEX ix_lessons_user_subject ON lessons (user_id, subject_id);

CREATE INDEX ix_lessons_user_updated ON lessons (user_id, updated_at);

CREATE TABLE notes (
    user_id UUID NOT NULL, 
    lesson_id UUID NOT NULL, 
    content TEXT NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_notes PRIMARY KEY (id), 
    CONSTRAINT fk_notes_lesson_user FOREIGN KEY(lesson_id, user_id) REFERENCES lessons (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_notes_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_notes_lesson ON notes (user_id, lesson_id);

CREATE INDEX ix_notes_user_id ON notes (user_id);

CREATE TABLE source_materials (
    user_id UUID NOT NULL, 
    lesson_id UUID NOT NULL, 
    content TEXT NOT NULL, 
    content_hash VARCHAR(64) NOT NULL, 
    origin VARCHAR(10) DEFAULT 'typed' NOT NULL, 
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(content, ''))) STORED NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_source_materials PRIMARY KEY (id), 
    CONSTRAINT ck_source_materials_origem_valida CHECK (origin IN ('typed', 'pasted')), 
    CONSTRAINT ck_source_materials_conteudo_nao_vazio CHECK (length(content) > 0), 
    CONSTRAINT fk_source_materials_lesson_user FOREIGN KEY(lesson_id, user_id) REFERENCES lessons (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_source_materials_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_source_materials_id_user UNIQUE (id, user_id)
);

CREATE INDEX ix_source_materials_lesson ON source_materials (user_id, lesson_id);

CREATE INDEX ix_source_materials_search ON source_materials USING gin (search_vector);

CREATE INDEX ix_source_materials_user_id ON source_materials (user_id);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

-- Running upgrade 0001 -> 0002

CREATE TABLE ai_generations (
    user_id UUID NOT NULL, 
    material_id UUID NOT NULL, 
    operation VARCHAR(40) NOT NULL, 
    detail_level VARCHAR(12) NOT NULL, 
    input_hash VARCHAR(64) NOT NULL, 
    provider VARCHAR(40) NOT NULL, 
    model VARCHAR(80) NOT NULL, 
    result JSONB NOT NULL, 
    input_tokens INTEGER DEFAULT '0' NOT NULL, 
    output_tokens INTEGER DEFAULT '0' NOT NULL, 
    estimated_cost_usd NUMERIC(12, 6) DEFAULT '0' NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_ai_generations PRIMARY KEY (id), 
    CONSTRAINT fk_ai_generations_material_user FOREIGN KEY(material_id, user_id) REFERENCES source_materials (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_ai_generations_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_ai_generations_id_user UNIQUE (id, user_id), 
    CONSTRAINT uq_ai_generations_dedup UNIQUE (user_id, material_id, operation, detail_level, input_hash)
);

CREATE INDEX ix_ai_generations_user_created ON ai_generations (user_id, created_at);

CREATE INDEX ix_ai_generations_user_id ON ai_generations (user_id);

CREATE TABLE ai_usage_logs (
    user_id UUID NOT NULL, 
    generation_id UUID, 
    operation VARCHAR(40) NOT NULL, 
    provider VARCHAR(40) NOT NULL, 
    model VARCHAR(80) NOT NULL, 
    status VARCHAR(16) NOT NULL, 
    input_tokens INTEGER DEFAULT '0' NOT NULL, 
    output_tokens INTEGER DEFAULT '0' NOT NULL, 
    estimated_cost_usd NUMERIC(12, 6) DEFAULT '0' NOT NULL, 
    duration_ms INTEGER DEFAULT '0' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    CONSTRAINT pk_ai_usage_logs PRIMARY KEY (id), 
    CONSTRAINT ck_ai_usage_logs_status_valido CHECK (status IN ('ok', 'timeout', 'rate_limited', 'error', 'invalid_output')), 
    CONSTRAINT fk_ai_usage_logs_generation_id FOREIGN KEY(generation_id) REFERENCES ai_generations (id) ON DELETE SET NULL, 
    CONSTRAINT fk_ai_usage_logs_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_ai_usage_logs_created ON ai_usage_logs (created_at);

CREATE INDEX ix_ai_usage_logs_user_created ON ai_usage_logs (user_id, created_at);

CREATE INDEX ix_ai_usage_logs_user_id ON ai_usage_logs (user_id);

CREATE TABLE summaries (
    user_id UUID NOT NULL, 
    lesson_id UUID NOT NULL, 
    generation_id UUID, 
    kind VARCHAR(40) NOT NULL, 
    title VARCHAR(200) NOT NULL, 
    content TEXT NOT NULL, 
    current_version INTEGER DEFAULT '1' NOT NULL, 
    is_favorite BOOLEAN DEFAULT 'false' NOT NULL, 
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, ''))) STORED NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_summaries PRIMARY KEY (id), 
    CONSTRAINT ck_summaries_versao_positiva CHECK (current_version >= 1), 
    CONSTRAINT ck_summaries_titulo_nao_vazio CHECK (length(trim(title)) > 0), 
    CONSTRAINT fk_summaries_generation_user FOREIGN KEY(generation_id, user_id) REFERENCES ai_generations (id, user_id) ON DELETE SET NULL (generation_id), 
    CONSTRAINT fk_summaries_lesson_user FOREIGN KEY(lesson_id, user_id) REFERENCES lessons (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_summaries_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_summaries_id_user UNIQUE (id, user_id)
);

CREATE INDEX ix_summaries_lesson ON summaries (user_id, lesson_id);

CREATE INDEX ix_summaries_search ON summaries USING gin (search_vector);

CREATE INDEX ix_summaries_user_id ON summaries (user_id);

CREATE INDEX ix_summaries_user_updated ON summaries (user_id, updated_at);

CREATE TABLE summary_versions (
    user_id UUID NOT NULL, 
    summary_id UUID NOT NULL, 
    version_number INTEGER NOT NULL, 
    title VARCHAR(200) NOT NULL, 
    content TEXT NOT NULL, 
    origin VARCHAR(10) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    CONSTRAINT pk_summary_versions PRIMARY KEY (id), 
    CONSTRAINT ck_summary_versions_origem_valida CHECK (origin IN ('ai', 'user', 'duplicate')), 
    CONSTRAINT fk_summary_versions_summary_user FOREIGN KEY(summary_id, user_id) REFERENCES summaries (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_summary_versions_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_summary_versions_number UNIQUE (summary_id, version_number)
);

CREATE INDEX ix_summary_versions_user_id ON summary_versions (user_id);

UPDATE alembic_version SET version_num='0002' WHERE alembic_version.version_num = '0001';

COMMIT;

