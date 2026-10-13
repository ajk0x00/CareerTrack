"""create_experience_logs_table

Revision ID: 5cb37eeab91f
Revises: 3a26aef408c1
Create Date: 2026-10-13 21:05:19.861852

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5cb37eeab91f'
down_revision: Union[str, Sequence[str], None] = '3a26aef408c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'experience_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('company_name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_experience_logs_company_name'), 'experience_logs', ['company_name'], unique=False)
    op.create_index(op.f('ix_experience_logs_id'), 'experience_logs', ['id'], unique=False)
    op.create_index(op.f('ix_experience_logs_user_id'), 'experience_logs', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_experience_logs_user_id'), table_name='experience_logs')
    op.drop_index(op.f('ix_experience_logs_id'), table_name='experience_logs')
    op.drop_index(op.f('ix_experience_logs_company_name'), table_name='experience_logs')
    op.drop_table('experience_logs')
