"""scope resume uniqueness to jobs instead of canonical rows

Revision ID: b7c41d9a2f10
Revises: 1feee87e40de
Create Date: 2026-10-24 12:05:00.000000

The original partial unique index on (user_id) WHERE job_id IS NULL made
jobs.job_id ON DELETE SET NULL unusable: deleting a job rewrites its tailored
resumes to job_id = NULL, which immediately collided with the existing canonical
resume and aborted the delete. Uniqueness is now scoped to (user_id, job_id) for
job-bound resumes, and the single-canonical rule is enforced in the API layer.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c41d9a2f10'
down_revision: Union[str, Sequence[str], None] = '1feee87e40de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index('uq_resumes_user_canonical', table_name='resumes')
    op.create_index(
        'uq_resumes_user_job',
        'resumes',
        ['user_id', 'job_id'],
        unique=True,
        postgresql_where=sa.text('job_id IS NOT NULL'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_resumes_user_job', table_name='resumes')
    op.create_index(
        'uq_resumes_user_canonical',
        'resumes',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text('job_id IS NULL'),
    )
