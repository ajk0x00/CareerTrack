"""replace education cgpa with description and dates

Revision ID: 7ab241dbbf83
Revises: 9343d7397c39
Create Date: 2026-10-25 12:12:05.581019

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ab241dbbf83'
down_revision: Union[str, Sequence[str], None] = '9343d7397c39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'education',
        sa.Column('description', sa.Text(), server_default='', nullable=False),
    )
    op.add_column('education', sa.Column('start_date', sa.Date(), nullable=True))
    op.add_column('education', sa.Column('end_date', sa.Date(), nullable=True))
    op.drop_column('education', 'cgpa')
    # Backfill is complete once the column exists; drop the temporary default so
    # new rows must supply a description explicitly.
    op.alter_column('education', 'description', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    # cgpa is re-added with a default of 0 so existing rows can satisfy NOT NULL.
    op.add_column(
        'education',
        sa.Column(
            'cgpa',
            sa.Numeric(precision=4, scale=2, asdecimal=False),
            server_default='0',
            nullable=False,
        ),
    )
    op.drop_column('education', 'end_date')
    op.drop_column('education', 'start_date')
    op.drop_column('education', 'description')
