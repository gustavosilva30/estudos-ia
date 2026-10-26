"""formulas do usuario: favoritos/anotacoes, formulas proprias e vinculo com aulas

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-26
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('formula_marks',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('formula_key', sa.String(length=80), nullable=False),
    sa.Column('is_favorite', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('length(formula_key) <= 80', name=op.f('ck_formula_marks_chave_curta')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_formula_marks_user_id'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_formula_marks')),
    sa.UniqueConstraint('user_id', 'formula_key', name='uq_formula_marks_user_key')
    )
    op.create_index(op.f('ix_formula_marks_user_id'), 'formula_marks', ['user_id'], unique=False)

    op.create_table('custom_formulas',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('category', sa.String(length=12), server_default='outra', nullable=False),
    sa.Column('latex', sa.String(length=500), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('variables', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('expression', sa.String(length=300), nullable=False),
    sa.Column('result_name', sa.String(length=16), nullable=False),
    sa.Column('result_label', sa.String(length=60), server_default='resultado', nullable=False),
    sa.Column('result_unit', sa.String(length=30), nullable=True),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("category IN ('matematica', 'fisica', 'quimica', 'outra')", name=op.f('ck_custom_formulas_categoria_valida')),
    sa.CheckConstraint('length(title) > 0', name=op.f('ck_custom_formulas_titulo_nao_vazio')),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_custom_formulas_user_id'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_custom_formulas')),
    sa.UniqueConstraint('id', 'user_id', name='uq_custom_formulas_id_user')
    )
    op.create_index('ix_custom_formulas_user', 'custom_formulas', ['user_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_custom_formulas_user_id'), 'custom_formulas', ['user_id'], unique=False)

    op.create_table('lesson_formulas',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('lesson_id', sa.UUID(), nullable=False),
    sa.Column('formula_key', sa.String(length=80), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.ForeignKeyConstraint(['lesson_id', 'user_id'], ['lessons.id', 'lessons.user_id'], name='fk_lesson_formulas_lesson_user', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_lesson_formulas_user_id'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_lesson_formulas')),
    sa.UniqueConstraint('user_id', 'lesson_id', 'formula_key', name='uq_lesson_formulas_lesson_key')
    )
    op.create_index('ix_lesson_formulas_key', 'lesson_formulas', ['user_id', 'formula_key'], unique=False)
    op.create_index('ix_lesson_formulas_lesson', 'lesson_formulas', ['user_id', 'lesson_id'], unique=False)
    op.create_index(op.f('ix_lesson_formulas_user_id'), 'lesson_formulas', ['user_id'], unique=False)

    # Textos da aula podem nascer de uma fórmula ("salvar como texto" para a IA estudar).
    op.drop_constraint(op.f('ck_source_materials_origem_valida'), 'source_materials', type_='check')
    op.create_check_constraint(
        op.f('ck_source_materials_origem_valida'), 'source_materials',
        "origin IN ('typed', 'pasted', 'image', 'pdf', 'link', 'formula')",
    )


def downgrade() -> None:
    op.execute("UPDATE source_materials SET origin = 'pasted' WHERE origin = 'formula'")
    op.drop_constraint(op.f('ck_source_materials_origem_valida'), 'source_materials', type_='check')
    op.create_check_constraint(
        op.f('ck_source_materials_origem_valida'), 'source_materials',
        "origin IN ('typed', 'pasted', 'image', 'pdf', 'link')",
    )
    op.drop_index(op.f('ix_lesson_formulas_user_id'), table_name='lesson_formulas')
    op.drop_index('ix_lesson_formulas_lesson', table_name='lesson_formulas')
    op.drop_index('ix_lesson_formulas_key', table_name='lesson_formulas')
    op.drop_table('lesson_formulas')
    op.drop_index(op.f('ix_custom_formulas_user_id'), table_name='custom_formulas')
    op.drop_index('ix_custom_formulas_user', table_name='custom_formulas')
    op.drop_table('custom_formulas')
    op.drop_index(op.f('ix_formula_marks_user_id'), table_name='formula_marks')
    op.drop_table('formula_marks')
