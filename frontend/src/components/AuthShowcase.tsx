const SHOWCASE_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC1CtUeUC9LuVMTgZ1K_amoaNHUlsF-cB9dB5vIQAXoYZqltLX7KMKqZ6wfyQc6d1KKFcMC32ijkdUJnFtuStiZDgVnEg-6LtZJ4RlGc3uc5uPFSatgYX8u05Lj94wkt8zdOVo3wXaz-iZFXb6rIhfKmzEMn0TrTTXgsgabBXq3_nOPP0LE7iqW73jGnHOVkK535b45hYNrzuCqh3OKzq0gUfln30wbjhDw-rfgHazmNublEI5iIkYE'

export default function AuthShowcase() {
  return (
    <section className="auth-showcase-column">
      <div className="showcase-content">
        <div className="illustration-card">
          <img
            src={SHOWCASE_IMAGE_URL}
            alt="CareerTrack Professional Workspace Illustration"
            className="illustration-img"
          />
        </div>

        <div className="showcase-metrics">
          <div className="metric-chip">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', color: 'var(--tertiary)' }}
            >
              verified
            </span>
            <span>Continuous Accomplishment Log</span>
          </div>
          <div className="metric-chip">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', color: 'var(--primary)' }}
            >
              auto_awesome
            </span>
            <span>ATS-Tailored Resumes</span>
          </div>
        </div>
      </div>
    </section>
  )
}
