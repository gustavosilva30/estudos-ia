BEGIN;

-- Running upgrade 0003 -> 0004

ALTER TABLE source_materials ADD COLUMN source_name VARCHAR(500);

ALTER TABLE source_materials DROP CONSTRAINT ck_source_materials_origem_valida;

ALTER TABLE source_materials ADD CONSTRAINT ck_source_materials_origem_valida CHECK (origin IN ('typed', 'pasted', 'image', 'pdf', 'link'));

UPDATE alembic_version SET version_num='0004' WHERE alembic_version.version_num = '0003';

COMMIT;

