"""textos originais vindos de PDF ou link (origem e nome da fonte)

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-25
"""
import sqlalchemy as sa

from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('source_materials', sa.Column('source_name', sa.String(length=500), nullable=True))
    op.drop_constraint(op.f('ck_source_materials_origem_valida'), 'source_materials', type_='check')
    op.create_check_constraint(
        op.f('ck_source_materials_origem_valida'), 'source_materials',
        "origin IN ('typed', 'pasted', 'image', 'pdf', 'link')",
    )


def downgrade() -> None:
    # Textos vindos de PDF/link voltam a ser tratados como colados.
    op.execute("UPDATE source_materials SET origin = 'pasted' WHERE origin IN ('pdf', 'link')")
    op.drop_constraint(op.f('ck_source_materials_origem_valida'), 'source_materials', type_='check')
    op.create_check_constraint(
        op.f('ck_source_materials_origem_valida'), 'source_materials', "origin IN ('typed', 'pasted', 'image')"
    )
    op.drop_column('source_materials', 'source_name')
