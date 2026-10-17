# Staging discipline (tester hors prod avant merge) — ticket #230

## Contexte

Décision v1.5 : le fondateur testait sur **prod/main** — remplacé par un
**staging dédié** (pas de Git Flow complet : pas de branche `develop`, pas de
cycle de release ; `main` reste la branche de production, les PR restent le
seul chemin d'intégration). Le staging sert au **test manuel du fondateur**
(parcours réels) avant merge ; la CI (quality, database, e2e) reste le filet
automatique.

## Projets

- **PROD** : Supabase `oizfmmnuoqkdqkguynfv` + URL app production (domaine
  custom du projet Vercel, cf. `NEXT_PUBLIC_SITE_URL` en Vercel).
- **STAGING** : Supabase `mxiduaezelcseymnvdfv` — nom historique
  `grocery-web-e2e-throwaway`, **réaffecté comme staging** (plus un bac à
  sable jetable), région **`eu-west-3`** (Paris). Migrations **alignées sur
  le repo le 17 oct 2026** (rattrapage détaillé plus bas) ; c'est le backend
  des overrides Preview ci-dessous.

## Règle d'or reprise

**Le staging ne suit jamais `main` tout seul** (même discipline que la prod,
cf. `supabase-migration-sync.md`) : les migrations passent par **fichiers
versionnés** (`supabase/migrations/`) + **application explicite**
(MCP `apply_migration` / `supabase db push --project-ref mxiduaezelcseymnvdfv`)
— **jamais de SQL direct** sur le staging. Le check « Supabase Preview »
compare toujours les versions distantes aux noms de fichiers locaux ; une
dérive staging se répare comme une dérive prod (audit read-only, application
des fichiers manquants, réécriture d'historique si besoin).

## État des migrations (17 oct 2026)

Le staging a été **rattrapé explicitement** le 17 oct 2026 (option A,
ticket #230, revue Spec F1) :

- **4 fichiers manquants appliqués** dans l'ordre des versions :
  `20260929000000_email_exists`, `20260930000000_auth_provider_for_email`,
  `20260930000001_realtime_household_members`,
  `20261015000000_lockout_return_status` — tampons MCP
  `20261017212849/50/51/2917`.
- **3 versions re-tamponnées, orphelines assumées** face aux noms de
  fichiers du repo (signature du piège « stamp à aujourd'hui ») :
  `20261012181652_fork_language` ↔ `20261012000000`,
  `20261015094812_threshold_nullable` ↔ `20261014000000`,
  `20261015094813_reminder_badge_none` ↔ `20261014000001`.
  **Contenu équivalent prouvé** par audit objet du 17 oct 2026 : fonction
  `create_household(text, text)` avec `DEFAULT 'fr'` et copie `name_en` ;
  `items.low_stock_threshold` nullable + commentaire « NULL = cleared by a
  unit change » (#222) ; `enqueue_daily_reminders(time)` canaux badge/none +
  fenêtre `<=` + commentaire #224. Historique final : **29 records**.
- **Pré-validation** des clés du staging : chantier preview-run one-off de
  la **PR #238** (backend jetable) — pas de l'issue #237 (E2E harness).
- **Région : `eu-west-3`** (Paris, preuve MCP `get_project` du 17 oct).

À recréation future : rejouer les 29 fichiers du repo dans l'ordre,
jamais en SQL direct. Le détail opératoire de rattrapage reste
dans ce runbook, pas dans le code.

## Câblage Preview → staging (PAR BRANCHE, pas global)

Les variables Preview **globales** pointent sur la prod (c'est voulu : une PR
sans override se teste sur prod, comme avant). Pour tester une branche sur le
staging, on ajoute **deux overrides branch-scoped** qui shadowent les
globales — la précédence *branch-scope > preview* dérive de la doc Vercel
(§1.3 de `docs/research/github-vercel-supabase-environments.md` : « Any
branch-specific variables will override other preview environment variables
with the same name ») :

```bash
# Valeur par STDIN, jamais en argument (jamais d'URL ni de clé sur la ligne de
# commande ni dans l'historique shell).
vercel env add NEXT_PUBLIC_SUPABASE_URL preview <branch> --type config
# → coller https://mxiduaezelcseymnvdfv.supabase.co
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview <branch> --type config
# → coller la clé anon du staging (cf. leçon 3)
```

Puis **redeploy** de la branche (les changements de variables ne s'appliquent
qu'aux nouveaux déploiements) et test manuel sur l'URL Preview de la branche
(`<project>-git-<branch>-<scope>.vercel.app`, commentée sur la PR).

## Leçons opérationnelles (oct 2026)

1. **La branche doit exister sur GitHub AVANT** `vercel env add … preview
   <branch>` — sinon `branch_not_found`. Créer/pousser la branche d'abord.
2. **`--type config` explicite** pour un nom `NEXT_PUBLIC_*` — vérifié sur
   CLI 59.11.2 (oct 2026) qui traite une valeur ressemblant à un credential
   comme un secret si le flag est absent ; re-vérifier à chaque montée de
   version de la CLI.
3. La **clé anon vivait déjà** dans `.scratch/e2e-throwaway-keys.json`
   (pattern repo : clés jetables locales, jamais commitées) — l'ajouter
   **depuis ce fichier sans jamais l'imprimer** (pas de `cat`/`echo` de la
   valeur dans la conversation ni la sortie shell).
4. **`service_role` JAMAIS câblé côté Vercel** (risque d'exfiltration via les
   déploiements/URLs publiques — cf. la note explicite de
   `.env.local.example` sur le refus de stocker la service role key comme
   secret GitHub). Le staging n'a besoin que de `URL` + `ANON_KEY`.
5. **MCP `apply_migration` tamponne à aujourd'hui** — pas à la date du
   fichier (le rattrapage du 17 oct a produit des stamps `2026101721…`
   pour des fichiers de sept/oct : versions orphelines assumées, cf.
   l'état ci-dessus). Le « name » du MCP reste le nom logique du fichier.
6. **Deux `apply_migration` dans la même seconde → collision PK**
   (`duplicate key … schema_migrations_pkey`) : relancer la migration
   seule une seconde plus tard — la transaction SQL est annulée
   proprement (aucun artefact partiel).

## Limite connue

Sur backend **hébergé**, l'Auth **rejette/throttle les emails `.test`** —
les specs E2E fresh-signup (comptes éphémères `@example.test`) **restent sur
la CI locale** (Supabase éphémère, `E2E_ALLOW_WRITES`). Le staging ne sert
qu'au **test manuel du fondateur** (parcours réels, comptes réels) ; il ne
remplace pas la couverture E2E automatisée.

## Checklist PR (à référencer depuis AGENTS.md)

Avant merge d'une PR :

- [ ] Au moins **un tour de test manuel** sur l'URL Preview de la branche
      (staging via les overrides ci-dessus).
- [ ] **Vars branch-scoped ajoutées** si la branche n'en a pas
      (`vercel env ls preview` pour vérifier).
- [ ] **Overrides détruits après merge** — ne pas laisser une branche morte
      pointer sur staging :
      ```bash
      vercel env rm NEXT_PUBLIC_SUPABASE_URL preview <branch>
      vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY preview <branch>
      ```

## Discipline protection

Protection de branche **`main` active** depuis le **17 oct 2026** (ticket
#230) : checks requis **quality, database, e2e (1-4), merge-reports,
Vercel Preview Comments** + **résolution des conversations** avant merge.

- **E2E (1-4) requis malgré la loterie apparente** : choix assumé le
  17 oct 2026 — suite verte sur les runs récents, `trace: on-first-retry` ;
  si la loterie redevient bruyante, on diagnostique via les artefacts
  (traces) plutôt que baisser l'exigence.
- **Vercel Preview Comments requis** (choix fondateur) : une preview
  cassée ou non générée bloque le merge comme n'importe quel job CI.
Un merge sans ces checks verts est bloqué par GitHub — le staging manuel
vient **en plus** de ce filet, pas à sa place.
