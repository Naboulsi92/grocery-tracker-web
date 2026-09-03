export function Footer() {
  return (
    <footer className="mk-footer">
      <div className="mk-container mk-footer-inner">
        <p>
          &copy; {new Date().getFullYear()} Grocery List. All rights reserved.
        </p>
        <div className="mk-footer-links">
          {/* TODO: Create /about, /contact, /terms pages and update links */}
          <a href="#" className="mk-footer-link">
            About
          </a>
          <a href="#" className="mk-footer-link">
            Contact
          </a>
          <a href="#" className="mk-footer-link">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
