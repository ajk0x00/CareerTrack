"""Endpoints for persisting, drafting, and exporting resumes built from career data."""

from datetime import date, datetime, timezone
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.llm.resume_generation import (
    ResumeGenerationConfigurationError,
    ResumeGenerationError,
)
from app.models.job import Job
from app.models.resume import Resume
from app.models.user import User
from app.schemas.resume import (
    AtsReport,
    ResumeCreate,
    ResumeDetail,
    ResumeDraftResponse,
    ResumeGenerationRequest,
    ResumeSummary,
    ResumeUpdate,
)
from app.services.resume import ResumeDraftService, ResumeGenerationService
from app.services.resume_export import ResumeExportService, build_keyword_coverage

logger = logging.getLogger(__name__)

router = APIRouter()


def _slugify(value: str) -> str:
    """Lowercases and collapses non-alphanumeric runs into single hyphens."""
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _display_name(user: User) -> str:
    """Returns the user's name or the email local part when the name is empty."""
    name = (user.name or "").strip()
    if name:
        return name
    return user.email.split("@", 1)[0]


def _job_posting_text(job: Job) -> str:
    """Combines a stored job description and requirements into one prompt-ready string."""
    description = (job.description or "").strip()
    requirements = (job.requirements or "").strip()
    if description and requirements:
        return f"{description}\n\nKey Requirements & Qualifications:\n{requirements}"
    return description or requirements


def _to_summary(resume: Resume, job: Job | None) -> ResumeSummary:
    """Builds a list representation from a resume and its optional job."""
    return ResumeSummary(
        id=resume.id,
        title=resume.title,
        job_id=resume.job_id,
        job_title=job.title if job is not None else None,
        job_company=job.company_name if job is not None else None,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
        exported_at=resume.exported_at,
    )


def _to_detail(resume: Resume, job: Job | None) -> ResumeDetail:
    """Builds a full representation from a resume and its optional job."""
    summary = _to_summary(resume, job)
    return ResumeDetail(**summary.model_dump(), markdown=resume.markdown)


async def _get_resume(
    resume_id: int,
    user: User,
    db: AsyncSession,
) -> Resume:
    """Loads a resume owned by the user or raises a 404."""
    stmt = select(Resume).where(
        Resume.id == resume_id,
        Resume.user_id == user.id,
    )
    result = await db.execute(stmt)
    resume = result.scalar_one_or_none()
    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found",
        )
    return resume


async def _ensure_no_canonical(user: User, db: AsyncSession) -> None:
    """Raises 409 when the user already has a canonical (untailored) resume."""
    stmt = select(Resume.id).where(
        Resume.user_id == user.id,
        Resume.job_id.is_(None),
    )
    if (await db.execute(stmt)).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A canonical resume already exists for this user",
        )


@router.post(
    "",
    response_model=ResumeDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Persist a generated resume",
)
async def create_resume(
    data: ResumeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResumeDetail:
    """Stores resume markdown, optionally tied to a job owned by the caller."""
    job: Job | None = None
    if data.job_id is not None:
        job_stmt = select(Job).where(
            Job.id == data.job_id,
            Job.user_id == current_user.id,
        )
        job = (await db.execute(job_stmt)).scalar_one_or_none()
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found",
            )

    if data.title is None:
        if job is not None:
            generated_title = f"{job.title} @ {job.company_name}"
        else:
            generated_title = "Master Resume"
        if data.job_id is None:
            await _ensure_no_canonical(current_user, db)
    else:
        generated_title = data.title

    resume = Resume(
        user_id=current_user.id,
        title=generated_title[:150],
        markdown=data.markdown,
    )
    if job is not None:
        resume.job = job

    db.add(resume)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        detail = (
            "A resume already exists for this job"
            if data.job_id is not None
            else "A canonical resume already exists for this user"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        ) from exc
    await db.refresh(resume)
    return _to_detail(resume, job)


@router.get(
    "",
    response_model=list[ResumeSummary],
    summary="List stored resumes for the current user",
)
async def list_resumes(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ResumeSummary]:
    """Returns the user's resumes newest-updated first."""
    stmt = (
        select(Resume)
        .where(Resume.user_id == current_user.id)
        .order_by(Resume.updated_at.desc())
    )
    resumes = (await db.execute(stmt)).scalars().all()
    return [_to_summary(resume, resume.job) for resume in resumes]


