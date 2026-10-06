"""MCP tools definitions for CareerTrack.

Exposes read-only inspection tools for querying:
- Technical and soft skills (with optional proficiency or search query filtering)
- Career preferences and priorities (with optional importance filtering)
- Companies worked in, tenure, and verified work experience timeline
- Experience summary with ATS-grade calendar tenure calculation
- Workspaces
- Comprehensive ATS-ready career context snapshot
"""

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
    # Unified Career Context Tool (ATS & Resume Ready, Read-Only)
    # -------------------------------------------------------------------------

    @server.tool(
        name="get_career_context",
        description=(
            "Retrieve an aggregated, ATS-ready profile snapshot combining verified years of experience, "
            "work timeline with tenures, skills matrix grouped by proficiency, ranked career preferences, "
            "and workspaces."
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
                "workspaces": [
                    {"id": w.id, "name": w.name} for w in workspaces
                ],
            }
