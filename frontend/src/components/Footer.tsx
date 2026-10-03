export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-copyright">
          <span>&copy; 2024 CareerTrack Inc. All rights reserved.</span>
        </div>
        <div className="footer-links">
          <a href="#privacy" className="footer-link">Privacy Policy</a>
          <a href="#terms" className="footer-link">Terms of Service</a>
          <a href="#security" className="footer-link">Security</a>
          <a href="#status" className="footer-link">
            <span className="status-dot"></span>
            <span>System Status</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
