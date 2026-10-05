"""Experience calculation and career timeline analysis utilities for the MCP server."""

from datetime import date
from typing import Any

from app.models.company import CompanyWorked, EmploymentType


def format_tenure(months: int) -> str:
    """Formats months into a human-readable tenure string like '2 yrs 4 mos' or '8 mos'."""
    if months <= 0:
        return "0 mos"
    years = months // 12
    rem = months % 12
    if years == 0:
        return f"{rem} mo" if rem == 1 else f"{rem} mos"
    yr_str = f"{years} yr" if years == 1 else f"{years} yrs"
    if rem == 0:
        return yr_str
    mo_str = f"{rem} mo" if rem == 1 else f"{rem} mos"
    return f"{yr_str} {mo_str}"


def format_years_and_months(months: int) -> str:
    """Formats months into formal ATS-ready text like '3 years, 2 months'."""
    if months <= 0:
        return "0 months"
    years = months // 12
    rem = months % 12
    parts: list[str] = []
    if years > 0:
        parts.append(f"{years} year" if years == 1 else f"{years} years")
    if rem > 0 or years == 0:
        parts.append(f"{rem} month" if rem == 1 else f"{rem} months")
    return ", ".join(parts)


def compute_company_tenure(
    start_date: date,
    end_date: date | None,
    actively_working: bool,
    today: date | None = None,
) -> tuple[int, str]:
    """Computes tenure months and formatted string for an individual company position."""
    ref_date = today or date.today()
    effective_end = ref_date if (actively_working or end_date is None) else end_date
    if effective_end < start_date:
        return (0, "0 mos")
    days = (effective_end - start_date).days
    months = max(1, int(round(days / 30.4375)))
    return (months, format_tenure(months))


def calculate_experience_summary(
    companies: list[CompanyWorked],
    today: date | None = None,
) -> dict[str, Any]:
    """Computes total verified experience, timeline with merged intervals, and active roles.

    Overlapping employment periods are merged to accurately reflect calendar experience
    without double counting, adhering to resume and ATS evaluation standards.
    """
    ref_date = today or date.today()

    if not companies:
        return {
            "total_experience": {
                "total_years_decimal": 0.0,
                "total_months": 0,
                "total_years": 0,
                "remaining_months": 0,
                "formatted": "0 months",
            },
            "total_companies": 0,
            "active_positions_count": 0,
            "active_positions": [],
            "employment_type_breakdown": {},
            "timeline": [],
        }

    # Normalize individual tenures and build timeline
    timeline: list[dict[str, Any]] = []
    active_positions: list[dict[str, Any]] = []
    intervals_for_merging: list[tuple[date, date]] = []
    emp_type_months: dict[str, int] = {t.value: 0 for t in EmploymentType}

    # Sort companies by start_date descending (most recent first)
    sorted_companies = sorted(companies, key=lambda c: c.start_date, reverse=True)

    for comp in sorted_companies:
        effective_end = ref_date if (comp.actively_working or comp.end_date is None) else comp.end_date
        safe_end = max(comp.start_date, effective_end)
        tenure_months, tenure_str = compute_company_tenure(
            comp.start_date,
            comp.end_date,
            comp.actively_working,
            today=ref_date,
        )

        item = {
            "id": comp.id,
            "company_name": comp.company_name,
            "employment_type": comp.employment_type,
            "start_date": comp.start_date.isoformat(),
            "end_date": comp.end_date.isoformat() if comp.end_date else None,
            "actively_working": comp.actively_working,
            "tenure_months": tenure_months,
            "tenure_formatted": tenure_str,
        }
        timeline.append(item)

        if comp.actively_working or comp.end_date is None:
            active_positions.append(item)

        # Track employment type raw months
        emp_type_months[comp.employment_type] = (
            emp_type_months.get(comp.employment_type, 0) + tenure_months
        )

        intervals_for_merging.append((comp.start_date, safe_end))

    # Merge overlapping intervals to calculate true calendar experience
    intervals_for_merging.sort(key=lambda x: x[0])
    merged_intervals: list[list[date]] = []
    for s, e in intervals_for_merging:
        if not merged_intervals:
            merged_intervals.append([s, e])
        else:
            prev_start, prev_end = merged_intervals[-1]
            if s <= prev_end:
                merged_intervals[-1][1] = max(prev_end, e)
            else:
                merged_intervals.append([s, e])

    total_days = sum((e - s).days for s, e in merged_intervals)
    total_months = max(1, int(round(total_days / 30.4375))) if total_days > 0 else 0
    total_years = total_months // 12
    remaining_months = total_months % 12
    total_years_decimal = round(total_months / 12, 1)

    formatted_emp_breakdown: dict[str, dict[str, Any]] = {}
    for emp_type, raw_months in emp_type_months.items():
        if raw_months > 0:
            formatted_emp_breakdown[emp_type] = {
                "months": raw_months,
                "years_decimal": round(raw_months / 12, 1),
                "formatted": format_years_and_months(raw_months),
            }

    return {
        "total_experience": {
            "total_years_decimal": total_years_decimal,
            "total_months": total_months,
            "total_years": total_years,
            "remaining_months": remaining_months,
            "formatted": format_years_and_months(total_months),
        },
        "total_companies": len(companies),
        "active_positions_count": len(active_positions),
        "active_positions": active_positions,
        "employment_type_breakdown": formatted_emp_breakdown,
        "timeline": timeline,
    }
