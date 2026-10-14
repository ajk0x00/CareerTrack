"""Service for orchestrating LLM-powered resume parsing and database upserts via LangGraph."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.graph import resume_extraction_graph
from app.schemas.resume import ResumeImportResponse

logger = logging.getLogger(__name__)


class ResumeImportService:
    """Orchestrates LLM extraction and transactional upsert into CareerTrack models via LangGraph."""

    @staticmethod
    async def import_resume(
        user_id: int,
        resume_markdown: str,
        db: AsyncSession,
    ) -> ResumeImportResponse:
        """Parses a Markdown resume via LangGraph and upserts companies, accomplishments, and skills."""
        initial_state = {
            "user_id": user_id,
            "resume_markdown": resume_markdown,
            "extraction": None,
            "import_response": None,
        }

        config = {
            "configurable": {"db": db},
            "run_name": "ResumeImportWorkflow",
            "tags": ["resume-import", f"user:{user_id}"],
        }

        logger.info("Executing LangGraph resume extraction workflow for user_id=%d", user_id)
        final_state = await resume_extraction_graph.ainvoke(initial_state, config=config)

        import_response = final_state.get("import_response")
        if import_response is None:
            raise ValueError("LangGraph execution completed without generating an import response.")

        return import_response
