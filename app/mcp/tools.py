"""MCP tools definitions for CareerTrack.

Exposes tools for querying and managing:
- Technical and soft skills
- Career preferences and priorities
- Companies worked in, tenure, and total years of work experience
- Workspaces
- Comprehensive ATS-ready career context
"""

from datetime import date
from typing import Any

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from sqlalchemy import delete, func, select

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
    """Registers all CareerTrack tools onto the provided MCPServer instance."""

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

    @server.tool(
        name="add_skill",
        description="Add a new skill or update proficiency of an existing skill for the authenticated user.",
    )
    async def add_skill(
        name: str,
        proficiency: str = "intermediate",
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        clean_name = name.strip()
        if not clean_name:
            raise ToolError("Skill name cannot be empty.")

        clean_prof = proficiency.strip().lower()
        valid_profs = [p.value for p in SkillProficiency]
        if clean_prof not in valid_profs:
            raise ToolError(
                f"Invalid proficiency '{proficiency}'. Allowed values: {', '.join(valid_profs)}"
            )

        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            # Check if skill exists for this user (case-insensitive)
            stmt = select(Skill).where(
                Skill.user_id == user.id,
                func.lower(Skill.name) == clean_name.lower(),
            )
            result = await db.execute(stmt)
            existing = result.scalars().first()

            if existing:
                existing.proficiency = clean_prof
                await db.commit()
                await db.refresh(existing)
                return {
                    "message": f"Skill '{existing.name}' updated to proficiency '{existing.proficiency}'.",
                    "skill": {
                        "id": existing.id,
                        "name": existing.name,
                        "proficiency": existing.proficiency,
                    },
                }

            new_skill = Skill(
                user_id=user.id,
                name=clean_name,
                proficiency=clean_prof,
            )
            db.add(new_skill)
            await db.commit()
            await db.refresh(new_skill)

            return {
                "message": f"Skill '{new_skill.name}' added successfully.",
                "skill": {
                    "id": new_skill.id,
                    "name": new_skill.name,
                    "proficiency": new_skill.proficiency,
                },
            }

    @server.tool(
        name="update_skill",
        description="Update an existing skill's name or proficiency level.",
    )
    async def update_skill(
        skill_id: int,
        name: str | None = None,
        proficiency: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(Skill).where(Skill.id == skill_id, Skill.user_id == user.id)
            result = await db.execute(stmt)
            skill = result.scalars().first()

            if not skill:
                raise ToolError(f"Skill with ID {skill_id} not found.")

            if name is not None:
                clean_name = name.strip()
                if not clean_name:
                    raise ToolError("Skill name cannot be empty.")
                skill.name = clean_name

            if proficiency is not None:
                clean_prof = proficiency.strip().lower()
                valid_profs = [p.value for p in SkillProficiency]
                if clean_prof not in valid_profs:
                    raise ToolError(
                        f"Invalid proficiency '{proficiency}'. Allowed values: {', '.join(valid_profs)}"
                    )
                skill.proficiency = clean_prof

            await db.commit()
            await db.refresh(skill)

            return {
                "message": f"Skill '{skill.name}' updated successfully.",
                "skill": {
                    "id": skill.id,
                    "name": skill.name,
                    "proficiency": skill.proficiency,
                },
            }

    @server.tool(
        name="delete_skill",
        description="Delete a skill by its ID.",
    )
    async def delete_skill(
        skill_id: int,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(Skill).where(Skill.id == skill_id, Skill.user_id == user.id)
            result = await db.execute(stmt)
            skill = result.scalars().first()

            if not skill:
                raise ToolError(f"Skill with ID {skill_id} not found.")

            skill_name = skill.name
            await db.delete(skill)
            await db.commit()

            return {"message": f"Skill '{skill_name}' (ID {skill_id}) deleted successfully."}

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

    @server.tool(
        name="add_preference",
        description="Add a new career preference or priority (e.g. remote work, target tech stack, salary range, culture values).",
    )
    async def add_preference(
        title: str,
        description: str | None = None,
        importance: str = "medium",
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        clean_title = title.strip()
        if not clean_title:
            raise ToolError("Preference title cannot be empty.")

        clean_imp = importance.strip().lower()
        valid_imps = [i.value for i in PreferenceImportance]
        if clean_imp not in valid_imps:
            raise ToolError(
                f"Invalid importance '{importance}'. Allowed values: {', '.join(valid_imps)}"
            )

        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            pref = Preference(
                user_id=user.id,
                title=clean_title,
                description=description.strip() if description else None,
                importance=clean_imp,
            )
            db.add(pref)
            await db.commit()
            await db.refresh(pref)

            return {
                "message": f"Career preference '{pref.title}' created successfully.",
                "preference": {
                    "id": pref.id,
                    "title": pref.title,
                    "description": pref.description,
                    "importance": pref.importance,
                },
            }

    @server.tool(
        name="update_preference",
        description="Update an existing career preference's title, description, or importance.",
    )
    async def update_preference(
        preference_id: int,
        title: str | None = None,
        description: str | None = None,
        importance: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(Preference).where(
                Preference.id == preference_id, Preference.user_id == user.id
            )
            result = await db.execute(stmt)
            pref = result.scalars().first()

            if not pref:
                raise ToolError(f"Preference with ID {preference_id} not found.")

            if title is not None:
                clean_title = title.strip()
                if not clean_title:
                    raise ToolError("Preference title cannot be empty.")
                pref.title = clean_title

            if description is not None:
                pref.description = description.strip() if description else None

            if importance is not None:
                clean_imp = importance.strip().lower()
                valid_imps = [i.value for i in PreferenceImportance]
                if clean_imp not in valid_imps:
                    raise ToolError(
                        f"Invalid importance '{importance}'. Allowed values: {', '.join(valid_imps)}"
                    )
                pref.importance = clean_imp

            await db.commit()
            await db.refresh(pref)

            return {
                "message": f"Preference '{pref.title}' updated successfully.",
                "preference": {
                    "id": pref.id,
                    "title": pref.title,
                    "description": pref.description,
                    "importance": pref.importance,
                },
            }

    @server.tool(
        name="delete_preference",
        description="Delete a career preference by its ID.",
    )
    async def delete_preference(
        preference_id: int,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(Preference).where(
                Preference.id == preference_id, Preference.user_id == user.id
            )
            result = await db.execute(stmt)
            pref = result.scalars().first()

            if not pref:
                raise ToolError(f"Preference with ID {preference_id} not found.")

            title = pref.title
            await db.delete(pref)
            await db.commit()

            return {"message": f"Preference '{title}' (ID {preference_id}) deleted successfully."}

    # -------------------------------------------------------------------------
    # Work Experience Tools
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

    @server.tool(
        name="add_work_experience",
        description="Add a company to the user's career history (start_date and end_date in YYYY-MM-DD format).",
    )
    async def add_work_experience(
        company_name: str,
        start_date: str,
        end_date: str | None = None,
        actively_working: bool = False,
        employment_type: str = "full_time",
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        clean_name = company_name.strip()
        if not clean_name:
            raise ToolError("Company name cannot be empty.")

        try:
            parsed_start = date.fromisoformat(start_date.strip())
        except ValueError:
            raise ToolError(f"Invalid start_date '{start_date}'. Must be in YYYY-MM-DD format.") from None

        parsed_end: date | None = None
        if end_date and end_date.strip():
            try:
                parsed_end = date.fromisoformat(end_date.strip())
            except ValueError:
                raise ToolError(f"Invalid end_date '{end_date}'. Must be in YYYY-MM-DD format.") from None

        if parsed_end and parsed_end < parsed_start:
            raise ToolError("End date cannot be earlier than start date.")

        if actively_working and parsed_end is not None:
            # When actively working, end date is normally None
            parsed_end = None

        clean_type = employment_type.strip().lower()
        valid_types = [t.value for t in EmploymentType]
        if clean_type not in valid_types:
            raise ToolError(
                f"Invalid employment_type '{employment_type}'. Allowed values: {', '.join(valid_types)}"
            )

        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            company = CompanyWorked(
                user_id=user.id,
                company_name=clean_name,
                employment_type=clean_type,
                start_date=parsed_start,
                end_date=parsed_end,
                actively_working=actively_working,
            )
            db.add(company)
            await db.commit()
            await db.refresh(company)

            months, tenure_str = compute_company_tenure(
                company.start_date, company.end_date, company.actively_working
            )

            return {
                "message": f"Work experience at '{company.company_name}' added successfully.",
                "company": {
                    "id": company.id,
                    "company_name": company.company_name,
                    "employment_type": company.employment_type,
                    "start_date": company.start_date.isoformat(),
                    "end_date": company.end_date.isoformat() if company.end_date else None,
                    "actively_working": company.actively_working,
                    "tenure_formatted": tenure_str,
                },
            }

    @server.tool(
        name="update_work_experience",
        description="Update an existing work experience record.",
    )
    async def update_work_experience(
        company_id: int,
        company_name: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        actively_working: bool | None = None,
        employment_type: str | None = None,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(CompanyWorked).where(
                CompanyWorked.id == company_id, CompanyWorked.user_id == user.id
            )
            result = await db.execute(stmt)
            company = result.scalars().first()

            if not company:
                raise ToolError(f"Company experience record with ID {company_id} not found.")

            if company_name is not None:
                clean_name = company_name.strip()
                if not clean_name:
                    raise ToolError("Company name cannot be empty.")
                company.company_name = clean_name

            if start_date is not None:
                try:
                    company.start_date = date.fromisoformat(start_date.strip())
                except ValueError:
                    raise ToolError(f"Invalid start_date '{start_date}'. Must be in YYYY-MM-DD format.") from None

            if actively_working is not None:
                company.actively_working = actively_working
                if actively_working:
                    company.end_date = None

            if end_date is not None:
                if not company.actively_working:
                    try:
                        company.end_date = date.fromisoformat(end_date.strip())
                    except ValueError:
                        raise ToolError(f"Invalid end_date '{end_date}'. Must be in YYYY-MM-DD format.") from None

            if company.end_date and company.end_date < company.start_date:
                raise ToolError("End date cannot be earlier than start date.")

            if employment_type is not None:
                clean_type = employment_type.strip().lower()
                valid_types = [t.value for t in EmploymentType]
                if clean_type not in valid_types:
                    raise ToolError(
                        f"Invalid employment_type '{employment_type}'. Allowed values: {', '.join(valid_types)}"
                    )
                company.employment_type = clean_type

            await db.commit()
            await db.refresh(company)

            months, tenure_str = compute_company_tenure(
                company.start_date, company.end_date, company.actively_working
            )

            return {
                "message": f"Company record '{company.company_name}' updated successfully.",
                "company": {
                    "id": company.id,
                    "company_name": company.company_name,
                    "employment_type": company.employment_type,
                    "start_date": company.start_date.isoformat(),
                    "end_date": company.end_date.isoformat() if company.end_date else None,
                    "actively_working": company.actively_working,
                    "tenure_formatted": tenure_str,
                },
            }

    @server.tool(
        name="delete_work_experience",
        description="Delete a work experience record by ID.",
    )
    async def delete_work_experience(
        company_id: int,
        auth_token: str | None = None,
        ctx: Context | None = None,
    ) -> dict[str, Any]:
        async with async_session_factory() as db:
            user = await resolve_user(db, auth_token=auth_token, ctx=ctx)

            stmt = select(CompanyWorked).where(
                CompanyWorked.id == company_id, CompanyWorked.user_id == user.id
            )
            result = await db.execute(stmt)
            company = result.scalars().first()

            if not company:
                raise ToolError(f"Company experience record with ID {company_id} not found.")

            c_name = company.company_name
            await db.delete(company)
            await db.commit()

            return {"message": f"Work experience at '{c_name}' (ID {company_id}) deleted successfully."}

    # -------------------------------------------------------------------------
    # Workspaces Tools
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
    # Unified Career Context Tool (ATS & Resume Ready)
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
