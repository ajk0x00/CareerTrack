"""MCP resources definitions for CareerTrack.

Exposes URI-based resources for AI clients to directly inspect:
- careertrack://profile
- careertrack://skills
- careertrack://preferences
- careertrack://experience
- careertrack://experience-summary
- careertrack://career-context
"""

import json
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ResourceError
from sqlalchemy import select

from app.core.database import async_session_factory
from app.mcp.auth import resolve_user
from app.mcp.experience import calculate_experience_summary, compute_company_tenure
from app.models.company import CompanyWorked
from app.models.job import Job, JobStatus
from app.models.preference import Preference, PreferenceImportance
from app.models.skill import Skill, SkillProficiency
from app.models.workspace import Workspace


def register_resources(server: MCPServer) -> None:
    """Registers CareerTrack URI resources on the MCPServer."""

    @server.resource(
        "careertrack://profile",
        name="User Profile",
        description="Basic user profile information including name, email, phone, and socials.",
        mime_type="application/json",
    )
    async def get_profile_resource() -> str:
        async with async_session_factory() as db:
            try:
                user = await resolve_user(db)
            except Exception as exc:
                raise ResourceError(f"Authentication error: {exc}") from exc

            data = {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "phone": user.phone,
                "address": user.address,
                "socials": user.socials,
            }
            return json.dumps(data, indent=2)

    @server.resource(
        "careertrack://skills",
        name="Skills Matrix",
        description="User technical and soft skills grouped by proficiency level.",
        mime_type="application/json",
    )
    async def get_skills_resource() -> str:
        async with async_session_factory() as db:
            try:
                user = await resolve_user(db)
            except Exception as exc:
                raise ResourceError(f"Authentication error: {exc}") from exc

            stmt = select(Skill).where(Skill.user_id == user.id).order_by(Skill.name.asc())
            result = await db.execute(stmt)
            skills = result.scalars().all()

            by_prof: dict[str, list[str]] = {p.value: [] for p in SkillProficiency}
            for s in skills:
                by_prof.setdefault(s.proficiency, []).append(s.name)

            data = {
                "total_skills": len(skills),
                "skills_by_proficiency": by_prof,
                "raw_skills": [
                    {"id": s.id, "name": s.name, "proficiency": s.proficiency}
                    for s in skills
                ],
            }
            return json.dumps(data, indent=2)

    @server.resource(
        "careertrack://preferences",
        name="Career Preferences",
        description="Career preferences, priorities, and constraints grouped by importance.",
        mime_type="application/json",
    )
    async def get_preferences_resource() -> str:
        async with async_session_factory() as db:
            try:
                user = await resolve_user(db)
            except Exception as exc:
                raise ResourceError(f"Authentication error: {exc}") from exc

            stmt = (
                select(Preference)
                .where(Preference.user_id == user.id)
                .order_by(Preference.created_at.desc())
            )
            result = await db.execute(stmt)
            prefs = result.scalars().all()

            by_imp: dict[str, list[dict[str, Any]]] = {
                i.value: [] for i in PreferenceImportance
            }
            for p in prefs:
                by_imp.setdefault(p.importance, []).append(
                    {"id": p.id, "title": p.title, "description": p.description}
                )

            data = {
                "total_preferences": len(prefs),
                "by_importance": by_imp,
            }
            return json.dumps(data, indent=2)

    @server.resource(
        "careertrack://experience",
        name="Work Experience Timeline",
        description="Timeline of companies worked in, roles, and formatted tenures.",
        mime_type="application/json",
    )
    async def get_experience_resource() -> str:
        async with async_session_factory() as db:
            try:
                user = await resolve_user(db)
            except Exception as exc:
                raise ResourceError(f"Authentication error: {exc}") from exc

            stmt = (
                select(CompanyWorked)
                .where(CompanyWorked.user_id == user.id)
                .order_by(CompanyWorked.start_date.desc())
            )
            result = await db.execute(stmt)
            companies = result.scalars().all()

            timeline = []
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

            return json.dumps({"companies": timeline, "total": len(timeline)}, indent=2)

    @server.resource(
        "careertrack://experience-summary",
        name="Experience Summary",
        description="Total verified years of work experience, active positions, and breakdown.",
        mime_type="application/json",
    )
    async def get_experience_summary_resource() -> str:
        async with async_session_factory() as db:
            try:
                user = await resolve_user(db)
            except Exception as exc:
                raise ResourceError(f"Authentication error: {exc}") from exc

            stmt = (
                select(CompanyWorked)
                .where(CompanyWorked.user_id == user.id)
                .order_by(CompanyWorked.start_date.desc())
            )
            result = await db.execute(stmt)
            companies = result.scalars().all()

            summary = calculate_experience_summary(list(companies))
            return json.dumps(summary, indent=2)

    @server.resource(
        "careertrack://career-context",
        name="Career Context",
        description="Unified, ATS-tailored resume context combining all user profile, skills, preferences, and experience.",
        mime_type="application/json",
    )
    async def get_career_context_resource() -> str:
        async with async_session_factory() as db:
            try:
                user = await resolve_user(db)
            except Exception as exc:
                raise ResourceError(f"Authentication error: {exc}") from exc

            # Skills
            skills_res = await db.execute(
                select(Skill).where(Skill.user_id == user.id).order_by(Skill.name.asc())
            )
            skills = skills_res.scalars().all()
            skills_by_proficiency: dict[str, list[str]] = {
                p.value: [] for p in SkillProficiency
            }
            for s in skills:
                skills_by_proficiency.setdefault(s.proficiency, []).append(s.name)

            # Preferences
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

            # Experience
            comps_res = await db.execute(
                select(CompanyWorked)
                .where(CompanyWorked.user_id == user.id)
                .order_by(CompanyWorked.start_date.desc())
            )
            companies = comps_res.scalars().all()
            exp_summary = calculate_experience_summary(list(companies))

            # Workspaces
            ws_res = await db.execute(
                select(Workspace)
                .where(Workspace.user_id == user.id)
                .order_by(Workspace.created_at.asc())
            )
            workspaces = ws_res.scalars().all()

            # Job Opportunities & Pipeline
            jobs_res = await db.execute(
                select(Job).where(Job.user_id == user.id).order_by(Job.updated_at.desc())
            )
            jobs = jobs_res.scalars().all()
            pipeline_counts = {s.value: 0 for s in JobStatus}
            for j in jobs:
                pipeline_counts[j.status] = pipeline_counts.get(j.status, 0) + 1

            payload = {
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
                "workspaces": [{"id": w.id, "name": w.name} for w in workspaces],
            }
            return json.dumps(payload, indent=2)

    @server.resource(
        "careertrack://jobs",
        name="Job Pipeline Opportunities",
        description="All job postings and active applications in the user's career pipeline.",
        mime_type="application/json",
    )
    async def get_jobs_resource() -> str:
        async with async_session_factory() as db:
            try:
                user = await resolve_user(db)
            except Exception as exc:
                raise ResourceError(f"Authentication error: {exc}") from exc

            stmt = select(Job).where(Job.user_id == user.id).order_by(Job.updated_at.desc())
            result = await db.execute(stmt)
            jobs = result.scalars().all()

            data = {
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
            return json.dumps(data, indent=2)

    @server.resource(
        "careertrack://job-pipeline-summary",
        name="Job Pipeline Summary",
        description="Aggregate count of job applications across stages (saved, applied, interviewing, offer).",
        mime_type="application/json",
    )
    async def get_job_pipeline_summary_resource() -> str:
        async with async_session_factory() as db:
            try:
                user = await resolve_user(db)
            except Exception as exc:
                raise ResourceError(f"Authentication error: {exc}") from exc

            stmt = select(Job).where(Job.user_id == user.id)
            result = await db.execute(stmt)
            jobs = result.scalars().all()

            counts = {s.value: 0 for s in JobStatus}
            for j in jobs:
                counts[j.status] = counts.get(j.status, 0) + 1

            data = {
                "total": len(jobs),
                "saved": counts.get(JobStatus.SAVED.value, 0),
                "applied": counts.get(JobStatus.APPLIED.value, 0),
                "interviewing": counts.get(JobStatus.INTERVIEWING.value, 0),
                "offer": counts.get(JobStatus.OFFER.value, 0),
            }
            return json.dumps(data, indent=2)
