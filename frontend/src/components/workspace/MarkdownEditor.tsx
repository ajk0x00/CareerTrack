interface MarkdownEditorProps {
  markdown: string
  onChange: (val: string) => void
  onCopy: () => void
}

export default function MarkdownEditor({
  markdown,
  onChange,
  onCopy,
}: MarkdownEditorProps) {
  return (
    <div className="markdown-editor-card">
      {/* Editor Header Bar */}
      <div className="md-editor-header">
        <div className="md-dots-group">
          <span className="dot error"></span>
          <span className="dot warning"></span>
          <span className="dot success"></span>
          <span className="md-buffer-name">
            resume-tailored.md • Live Markdown Buffer
          </span>
        </div>

        <div className="md-sync-indicator">
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--tertiary)' }}>
            check_circle
          </span>
          <span>Buffer Auto-sync active</span>
        </div>
      </div>

      {/* "Coming soon" Callout per User Specification */}
      <div className="md-coming-soon-banner">
        <div className="banner-left">
          <span className="material-symbols-outlined banner-icon">info</span>
          <div>
            <span className="banner-title">Markdown Rendering Engine — Coming Soon</span>
            <p className="banner-desc">
              All buffer state and export dependencies are fully wired. Real-time markdown AST parsing will be activated in an upcoming update.
            </p>
          </div>
        </div>
        <button type="button" className="btn-copy-mini" onClick={onCopy}>
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>content_copy</span>
          <span>Copy Buffer</span>
        </button>
      </div>

      {/* Raw Markdown Textarea */}
      <div className="md-textarea-container">
        <textarea
          className="md-raw-textarea"
          value={markdown}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder="Enter or edit markdown buffer..."
        />
      </div>
    </div>
  )
}
