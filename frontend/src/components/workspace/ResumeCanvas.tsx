import { useState } from 'react'
import type { ExperienceItem, SkillCategory } from '../../types/workspace'
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
}: ResumeCanvasProps) {
  const [activeTab, setActiveTab] = useState<'rendered' | 'markdown'>('rendered')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false)

  const handleExportPDF = () => {
    window.print()
  }

  const handleDownloadDOCX = () => {
    alert('Exporting ATS-optimized DOCX document formatted for enterprise screening engines.')
  }

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
            <span>•</span>
            <span className="ats-score-pill">
              <span className="ats-score-dot"></span>
              ATS Score: 98% Match
            </span>
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
              className="btn-canvas-secondary"
              onClick={handleExportPDF}
              title="Export PDF Document"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                picture_as_pdf
              </span>
              <span className="hide-mobile">Export PDF</span>
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
        <div className={`resume-view-container ${highlightFlash ? 'flash-ring' : ''}`}>
          {/* ATS Context Notification Banner */}
          <div className="ats-notice-box">
            <div className="ats-notice-left">
              <div className="ats-notice-icon">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  auto_awesome
                </span>
              </div>
              <div>
                <p className="ats-notice-title">
                  Requisition High-Affinity Tailoring Applied
                </p>
                <p className="ats-notice-body">
                  14 metrics from your {company} &amp; verified roles were weighted. 9 keyword patterns seamlessly integrated into bullet hierarchies.
                </p>
              </div>
            </div>

            <div className="ats-notice-badges">
              <span className="stat-pill success">99.2% Parse Rate</span>
              <span className="stat-pill primary">0 Format Errors</span>
            </div>
          </div>

          {activeTab === 'rendered' ? (
            <RenderedResume
              markdown={markdownContent}
              userName={userName}
              roleTitle={roleTitle}
              company={company}
              experiences={experiences}
              categories={categories}
            />
          ) : (
            <MarkdownEditor
              markdown={markdownContent}
              onChange={onMarkdownChange}
              onCopy={onCopyMarkdown}
            />
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
