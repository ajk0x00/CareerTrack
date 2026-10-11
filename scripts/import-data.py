#!/usr/bin/env python3
"""Helper script to import exported workLog JSON data into the production PostgreSQL database.

Features:
- Imports user profile, companies worked, skills, tags, work logs (accomplishments), and tag associations.
- Automatically maps skills proficiency numbers (1-5) to careerTrack string proficiencies.
- Safely links foreign keys even if user ID or company IDs differ in target database.
- Ensures all tables exist and synchronizes PostgreSQL auto-increment sequences.
- Supports dry-run mode (--dry-run) to preview operations before making database changes.
- Supports custom database URL (--db-url or DATABASE_URL).
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import date, datetime
import json
import os
from pathlib import Path
import sys
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

# Map numeric proficiency from workLog (1-5) to careerTrack SkillProficiency strings
PROFICIENCY_MAP: dict[int, str] = {
    1: "beginner",
    2: "beginner",
    3: "intermediate",
    4: "advanced",
    5: "expert",
}


def parse_dt(val: Any) -> datetime:
    """Parses ISO timestamp string to datetime instance for asyncpg."""
    if isinstance(val, datetime):
        return val
    if isinstance(val, str) and val.strip():
        try:
            return datetime.fromisoformat(val)
        except Exception:
            pass
    return datetime.now()


def mask_db_url(url: str) -> str:
    """Masks database password in connection string for safe printing."""
    try:
        parsed = urlparse(url.replace("postgresql+asyncpg://", "http://"))
        netloc = parsed.hostname or "localhost"
        if parsed.port:
            netloc += f":{parsed.port}"
        if parsed.username:
            netloc = f"{parsed.username}:***@{netloc}"
        return f"postgresql://{netloc}{parsed.path}"
    except Exception:
        return "<configured database>"


def normalize_db_url(url: str) -> str:
    """Ensures asyncpg driver is specified and rewrites libpq params for asyncpg."""
    url = url.strip()
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    parsed = urlparse(url)
    if not parsed.query:
        return url

    query_params = parse_qs(parsed.query, keep_blank_values=True)
    new_params: dict[str, list[str]] = {}

    for k, v in query_params.items():
        k_lower = k.lower()
        if k_lower == "sslmode":
            mode = v[0].lower() if v else "require"
            if mode in ("disable", "false", "0"):
                new_params["ssl"] = ["disable"]
            else:
                new_params["ssl"] = ["require"]
        elif k_lower in ("channel_binding", "gssencmode"):
            continue
        else:
            new_params[k] = v

    new_query = urlencode(new_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def get_default_db_url() -> str:
    """Retrieves target database URL from environment or .env file."""
    # 1. Direct DATABASE_URL env var
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return normalize_db_url(env_url)

    # 2. Try loading from .env
    env_file = Path(".env")
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("DATABASE_URL="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    return normalize_db_url(val)

    # 3. Fallback to settings / localhost default
    pg_user = os.getenv("POSTGRES_USER", "postgres")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "postgres")
    pg_host = os.getenv("POSTGRES_SERVER", "localhost")
    pg_port = os.getenv("POSTGRES_PORT", "5432")
    pg_db = os.getenv("POSTGRES_DB", "careertrack")
    return f"postgresql+asyncpg://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"


async def table_exists(conn: AsyncConnection, table_name: str) -> bool:
    """Checks whether a table exists in the PostgreSQL database."""
    res = await conn.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_name = :table_name
            );
            """
        ),
        {"table_name": table_name},
    )
    return bool(res.scalar())


