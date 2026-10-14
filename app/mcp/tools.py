"""MCP tools definitions for CareerTrack.

Exposes tools for:
- User profile details omitting private email and phone (get_profile)
- Technical and soft skills (get_skills)
- Career preferences and priorities (get_preferences)
- Chronological employment history and company timeline (get_employment_history)
- Logged project accomplishments and work achievements (get_work_accomplishments)
- Adding target job opportunities to the pipeline (add_job)
"""

from datetime import date
from typing import Any

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy import func, select

from app.core.database import async_session_factory
from app.mcp.auth import resolve_user
from app.mcp.experience import compute_company_tenure
from app.models.company import CompanyWorked, EmploymentType
from app.models.experience_log import ExperienceLog
from app.models.job import Job, JobStatus, WorkplaceType
from app.models.preference import Preference, PreferenceImportance
from app.models.skill import Skill, SkillProficiency


def register_tools(server: MCPServer) -> None:
    """Registers CareerTrack tools onto the provided MCPServer instance."""

    # -------------------------------------------------------------------------
    # Profile Tools
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_profile",
        description="Retrieve the authenticated user's public profile details (name, location/address, and social profiles), omitting private contact information (email and phone).",
    )
    async def get_profile(
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            return {
                "id": user.id,
                "name": user.name,
                "address": user.address or {},
                "socials": user.socials or {},
            }

    # -------------------------------------------------------------------------
    # Skills Tools
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
    # Career Preferences Tools
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
    # Employment History & Timeline Tools
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_employment_history",
        description=(
            "Retrieve the user's chronological employment history and company timeline. "
            "Returns high-level employment records: company names, start and end dates, actively working status, "
            "employment arrangements (full_time, part_time, contract, freelance, internship), and computed tenures in years and months. "
            "Use this tool when you need to know where the user worked and for how long. "
            "Do NOT use this tool for reading detailed project accomplishments or engineering deliverables; "
            "use 'get_work_accomplishments' instead."
        ),
    )
    async def get_employment_history(
        actively_working: bool | None = None,
        employment_type: str | None = None,
        include_accomplishments: bool = True,
        include_logs: bool = True,
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

            # Fetch experience logs/accomplishments for user if requested
            logs_by_company: dict[int, list[dict[str, Any]]] = {}
            should_include = include_accomplishments and include_logs
            if should_include and companies:
                logs_res = await db.execute(
                    select(ExperienceLog)
                    .where(ExperienceLog.user_id == user.id)
                    .order_by(ExperienceLog.created_at.desc())
                )
                for log in logs_res.scalars().all():
                    logs_by_company.setdefault(log.company_id, []).append(
                        {
                            "id": log.id,
                            "description": log.description,
                            "created_at": log.created_at.isoformat(),
                            "updated_at": log.updated_at.isoformat(),
                        }
                    )

            timeline: list[dict[str, Any]] = []
            for c in companies:
                months, tenure_formatted = compute_company_tenure(
                    c.start_date, c.end_date, c.actively_working
                )
                comp_logs = logs_by_company.get(c.id, [])
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
                        "accomplishments": comp_logs,
                        "experience_logs": comp_logs,
                        "total_accomplishments": len(comp_logs),
                    }
                )

            return {
                "companies": timeline,
                "total": len(timeline),
            }

    # -------------------------------------------------------------------------
    # Work Accomplishments & Project Achievements Tools
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_work_accomplishments",
        description=(
            "Retrieve specific work accomplishments, technical achievements, project deliverables, "
            "and impact bullet points logged by the user across their career. "
            "Supports filtering by company name, company ID, or keyword search across accomplishment descriptions "
            "(e.g., 'PostgreSQL', 'migration', 'agent', 'Kubernetes'). "
            "Use this tool when drafting resume bullet points, preparing interview stories, or finding evidence "
            "of technical accomplishments. "
            "Do NOT use this tool for high-level company dates, tenures, or employment arrangements; "
            "use 'get_employment_history' instead."
        ),
    )
    async def get_work_accomplishments(
        company_name: str | None = None,
        company_id: int | None = None,
        query: str | None = None,
        q: str | None = None,
        limit: int = 50,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(ExperienceLog).where(ExperienceLog.user_id == user.id)

            if company_id is not None:
                stmt = stmt.where(ExperienceLog.company_id == company_id)

            if company_name and company_name.strip():
                stmt = stmt.join(CompanyWorked).where(
                    CompanyWorked.company_name.ilike(f"%{company_name.strip()}%")
                )

            search_query = (query or q or "").strip()
            if search_query:
                stmt = stmt.where(ExperienceLog.description.ilike(f"%{search_query}%"))

            stmt = stmt.order_by(ExperienceLog.created_at.desc()).limit(max(1, min(limit, 200)))
            result = await db.execute(stmt)
            logs = result.scalars().all()

            formatted_logs = [
                {
                    "id": log.id,
                    "company_id": log.company_id,
                    "company_name": log.company_name,
                    "description": log.description,
                    "created_at": log.created_at.isoformat(),
                    "updated_at": log.updated_at.isoformat(),
                }
                for log in logs
            ]

            return {
                "accomplishments": formatted_logs,
                "experience_logs": formatted_logs,
                "total": len(formatted_logs),
            }

    # -------------------------------------------------------------------------
    # Jobs Tools
    # -------------------------------------------------------------------------

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
