# Exact Job Posting MCP Agent Requirements and Interactive Pipeline Card Viewer

**Date**: 2026-10-19

## 1. Changes Made
- `app/mcp/server.py`: Enriched MCP server description to explicitly mandate that any external agent connected to CareerTrack's MCP server must supply the entire, unabridged content of the job posting as it is when adding opportunities.
- `app/mcp/tools.py`: Enhanced `add_job` tool signature with detailed `Annotated[..., Field(...)]` parameter prompts for `description` and `requirements`, instructing connected LLM agents to provide the complete, verbatim job posting text as published (all sections: About the company, Role Overview, Responsibilities, Day-to-Day tasks, and Requirements) and strictly prohibiting summaries or truncation.
- `frontend/src/components/workspace/JobDetailModal.tsx`: Created modal component displaying the exact job posting (title, company, stage badge, compensation, dates, full formatted job description, key requirements, private notes/intel callout, and requisition link) with pinned header/footer, `useBodyScrollLock`, and "Tailor Resume for this Job" action.
- `frontend/src/components/workspace/JobPipeline.tsx`: Made pipeline cards interactive with pointer cursor, hover elevation, and an expand icon; clicking a card opens `JobDetailModal` while stopping event propagation on card dropdowns and action buttons; updated `handleTailorResume` to pass `?jobId=${job.id}`.
- `frontend/src/components/workspace/TailoredResumeWorkspace.tsx`: Added `jobId` URL query parameter support to automatically fetch and populate the target job's full description and requirements into the tailoring workspace.
- `frontend/src/components/workspace/JobModal.tsx`: Expanded the description textarea to 6 rows to comfortably view and edit full job posting text.
- `frontend/src/index.css`: Added responsive styles for `JobDetailModal`, formatted text blocks (headings, bullet points, paragraphs), highlights bar, notes callouts, and hover states on `.pipeline-job-card`.

## 2. Why the Change Was Made (Rationale)
- The user clarified that instead of fetching/scraping data from the posting URL, CareerTrack should instruct the agent connected to the MCP server (the one adding jobs to the database) to provide all the content of the job posting as it is.
- Storing and viewing the full job description is critical to CareerTrack's core mission: generating high-accuracy, ATS-optimized resumes tailored against specific employer requirements and responsibilities.
- By defining explicit instructions in the MCP server and tool schema parameter metadata, any external AI agent invoking `add_job` receives strong directives not to summarize or truncate, ensuring the exact job posting is preserved in the database.
- The pipeline modal provides a clean view of the full job posting as recorded by the agent, cleanly separating the employer's official description from private applicant notes, and provides one-click navigation directly into the resume tailoring workspace.

## 3. Things to Lookout for in Future Development
- **Agent Payload Sizes**: Full job postings can be several thousand characters. Ensure external agent connections have appropriate timeout and message size limits when transmitting large posting texts over MCP stdio/HTTP.
- **ATS Parsing Token Limits**: Extremely long job descriptions (8k+ characters) consume significant prompt tokens when sent to LLM resume generation models. If necessary in the future, consider adding chunked or keyword-focused sectioning during prompt compilation.