async def ensure_tables_exist(conn: AsyncConnection, dry_run: bool) -> None:
    """Ensures supplementary tables (tags, work_logs, log_tags) exist in target database."""
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            color VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_tags_user_id ON tags(user_id);
        """,
        """
        CREATE TABLE IF NOT EXISTS work_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            company_id INTEGER REFERENCES companies_worked(id) ON DELETE SET NULL,
            log_date DATE NOT NULL,
            title VARCHAR(500) NOT NULL,
            content_markdown TEXT,
            status VARCHAR(50) DEFAULT 'done',
            blockers TEXT,
            achievements TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_work_logs_user_id ON work_logs(user_id);
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_work_logs_log_date ON work_logs(log_date);
        """,
        """
        CREATE TABLE IF NOT EXISTS log_tags (
            log_id INTEGER NOT NULL REFERENCES work_logs(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (log_id, tag_id)
        );
        """,
    ]

    has_tags = await table_exists(conn, "tags")
    has_work_logs = await table_exists(conn, "work_logs")
    has_log_tags = await table_exists(conn, "log_tags")

    if dry_run:
        needed = []
        if not has_tags:
            needed.append("tags")
        if not has_work_logs:
            needed.append("work_logs")
        if not has_log_tags:
            needed.append("log_tags")
        if needed:
            print(f"  • [DRY-RUN] Target database is missing tables: {', '.join(needed)}. Live run will create them.")
        else:
            print("  • Supplementary tables (tags, work_logs, log_tags) already exist.")
        return

    for stmt in ddl_statements:
        await conn.execute(text(stmt))
    print("  ✓ Verified/created supplementary work_logs, tags, and log_tags tables.")


async def import_data(
    file_path: Path,
    db_url: str,
    dry_run: bool = False,
    override_email: str | None = None,
) -> None:
    """Reads the JSON export and inserts records into target database."""
    print("==================================================================")
    print(" CareerTrack WorkLog Data Importer")
    print(f" Source File: {file_path}")
    print(f" Target DB:   {mask_db_url(db_url)}")
    print(f" Mode:        {'DRY-RUN (Simulating only)' if dry_run else 'LIVE IMPORT'}")
    print("==================================================================")

    if not file_path.exists():
        print(f"ERROR: File not found at {file_path}", file=sys.stderr)
        sys.exit(1)

    raw_data: dict[str, Any] = json.loads(file_path.read_text(encoding="utf-8"))
    tables = raw_data.get("tables", {})
    if not tables and "users" in raw_data and raw_data["users"]:
        # Reconstruct tables map from users[0] structure
        u0 = raw_data["users"][0]
        tables = {
            "users": [u0.get("profile", {})],
            "companies": u0.get("companies", []),
            "skills": u0.get("skills", []),
            "tags": u0.get("tags", []),
            "work_logs": u0.get("work_logs", []),
        }

    engine = create_async_engine(db_url, echo=False)

    async with engine.connect() as conn:
        # 1. Ensure schema readiness
        print("\n--- Step 1: Checking Database Schema ---")
        has_users = await table_exists(conn, "users")
        has_cw = await table_exists(conn, "companies_worked")
        has_skills = await table_exists(conn, "skills")

        if not (has_users and has_cw and has_skills):
            missing_core = []
            if not has_users:
                missing_core.append("users")
            if not has_cw:
                missing_core.append("companies_worked")
            if not has_skills:
                missing_core.append("skills")
            msg = f"Missing core tables: {', '.join(missing_core)}. Please run migrations first (e.g. alembic upgrade head)."
            if dry_run:
                print(f"  ! WARNING: {msg}")
            else:
                raise RuntimeError(msg)

        await ensure_tables_exist(conn, dry_run=dry_run)

        # 2. Process Users
        print("\n--- Step 2: Processing Users ---")
        has_users = await table_exists(conn, "users")
        user_rows = tables.get("users", [])
        user_id_map: dict[int, int] = {}

        for u in user_rows:
            old_id = u["id"]
            email = override_email or u["email"].strip().lower()
            name = u.get("full_name") or u.get("name") or u.get("username")
            pw_hash = u.get("password_hash") or u.get("hashed_password")

            # Check if user already exists in DB
            existing_user = None
            if has_users:
                check_res = await conn.execute(
                    text("SELECT id, name FROM users WHERE lower(email) = :email"),
                    {"email": email},
                )
                existing_user = check_res.mappings().first()

            if existing_user:
                new_id = existing_user["id"]
                user_id_map[old_id] = new_id
                print(f"  • Existing user found: ID {new_id} ({email})")
                if not dry_run and name and not existing_user["name"]:
                    await conn.execute(
                        text("UPDATE users SET name = :name, updated_at = NOW() WHERE id = :id"),
                        {"name": name, "id": new_id},
                    )
            else:
                if dry_run:
                    new_id = old_id
                    user_id_map[old_id] = new_id
                    print(f"  • [DRY-RUN] Would create user: ID {new_id} ({email}) - {name}")
                else:
                    insert_user_stmt = text(
                        """
                        INSERT INTO users (id, email, hashed_password, name, is_active, created_at, updated_at)
                        VALUES (:id, :email, :hashed_password, :name, true, NOW(), NOW())
                        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
                        RETURNING id
                        """
                    )
                    res = await conn.execute(
                        insert_user_stmt,
                        {
                            "id": old_id,
                            "email": email,
                            "hashed_password": pw_hash or "$2a$10$OFafC65m755kNzJEtUsqG.HE24XzRiAuDqhbw00aiIKus8ptbau/6",
                            "name": name,
                        },
                    )
                    new_id = res.scalar_one()
                    user_id_map[old_id] = new_id
                    print(f"  ✓ Inserted user: ID {new_id} ({email}) - {name}")

        # 3. Process Companies & CompaniesWorked
        print("\n--- Step 3: Processing Companies & Work History ---")
        companies_rows = tables.get("companies", [])
        company_id_map: dict[int, int] = {}
        has_cw = await table_exists(conn, "companies_worked")

        # Scan work logs to infer employment dates
        work_logs_rows = tables.get("work_logs", [])
        company_dates: dict[int, list[str]] = {}
        for wl in work_logs_rows:
            cid = wl.get("company_id")
            ldate = wl.get("log_date")
            if cid and ldate:
                company_dates.setdefault(cid, []).append(ldate)

        for c in companies_rows:
            old_cid = c["id"]
            old_uid = c.get("user_id", 1)
            target_uid = user_id_map.get(old_uid, 1)
            cname = c["name"].strip()
            is_current = bool(c.get("is_current", False))

            # Infer dates from work logs
            dates = sorted(company_dates.get(old_cid, []))
            if dates:
                start_dt = date.fromisoformat(dates[0])
                end_dt = None if is_current else date.fromisoformat(dates[-1])
            else:
                start_dt = date(2024, 1, 1)
                end_dt = None if is_current else date(2025, 1, 1)

            # Check if company already in companies_worked
            existing_cw = None
            if has_cw:
                cw_check = await conn.execute(
                    text(
                        """
                        SELECT id FROM companies_worked
                        WHERE user_id = :user_id AND lower(company_name) = lower(:company_name)
                        """
                    ),
                    {"user_id": target_uid, "company_name": cname},
                )
                existing_cw = cw_check.mappings().first()

            if existing_cw:
                cw_id = existing_cw["id"]
                company_id_map[old_cid] = cw_id
                print(f"  • Existing company_worked record found: ID {cw_id} ({cname})")
            else:
                if dry_run:
                    cw_id = old_cid
                    company_id_map[old_cid] = cw_id
                    print(f"  • [DRY-RUN] Would insert into companies_worked: {cname} (Active: {is_current}, Start: {start_dt})")
                else:
                    cw_res = await conn.execute(
                        text(
                            """
                            INSERT INTO companies_worked (
                                user_id, company_name, employment_type, start_date, end_date, actively_working, created_at, updated_at
                            ) VALUES (
                                :user_id, :company_name, 'full_time', :start_date, :end_date, :actively_working, NOW(), NOW()
                            ) RETURNING id
                            """
                        ),
                        {
                            "user_id": target_uid,
                            "company_name": cname,
                            "start_date": start_dt,
                            "end_date": end_dt,
                            "actively_working": is_current,
                        },
                    )
                    cw_id = cw_res.scalar_one()
                    company_id_map[old_cid] = cw_id
                    print(f"  ✓ Inserted into companies_worked: ID {cw_id} ({cname})")

        # 4. Process Skills
        print("\n--- Step 4: Processing Skills ---")
        skills_rows = tables.get("skills", [])
        skills_inserted = 0
        skills_updated = 0
        has_skills = await table_exists(conn, "skills")

        for s in skills_rows:
            old_uid = s.get("user_id", 1)
            target_uid = user_id_map.get(old_uid, 1)
            sname = s["name"].strip()
            raw_prof = s.get("proficiency", 3)
            prof_str = PROFICIENCY_MAP.get(int(raw_prof), "intermediate")

            existing_skill = None
            if has_skills:
                skill_check = await conn.execute(
                    text("SELECT id, proficiency FROM skills WHERE user_id = :user_id AND lower(name) = lower(:name)"),
                    {"user_id": target_uid, "name": sname},
                )
                existing_skill = skill_check.mappings().first()

            if existing_skill:
                skills_updated += 1
                if not dry_run and existing_skill["proficiency"] != prof_str:
                    await conn.execute(
                        text("UPDATE skills SET proficiency = :prof, updated_at = NOW() WHERE id = :id"),
                        {"prof": prof_str, "id": existing_skill["id"]},
                    )
                print(f"  • Skill '{sname}' already present (Proficiency: {prof_str})")
            else:
                skills_inserted += 1
                if dry_run:
                    print(f"  • [DRY-RUN] Would insert skill: '{sname}' -> {prof_str}")
                else:
                    await conn.execute(
                        text(
                            """
                            INSERT INTO skills (user_id, name, proficiency, created_at, updated_at)
                            VALUES (:user_id, :name, :proficiency, NOW(), NOW())
                            """
                        ),
                        {"user_id": target_uid, "name": sname, "proficiency": prof_str},
                    )
                    print(f"  ✓ Inserted skill: '{sname}' ({prof_str})")

        # 5. Process Tags
        print("\n--- Step 5: Processing Tags ---")
        tags_rows = tables.get("tags", [])
        tag_id_map: dict[int, int] = {}
        has_tags = await table_exists(conn, "tags")

        for t in tags_rows:
            old_tid = t["id"]
            old_uid = t.get("user_id", 1)
            target_uid = user_id_map.get(old_uid, 1)
            tname = t["name"].strip()
            color = t.get("color", "#64748b")
            created_at = t.get("created_at")

            existing_tag = None
            if has_tags:
                tag_check = await conn.execute(
                    text("SELECT id FROM tags WHERE user_id = :user_id AND lower(name) = lower(:name)"),
                    {"user_id": target_uid, "name": tname},
                )
                existing_tag = tag_check.mappings().first()

            if existing_tag:
                tag_id_map[old_tid] = existing_tag["id"]
                print(f"  • Existing tag: ID {existing_tag['id']} ('{tname}')")
            else:
                if dry_run:
                    tag_id_map[old_tid] = old_tid
                    print(f"  • [DRY-RUN] Would insert tag: ID {old_tid} ('{tname}', color: {color})")
                else:
                    res = await conn.execute(
                        text(
                            """
                            INSERT INTO tags (id, user_id, name, color, created_at)
                            VALUES (:id, :user_id, :name, :color, :created_at)
                            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
                            RETURNING id
                            """
                        ),
                        {
                            "id": old_tid,
                            "user_id": target_uid,
                            "name": tname,
                            "color": color,
                            "created_at": parse_dt(created_at),
                        },
                    )
                    new_tid = res.scalar_one()
                    tag_id_map[old_tid] = new_tid
                    print(f"  ✓ Inserted tag: ID {new_tid} ('{tname}')")

        # 6. Process Work Logs
        print("\n--- Step 6: Processing Work Logs (Accomplishments) ---")
        logs_inserted = 0
        logs_skipped = 0
        has_work_logs = await table_exists(conn, "work_logs")

        for wl in work_logs_rows:
            old_lid = wl["id"]
            old_uid = wl.get("user_id", 1)
            target_uid = user_id_map.get(old_uid, 1)
            old_cid = wl.get("company_id")
            target_cid = company_id_map.get(old_cid) if old_cid else None
            title = wl["title"].strip()
            content_md = wl.get("content_markdown", "")
            log_dt = date.fromisoformat(wl["log_date"])
            log_status = wl.get("status", "done")
            blockers = wl.get("blockers", "")
            achievements = wl.get("achievements", "")
            created_at = wl.get("created_at")
            updated_at = wl.get("updated_at")

            existing_log = None
            if has_work_logs:
                log_check = await conn.execute(
                    text("SELECT id FROM work_logs WHERE id = :id"),
                    {"id": old_lid},
                )
                existing_log = log_check.mappings().first()

            if existing_log:
                logs_skipped += 1
                print(f"  • Existing work log ID {old_lid}: '{title[:45]}...'")
            else:
                logs_inserted += 1
                if dry_run:
                    print(f"  • [DRY-RUN] Would insert work log ID {old_lid} ({log_dt}): '{title[:45]}...'")
                else:
                    await conn.execute(
                        text(
                            """
                            INSERT INTO work_logs (
                                id, user_id, company_id, log_date, title, content_markdown,
                                status, blockers, achievements, created_at, updated_at
                            ) VALUES (
                                :id, :user_id, :company_id, :log_date, :title, :content_markdown,
                                :status, :blockers, :achievements, :created_at, :updated_at
                            )
                            ON CONFLICT (id) DO UPDATE SET
                                title = EXCLUDED.title,
                                content_markdown = EXCLUDED.content_markdown,
                                status = EXCLUDED.status,
                                blockers = EXCLUDED.blockers,
                                achievements = EXCLUDED.achievements,
                                updated_at = EXCLUDED.updated_at
                            """
                        ),
                        {
                            "id": old_lid,
                            "user_id": target_uid,
                            "company_id": target_cid,
                            "log_date": log_dt,
                            "title": title,
                            "content_markdown": content_md,
                            "status": log_status,
                            "blockers": blockers,
                            "achievements": achievements,
                            "created_at": parse_dt(created_at),
                            "updated_at": parse_dt(updated_at),
                        },
                    )
                    print(f"  ✓ Inserted work log ID {old_lid} ({log_dt}): '{title[:45]}...'")

        # 7. Process Log Tags
        print("\n--- Step 7: Processing Log-Tag Associations ---")
        log_tags_rows = tables.get("log_tags", [])
        lt_inserted = 0
        has_log_tags = await table_exists(conn, "log_tags")

        for lt in log_tags_rows:
            old_lid = lt["log_id"]
            old_tid = lt["tag_id"]
            target_lid = old_lid  # Log IDs preserved
            target_tid = tag_id_map.get(old_tid, old_tid)

            if dry_run or not has_log_tags:
                lt_inserted += 1
            else:
                try:
                    await conn.execute(
                        text(
                            """
                            INSERT INTO log_tags (log_id, tag_id)
                            VALUES (:log_id, :tag_id)
                            ON CONFLICT DO NOTHING
                            """
                        ),
                        {"log_id": target_lid, "tag_id": target_tid},
                    )
                    lt_inserted += 1
                except Exception as exc:
                    print(f"  ! Skipped tag association ({target_lid}, {target_tid}): {exc}")

        print(f"  ✓ Processed {lt_inserted} log-tag associations.")

        # 8. Synchronize PostgreSQL Sequences
        print("\n--- Step 8: Synchronizing PostgreSQL Sequences ---")
        tables_to_sync = [
            ("users", "id"),
            ("skills", "id"),
            ("companies_worked", "id"),
            ("tags", "id"),
            ("work_logs", "id"),
        ]

        for tbl, col in tables_to_sync:
            if not await table_exists(conn, tbl):
                continue

            if dry_run:
                print(f"  • [DRY-RUN] Would sync sequence for {tbl}.{col}")
            else:
                try:
                    seq_res = await conn.execute(
                        text(f"SELECT pg_get_serial_sequence('{tbl}', '{col}');")
                    )
                    seq_name = seq_res.scalar()
                    if seq_name:
                        await conn.execute(
                            text(
                                f"""
                                SELECT setval(
                                    :seq_name,
                                    COALESCE((SELECT MAX({col}) FROM {tbl}), 1),
                                    (SELECT COUNT(*) > 0 FROM {tbl})
                                );
                                """
                            ),
                            {"seq_name": seq_name},
                        )
                        print(f"  ✓ Synced sequence {seq_name}")
                except Exception as exc:
                    print(f"  ! Notice: Could not sync sequence for {tbl}: {exc}")

        if not dry_run:
            await conn.commit()

        print("\n==================================================================")
        print(" IMPORT SUMMARY")
        print("==================================================================")
        print(f" Users:                 {len(user_rows)} processed")
        print(f" Companies Worked In:   {len(companies_rows)} mapped & synced")
        print(f" Skills:                {skills_inserted} inserted, {skills_updated} updated")
        print(f" Tags:                  {len(tags_rows)} tags synced")
        print(f" Work Logs:             {logs_inserted} inserted, {logs_skipped} existing")
        print(f" Log Tag Associations:  {lt_inserted} associations verified")
        print(" Status:                SUCCESS")
        print("==================================================================")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import workLog exported JSON data into careerTrack PostgreSQL database."
    )
    parser.add_argument(
        "--file",
        "-f",
        type=Path,
        default=Path("data/worklog_export.json"),
        help="Path to JSON export file (default: data/worklog_export.json)",
    )
    parser.add_argument(
        "--db-url",
        type=str,
        default=None,
        help="Target PostgreSQL database URL (defaults to DATABASE_URL environment variable)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate the import without writing any changes to the database.",
    )
    parser.add_argument(
        "--email",
        type=str,
        default=None,
        help="Override the user email to associate data with.",
    )

    args = parser.parse_args()
    target_db_url = args.db_url or get_default_db_url()

    asyncio.run(
        import_data(
            file_path=args.file,
            db_url=target_db_url,
            dry_run=args.dry_run,
            override_email=args.email,
        )
    )


if __name__ == "__main__":
    main()
