"""imagens (anexos), categoria da materia e geracoes de IA a partir de imagem

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-25
"""
import sqlalchemy as sa

from alembic import op

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Categoria da matéria (área de conhecimento usada nos prompts da IA).
    op.add_column('subjects', sa.Column('category', sa.String(length=30), server_default='outro', nullable=False))

    # Textos originais podem vir de uma imagem (OCR).
    op.drop_constraint(op.f('ck_source_materials_origem_valida'), 'source_materials', type_='check')
    op.create_check_constraint(
        op.f('ck_source_materials_origem_valida'), 'source_materials', "origin IN ('typed', 'pasted', 'image')"
    )

    # Imagens enviadas pelo usuário.
    op.create_table('attachments',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('lesson_id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.String(length=10), server_default='image', nullable=False),
    sa.Column('mime_type', sa.String(length=30), nullable=False),
    sa.Column('width', sa.Integer(), nullable=False),
    sa.Column('height', sa.Integer(), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.CheckConstraint("kind IN ('image')", name=op.f('ck_attachments_tipo_valido')),
    sa.CheckConstraint("mime_type IN ('image/jpeg', 'image/png', 'image/webp')", name=op.f('ck_attachments_mime_valido')),
    sa.CheckConstraint('size_bytes > 0', name=op.f('ck_attachments_tamanho_positivo')),
    sa.ForeignKeyConstraint(['lesson_id', 'user_id'], ['lessons.id', 'lessons.user_id'], name='fk_attachments_lesson_user', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_attachments_user_id'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_attachments')),
    sa.UniqueConstraint('id', 'user_id', name='uq_attachments_id_user'),
    sa.UniqueConstraint('user_id', 'lesson_id', 'sha256', name='uq_attachments_lesson_sha')
    )
    op.create_index('ix_attachments_lesson', 'attachments', ['user_id', 'lesson_id'], unique=False)
    op.create_index(op.f('ix_attachments_user_id'), 'attachments', ['user_id'], unique=False)

    # Gerações de IA: a origem é um texto salvo OU uma imagem (exatamente um dos dois).
    op.alter_column('ai_generations', 'material_id', existing_type=sa.UUID(), nullable=True)
    op.add_column('ai_generations', sa.Column('attachment_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_ai_generations_attachment_user', 'ai_generations', 'attachments',
        ['attachment_id', 'user_id'], ['id', 'user_id'], ondelete='CASCADE',
    )
    op.create_unique_constraint(
        'uq_ai_generations_dedup_attachment', 'ai_generations',
        ['user_id', 'attachment_id', 'operation', 'detail_level', 'input_hash'],
    )
    op.create_check_constraint(
        op.f('ck_ai_generations_uma_origem'), 'ai_generations', 'num_nonnulls(material_id, attachment_id) = 1'
    )


def downgrade() -> None:
    # Gerações feitas a partir de imagem não existem na versão anterior do esquema.
    op.execute("DELETE FROM ai_generations WHERE material_id IS NULL")
    op.drop_constraint(op.f('ck_ai_generations_uma_origem'), 'ai_generations', type_='check')
    op.drop_constraint('uq_ai_generations_dedup_attachment', 'ai_generations', type_='unique')
    op.drop_constraint('fk_ai_generations_attachment_user', 'ai_generations', type_='foreignkey')
    op.drop_column('ai_generations', 'attachment_id')
    op.alter_column('ai_generations', 'material_id', existing_type=sa.UUID(), nullable=False)

    op.drop_index(op.f('ix_attachments_user_id'), table_name='attachments')
    op.drop_index('ix_attachments_lesson', table_name='attachments')
    op.drop_table('attachments')

    op.execute("UPDATE source_materials SET origin = 'pasted' WHERE origin = 'image'")
    op.drop_constraint(op.f('ck_source_materials_origem_valida'), 'source_materials', type_='check')
    op.create_check_constraint(
        op.f('ck_source_materials_origem_valida'), 'source_materials', "origin IN ('typed', 'pasted')"
    )

    op.drop_column('subjects', 'category')
