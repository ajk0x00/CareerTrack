interface JobDescriptionPanelProps {
  company: string
  onCompanyChange: (val: string) => void
  roleTitle: string
  onRoleTitleChange: (val: string) => void
  jobDescription: string
  onJobDescriptionChange: (val: string) => void
  hasTargetJob: boolean
  onReloadSample: () => void
  onGenerate: () => void
  isGenerating: boolean
  userName: string
}

export default function JobDescriptionPanel({
  company,
  onCompanyChange,
  roleTitle,
  onRoleTitleChange,
  jobDescription,
  onJobDescriptionChange,
  hasTargetJob,
  onReloadSample,
  onGenerate,
  isGenerating,
  userName,
}: JobDescriptionPanelProps) {
  // Compute word count
  const trimmedDescription = jobDescription.trim()
  const wordCount = trimmedDescription ? trimmedDescription.split(/\s+/).length : 0
  const isTailored = hasTargetJob

  return (
    <aside className="jd-panel">
      {/* Header */}
      <div className="jd-panel-header">
        <div className="flex-between">
          <div className="jd-title-row">
            <span className="live-dot animate-pulse"></span>
            <h2 className="jd-title">Target Job Description</h2>
          </div>
          <span className="step-tag">Step 1 of 2</span>
        </div>
        <p className="jd-subtitle">
          Paste the target requisition to calculate alignment &amp; tailor bullet impacts.
        </p>
      </div>

      {/* Body Inputs */}
      <div className="jd-panel-body">
        {/* Company & Role */}
        <div className="grid-two-cols">
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="input-company">
              Company
            </label>
            <div className="input-with-icon">
              <span className="material-symbols-outlined input-leading-icon">business</span>
              <input
                id="input-company"
                type="text"
                className="compact-input"
                value={company}
                onChange={(e) => onCompanyChange(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="input-role">
              Role Title
            </label>
            <div className="input-with-icon">
              <span className="material-symbols-outlined input-leading-icon">badge</span>
              <input
                id="input-role"
                type="text"
                className="compact-input"
                value={roleTitle}
                onChange={(e) => onRoleTitleChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Textarea container */}
        <div className="jd-textarea-wrapper">
          <div className="flex-between" style={{ marginBottom: '6px' }}>
            <label className="compact-label" htmlFor="jd-text">
              Job Description Content
            </label>
            <div className="jd-stats-row">
              <span className="stat-highlight">{wordCount.toLocaleString()}</span> words
              <span>•</span>
              <span className="stat-tertiary">
                {isTailored ? 'Tailored mode' : 'Generic mode'}
              </span>
            </div>
          </div>

          <div className="jd-textarea-relative">
            <textarea
              id="jd-text"
              className="jd-textarea"
              placeholder="Paste full job description or responsibilities here..."
              value={jobDescription}
              onChange={(e) => onJobDescriptionChange(e.target.value)}
            />
          </div>

          <div className="jd-sample-row">
            <button
              type="button"
              className="reload-sample-btn"
              onClick={onReloadSample}
              title="Reload sample Stripe requisition"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                autorenew
              </span>
              <span>Reload Sample</span>
            </button>
          </div>

          <div className="jd-bottom-links">
            <button
              type="button"
              className="import-url-btn"
              onClick={() => alert('LinkedIn / URL parser integration connected.')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                link
              </span>
              <span>Import from LinkedIn / URL</span>
            </button>
            <span className="charset-tag">UTF-8 Plaintext</span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom CTA */}
      <div className="jd-panel-cta-wrapper">
        <button
          type="button"
          className="generate-cta-btn"
          disabled={isGenerating}
          onClick={onGenerate}
        >
          {isGenerating ? (
            <>
              <span className="material-symbols-outlined rotating-icon">sync</span>
              <span>Synthesizing ATS Model...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined cta-bolt-icon">bolt</span>
              <span>{isTailored ? 'Generate Tailored Resume' : 'Generate Generic Resume'}</span>
              <span className="shortcut-pill">⌘↵</span>
            </>
          )}
        </button>
        <p className="cta-disclaimer">
          Syncs with {userName}’s verified Experience Vault &amp; Competencies
        </p>
      </div>
    </aside>
  )
}
