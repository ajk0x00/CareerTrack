import React from 'react'

export interface MarkdownRendererProps {
  markdown: string
  className?: string
}

interface TextInlineToken {
  type: 'text'
  text: string
}

interface BoldInlineToken {
  type: 'bold'
  text: string
  isMetric: boolean
  children: InlineToken[]
}

interface ItalicInlineToken {
  type: 'italic'
  text: string
  children: InlineToken[]
}

interface BoldItalicInlineToken {
  type: 'bold_italic'
  text: string
  children: InlineToken[]
}

interface DelInlineToken {
  type: 'del'
  text: string
  children: InlineToken[]
}

interface CodeInlineToken {
  type: 'code'
  text: string
}

interface LinkInlineToken {
  type: 'link'
  text: string
  url: string
  children: InlineToken[]
}

interface BrInlineToken {
  type: 'br'
}

type InlineToken =
  | TextInlineToken
  | BoldInlineToken
  | ItalicInlineToken
  | BoldItalicInlineToken
  | DelInlineToken
  | CodeInlineToken
  | LinkInlineToken
  | BrInlineToken

interface HeadingBlock {
  type: 'heading'
  level: number
  text: string
}

interface HrBlock {
  type: 'hr'
}

interface BlockquoteBlock {
  type: 'blockquote'
  text: string
}

interface CodeBlock {
  type: 'code'
  lang: string
  code: string
}

interface TableBlock {
  type: 'table'
  headers: string[]
  rows: string[][]
}

interface ListItem {
  indent: number
  text: string
}

interface ListBlock {
  type: 'list'
  ordered: boolean
  items: ListItem[]
}

interface ParagraphBlock {
  type: 'paragraph'
  text: string
}

type BlockToken =
  | HeadingBlock
  | HrBlock
  | BlockquoteBlock
  | CodeBlock
  | TableBlock
  | ListBlock
  | ParagraphBlock

const METRIC_REGEX =
  /(\d+(\.\d+)?%|\$\d+(\.\d+)?[kKmMbBtT]?\+?|\b\d+[xX]\b|\b\d+\.?\d*B\+?\b)/

function parseInline(text: string): InlineToken[] {
  if (!text) return []

  const patterns = [
    { type: 'code', regex: /^`([^`]+)`/ },
    { type: 'link', regex: /^\[([^\]]+)\]\(([^)]+)\)/ },
    {
      type: 'bold_italic',
      regex: /^(?:\*\*\*([\s\S]+?)\*\*\*|___([\s\S]+?)___)/,
    },
    { type: 'bold', regex: /^(?:\*\*([\s\S]+?)\*\*|__([\s\S]+?)__)/ },
    { type: 'italic', regex: /^(?:\*([\s\S]+?)\*|_([\s\S]+?)_)/ },
    { type: 'del', regex: /^~~([\s\S]+?)~~/ },
    { type: 'br', regex: /^(?: {2,}\n|\r?\n)/ },
  ] as const

  const result: InlineToken[] = []
  let cursor = 0

  while (cursor < text.length) {
    let matched = false
    const remaining = text.slice(cursor)

    for (const p of patterns) {
      const m = remaining.match(p.regex)
      if (m) {
        matched = true
        const full = m[0]

        if (p.type === 'code') {
          result.push({ type: 'code', text: m[1] })
        } else if (p.type === 'link') {
          result.push({
            type: 'link',
            text: m[1],
            url: m[2],
            children: parseInline(m[1]),
          })
        } else if (p.type === 'bold_italic') {
          const inner = m[1] || m[2]
          result.push({
            type: 'bold_italic',
            text: inner,
            children: parseInline(inner),
          })
        } else if (p.type === 'bold') {
          const inner = m[1] || m[2]
          const isMetric = METRIC_REGEX.test(inner)
          result.push({
            type: 'bold',
            text: inner,
            isMetric,
            children: parseInline(inner),
          })
        } else if (p.type === 'italic') {
          const inner = m[1] || m[2]
          result.push({
            type: 'italic',
            text: inner,
            children: parseInline(inner),
          })
        } else if (p.type === 'del') {
          result.push({
            type: 'del',
            text: m[1],
            children: parseInline(m[1]),
          })
        } else if (p.type === 'br') {
          result.push({ type: 'br' })
        }

        cursor += full.length
        break
      }
    }

    if (!matched) {
      const nextSpecial = text.slice(cursor).search(/[`[*_~\n]/)
      if (nextSpecial === -1) {
        result.push({ type: 'text', text: text.slice(cursor) })
        break
      } else if (nextSpecial > 0) {
        result.push({
          type: 'text',
          text: text.slice(cursor, cursor + nextSpecial),
        })
        cursor += nextSpecial
      } else {
        result.push({ type: 'text', text: text[cursor] })
        cursor++
      }
    }
  }

  // Merge adjacent plain text nodes
  const merged: InlineToken[] = []
  for (const node of result) {
    if (
      node.type === 'text' &&
      merged.length > 0 &&
      merged[merged.length - 1].type === 'text'
    ) {
      (merged[merged.length - 1] as TextInlineToken).text += node.text
    } else {
      merged.push(node)
    }
  }

  return merged
}

