import React from 'react'

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
  const lineCount = markdown ? markdown.split('\n').length : 0
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0
  const charCount = markdown.length

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const updated = markdown.substring(0, start) + '  ' + markdown.substring(end)
      onChange(updated)
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className="markdown-editor-card resume-editor-surface">
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
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '16px', color: 'var(--tertiary)' }}
          >
            check_circle
          </span>
          <span>Buffer Auto-sync active</span>
        </div>
      </div>

      {/* Active Live Sync & Buffer Stats Banner */}
      <div className="md-coming-soon-banner">
        <div className="banner-left">
          <span
            className="material-symbols-outlined banner-icon"
            style={{ color: 'var(--tertiary)' }}
          >
            auto_awesome
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="banner-title" style={{ color: 'var(--on-surface)' }}>
                Live Markdown Rendering Active
              </span>
              <span className="stat-pill success" style={{ fontSize: '11px', padding: '1px 6px' }}>
                {lineCount} lines • {wordCount} words • {charCount} chars
              </span>
            </div>
            <p className="banner-desc">
              Edits to this buffer render immediately in the &ldquo;Rendered Preview&rdquo; tab with ATS formatting.
            </p>
          </div>
        </div>
        <button type="button" className="btn-copy-mini" onClick={onCopy} title="Copy markdown buffer">
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
            content_copy
          </span>
          <span>Copy Buffer</span>
        </button>
      </div>

      {/* Header Line Hint */}
      <p className="md-header-hint">
        Header line: <code># Your Name</code> — edit it here; it renders as the resume
        title and appears in the exported PDF.
      </p>

      {/* Raw Markdown Textarea */}
      <div className="md-textarea-container">
        <textarea
          className="md-raw-textarea"
          value={markdown}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="Enter or edit markdown buffer..."
        />
      </div>
    </div>
  )
}
