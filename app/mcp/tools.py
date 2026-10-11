"""MCP tools definitions for CareerTrack.

Exposes read-only inspection tools for querying:
- Technical and soft skills (with optional proficiency or search query filtering)
- Career preferences and priorities (with optional importance filtering)
- Companies worked in, tenure, and verified work experience timeline
- Experience summary with ATS-grade calendar tenure calculation
- Workspaces
- Comprehensive ATS-ready career context snapshot
"""

from datetime import date
from typing import Any

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy import func, select

from app.core.database import async_session_factory
from app.mcp.auth import resolve_user
from app.mcp.experience import (
    calculate_experience_summary,
    compute_company_tenure,
)
from app.models.company import CompanyWorked, EmploymentType
from app.models.job import Job, JobStatus, WorkplaceType
from app.models.preference import Preference, PreferenceImportance
from app.models.skill import Skill, SkillProficiency
from app.models.workspace import Workspace


def register_tools(server: MCPServer) -> None:
    """Registers CareerTrack read-only tools onto the provided MCPServer instance."""

    # -------------------------------------------------------------------------
    # Skills Tools (Read-Only)
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_skills",
        description="Retrieve the authenticated user's technical and professional skills, with optional filtering by proficiency or search query.",
    )
    async def get_skills(
        proficiency: str | None = None,
        query: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(Skill).where(Skill.user_id == user.id)
            if proficiency:
                clean_prof = proficiency.strip().lower()
                valid_profs = [p.value for p in SkillProficiency]
                if clean_prof not in valid_profs:
                    raise ToolError(
                        f"Invalid proficiency '{proficiency}'. Allowed values: {', '.join(valid_profs)}"
                    )
                stmt = stmt.where(Skill.proficiency == clean_prof)

            if query and query.strip():
                clean_q = f"%{query.strip().lower()}%"
                stmt = stmt.where(func.lower(Skill.name).like(clean_q))

            stmt = stmt.order_by(Skill.name.asc())
            result = await db.execute(stmt)
            skills = result.scalars().all()

            return {
                "skills": [
                    {
                        "id": s.id,
                        "name": s.name,
                        "proficiency": s.proficiency,
                        "created_at": s.created_at.isoformat(),
                    }
                    for s in skills
                ],
                "total": len(skills),
            }

    # -------------------------------------------------------------------------
    # Career Preferences Tools (Read-Only)
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_preferences",
        description="Retrieve the user's career preferences, priorities, and constraints with optional filtering by importance.",
    )
    async def get_preferences(
        importance: str | None = None,
        query: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(Preference).where(Preference.user_id == user.id)
            if importance:
                clean_imp = importance.strip().lower()
                valid_imps = [i.value for i in PreferenceImportance]
                if clean_imp not in valid_imps:
                    raise ToolError(
                        f"Invalid importance '{importance}'. Allowed values: {', '.join(valid_imps)}"
                    )
                stmt = stmt.where(Preference.importance == clean_imp)

            if query and query.strip():
                clean_q = f"%{query.strip().lower()}%"
                stmt = stmt.where(
                    func.lower(Preference.title).like(clean_q)
                    | func.lower(Preference.description).like(clean_q)
                )

            stmt = stmt.order_by(Preference.created_at.desc())
            result = await db.execute(stmt)
            prefs = result.scalars().all()

            return {
                "preferences": [
                    {
                        "id": p.id,
                        "title": p.title,
                        "description": p.description,
                        "importance": p.importance,
                        "created_at": p.created_at.isoformat(),
                    }
                    for p in prefs
                ],
                "total": len(prefs),
            }

    # -------------------------------------------------------------------------
    # Work Experience Tools (Read-Only)
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_work_experience",
        description="Retrieve the user's work experience timeline including company names, dates, employment types, and calculated tenures.",
    )
    async def get_work_experience(
        actively_working: bool | None = None,
        employment_type: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(CompanyWorked).where(CompanyWorked.user_id == user.id)
            if actively_working is not None:
                stmt = stmt.where(CompanyWorked.actively_working == actively_working)

            if employment_type is not None:
                clean_type = employment_type.strip().lower()
                valid_types = [t.value for t in EmploymentType]
                if clean_type not in valid_types:
                    raise ToolError(
                        f"Invalid employment_type '{employment_type}'. Allowed: {', '.join(valid_types)}"
                    )
                stmt = stmt.where(CompanyWorked.employment_type == clean_type)

            stmt = stmt.order_by(CompanyWorked.start_date.desc())
            result = await db.execute(stmt)
            companies = result.scalars().all()

            timeline: list[dict[str, Any]] = []
            for c in companies:
                months, tenure_formatted = compute_company_tenure(
                    c.start_date, c.end_date, c.actively_working
                )
                timeline.append(
                    {
                        "id": c.id,
                        "company_name": c.company_name,
                        "employment_type": c.employment_type,
                        "start_date": c.start_date.isoformat(),
                        "end_date": c.end_date.isoformat() if c.end_date else None,
                        "actively_working": c.actively_working,
                        "tenure_months": months,
                        "tenure_formatted": tenure_formatted,
                    }
                )

            return {
                "companies": timeline,
                "total": len(timeline),
            }

    @server.tool(
        name="get_experience_summary",
        description="Compute total verified years and months of work experience (with non-overlapping calendar intervals), active roles, and tenure breakdown.",
    )
    async def get_experience_summary(
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = (
                select(CompanyWorked)
                .where(CompanyWorked.user_id == user.id)
                .order_by(CompanyWorked.start_date.desc())
            )
            result = await db.execute(stmt)
            companies = result.scalars().all()

            summary = calculate_experience_summary(list(companies))
            return summary

    # -------------------------------------------------------------------------
    # Workspaces Tools (Read-Only)
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_workspaces",
        description="Retrieve all workspaces for the authenticated user.",
    )
    async def get_workspaces(
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = (
                select(Workspace)
                .where(Workspace.user_id == user.id)
                .order_by(Workspace.created_at.asc())
            )
            result = await db.execute(stmt)
            workspaces = result.scalars().all()

            return {
                "workspaces": [
                    {
                        "id": w.id,
                        "name": w.name,
                        "created_at": w.created_at.isoformat(),
                    }
                    for w in workspaces
                ],
                "total": len(workspaces),
            }

    # -------------------------------------------------------------------------
    # Job Pipeline Tools (Read & Create)
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_jobs",
        description=(
            "Retrieve the user's tracked job postings and pipeline applications. "
            "Supports optional filtering by pipeline status (saved, applied, interviewing, offer), "
            "workplace type (remote, hybrid, on_site), or search query across title, company, and location."
        ),
    )
    async def get_jobs(
        status: str | None = None,
        query: str | None = None,
        workplace_type: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(Job).where(Job.user_id == user.id)
            if status:
                clean_status = status.strip().lower().replace("-", "_").replace(" ", "_")
                valid_statuses = [s.value for s in JobStatus]
                if clean_status not in valid_statuses:
                    raise ToolError(
                        f"Invalid status '{status}'. Allowed values: {', '.join(valid_statuses)}"
                    )
                stmt = stmt.where(Job.status == clean_status)

            if workplace_type:
                clean_wp = workplace_type.strip().lower().replace("-", "_").replace(" ", "_")
                valid_wp = [w.value for w in WorkplaceType]
                if clean_wp not in valid_wp:
                    raise ToolError(
                        f"Invalid workplace_type '{workplace_type}'. Allowed values: {', '.join(valid_wp)}"
                    )
                stmt = stmt.where(Job.workplace_type == clean_wp)

            if query and query.strip():
                clean_q = f"%{query.strip().lower()}%"
                stmt = stmt.where(
                    func.lower(Job.title).like(clean_q)
                    | func.lower(Job.company_name).like(clean_q)
                    | func.lower(Job.location).like(clean_q)
                )

            stmt = stmt.order_by(Job.updated_at.desc())
            result = await db.execute(stmt)
            jobs = result.scalars().all()

            return {
                "jobs": [
                    {
                        "id": j.id,
                        "title": j.title,
                        "company_name": j.company_name,
                        "status": j.status,
                        "current_stage": j.current_stage,
                        "job_url": j.job_url,
                        "location": j.location,
                        "workplace_type": j.workplace_type,
                        "employment_type": j.employment_type,
                        "department": j.department,
                        "description": j.description,
                        "requirements": j.requirements,
                        "salary_min": j.salary_min,
                        "salary_max": j.salary_max,
                        "salary_currency": j.salary_currency,
                        "salary_interval": j.salary_interval,
                        "posted_date": j.posted_date.isoformat() if j.posted_date else None,
                        "deadline_date": j.deadline_date.isoformat() if j.deadline_date else None,
                        "applied_date": j.applied_date.isoformat() if j.applied_date else None,
                        "excitement_rating": j.excitement_rating,
                        "notes": j.notes,
                        "contact_name": j.contact_name,
                        "contact_email": j.contact_email,
                        "contact_phone": j.contact_phone,
                        "created_at": j.created_at.isoformat(),
                        "updated_at": j.updated_at.isoformat(),
                    }
                    for j in jobs
                ],
                "total": len(jobs),
            }

    @server.tool(
        name="get_job",
        description="Retrieve complete details of a specific job posting from the user's pipeline by ID.",
    )
    async def get_job(
        job_id: int,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(Job).where(Job.id == job_id, Job.user_id == user.id)
            result = await db.execute(stmt)
            job = result.scalars().first()

            if not job:
                raise ToolError(f"Job record with ID {job_id} not found.")

            return {
                "job": {
                    "id": job.id,
                    "title": job.title,
                    "company_name": job.company_name,
                    "status": job.status,
                    "current_stage": job.current_stage,
                    "job_url": job.job_url,
                    "location": job.location,
                    "workplace_type": job.workplace_type,
                    "employment_type": job.employment_type,
                    "department": job.department,
                    "description": job.description,
                    "requirements": job.requirements,
                    "salary_min": job.salary_min,
                    "salary_max": job.salary_max,
                    "salary_currency": job.salary_currency,
                    "salary_interval": job.salary_interval,
                    "posted_date": job.posted_date.isoformat() if job.posted_date else None,
                    "deadline_date": job.deadline_date.isoformat() if job.deadline_date else None,
                    "applied_date": job.applied_date.isoformat() if job.applied_date else None,
                    "excitement_rating": job.excitement_rating,
                    "notes": job.notes,
                    "contact_name": job.contact_name,
                    "contact_email": job.contact_email,
                    "contact_phone": job.contact_phone,
                    "created_at": job.created_at.isoformat(),
                    "updated_at": job.updated_at.isoformat(),
                }
            }

    @server.tool(
        name="get_job_pipeline_summary",
        description="Retrieve an aggregate breakdown of the user's active job pipeline across stages (saved, applied, interviewing, offer).",
    )
    async def get_job_pipeline_summary(
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = (
                select(Job.status, func.count(Job.id))
                .where(Job.user_id == user.id)
                .group_by(Job.status)
            )
            result = await db.execute(stmt)
            counts = dict(result.all())

            saved = counts.get(JobStatus.SAVED.value, 0)
            applied = counts.get(JobStatus.APPLIED.value, 0)
            interviewing = counts.get(JobStatus.INTERVIEWING.value, 0)
            offer = counts.get(JobStatus.OFFER.value, 0)
            total = sum(counts.values())

            return {
                "total": total,
                "saved": saved,
                "applied": applied,
                "interviewing": interviewing,
                "offer": offer,
            }

    @server.tool(
        name="add_job",
        description=(
            "Add a new job posting to the user's career pipeline. Requires title and company_name. "
            "Supports optional description (used for ATS tailoring), requirements, salary range, "
            "location, workplace_type (remote, hybrid, on_site), employment_type, and status (saved, applied, interviewing, offer)."
        ),
    )
    async def add_job(
        title: str,
        company_name: str,
        status: str = "saved",
        job_url: str | None = None,
        location: str | None = None,
        workplace_type: str | None = None,
        employment_type: str | None = None,
        department: str | None = None,
        description: str | None = None,
        requirements: str | None = None,
        salary_min: float | None = None,
        salary_max: float | None = None,
        salary_currency: str = "USD",
        salary_interval: str | None = "yearly",
        posted_date: str | None = None,
        deadline_date: str | None = None,
        current_stage: str | None = None,
        applied_date: str | None = None,
        excitement_rating: int | None = None,
        notes: str | None = None,
        contact_name: str | None = None,
        contact_email: str | None = None,
        contact_phone: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        clean_title = title.strip()
        if not clean_title:
            raise ToolError("Job title cannot be empty.")

        clean_company = company_name.strip()
        if not clean_company:
            raise ToolError("Company name cannot be empty.")

        clean_status = status.strip().lower().replace("-", "_").replace(" ", "_")
        valid_statuses = [s.value for s in JobStatus]
        if clean_status not in valid_statuses:
            raise ToolError(
                f"Invalid status '{status}'. Allowed values: {', '.join(valid_statuses)}"
            )

        clean_wp: str | None = None
        if workplace_type:
            clean_wp = workplace_type.strip().lower().replace("-", "_").replace(" ", "_")
            valid_wp = [w.value for w in WorkplaceType]
            if clean_wp not in valid_wp:
                raise ToolError(
                    f"Invalid workplace_type '{workplace_type}'. Allowed values: {', '.join(valid_wp)}"
                )

        clean_emp: str | None = None
        if employment_type:
            clean_emp = employment_type.strip().lower().replace("-", "_").replace(" ", "_")
            valid_emp = [e.value for e in EmploymentType]
            if clean_emp not in valid_emp:
                raise ToolError(
                    f"Invalid employment_type '{employment_type}'. Allowed values: {', '.join(valid_emp)}"
                )

        clean_interval: str | None = None
        if salary_interval:
            clean_interval = salary_interval.strip().lower().replace("-", "_").replace(" ", "_")
            valid_intervals = ["yearly", "monthly", "hourly"]
            if clean_interval not in valid_intervals:
                raise ToolError(
                    f"Invalid salary_interval '{salary_interval}'. Allowed values: {', '.join(valid_intervals)}"
                )

        if salary_min is not None and salary_max is not None and salary_max < salary_min:
            raise ToolError("Maximum salary cannot be less than minimum salary.")

        parsed_posted: date | None = None
        if posted_date and posted_date.strip():
            try:
                parsed_posted = date.fromisoformat(posted_date.strip())
            except ValueError:
                raise ToolError(f"Invalid posted_date '{posted_date}'. Must be in YYYY-MM-DD format.") from None

        parsed_deadline: date | None = None
        if deadline_date and deadline_date.strip():
            try:
                parsed_deadline = date.fromisoformat(deadline_date.strip())
            except ValueError:
                raise ToolError(f"Invalid deadline_date '{deadline_date}'. Must be in YYYY-MM-DD format.") from None

        if parsed_posted and parsed_deadline and parsed_deadline < parsed_posted:
            raise ToolError("Deadline date cannot be earlier than posted date.")

        parsed_applied: date | None = None
        if applied_date and applied_date.strip():
            try:
                parsed_applied = date.fromisoformat(applied_date.strip())
            except ValueError:
                raise ToolError(f"Invalid applied_date '{applied_date}'. Must be in YYYY-MM-DD format.") from None
        elif clean_status == JobStatus.APPLIED.value:
            parsed_applied = date.today()

        if excitement_rating is not None and not (1 <= excitement_rating <= 5):
            raise ToolError("Excitement rating must be an integer between 1 and 5.")

        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            job = Job(
                user_id=user.id,
                title=clean_title,
                company_name=clean_company,
                status=clean_status,
                job_url=job_url.strip() if job_url and job_url.strip() else None,
                location=location.strip() if location and location.strip() else None,
                workplace_type=clean_wp,
                employment_type=clean_emp,
                department=department.strip() if department and department.strip() else None,
                description=description.strip() if description and description.strip() else None,
                requirements=requirements.strip() if requirements and requirements.strip() else None,
                salary_min=salary_min,
                salary_max=salary_max,
                salary_currency=salary_currency.strip() if salary_currency else "USD",
                salary_interval=clean_interval,
                posted_date=parsed_posted,
                deadline_date=parsed_deadline,
                current_stage=current_stage.strip() if current_stage and current_stage.strip() else None,
                applied_date=parsed_applied,
                excitement_rating=excitement_rating,
                notes=notes.strip() if notes and notes.strip() else None,
                contact_name=contact_name.strip() if contact_name and contact_name.strip() else None,
                contact_email=contact_email.strip() if contact_email and contact_email.strip() else None,
                contact_phone=contact_phone.strip() if contact_phone and contact_phone.strip() else None,
            )
            db.add(job)
            await db.commit()
            await db.refresh(job)

            return {
                "message": f"Job posting for '{job.title}' at '{job.company_name}' added to pipeline ({job.status}).",
                "job": {
                    "id": job.id,
                    "title": job.title,
                    "company_name": job.company_name,
                    "status": job.status,
                    "current_stage": job.current_stage,
                    "location": job.location,
                    "workplace_type": job.workplace_type,
                    "salary_min": job.salary_min,
                    "salary_max": job.salary_max,
                    "salary_currency": job.salary_currency,
                    "applied_date": job.applied_date.isoformat() if job.applied_date else None,
                    "excitement_rating": job.excitement_rating,
                    "created_at": job.created_at.isoformat(),
                },
            }

    @server.tool(
        name="create_job",
        description="Alias for add_job. Creates a new job posting entry in the user's career pipeline.",
    )
    async def create_job(
        title: str,
        company_name: str,
        status: str = "saved",
        job_url: str | None = None,
        location: str | None = None,
        workplace_type: str | None = None,
        employment_type: str | None = None,
        department: str | None = None,
        description: str | None = None,
        requirements: str | None = None,
        salary_min: float | None = None,
        salary_max: float | None = None,
        salary_currency: str = "USD",
        salary_interval: str | None = "yearly",
        posted_date: str | None = None,
        deadline_date: str | None = None,
        current_stage: str | None = None,
        applied_date: str | None = None,
        excitement_rating: int | None = None,
        notes: str | None = None,
        contact_name: str | None = None,
        contact_email: str | None = None,
        contact_phone: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        return await add_job(
            title=title,
            company_name=company_name,
            status=status,
            job_url=job_url,
            location=location,
            workplace_type=workplace_type,
            employment_type=employment_type,
            department=department,
            description=description,
            requirements=requirements,
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=salary_currency,
            salary_interval=salary_interval,
            posted_date=posted_date,
            deadline_date=deadline_date,
            current_stage=current_stage,
            applied_date=applied_date,
            excitement_rating=excitement_rating,
            notes=notes,
            contact_name=contact_name,
            contact_email=contact_email,
            contact_phone=contact_phone,
            auth_token=auth_token,
            ctx=ctx,
        )

    # -------------------------------------------------------------------------
    # Unified Career Context Tool (ATS & Resume Ready)
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_career_context",
        description=(
            "Retrieve an aggregated, ATS-ready profile snapshot combining verified years of experience, "
            "work timeline with tenures, skills matrix grouped by proficiency, ranked career preferences, "
            "active job opportunities pipeline, and workspaces."
        ),
    )
    async def get_career_context(
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            # 1. Fetch skills
            skills_res = await db.execute(
                select(Skill).where(Skill.user_id == user.id).order_by(Skill.name.asc())
            )
            skills = skills_res.scalars().all()

            skills_by_proficiency: dict[str, list[str]] = {
                p.value: [] for p in SkillProficiency
            }
            for s in skills:
                skills_by_proficiency.setdefault(s.proficiency, []).append(s.name)

            # 2. Fetch preferences
            prefs_res = await db.execute(
                select(Preference)
                .where(Preference.user_id == user.id)
                .order_by(Preference.created_at.desc())
            )
            preferences = prefs_res.scalars().all()

            prefs_by_importance: dict[str, list[dict[str, Any]]] = {
                i.value: [] for i in PreferenceImportance
            }
            for p in preferences:
                prefs_by_importance.setdefault(p.importance, []).append(
                    {"id": p.id, "title": p.title, "description": p.description}
                )

            # 3. Fetch experience & calculate metrics
            comps_res = await db.execute(
                select(CompanyWorked)
                .where(CompanyWorked.user_id == user.id)
                .order_by(CompanyWorked.start_date.desc())
            )
            companies = comps_res.scalars().all()
            exp_summary = calculate_experience_summary(list(companies))

            # 4. Fetch workspaces
            ws_res = await db.execute(
                select(Workspace)
                .where(Workspace.user_id == user.id)
                .order_by(Workspace.created_at.asc())
            )
            workspaces = ws_res.scalars().all()

            # 5. Fetch jobs pipeline
            jobs_res = await db.execute(
                select(Job).where(Job.user_id == user.id).order_by(Job.updated_at.desc())
            )
            jobs = jobs_res.scalars().all()
            pipeline_counts = {s.value: 0 for s in JobStatus}
            for j in jobs:
                pipeline_counts[j.status] = pipeline_counts.get(j.status, 0) + 1

            return {
                "profile": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "phone": user.phone,
                    "address": user.address,
                    "socials": user.socials,
                },
                "total_work_experience": exp_summary["total_experience"],
                "active_roles": exp_summary["active_positions"],
                "work_timeline": exp_summary["timeline"],
                "skills_matrix": {
                    "total_skills": len(skills),
                    "by_proficiency": skills_by_proficiency,
                },
                "career_preferences": {
                    "total_preferences": len(preferences),
                    "by_importance": prefs_by_importance,
                },
                "job_pipeline": {
                    "total_opportunities": len(jobs),
                    "summary_by_stage": pipeline_counts,
                    "active_roles": [
                        {
                            "id": j.id,
                            "title": j.title,
                            "company_name": j.company_name,
                            "status": j.status,
                            "current_stage": j.current_stage,
                            "location": j.location,
                        }
                        for j in jobs
                    ],
                },
                "workspaces": [
                    {"id": w.id, "name": w.name} for w in workspaces
                ],
            }
