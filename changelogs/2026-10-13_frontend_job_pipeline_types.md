# Frontend Job Pipeline TypeScript Definitions

**Date**: 2026-10-13

## 1. Changes Made
- `frontend/src/types/workspace.ts`: Added TypeScript interfaces and types for Jobs (`JobStatus`, `JobItem`, `JobCreateInput`, `JobUpdateInput`, `JobPipelineSummary`).
- `frontend/src/components/workspace/JobPipeline.tsx`: Updated `PipelineJob.stage` to reference the centralized `JobStatus` type.

## 2. Why the Change Was Made (Rationale)
- Consolidates job-related data models and pipeline stage definitions into shared TypeScript types matching the backend Job API schemas, preventing drift between the frontend pipeline components and backend endpoints.

## 3. Things to Lookout for in Future Development
- When adding new stage filters or status transition actions to the `JobPipeline` UI, use `JobStatus` and the corresponding CRUD endpoints in `/api/v1/jobs`.
