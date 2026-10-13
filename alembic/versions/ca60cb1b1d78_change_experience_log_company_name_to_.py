"""change_experience_log_company_name_to_company_id_fk

Revision ID: ca60cb1b1d78
Revises: 5cb37eeab91f
Create Date: 2026-10-13 21:27:32.986275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca60cb1b1d78'
down_revision: Union[str, Sequence[str], None] = '5cb37eeab91f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DELETE FROM experience_logs")
    op.add_column('experience_logs', sa.Column('company_id', sa.Integer(), nullable=False))
    op.drop_index(op.f('ix_experience_logs_company_name'), table_name='experience_logs')
    op.create_index(op.f('ix_experience_logs_company_id'), 'experience_logs', ['company_id'], unique=False)
    op.create_foreign_key(
        'fk_experience_logs_company_id_companies_worked',
        'experience_logs',
        'companies_worked',
        ['company_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.drop_column('experience_logs', 'company_name')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('experience_logs', sa.Column('company_name', sa.VARCHAR(length=255), autoincrement=False, nullable=True))
    op.drop_constraint('fk_experience_logs_company_id_companies_worked', 'experience_logs', type_='foreignkey')
    op.drop_index(op.f('ix_experience_logs_company_id'), table_name='experience_logs')
    op.create_index(op.f('ix_experience_logs_company_name'), 'experience_logs', ['company_name'], unique=False)
    op.drop_column('experience_logs', 'company_id')
