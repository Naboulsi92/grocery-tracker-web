# T1E: i18n infrastructure and translations

**What to build:** Full bilingual support (fr/en) for all UI text, error messages, validation messages, and default seed names.

**Blocked by:** T0, T1A, T1B, T1C, T2C, T3C (needs stable UI strings to extract)

**Status:** ready-for-agent

- [ ] Install `next-i18next` package
- [ ] Configure i18n with `fr` and `en` locales, default to browser locale
- [ ] Create translation files: `public/locales/fr/common.json`, `public/locales/en/common.json`
- [ ] Extract ALL hardcoded strings from app UI (currently mixed French/English)
- [ ] Extract error messages and validation messages
- [ ] Extract default category and item names (bilingual seed)
- [ ] Language switcher in account settings (persists to user profile)
- [ ] Update `<html lang>` attribute dynamically based on selected language
- [ ] Marketing pages: currently English-only, add French translations
- [ ] App pages: currently French-only, add English translations
- [ ] All `data-testid` attributes remain in English (not translated)
