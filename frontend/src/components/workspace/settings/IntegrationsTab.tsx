import { useState, useEffect, useCallback } from 'react'
import type { ApiClientItem, ApiClientCreateResponse } from '../../../types/workspace'

interface IntegrationsTabProps {
  token: string
}

export default function IntegrationsTab({ token }: IntegrationsTabProps) {
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
      // Refresh list
      await fetchClients()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate API credentials')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke credentials')
    }
  }

  const handleCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(identifier)
    setTimeout(() => {
      setCopiedId(null)
    }, 2000)
  }

  const getMcpConfigSnippet = (clientId: string, clientSecret: string) => {
    return JSON.stringify(
      {
        mcpServers: {
          careertrack: {
            command: "python",
            args: ["-m", "app.mcp.server"],
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

      {error && (
        <div className="settings-error-banner" style={{ marginBottom: '16px' }}>
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Newly Created Credentials Modal / Callout */}
      {createdResult && (
        <div
          className="settings-section-card"
          style={{
            borderColor: 'var(--primary)',
            background: 'var(--bg-elevated)',
            marginBottom: '20px',
            borderLeftWidth: '4px',
          }}
        >
          <div className="settings-section-header">
            <div className="settings-section-icon" style={{ color: 'var(--primary)' }}>
              <span className="material-symbols-outlined">key</span>
            </div>
            <div style={{ flex: 1 }}>
              <h5 className="settings-section-title">New Credentials Generated</h5>
              <p className="settings-section-desc">
                For "{createdResult.name}" — Copy your Client Secret now. It will never be shown again!
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCreatedResult(null)}
              style={{ fontSize: '13px', padding: '4px 10px' }}
            >
              Done
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {/* Client ID */}
            <div>
              <label className="input-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Client ID
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={createdResult.client_id}
                  className="input-field mono"
                  style={{ background: 'var(--bg-subtle)' }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleCopy(createdResult.client_id, 'new-client-id')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {copiedId === 'new-client-id' ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedId === 'new-client-id' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Client Secret */}
            <div>
              <label className="input-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Client Secret (Save this now!)
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={createdResult.client_secret}
                  className="input-field mono"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--primary)' }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleCopy(createdResult.client_secret, 'new-client-secret')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {copiedId === 'new-client-secret' ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedId === 'new-client-secret' ? 'Copied' : 'Copy Secret'}</span>
                </button>
              </div>
            </div>

            {/* MCP Config Snippet */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Claude Desktop / Cursor Configuration:
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '2px 8px' }}
                  onClick={() =>
                    handleCopy(
                      getMcpConfigSnippet(createdResult.client_id, createdResult.client_secret),
                      'mcp-config'
                    )
                  }
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {copiedId === 'mcp-config' ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedId === 'mcp-config' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre
                className="mono"
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  overflowX: 'auto',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
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
            <p className="settings-section-desc">Generate a dedicated Client ID &amp; Secret for your AI desktop app or agent</p>
          </div>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Claude Desktop, Work Cursor IDE"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            required
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || !name.trim()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              vpn_key
            </span>
            <span>{isSubmitting ? 'Generating...' : 'Generate Key'}</span>
          </button>
        </form>
      </div>

      {/* Existing Credentials List */}
      <div className="settings-section-card" style={{ marginTop: '16px' }}>
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">devices</span>
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
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading API client credentials...
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Generate your first Client ID and Secret above to connect AI assistants via MCP.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
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
                <div
                  key={client.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {client.name}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: client.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: client.is_active ? 'var(--success)' : 'var(--error)',
                          fontWeight: 500,
                        }}
                      >
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
                      <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                        ID: {client.client_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(client.client_id, `cid-${client.id}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          {copiedId === `cid-${client.id}` ? 'check' : 'content_copy'}
                        </span>
                        <span>{copiedId === `cid-${client.id}` ? 'Copied' : 'Copy'}</span>
                      </button>
                      <span style={{ color: 'var(--text-tertiary)' }}>•</span>
                      <span className="mono" style={{ color: 'var(--text-tertiary)' }}>
                        Secret: {client.client_secret_prefix}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      Created {createdDate} • {lastUsedText}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleRevoke(client.client_id, client.name)}
                    style={{
                      color: 'var(--error)',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      fontSize: '12px',
                      padding: '4px 10px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
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
