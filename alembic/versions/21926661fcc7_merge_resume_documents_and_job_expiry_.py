"""merge resume documents and job expiry heads

Revision ID: 21926661fcc7
Revises: 463ed55ace41, b7c41d9a2f10
Create Date: 2026-10-25 11:12:59.710041

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21926661fcc7'
down_revision: Union[str, Sequence[str], None] = ('463ed55ace41', 'b7c41d9a2f10')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
