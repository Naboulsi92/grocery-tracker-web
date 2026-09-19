# T3D: PWA manifest and install

**What to build:** Make the app installable as a PWA with a manifest, app icons, and a custom install banner.

**Blocked by:** T1D (service worker foundation)

**Status:** ready-for-agent

- [ ] Create `public/manifest.json` with app name, short name, theme colors, display mode (`standalone`), start URL, icons
- [ ] Generate app icons in required sizes (192x192, 512x512)
- [ ] Link manifest in `<head>` of root layout
- [ ] Custom install banner component: appears on 2nd visit, dismissable, reappears after 2 visits if dismissed
- [ ] Banner triggers browser's `beforeinstallprompt` event
- [ ] Banner persists dismissal count in localStorage
- [ ] `data-testid` attributes: `pwa-install-banner`, `pwa-install-button`, `pwa-dismiss-button`
