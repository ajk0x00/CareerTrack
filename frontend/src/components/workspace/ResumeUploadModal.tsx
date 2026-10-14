import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { useToast } from '../ToastContext'

export interface ResumeImportResult {
  companies_created: number
  companies_updated: number
  accomplishments_created: number
  skills_created: number
  skills_updated: number
  errors: string[]
}

interface ResumeUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess?: (result: ResumeImportResult, markdownText: string) => void
}

export default function ResumeUploadModal({
  isOpen,
  onClose,
  onImportSuccess,
}: ResumeUploadModalProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [markdownText, setMarkdownText] = useState<string>('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ResumeImportResult | null>(null)

  if (!isOpen) return null

  const resetForm = () => {
    setMarkdownText('')
    setFileName(null)
    setIsDragging(false)
    setIsSubmitting(false)
    setError(null)
    setImportResult(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(md|markdown|txt)$/i)) {
      setError('Please upload a Markdown file (.md, .markdown, or .txt).')
      return
    }

    setError(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result
      if (typeof content === 'string') {
        setMarkdownText(content)
      }
    }
    reader.onerror = () => {
      setError('Failed to read the selected file.')
    }
    reader.readAsText(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleImport = async () => {
    const trimmed = markdownText.trim()
    if (!trimmed) {
      setError('Please paste your resume markdown or choose a file first.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setImportResult(null)

    const token =
      localStorage.getItem('careerTrack_token') ||
      sessionStorage.getItem('careerTrack_token') ||
      ''

    try {
      const res = await fetch('/api/v1/resume/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resume_markdown: trimmed }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        const detail = errorData?.detail || `Import failed with status ${res.status}`
        throw new Error(detail)
      }

      const data: ResumeImportResult = await res.json()
      setImportResult(data)
      toast.success(
        `Imported: ${data.companies_created + data.companies_updated} companies, ${data.accomplishments_created} achievements, ${data.skills_created + data.skills_updated} skills.`,
        'Resume Synced to Profile'
      )

      if (onImportSuccess) {
        onImportSuccess(data, trimmed)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during import.'
      setError(msg)
      toast.error(msg, 'Resume Import Failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-upload-title"
    >
      <div
        className="modal-container modal-wide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: 'var(--primary-container)', color: 'var(--on-primary-container)' }}>
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <div>
              <h2 id="resume-upload-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>
                Import Resume via AI
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                Extract and update companies, accomplishments, and skills directly into your profile.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ marginTop: '20px' }}>
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
              <span>{error}</span>
            </div>
          )}

          {importResult ? (
            /* Success Summary State */
            <div style={{ padding: '8px 0' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '28px' }}>
                  check_circle
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--on-surface)' }}>
                    Career Data Successfully Synced
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                    Your work timeline, accomplishments, and skills have been populated in the database.
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--surface-container)', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
                    {importResult.companies_created + importResult.companies_updated}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                    Companies ({importResult.companies_created} new, {importResult.companies_updated} updated)
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--surface-container)', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
                    {importResult.accomplishments_created}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                    Accomplishment Logs Added
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--surface-container)', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
                    {importResult.skills_created + importResult.skills_updated}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                    Skills ({importResult.skills_created} new, {importResult.skills_updated} updated)
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ padding: 0, justifyContent: 'flex-end', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetForm}
                >
                  Import Another
                </button>
                <button
                  type="button"
                  className="btn-canvas-primary"
                  onClick={handleClose}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Upload / Paste Form State */
            <div>
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--outline-variant, #cbd5e1)'}`,
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  backgroundColor: isDragging ? 'var(--primary-container)' : 'var(--surface-container-low)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  marginBottom: '16px',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".md,.markdown,.txt"
                  style={{ display: 'none' }}
                />
                <span className="material-symbols-outlined" style={{ fontSize: '36px', color: 'var(--primary)', marginBottom: '8px' }}>
                  cloud_upload
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)' }}>
                  {fileName ? (
                    <span>Selected: <strong>{fileName}</strong></span>
                  ) : (
                    <span>Drop your Markdown resume here, or <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>browse file</span></span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                  Supports .md, .markdown, and .txt files
                </div>
              </div>

              {/* Paste or Edit Buffer */}
              <div className="form-group-compact">
                <div className="flex-between" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="compact-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                    Resume Markdown Content
                  </label>
                  {markdownText && (
                    <span style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                      {markdownText.length} characters • {markdownText.split(/\s+/).filter(Boolean).length} words
                    </span>
                  )}
                </div>
                <textarea
                  className="compact-textarea"
                  rows={9}
                  placeholder={`# Your Name\n\n## Experience\n### Senior Engineer • Acme Corp (2021 - Present)\n- Led platform modernization...\n\n## Skills\n- Python, TypeScript, Docker...`}
                  value={markdownText}
                  onChange={(e) => setMarkdownText(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--outline-variant, #cbd5e1)',
                    backgroundColor: 'var(--surface-container-lowest)',
                    color: 'var(--on-surface)',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div
                className="modal-actions"
                style={{
                  marginTop: '20px',
                  padding: 0,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-canvas-primary"
                  onClick={handleImport}
                  disabled={isSubmitting || !markdownText.trim()}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: isSubmitting || !markdownText.trim() ? 0.6 : 1,
                    cursor: isSubmitting || !markdownText.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {isSubmitting ? 'hourglass_top' : 'auto_awesome'}
                  </span>
                  <span>{isSubmitting ? 'Extracting with AI...' : 'Extract & Sync to Profile'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
