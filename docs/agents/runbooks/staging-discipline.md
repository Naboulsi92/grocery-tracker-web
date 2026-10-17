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
  sable jetable). Héberge déjà les migrations du repo (vérifié #237) ; c'est
  le backend des overrides Preview ci-dessous.

## Règle d'or reprise

**Le staging ne suit jamais `main` tout seul** (même discipline que la prod,
cf. `supabase-migration-sync.md`) : les migrations passent par **fichiers
versionnés** (`supabase/migrations/`) + **application explicite**
(MCP `apply_migration` / `supabase db push --project-ref mxiduaezelcseymnvdfv`)
— **jamais de SQL direct** sur le staging. Le check « Supabase Preview »
compare toujours les versions distantes aux noms de fichiers locaux ; une
dérive staging se répare comme une dérive prod (audit read-only, application
des fichiers manquants, réécriture d'historique si besoin).

## Câblage Preview → staging (PAR BRANCHE, pas global)

Les variables Preview **globales** pointent sur la prod (c'est voulu : une PR
sans override se teste sur prod, comme avant). Pour tester une branche sur le
staging, on ajoute **deux overrides branch-scoped** qui shadowent les
globales — la précédence *branch-scope > preview* dérive de la doc Vercel
(§1.3 de `docs/research/github-vercel-supabase-environments.md` : « Any
branch-specific variables will override other preview environment variables
with the same name ») :

```bash
# Valeur par STDIN, jamais en argument (jamais d'URL/ clé sur la ligne de
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
2. **`--type config` obligatoire** pour un nom `NEXT_PUBLIC_*` qui ressemble
   à un credential — sans ce flag, Vercel refuse/traite la variable comme un
   secret et le câblage échoue.
3. La **clé anon vivait déjà** dans `.scratch/e2e-throwaway-keys.json`
   (pattern repo : clés jetables locales, jamais commitées) — l'ajouter
   **depuis ce fichier sans jamais l'imprimer** (pas de `cat`/`echo` de la
   valeur dans la conversation ni la sortie shell).
4. **`service_role` JAMAIS câblé côté Vercel** (risque d'exfiltration via les
   déploiements/URLs publiques — cf. la note explicite de
   `.env.local.example` sur le refus de stocker la service role key comme
   secret GitHub). Le staging n'a besoin que de `URL` + `ANON_KEY`.

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
#230) : checks requis **quality, database, e2e (1-4), merge-reports** +
**résolution des conversations** avant merge. Un merge sans ces checks verts
est bloqué par GitHub — le staging manuel vient **en plus** de ce filet, pas
à sa place.
