BEGIN;

-- Running upgrade 0004 -> 0005

CREATE TABLE formula_marks (
    user_id UUID NOT NULL, 
    formula_key VARCHAR(80) NOT NULL, 
    is_favorite BOOLEAN DEFAULT 'false' NOT NULL, 
    note TEXT, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_formula_marks PRIMARY KEY (id), 
    CONSTRAINT ck_formula_marks_chave_curta CHECK (length(formula_key) <= 80), 
    CONSTRAINT fk_formula_marks_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_formula_marks_user_key UNIQUE (user_id, formula_key)
);

CREATE INDEX ix_formula_marks_user_id ON formula_marks (user_id);

CREATE TABLE custom_formulas (
    user_id UUID NOT NULL, 
    title VARCHAR(120) NOT NULL, 
    category VARCHAR(12) DEFAULT 'outra' NOT NULL, 
    latex VARCHAR(500), 
    description TEXT, 
    variables JSONB DEFAULT '[]' NOT NULL, 
    expression VARCHAR(300) NOT NULL, 
    result_name VARCHAR(16) NOT NULL, 
    result_label VARCHAR(60) DEFAULT 'resultado' NOT NULL, 
    result_unit VARCHAR(30), 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_custom_formulas PRIMARY KEY (id), 
    CONSTRAINT ck_custom_formulas_categoria_valida CHECK (category IN ('matematica', 'fisica', 'quimica', 'outra')), 
    CONSTRAINT ck_custom_formulas_titulo_nao_vazio CHECK (length(title) > 0), 
    CONSTRAINT fk_custom_formulas_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_custom_formulas_id_user UNIQUE (id, user_id)
);

CREATE INDEX ix_custom_formulas_user ON custom_formulas (user_id, created_at);

CREATE INDEX ix_custom_formulas_user_id ON custom_formulas (user_id);

CREATE TABLE lesson_formulas (
    user_id UUID NOT NULL, 
    lesson_id UUID NOT NULL, 
    formula_key VARCHAR(80) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    id UUID DEFAULT gen_random_uuid() NOT NULL, 
    CONSTRAINT pk_lesson_formulas PRIMARY KEY (id), 
    CONSTRAINT fk_lesson_formulas_lesson_user FOREIGN KEY(lesson_id, user_id) REFERENCES lessons (id, user_id) ON DELETE CASCADE, 
    CONSTRAINT fk_lesson_formulas_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT uq_lesson_formulas_lesson_key UNIQUE (user_id, lesson_id, formula_key)
);

CREATE INDEX ix_lesson_formulas_key ON lesson_formulas (user_id, formula_key);

CREATE INDEX ix_lesson_formulas_lesson ON lesson_formulas (user_id, lesson_id);

CREATE INDEX ix_lesson_formulas_user_id ON lesson_formulas (user_id);

ALTER TABLE source_materials DROP CONSTRAINT ck_source_materials_origem_valida;

ALTER TABLE source_materials ADD CONSTRAINT ck_source_materials_origem_valida CHECK (origin IN ('typed', 'pasted', 'image', 'pdf', 'link', 'formula'));

UPDATE alembic_version SET version_num='0005' WHERE alembic_version.version_num = '0004';

COMMIT;

