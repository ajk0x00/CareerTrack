import { useEffect, useState } from 'react'
import type { User, AddressDetails, SocialLinks, ApiError } from '../../../types/auth'
import { useToast } from '../../ToastContext'


interface ProfileTabProps {
  user: User
  token: string
  onProfileUpdated: (updatedUser: User) => void
}

export default function ProfileTab({
  user,
  token,
  onProfileUpdated,
}: ProfileTabProps) {
  const toast = useToast()
  const [name, setName] = useState<string>(user.name || '')

  const [email, setEmail] = useState<string>(user.email || '')
  const [phone, setPhone] = useState<string>(user.phone || '')

  // Address
  const [street, setStreet] = useState<string>(user.address?.street || '')
  const [city, setCity] = useState<string>(user.address?.city || '')
  const [state, setState] = useState<string>(user.address?.state || '')
  const [postalCode, setPostalCode] = useState<string>(user.address?.postal_code || '')
  const [country, setCountry] = useState<string>(user.address?.country || '')

  // Socials
  const [linkedin, setLinkedin] = useState<string>(user.socials?.linkedin || '')
  const [github, setGithub] = useState<string>(user.socials?.github || '')
  const [twitter, setTwitter] = useState<string>(user.socials?.twitter || '')
  const [portfolio, setPortfolio] = useState<string>(user.socials?.portfolio || '')
  const [website, setWebsite] = useState<string>(user.socials?.website || '')

  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(token))
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Fetch fresh profile data on mount
  useEffect(() => {
    if (!token) return

    let isMounted = true
    fetch('/api/v1/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load profile')
        return res.json()
      })
      .then((profileData: User) => {
        if (profileData.name) setName(profileData.name)
        if (profileData.email) setEmail(profileData.email)
        if (profileData.phone) setPhone(profileData.phone)

        if (profileData.address) {
          setStreet(profileData.address.street || '')
          setCity(profileData.address.city || '')
          setState(profileData.address.state || '')
          setPostalCode(profileData.address.postal_code || '')
          setCountry(profileData.address.country || '')
        }

        if (profileData.socials) {
          setLinkedin(profileData.socials.linkedin || '')
          setGithub(profileData.socials.github || '')
          setTwitter(profileData.socials.twitter || '')
          setPortfolio(profileData.socials.portfolio || '')
          setWebsite(profileData.socials.website || '')
        }
      })
      .catch((err) => {
        console.error('Error fetching profile:', err)
        toast.error('Failed to load profile details from server.', 'Network Error')
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token, toast])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setIsSaving(true)

    // Construct address dict with only non-empty fields
    const addressPayload: AddressDetails = {}
    if (street.trim()) addressPayload.street = street.trim()
    if (city.trim()) addressPayload.city = city.trim()
    if (state.trim()) addressPayload.state = state.trim()
    if (postalCode.trim()) addressPayload.postal_code = postalCode.trim()
    if (country.trim()) addressPayload.country = country.trim()

    // Construct socials dict with only non-empty fields
    const socialsPayload: SocialLinks = {}
    if (linkedin.trim()) socialsPayload.linkedin = linkedin.trim()
    if (github.trim()) socialsPayload.github = github.trim()
    if (twitter.trim()) socialsPayload.twitter = twitter.trim()
    if (portfolio.trim()) socialsPayload.portfolio = portfolio.trim()
    if (website.trim()) socialsPayload.website = website.trim()

    const payload: {
      name: string | null
      email?: string
      phone: string | null
      address: AddressDetails | null
      socials: SocialLinks | null
    } = {
      name: name.trim() || null,
      phone: phone.trim() || null,
      address: Object.keys(addressPayload).length > 0 ? addressPayload : null,
      socials: Object.keys(socialsPayload).length > 0 ? socialsPayload : null,
    }

    if (email.trim() && email.trim() !== user.email) {
      payload.email = email.trim()
    }

    try {
      const res = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData: ApiError = await res.json().catch(() => ({}))
        if (Array.isArray(errorData.detail)) {
          const firstError = errorData.detail[0]
          throw new Error(firstError.msg || 'Validation failed')
        }
        if (typeof errorData.detail === 'string') {
          throw new Error(errorData.detail)
        }
        throw new Error('Failed to update profile. Please verify your inputs.')
      }

      const updatedUser: User = await res.json()
      onProfileUpdated(updatedUser)
      setSuccessMsg('Profile successfully updated!')
      toast.success('Your profile changes have been saved to the database.', 'Profile Updated')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred'
      setErrorMsg(msg)
      toast.error(msg, 'Update Failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="settings-pane-form" onSubmit={handleSave}>
      <div className="settings-pane-header">
        <div>
          <h4 className="settings-pane-title">Personal Profile &amp; Identity</h4>
          <p className="settings-pane-desc">
            Information stored in your account to automatically populate tailored resumes and applications.
          </p>
        </div>
        {isLoading && <span className="settings-loading-indicator">Loading profile...</span>}
      </div>

      {errorMsg && (
        <div className="settings-alert-banner error" role="alert">
          <span className="material-symbols-outlined alert-icon">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="settings-alert-banner success" role="status">
          <span className="material-symbols-outlined alert-icon">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Section 1: Basic Details */}
      <div className="settings-section-card">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">badge</span>
          </div>
          <div>
            <h5 className="settings-section-title">Identity &amp; Contact</h5>
            <p className="settings-section-desc">Primary name and communication channels</p>
          </div>
        </div>

        <div className="settings-grid-two">
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-name">
              Full Legal / Display Name
            </label>
            <input
              id="profile-name"
              type="text"
              className="compact-input"
              placeholder="e.g. Alex Chen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-email">
              Email Address
            </label>
            <input
              id="profile-email"
              type="email"
              className="compact-input"
              placeholder="e.g. alex.chen@workplace.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>
        </div>

        <div className="form-group-compact" style={{ marginTop: '14px' }}>
          <label className="compact-label" htmlFor="profile-phone">
            Phone Number <span className="settings-label-hint">(E.164 standard e.g. +1 415 555 0199)</span>
          </label>
          <input
            id="profile-phone"
            type="tel"
            className="compact-input"
            placeholder="+1 (415) 890-4412"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={50}
          />
        </div>
      </div>

      {/* Section 2: Address */}
      <div className="settings-section-card" style={{ marginTop: '16px' }}>
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">location_on</span>
          </div>
          <div>
            <h5 className="settings-section-title">Physical Address &amp; Location</h5>
            <p className="settings-section-desc">Appears in resume headers and geographical ATS filters</p>
          </div>
        </div>

        <div className="form-group-compact">
          <label className="compact-label" htmlFor="profile-street">
            Street Address
          </label>
          <input
            id="profile-street"
            type="text"
            className="compact-input"
            placeholder="100 Market St, Suite 400"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            maxLength={255}
          />
        </div>

        <div className="settings-grid-two" style={{ marginTop: '14px' }}>
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-city">
              City
            </label>
            <input
              id="profile-city"
              type="text"
              className="compact-input"
              placeholder="San Francisco"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-state">
              State / Province / Region
            </label>
            <input
              id="profile-state"
              type="text"
              className="compact-input"
              placeholder="CA"
              value={state}
              onChange={(e) => setState(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>

        <div className="settings-grid-two" style={{ marginTop: '14px' }}>
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-postal">
              Postal / ZIP Code
            </label>
            <input
              id="profile-postal"
              type="text"
              className="compact-input"
              placeholder="94105"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-country">
              Country
            </label>
            <input
              id="profile-country"
              type="text"
              className="compact-input"
              placeholder="United States"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Social & Professional Links */}
      <div className="settings-section-card" style={{ marginTop: '16px' }}>
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">link</span>
          </div>
          <div>
            <h5 className="settings-section-title">Online Profiles &amp; Social Links</h5>
            <p className="settings-section-desc">Strictly verified URLs starting with http:// or https://</p>
          </div>
        </div>

        <div className="settings-grid-two">
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-linkedin">
              LinkedIn Profile
            </label>
            <input
              id="profile-linkedin"
              type="url"
              className="compact-input"
              placeholder="https://linkedin.com/in/alexchen"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-github">
              GitHub Profile
            </label>
            <input
              id="profile-github"
              type="url"
              className="compact-input"
              placeholder="https://github.com/alexchen-eng"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        <div className="settings-grid-two" style={{ marginTop: '14px' }}>
          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-portfolio">
              Portfolio / Projects
            </label>
            <input
              id="profile-portfolio"
              type="url"
              className="compact-input"
              placeholder="https://alexchen.dev"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="form-group-compact">
            <label className="compact-label" htmlFor="profile-twitter">
              Twitter / X
            </label>
            <input
              id="profile-twitter"
              type="url"
              className="compact-input"
              placeholder="https://twitter.com/alexchen"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        <div className="form-group-compact" style={{ marginTop: '14px' }}>
          <label className="compact-label" htmlFor="profile-website">
            Personal Website / Blog
          </label>
          <input
            id="profile-website"
            type="url"
            className="compact-input"
            placeholder="https://alexchen.blog"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={500}
          />
        </div>
      </div>

      {/* Pane Footer Action Bar */}
      <div className="settings-pane-actions">
        <div className="settings-actions-hint">
          Changes are validated and stored directly to your backend profile.
        </div>
        <button
          type="submit"
          className="action-btn-primary"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <span className="spinner-sm" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                save
              </span>
              <span>Save Profile Changes</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