function renderInlineTokens(
  tokens: InlineToken[],
  prefix = 'in'
): React.ReactNode[] {
  return tokens.map((token, idx) => {
    const key = `${prefix}-${idx}`

    switch (token.type) {
      case 'text':
        return token.text
      case 'bold':
        return (
          <strong
            key={key}
            className={token.isMetric ? 'metric-badge' : undefined}
          >
            {renderInlineTokens(token.children, `${key}-b`)}
          </strong>
        )
      case 'italic':
        return (
          <em key={key}>{renderInlineTokens(token.children, `${key}-i`)}</em>
        )
      case 'bold_italic':
        return (
          <strong key={key}>
            <em>{renderInlineTokens(token.children, `${key}-bi`)}</em>
          </strong>
        )
      case 'del':
        return (
          <del key={key}>{renderInlineTokens(token.children, `${key}-d`)}</del>
        )
      case 'code':
        return (
          <code key={key} className="resume-inline-code">
            {token.text}
          </code>
        )
      case 'link':
        return (
          <a
            key={key}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className="resume-link"
          >
            {renderInlineTokens(token.children, `${key}-a`)}
          </a>
        )
      case 'br':
        return <br key={key} />
      default:
        return null
    }
  })
}

function parseMarkdownBlocks(markdown: string): BlockToken[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: BlockToken[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    // Code block ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') })
      continue
    }

    // Heading (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      })
      i++
      continue
    }

    // Horizontal rule (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Blockquote (> )
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') })
      continue
    }

    // Table (| col | col |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        lines[i].trim().endsWith('|')
      ) {
        tableLines.push(lines[i].trim())
        i++
      }
      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())
        const hasDelimiter = /^[|\s-:]+$/.test(tableLines[1])
        const dataRows = (hasDelimiter
          ? tableLines.slice(2)
          : tableLines.slice(1)
        ).map((r) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        )
        blocks.push({ type: 'table', headers: headerRow, rows: dataRows })
        continue
      }
    }

    // List item (- , * , + , 1. )
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
    if (listMatch) {
      const isOrdered = /^\d+\./.test(listMatch[2])
      const items: ListItem[] = []

      while (i < lines.length) {
        const curLine = lines[i]
        if (!curLine.trim()) break

        const curMatch = curLine.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
        if (curMatch) {
          items.push({
            indent: curMatch[1].length,
            text: curMatch[3],
          })
          i++
        } else if (/^\s{2,}/.test(curLine) && items.length > 0) {
          items[items.length - 1].text += ' ' + curLine.trim()
          i++
        } else {
          break
        }
      }
      blocks.push({ type: 'list', ordered: isOrdered, items })
      continue
    }

    // Paragraph
    const paraLines: string[] = []
    while (i < lines.length) {
      const curLine = lines[i]
      if (!curLine.trim()) break
      if (
        curLine.match(/^#{1,6}\s+/) ||
        curLine.trim().startsWith('```') ||
        curLine.trim().startsWith('>') ||
        curLine.match(/^(\*{3,}|-{3,}|_{3,})\s*$/) ||
        curLine.match(/^(\s*)([-*+]|\d+\.)\s+/)
      ) {
        break
      }
      paraLines.push(curLine)
      i++
    }

    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join('\n') })
    }
  }

  return blocks
}

