import { useState } from 'react'
import type { ExperienceItem, SkillCategory } from '../../types/workspace'
import type { AtsReport } from '../../types/resume'
import RenderedResume from './RenderedResume'
import MarkdownEditor from './MarkdownEditor'
import ResumeUploadModal from './ResumeUploadModal'

interface ResumeCanvasProps {
  userName: string
  roleTitle: string
  company: string
  experiences: ExperienceItem[]
  categories: SkillCategory[]
  markdownContent: string
  onMarkdownChange: (val: string) => void
  onCopyMarkdown: () => void
  highlightFlash: boolean
  onSave?: () => void
  onDownload?: () => void
  isSaving?: boolean
  isDownloading?: boolean
  isDirty?: boolean
  atsReport?: AtsReport | null
  isLoadingDraft?: boolean
  loadError?: string | null
}

function formatCoveragePercent(coverage: number): string {
  const percent = (coverage * 100).toFixed(1)
  return `${percent.endsWith('.0') ? percent.slice(0, -2) : percent}%`
}

export default function ResumeCanvas({
  userName,
  roleTitle,
  company,
  experiences,
  categories,
  markdownContent,
  onMarkdownChange,
  onCopyMarkdown,
  highlightFlash,
  onSave,
  onDownload,
  isSaving = false,
  isDownloading = false,
  isDirty = false,
  atsReport = null,
  isLoadingDraft = false,
  loadError = null,
}: ResumeCanvasProps) {
  const [activeTab, setActiveTab] = useState<'rendered' | 'split' | 'markdown'>('rendered')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false)

  const handleDownloadDOCX = () => {
    alert('Exporting ATS-optimized DOCX document formatted for enterprise screening engines.')
  }

  const hasContent = markdownContent.trim().length > 0
  const showLoadError = Boolean(loadError) && !hasContent
  const coverageLabel =
    atsReport && atsReport.keyword_coverage !== null
      ? formatCoveragePercent(atsReport.keyword_coverage)
      : null

  const renderedResumeElement = (
    <RenderedResume
      markdown={markdownContent}
      userName={userName}
      roleTitle={roleTitle}
      company={company}
      experiences={experiences}
      categories={categories}
    />
  )

  const emptyCanvasState = (
    <div className="resume-canvas-state">
      <span className="material-symbols-outlined resume-canvas-state-icon">
        description
      </span>
      <p className="resume-canvas-state-title">No resume content yet</p>
      <p className="resume-canvas-state-body">
        Rebuild the draft from your career data, or upload an existing resume to
        populate this canvas.
      </p>
    </div>
  )

  const markdownEditorElement = (
    <MarkdownEditor
      markdown={markdownContent}
      onChange={onMarkdownChange}
      onCopy={onCopyMarkdown}
    />
  )

  return (
    <section className="resume-canvas-area">
      {/* Top Action Control Bar */}
      <div className="canvas-top-bar">
        {/* Document Identity */}
        <div className="doc-identity-group">
          <div className="doc-title-row">
            <h1 className="doc-main-title">LATEST RESUME MARKDOWN RENDERED</h1>
            <span className="doc-version-tag">v3.2 - {company} Tailored</span>
          </div>
          <div className="doc-meta-row">
            <span className="doc-timestamp">Last synthesized: Just now</span>
            {coverageLabel && (
              <>
                <span>•</span>
                <span className="ats-score-pill">
                  <span className="ats-score-dot"></span>
                  ATS Coverage: {coverageLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="canvas-actions-cluster">
          {/* Segmented Switcher */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segment-btn ${activeTab === 'rendered' ? 'active' : ''}`}
              onClick={() => setActiveTab('rendered')}
              title="Rendered Preview"
              aria-label="Rendered Preview"
            >
              <span className="material-symbols-outlined segment-icon">visibility</span>
            </button>

            <button
              type="button"
              className={`segment-btn ${activeTab === 'split' ? 'active' : ''}`}
              onClick={() => setActiveTab('split')}
              title="Split editor and preview"
              aria-label="Split editor and preview"
            >
              <span className="material-symbols-outlined segment-icon">splitscreen</span>
            </button>

            <button
              type="button"
              className={`segment-btn ${activeTab === 'markdown' ? 'active' : ''}`}
              onClick={() => setActiveTab('markdown')}
              title="Edit Raw Markdown"
              aria-label="Edit Raw Markdown"
            >
              <span className="material-symbols-outlined segment-icon">code</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="canvas-buttons-group">
            {isDirty && (
              <span className="canvas-dirty-badge" title="Edits are saved when you press Save or Download PDF">
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              className="btn-canvas-primary"
              onClick={onSave}
              disabled={!onSave || !hasContent || isSaving || isLoadingDraft}
              title="Save this resume to your career data"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {isSaving ? 'hourglass_top' : 'save'}
              </span>
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>

            <button
              type="button"
              className="btn-canvas-secondary"
              onClick={onDownload}
              disabled={!onDownload || !hasContent || isDownloading || isLoadingDraft}
              title="Download the ATS-safe PDF for this resume (unsaved edits are saved first)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {isDownloading ? 'hourglass_top' : 'picture_as_pdf'}
              </span>
              <span className="hide-mobile">
                {isDownloading ? 'Downloading...' : 'Download PDF'}
              </span>
            </button>

            <button
              type="button"
              className="btn-canvas-secondary"
              onClick={() => setIsUploadModalOpen(true)}
              title="Upload and Extract Resume with AI"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                upload_file
              </span>
              <span className="hide-mobile">Upload Resume</span>
            </button>

            <button
              type="button"
              className="icon-action-btn"
              onClick={onCopyMarkdown}
              title="Copy Markdown to Clipboard"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                content_copy
              </span>
            </button>

            <button
              type="button"
              className="btn-canvas-primary"
              onClick={handleDownloadDOCX}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                download
              </span>
              <span>Download DOCX</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Resume Sheet Container */}
      <div className="resume-sheet-wrapper">
        <div
          className={`resume-view-container ${highlightFlash ? 'flash-ring' : ''}${
            activeTab === 'split' ? ' resume-view-container-split' : ''
          }`}
        >
          {/* ATS Verification Banner (rendered only from a real ATS report) */}
          {!isLoadingDraft && !showLoadError && atsReport && (
            <div className="ats-notice-box">
              <div className="ats-notice-left">
                <div
                  className={`ats-notice-icon ${atsReport.parse_clean ? '' : 'warning'}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {atsReport.parse_clean ? 'verified' : 'warning'}
                  </span>
                </div>
                <div>
                  <p className="ats-notice-title">
                    {atsReport.parse_clean
                      ? 'Parses cleanly'
                      : `${atsReport.missing_tokens.length} token${
                          atsReport.missing_tokens.length === 1 ? '' : 's'
                        } could not be verified`}
                  </p>
                  <p className="ats-notice-body">
                    {atsReport.page_count}{' '}
                    {atsReport.page_count === 1 ? 'page' : 'pages'} •{' '}
                    {atsReport.char_count.toLocaleString()} characters
                    {atsReport.sections_found.length > 0
                      ? ` • ${atsReport.sections_found.length} sections detected`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="ats-notice-badges">
                {coverageLabel && (
                  <span className="stat-pill primary">{coverageLabel} keyword coverage</span>
                )}
                <span
                  className={`stat-pill ${atsReport.parse_clean ? 'success' : 'danger'}`}
                >
                  {atsReport.parse_clean ? 'PDF verified' : 'Needs review'}
                </span>
              </div>
            </div>
          )}

          {isLoadingDraft ? (
            <div className="resume-canvas-state">
              <div className="pref-loading-spinner" />
              <span>Loading resume from your career data...</span>
            </div>
          ) : showLoadError ? (
            <div className="resume-canvas-state error">
              <span className="material-symbols-outlined resume-canvas-state-icon">
                error
              </span>
              <p className="resume-canvas-state-title">Could not load your resume</p>
              <p className="resume-canvas-state-body">{loadError}</p>
            </div>
          ) : activeTab === 'rendered' ? (
            hasContent ? renderedResumeElement : emptyCanvasState
          ) : activeTab === 'split' ? (
            <div className="resume-split-grid">
              <div className="resume-split-pane">{markdownEditorElement}</div>
              <div className="resume-split-pane">
                {hasContent ? renderedResumeElement : emptyCanvasState}
              </div>
            </div>
          ) : (
            markdownEditorElement
          )}
        </div>
      </div>

      {/* Resume Upload & AI Extraction Modal */}
      <ResumeUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onImportSuccess={(_result, markdown) => {
          onMarkdownChange(markdown)
        }}
      />
    </section>
  )
}
