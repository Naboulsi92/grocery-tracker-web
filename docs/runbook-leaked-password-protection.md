# Runbook — Supabase leaked-password protection (ticket #118)

> PRD v1.4 §11 fait foi : la protection contre les mots de passe compromis
> ("leaked password protection") est une **option Supabase Auth hébergée**,
> **non activable par migration**. Elle se vérifie manuellement dans le
> tableau de bord Supabase **avant le lancement**, sur chaque projet.

## Pourquoi pas de migration ?

`supabase/config.toml` ne pilote que la CLI locale (`auth.email.minimum_password_length = 8`,
déjà en place). La leaked-password protection est un réglage côté cloud
(HaveIBeenPwned k-anonymity, vérifié au signup/change-password) : aucun SQL
ni `config.toml` ne peut l'activer. D'où ce runbook manuel.

## Activation (à répéter sur staging ET production)

1. Ouvrir le projet : Supabase Dashboard → **Authentication** → **Policies**
   (ou **Auth** → **Settings** selon la version de l'UI) → section
   **Password protection**.
2. Activer **"Prevent use of compromised passwords"** (leaked password protection).
3. Vérifier **minimum password length = 8**, cohérent avec :
   - `supabase/config.toml:19` (`minimum_password_length = 8`),
   - `src/lib/account.ts` (`MIN_PASSWORD_LENGTH = 8`, `validateNewPassword`).
4. Sauvegarder, puis tester : signup avec un mot de passe notoirement
   compromis (ex. `password123`) doit être **rejeté** avec une erreur
   `weak_password` mappée côté client (`errors.account.password_weak`,
   voir `accountActionError` dans `src/lib/account.ts`).

## Vérification continue

- Supabase Dashboard → **Advisors** → advisor `auth_leaked_password_protection`
  doit être **vert** (éteint) sur chaque projet.
- Si l'advisor reste WARN après activation : noter le risque résiduel dans le
  ticket et re-vérifier après le délai de propagation (~quelques minutes).

## Cas plan insuffisant (risque résiduel documenté)

La protection peut nécessiter un plan payant (Pro+) selon la tarification en
vigueur. Si elle n'est pas disponible sur le plan actuel :

1. Ne **pas** tenter de contournement applicatif (pas de k-anonymity maison).
2. Le minimum 8 caractères + validation `validateNewPassword` restent la
   barrière active (défense en profondeur, pas un équivalent).
3. Documenter le risque résiduel dans le ticket #118 et planifier l'upgrade
   avant le lancement public.

## Pièces liées (même ticket, déjà en place dans le code)

- `next.config.ts` — `headers()` : HSTS, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP de départ
  (`default-src 'self'` + `https://*.supabase.co` + Plausible).
  Vérification prod : `curl -I https://<domaine> | grep -iE 'strict-transport|x-frame|content-security|referrer|permissions'`.
- `NEXT_PUBLIC_SITE_URL` — domaine canonique via variable d'environnement
  (Preview, Production **et** Development dans Vercel, puis redeploy),
  consommé par `metadataBase` (`src/app/layout.tsx`) et
  `src/lib/site-url.ts`. T-C2 (sitemap/OG) s'appuie dessus.
- `src/app/robots.ts` + `noindex` sur `src/app/(auth)/layout.tsx` —
  ni l'auth ni l'app connectée ne sont indexées.