/**
 * Checks if a paragraph represents a company/job timeline line, such as:
 * **Vercel Inc.** | May 2022 – Present | San Francisco, CA (Remote)
 */
function tryParseExperienceMeta(text: string): {
  company: string
  period?: string
  location?: string
} | null {
  const match3 = text.match(
    /^\*\*(.+?)\*\*\s*[|•]\s*(.+?)\s*[|•]\s*(.+)$/
  )
  if (match3) {
    return {
      company: match3[1].trim(),
      period: match3[2].trim(),
      location: match3[3].trim(),
    }
  }

  const match2 = text.match(/^\*\*(.+?)\*\*\s*[|•]\s*(.+)$/)
  if (match2) {
    return {
      company: match2[1].trim(),
      period: match2[2].trim(),
    }
  }

  return null
}

export default function MarkdownRenderer({
  markdown,
  className = '',
}: MarkdownRendererProps) {
  if (!markdown || !markdown.trim()) {
    return (
      <article className={`resume-sheet resume-empty-sheet ${className}`}>
        <div className="resume-empty-state">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '48px', color: 'var(--outline)' }}
          >
            article
          </span>
          <h3 style={{ margin: '12px 0 6px 0', color: 'var(--on-surface)' }}>
            Resume Buffer Empty
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--on-surface-variant)',
            }}
          >
            Switch to the &ldquo;Edit Raw Markdown&rdquo; tab or enter content to render your live ATS resume.
          </p>
        </div>
      </article>
    )
  }

  const blocks = parseMarkdownBlocks(markdown)

  // Check if first block is H1 (candidate name) and next block is header info
  let startIndex = 0
  let headerElement: React.ReactNode = null

  if (blocks.length > 0 && blocks[0].type === 'heading' && blocks[0].level === 1) {
    const candidateName = blocks[0].text
    startIndex = 1

    let roleLine: string | null = null
    let contactLines: string[] = []

    if (blocks.length > 1 && blocks[1].type === 'paragraph') {
      const paraLines = blocks[1].text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

      if (paraLines.length > 0) {
        // If line 1 is bold, it's typically the target role
        if (paraLines[0].startsWith('**') && paraLines[0].endsWith('**')) {
          roleLine = paraLines[0].slice(2, -2)
          contactLines = paraLines.slice(1)
        } else {
          contactLines = paraLines
        }
        startIndex = 2
      }
    }

    headerElement = (
      <header className="resume-header">
        <div className="resume-header-top">
          <div>
            <h1 className="resume-candidate-name">
              {renderInlineTokens(parseInline(candidateName), 'cand-name')}
            </h1>
            {roleLine && (
              <p className="resume-target-role">
                {renderInlineTokens(parseInline(roleLine), 'target-role')}
              </p>
            )}
          </div>

          {contactLines.length > 0 && (
            <div className="resume-contact-block">
              {contactLines.map((cline, cIdx) => (
                <div key={`contact-${cIdx}`} className="resume-contact-row">
                  {renderInlineTokens(parseInline(cline), `c-${cIdx}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>
    )
  }

  const bodyBlocks = blocks.slice(startIndex)

  return (
    <article className={`resume-sheet markdown-rendered-sheet ${className}`}>
      {headerElement}

      <div className="resume-content-stream">
        {bodyBlocks.map((block, bIdx) => {
          const key = `block-${bIdx}`

          switch (block.type) {
            case 'heading': {
              if (block.level === 1) {
                return (
                  <h1 key={key} className="resume-candidate-name">
                    {renderInlineTokens(parseInline(block.text), `${key}-h1`)}
                  </h1>
                )
              }
              if (block.level === 2) {
                return (
                  <section key={key} className="resume-section">
                    <div className="section-title-row">
                      <h2 className="section-title">
                        {renderInlineTokens(parseInline(block.text), `${key}-h2`)}
                      </h2>
                      <div className="section-divider-line"></div>
                    </div>
                  </section>
                )
              }
              if (block.level === 3) {
                return (
                  <div key={key} className="resume-job-heading-wrap">
                    <h3 className="exp-role-title">
                      {renderInlineTokens(parseInline(block.text), `${key}-h3`)}
                    </h3>
                  </div>
                )
              }
              return (
                <h4 key={key} className="resume-sub-heading">
                  {renderInlineTokens(parseInline(block.text), `${key}-h4`)}
                </h4>
              )
            }

            case 'hr':
              return (
                <div
                  key={key}
                  className="section-divider-line"
                  style={{ margin: '22px 0' }}
                />
              )

            case 'list': {
              const ListTag = block.ordered ? 'ol' : 'ul'
              return (
                <ListTag
                  key={key}
                  className={block.ordered ? 'resume-ordered-list' : 'exp-bullets-list'}
                >
                  {block.items.map((item, itemIdx) => {
                    // Check if item starts with bold key like - **Key:** Value
                    const keyValMatch = item.text.match(
                      /^\*\*([^*]+)\*\*:\s*(.*)$/
                    )
                    if (keyValMatch) {
                      return (
                        <li key={`${key}-item-${itemIdx}`}>
                          <strong style={{ color: 'var(--on-surface)' }}>
                            {keyValMatch[1]}:
                          </strong>{' '}
                          {renderInlineTokens(
                            parseInline(keyValMatch[2]),
                            `${key}-val-${itemIdx}`
                          )}
                        </li>
                      )
                    }

                    return (
                      <li key={`${key}-item-${itemIdx}`}>
                        {renderInlineTokens(
                          parseInline(item.text),
                          `${key}-li-${itemIdx}`
                        )}
                      </li>
                    )
                  })}
                </ListTag>
              )
            }

            case 'paragraph': {
              // Check if paragraph is experience metadata like **Company** | Period | Location
              const meta = tryParseExperienceMeta(block.text)
              if (meta) {
                return (
                  <div key={key} className="exp-heading-row" style={{ marginTop: '2px', marginBottom: '6px' }}>
                    <div>
                      <span className="exp-company-bold">{meta.company}</span>
                      {meta.location && (
                        <>
                          <span className="bullet-dot">•</span>
                          <span className="exp-location-text">
                            {meta.location}
                          </span>
                        </>
                      )}
                    </div>
                    {meta.period && (
                      <span className="exp-period-text">{meta.period}</span>
                    )}
                  </div>
                )
              }

              // Check if paragraph is single bold line (e.g. school name in education)
              if (block.text.startsWith('**') && block.text.endsWith('**') && !block.text.includes('\n')) {
                return (
                  <div key={key} style={{ marginTop: '12px', marginBottom: '2px' }}>
                    <span className="edu-school">
                      {renderInlineTokens(parseInline(block.text.slice(2, -2)), `${key}-sch`)}
                    </span>
                  </div>
                )
              }

              return (
                <p key={key} className="resume-paragraph">
                  {renderInlineTokens(parseInline(block.text), `${key}-p`)}
                </p>
              )
            }

            case 'blockquote':
              return (
                <blockquote key={key} className="resume-blockquote">
                  {renderInlineTokens(parseInline(block.text), `${key}-bq`)}
                </blockquote>
              )

            case 'code':
              return (
                <pre key={key} className="resume-code-block">
                  <div className="code-lang-tag">{block.lang || 'code'}</div>
                  <code>{block.code}</code>
                </pre>
              )

            case 'table':
              return (
                <div key={key} className="resume-table-wrapper">
                  <table className="resume-table">
                    <thead>
                      <tr>
                        {block.headers.map((h, hIdx) => (
                          <th key={`th-${hIdx}`}>
                            {renderInlineTokens(parseInline(h), `${key}-th-${hIdx}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, rIdx) => (
                        <tr key={`tr-${rIdx}`}>
                          {row.map((cell, cIdx) => (
                            <td key={`td-${rIdx}-${cIdx}`}>
                              {renderInlineTokens(parseInline(cell), `${key}-td-${rIdx}-${cIdx}`)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )

            default:
              return null
          }
        })}
      </div>
    </article>
  )
}
