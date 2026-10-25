"""add job expiry

Revision ID: 463ed55ace41
Revises: ca60cb1b1d78
Create Date: 2026-10-24 13:52:28.266115

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '463ed55ace41'
down_revision: Union[str, Sequence[str], None] = 'ca60cb1b1d78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('jobs', sa.Column('expired_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_jobs_status_created_at', 'jobs', ['status', 'created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_jobs_status_created_at', table_name='jobs')
    op.drop_column('jobs', 'expired_at')
