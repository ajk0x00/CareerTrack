import { useState, useEffect, useCallback } from 'react'
import type { ApiClientItem, ApiClientCreateResponse } from '../../../types/workspace'
import { useToast } from '../../ToastContext'

interface IntegrationsTabProps {
  token: string
}

const PRESET_CLIENTS = [
  { label: 'Claude Desktop', icon: 'desktop_mac' },
  { label: 'Cursor IDE', icon: 'terminal' },
  { label: 'VS Code Extension', icon: 'code' },
  { label: 'Terminal / CLI', icon: 'terminal' },
  { label: 'Custom AI Agent', icon: 'smart_toy' },
]

export default function IntegrationsTab({ token }: IntegrationsTabProps) {
  const toast = useToast()
  const [clients, setClients] = useState<ApiClientItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token))
  const [error, setError] = useState<string | null>(null)

  // Creation form state
  const [name, setName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [createdResult, setCreatedResult] = useState<ApiClientCreateResponse | null>(null)

  // Feedback on copy
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/api-clients', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        throw new Error('Failed to load API client credentials')
      }
      const data: ApiClientItem[] = await res.json()
      setClients(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    let isMounted = true
    if (!token) {
      return
    }

    fetch('/api/v1/api-clients', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load API client credentials')
        return res.json()
      })
      .then((data: ApiClientItem[]) => {
        if (isMounted) {
          setClients(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error occurred')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setIsSubmitting(true)
      setError(null)
      const res = await fetch('/api/v1/api-clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to generate API credentials')
      }

      const newClient: ApiClientCreateResponse = await res.json()
      setCreatedResult(newClient)
      setName('')
      toast.success(`API credentials for "${newClient.name}" created!`, 'Key Generated')
      // Refresh list
      await fetchClients()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate API credentials'
      setError(msg)
      toast.error(msg, 'Error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevoke = async (clientId: string, clientName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to revoke credentials for "${clientName}"? Any MCP client or integration using this Client ID will immediately lose access.`
    )
    if (!confirmed) return

    try {
      setError(null)
      const res = await fetch(`/api/v1/api-clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to revoke API credentials')
      }

      setClients((prev) => prev.filter((c) => c.client_id !== clientId))
      if (createdResult && createdResult.client_id === clientId) {
        setCreatedResult(null)
      }
      toast.success(`Credentials for "${clientName}" revoked.`, 'Revoked')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke credentials'
      setError(msg)
      toast.error(msg, 'Error')
    }
  }

  const handleCopy = (text: string, identifier: string, label: string = 'Text') => {
    navigator.clipboard.writeText(text)
    setCopiedId(identifier)
    toast.success(`${label} copied to clipboard!`, 'Copied')
    setTimeout(() => {
      setCopiedId((curr) => (curr === identifier ? null : curr))
    }, 2000)
  }

  const getMcpConfigSnippet = (clientId: string, clientSecret: string) => {
    return JSON.stringify(
      {
        mcpServers: {
          careertrack: {
            command: 'python',
            args: ['-m', 'app.mcp.server'],
            env: {
              CAREERTRACK_CLIENT_ID: clientId,
              CAREERTRACK_CLIENT_SECRET: clientSecret,
            },
          },
        },
      },
      null,
      2
    )
  }

  return (
    <div className="settings-pane-form">
      <div className="settings-pane-header">
        <div>
          <h4 className="settings-pane-title">MCP &amp; API Client Access</h4>
          <p className="settings-pane-desc">
            Manage Client ID and Client Secret credentials for Model Context Protocol (MCP) clients like Claude Desktop, Cursor, and custom AI agents.
          </p>
        </div>
      </div>

      {/* Info Overview Card */}
      <div className="mcp-info-banner">
        <div className="mcp-info-icon-wrap">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>hub</span>
        </div>
        <div className="mcp-info-body">
          <div className="mcp-info-title">Model Context Protocol (MCP) Integration</div>
          <div className="mcp-info-desc">
            MCP allows external AI tools like Claude Desktop, Cursor IDE, and custom LLM agents to securely inspect your work experience, skills matrix, career preferences, and active workspaces in real time.
          </div>
        </div>
      </div>

      {error && (
        <div className="settings-error-banner" style={{ marginBottom: '16px' }}>
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Newly Created Credentials Card */}
      {createdResult && (
        <div className="mcp-created-card">
          <div className="mcp-created-header">
            <div className="mcp-created-title-group">
              <div className="mcp-created-badge">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>key</span>
              </div>
              <div>
                <h5 className="mcp-created-title">New Credentials Generated</h5>
                <p className="mcp-created-subtitle">
                  For "{createdResult.name}" — Copy your Client Secret now. It will never be shown again!
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mcp-dismiss-btn"
              onClick={() => setCreatedResult(null)}
              title="Dismiss callout"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
              <span>Done</span>
            </button>
          </div>

          <div className="mcp-created-warning-box">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
            <span>
              Important: Store your Client Secret securely. It is hashed with bcrypt in PostgreSQL and cannot be retrieved later.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Client ID */}
            <div className="mcp-cred-row">
              <div className="mcp-cred-label-row">
                <span className="mcp-cred-label">
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>tag</span>
                  Client ID
                </span>
                <span className="mcp-cred-tag public">Public Identifier</span>
              </div>
              <div className="mcp-cred-input-box">
                <span className="material-symbols-outlined mcp-cred-icon">fingerprint</span>
                <input
                  type="text"
                  readOnly
                  value={createdResult.client_id}
                  className="mcp-cred-input"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  aria-label="Client ID"
                />
                <button
                  type="button"
                  className={`mcp-copy-btn ${copiedId === 'new-client-id' ? 'copied' : ''}`}
                  onClick={() => handleCopy(createdResult.client_id, 'new-client-id', 'Client ID')}
                  title="Copy Client ID"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {copiedId === 'new-client-id' ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedId === 'new-client-id' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Client Secret */}
            <div className="mcp-cred-row">
              <div className="mcp-cred-label-row">
                <span className="mcp-cred-label">
                  <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--error)' }}>
                    lock
                  </span>
                  Client Secret
                </span>
                <span className="mcp-cred-tag secret">Show Once • Secret</span>
              </div>
              <div className="mcp-cred-input-box highlight">
                <span className="material-symbols-outlined mcp-cred-icon secret-icon">vpn_key</span>
                <input
                  type="text"
                  readOnly
                  value={createdResult.client_secret}
                  className="mcp-cred-input secret-val"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  aria-label="Client Secret"
                />
                <button
                  type="button"
                  className={`mcp-copy-btn mcp-copy-btn-primary ${copiedId === 'new-client-secret' ? 'copied' : ''}`}
                  onClick={() => handleCopy(createdResult.client_secret, 'new-client-secret', 'Client Secret')}
                  title="Copy Client Secret"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                    {copiedId === 'new-client-secret' ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedId === 'new-client-secret' ? 'Copied' : 'Copy Secret'}</span>
                </button>
              </div>
            </div>

            {/* MCP Config Snippet */}
            <div className="mcp-code-card">
              <div className="mcp-code-header">
                <div className="mcp-code-title">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>terminal</span>
                  <span>claude_desktop_config.json</span>
                  <span className="mcp-code-badge">MCP v1</span>
                </div>
                <button
                  type="button"
                  className={`mcp-code-copy-btn ${copiedId === 'mcp-config' ? 'copied' : ''}`}
                  onClick={() =>
                    handleCopy(
                      getMcpConfigSnippet(createdResult.client_id, createdResult.client_secret),
                      'mcp-config',
                      'Configuration JSON'
                    )
                  }
                  title="Copy Configuration JSON"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {copiedId === 'mcp-config' ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedId === 'mcp-config' ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="mcp-code-pre">
                {getMcpConfigSnippet(createdResult.client_id, createdResult.client_secret)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Generate New Key Section */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">add_moderator</span>
          </div>
          <div>
            <h5 className="settings-section-title">Create New Client Credentials</h5>
            <p className="settings-section-desc">
              Generate a dedicated Client ID &amp; Secret for your AI desktop app, IDE, or background agent
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="mcp-create-form">
          <div className="mcp-cred-label-row">
            <label htmlFor="mcp-client-name-input" className="mcp-cred-label">
              Client / Integration Name <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <span className="mcp-presets-label">Click preset to quick fill:</span>
          </div>

          <div className="mcp-create-row">
            <div className="mcp-input-wrap">
              <span className="material-symbols-outlined mcp-input-icon">devices</span>
              <input
                id="mcp-client-name-input"
                type="text"
                className="mcp-text-input"
                placeholder="e.g. Claude Desktop (MacBook), Work Cursor IDE, Terminal Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <button
              type="submit"
              className="mcp-generate-btn"
              disabled={isSubmitting || !name.trim()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                vpn_key
              </span>
              <span>{isSubmitting ? 'Generating...' : 'Generate Key'}</span>
            </button>
          </div>

          <div className="mcp-presets-wrap">
            {PRESET_CLIENTS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="mcp-preset-chip"
                onClick={() => setName(preset.label)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                  {preset.icon}
                </span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Existing Credentials List */}
      <div className="settings-section-card" style={{ marginTop: '16px' }}>
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">key</span>
          </div>
          <div>
            <h5 className="settings-section-title">Active API Clients</h5>
            <p className="settings-section-desc">
              {clients.length === 0
                ? 'No client credentials generated yet.'
                : `${clients.length} credential pair${clients.length > 1 ? 's' : ''} configured.`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
            Loading API client credentials...
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--outline)', display: 'block', margin: '0 auto 8px' }}>
              key_off
            </span>
            No active credentials. Generate your first Client ID and Secret above to connect AI assistants via MCP.
          </div>
        ) : (
          <div className="mcp-clients-list">
            {clients.map((client) => {
              const createdDate = new Date(client.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              const lastUsedText = client.last_used_at
                ? `Last used ${new Date(client.last_used_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}`
                : 'Never used'

              return (
                <div key={client.id} className="mcp-client-item">
                  <div className="mcp-client-main">
                    <div className="mcp-client-avatar">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        smart_toy
                      </span>
                    </div>
                    <div className="mcp-client-details">
                      <div className="mcp-client-title-row">
                        <span className="mcp-client-name">{client.name}</span>
                        <span className={`mcp-client-pill ${client.is_active ? 'active' : 'inactive'}`}>
                          <span className="pulse-dot" style={{ width: '5px', height: '5px' }} />
                          {client.is_active ? 'Active' : 'Revoked'}
                        </span>
                      </div>

                      <div className="mcp-client-chips-row">
                        <div className="mcp-id-chip">
                          <span style={{ color: 'var(--outline)', fontSize: '10.5px' }}>ID:</span>
                          <span>{client.client_id}</span>
                          <button
                            type="button"
                            className="mcp-id-chip-copy"
                            onClick={() => handleCopy(client.client_id, `cid-${client.id}`, 'Client ID')}
                            title="Copy Client ID"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                              {copiedId === `cid-${client.id}` ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>

                        <div className="mcp-secret-prefix-chip">
                          <span style={{ color: 'var(--outline)', fontSize: '10.5px', marginRight: '4px' }}>SECRET:</span>
                          <span>{client.client_secret_prefix}••••••••</span>
                        </div>
                      </div>

                      <div className="mcp-client-meta">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                        <span>Created {createdDate}</span>
                        <span style={{ opacity: 0.5 }}>•</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>history</span>
                        <span>{lastUsedText}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mcp-revoke-btn"
                    onClick={() => handleRevoke(client.client_id, client.name)}
                    title="Revoke access immediately"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                      delete
                    </span>
                    <span>Revoke</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

