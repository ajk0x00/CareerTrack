"""API router and endpoints for Resume workflow operations."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.resume import ResumeImportRequest, ResumeImportResponse
from app.services.resume import ResumeImportService

router = APIRouter()


@router.post(
    "/import",
    response_model=ResumeImportResponse,
    status_code=status.HTTP_200_OK,
    summary="Import career data from Markdown resume via LLM",
)
async def import_resume(
    data: ResumeImportRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResumeImportResponse:
    """Parses a Markdown resume with an LLM and updates employment history, accomplishments, and skills."""
    try:
        return await ResumeImportService.import_resume(
            user_id=current_user.id,
            resume_markdown=data.resume_markdown,
            db=db,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process resume data: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM extraction service error: {exc}",
        ) from exc