@router.get(
    "/draft",
    response_model=ResumeDraftResponse,
    summary="Build a resume draft from live career data",
)
async def get_resume_draft(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResumeDraftResponse:
    """Builds a draft from stored profile, experience, and skills without persisting it."""
    return await ResumeDraftService.build_draft(current_user.id, db)


@router.post(
    "/generate",
    response_model=ResumeDraftResponse,
    summary="Generate a tailored or generic resume with AI",
    responses={
        404: {"description": "Target job not found"},
        502: {"description": "Resume generation service failed"},
        503: {"description": "Resume generation is not configured on this server"},
    },
)
async def generate_resume(
    data: ResumeGenerationRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResumeDraftResponse:
    """Generates ATS-oriented Markdown against a job description without persisting it."""
    job: Job | None = None
    if data.job_id is not None:
        job_stmt = select(Job).where(
            Job.id == data.job_id,
            Job.user_id == current_user.id,
            Job.expired_at.is_(None),
        )
        job = (await db.execute(job_stmt)).scalar_one_or_none()
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found",
            )

    job_description = data.job_description
    if job_description is None and job is not None:
        job_description = _job_posting_text(job) or None

    try:
        return await ResumeGenerationService.generate(
            user_id=current_user.id,
            job_description=job_description,
            db=db,
        )
    except ResumeGenerationConfigurationError as exc:
        logger.error(
            "Resume generation is not configured (user_id=%d): %s",
            current_user.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Resume generation is not configured on this server yet. "
                "Ask an administrator to set the LLM credentials."
            ),
        ) from exc
    except ResumeGenerationError as exc:
        logger.warning(
            "Resume generation rejected for user_id=%d: %s",
            current_user.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resume generation failed. Please try again.",
        ) from exc
    except Exception as exc:
        logger.exception(
            "Resume generation failed for user_id=%d",
            current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resume generation service is unavailable. Please try again.",
        ) from exc


@router.get(
    "/{resume_id}",
    response_model=ResumeDetail,
    summary="Get a stored resume by ID",
)
async def get_resume(
    resume_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResumeDetail:
    """Returns a resume belonging to the authenticated user."""
    resume = await _get_resume(resume_id, current_user, db)
    return _to_detail(resume, resume.job)


@router.patch(
    "/{resume_id}",
    response_model=ResumeDetail,
    summary="Partially update a stored resume",
)
async def update_resume(
    resume_id: int,
    data: ResumeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResumeDetail:
    """Applies only the fields provided in the request body."""
    resume = await _get_resume(resume_id, current_user, db)
    job = resume.job
    update_data = data.model_dump(exclude_unset=True)

    if update_data.get("title") is not None:
        resume.title = update_data["title"]
    if update_data.get("markdown") is not None:
        resume.markdown = update_data["markdown"]

    await db.flush()
    await db.refresh(resume)
    return _to_detail(resume, job)


@router.delete(
    "/{resume_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a stored resume",
)
async def delete_resume(
    resume_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Deletes a resume belonging to the authenticated user."""
    resume = await _get_resume(resume_id, current_user, db)
    await db.delete(resume)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{resume_id}/export",
    summary="Export a stored resume as an ATS-safe PDF",
)
async def export_resume(
    resume_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Renders the resume markdown to PDF and records the export on the row."""
    resume = await _get_resume(resume_id, current_user, db)
    user_name = _display_name(current_user)
    job = resume.job

    try:
        pdf_bytes, report, _ = ResumeExportService.render_pdf(resume.markdown, user_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Failed to render resume id=%d to PDF", resume.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resume PDF rendering failed",
        ) from exc

    user_slug = _slugify(user_name) or "resume"
    company_slug = _slugify(job.company_name if job is not None else "") or "general"
    file_name = f"{user_slug}-{company_slug}-{date.today().isoformat()}.pdf"

    resume.file_name = file_name
    resume.exported_at = datetime.now(timezone.utc)
    await db.flush()

    logger.info(
        "Exported resume id=%d pages=%d chars=%d",
        resume.id,
        report.page_count,
        report.char_count,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@router.get(
    "/{resume_id}/ats-report",
    response_model=AtsReport,
    summary="Verify the rendered resume and compute keyword coverage",
)
async def get_ats_report(
    resume_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AtsReport:
    """Re-renders the resume in memory and reports ATS parse and keyword results."""
    resume = await _get_resume(resume_id, current_user, db)
    user_name = _display_name(current_user)
    job = resume.job

    try:
        pdf_bytes, report, _ = ResumeExportService.render_pdf(resume.markdown, user_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Failed to render resume id=%d for ATS report", resume.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resume PDF rendering failed",
        ) from exc

    if job is None:
        return report

    requirements_text = (job.requirements or "").strip() or (job.description or "")
    pdf_text = ResumeExportService.extract_text(pdf_bytes)
    coverage, matched, missing = build_keyword_coverage(pdf_text, requirements_text)
    return report.model_copy(
        update={
            "keyword_coverage": coverage,
            "matched_keywords": matched,
            "missing_keywords": missing,
        }
    )
