// Ticket #113 (PRD §4.13) : clés localStorage et nom d'événement du bandeau
// PWA — source unique partagée entre le composant (runtime) et les tests
// (unit + E2E), pour qu'un renommage casse à la compilation plutôt que de
// diverger silencieusement.
export const PWA_VISITS_KEY = 'pwa-banner-visits';
export const PWA_SNOOZED_AT_KEY = 'pwa-banner-snoozed-at';
export const PWA_INSTALLED_KEY = 'pwa-banner-installed';
export const PWA_BANNER_EVENT = 'pwa-banner-change';
