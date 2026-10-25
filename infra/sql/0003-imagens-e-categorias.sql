BEGIN;

-- Running upgrade 0002 -> 0003

ALTER TABLE subjects ADD COLUMN category VARCHAR(30) DEFAULT 'outro' NOT NULL;

ALTER TABLE source_materials DROP CONSTRAINT ck_source_materials_origem_valida;

ALTER TABLE source_materials ADD CONSTRAINT ck_source_materials_origem_valida CHECK (origin IN ('typed', 'pasted', 'image'));

CREATE TABLE attachments (
    user_id UUID NOT NULL, 
    lesson_id UUID NOT NULL, 
    kind VARCHAR(10) DEFAULT 'image' NOT NULL, 
    mime_type VARCHAR(30) NOT NULL, 
    width INTEGER NOT NULL, 
    height INTEGER NOT NULL, 
    size_bytes INTEGER NOT NULL, 
    sha256 VARCHAR(64) NOT NULL, 
    data BYTEA NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    CONSTRAINT pk_attachments PRIMARY KEY (id), 
    CONSTRAINT ck_attachments_tipo_valido CHECK (kind IN ('image')), 
    CONSTRAINT ck_attachments_mime_valido CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')), 
    CONSTRAINT ck_attachments_tamanho_positivo CHECK (size_bytes > 0), 
    CONSTRAINT fk_attachments_lesson_user FOREIGN KEY(lesson_id, user_id) REFERENCES lessons (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_attachments_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_attachments_id_user UNIQUE (id, user_id), 
    CONSTRAINT uq_attachments_lesson_sha UNIQUE (user_id, lesson_id, sha256)
);

CREATE INDEX ix_attachments_lesson ON attachments (user_id, lesson_id);

CREATE INDEX ix_attachments_user_id ON attachments (user_id);

ALTER TABLE ai_generations ALTER COLUMN material_id DROP NOT NULL;

ALTER TABLE ai_generations ADD COLUMN attachment_id UUID;

ALTER TABLE ai_generations ADD CONSTRAINT fk_ai_generations_attachment_user FOREIGN KEY(attachment_id, user_id) REFERENCES attachments (id, user_id) ON DELETE CASCADE;

ALTER TABLE ai_generations ADD CONSTRAINT uq_ai_generations_dedup_attachment UNIQUE (user_id, attachment_id, operation, detail_level, input_hash);

ALTER TABLE ai_generations ADD CONSTRAINT ck_ai_generations_uma_origem CHECK (num_nonnulls(material_id, attachment_id) = 1);

UPDATE alembic_version SET version_num='0003' WHERE alembic_version.version_num = '0002';

COMMIT;

