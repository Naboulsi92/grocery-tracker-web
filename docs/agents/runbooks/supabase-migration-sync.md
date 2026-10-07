# Supabase migration sync (repo ↔ prod)

Prod project ref: `oizfmmnuoqkdqkguynfv`. Source conceptuelle :
`docs/research/github-vercel-supabase-environments.md` (§3 Supabase branching).

## Règle d'or

**La prod ne suit jamais `main` toute seule.** Vercel ne déploie que le code,
la CI n'applique les migrations que sur son Supabase éphémère local, et
l'intégration « Supabase Preview » ne fait que **comparer** (elle ne pousse
ni ne répare). La prod ne change que par écriture explicite :
fichier dans `supabase/migrations/` + application (`supabase db push`,
MCP `apply_migration`) — jamais de SQL direct en prod, sauf réparation
approuvée (voir § Réparation ci-dessous).

## Le check « Supabase Preview »

- Tourne à chaque push (PR = `skipping`, push `main` = verdict).
- Compare les **versions** distantes (`supabase_migrations.schema_migrations`)
  aux **noms de fichiers** locaux (`supabase/migrations/<version>_<nom>.sql`).
- Message typique : « Remote migration versions not found in local
  migrations directory » = l'historique distant contient des versions sans
  fichier local (dérive).

## Dérive d'octobre 2026 (épisode de référence, clos)

Symptôme : check Preview rouge sur `main` alors qu'aucune PR ne touchait
`supabase/`. Diagnostic (read-only, MCP) :
- Même **nom**, numéro **différent** = même contenu tamponné deux fois
  (ex. `20260922000511_v1_1_schema` distant vs `20260915000000_v1_1_schema`
  local) : signature d'applications manuelles / réparations (`repair_remote_baseline`,
  `reconcile_schema_drift` — déjà 2 réparations manuelles en sept.).
- Le numéro est une date de **tamponnage**, pas une mesure de fraîcheur du
  schéma. Seuls comptent les **objets** : 6 fichiers post-22-sept. jamais
  appliqués (rappels `<=`, contraintes #127, `email_exists` #164,
  `auth_provider_for_email` #166, publication `household_members` #173),
  avec impacts réels (mot de passe oublié cassé, roster non temps réel…).
- Piège : `apply_migration` (MCP) horodate à **aujourd'hui**, pas à la date
  du fichier — un rattrapage simple déplace le mismatch au lieu de le
  résoudre. Seule une réécriture d'historique aligne les versions.

Réparation (prod, avec feu vert explicite) :
1. Audit read-only objet par objet (fonctions, `pg_get_constraintdef`,
   `pg_publication_tables`, `has_function_privilege`).
2. Application des fichiers manquants (tous idempotents ici :
   `CREATE OR REPLACE`, `DROP IF EXISTS`, ajout conditionnel).
3. Réécriture de `supabase_migrations.schema_migrations` pour refléter
   **exactement** les fichiers locaux (backup préalable des lignes ;
   `DELETE` + `INSERT … ON CONFLICT DO NOTHING`), après avoir vérifié que
   les lignes orphelines (ex. `fix_invitation_functions_v2`) sont bien
   remplacées par des migrations ultérieures.
4. Re-vérification objets + historique ; smoke test prod (`HTTP 200`) ;
   advisors sécurité/performance (les `SECURITY DEFINER` exposées à `anon`
   sont volontaires ici : #164/#166).

## Requêtes d'audit réutilisables

```sql
-- Fonctions présentes
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('email_exists', 'auth_provider_for_email');
-- Contraintes nouvelle classe (#127) : attendu 6
select count(*) from pg_constraint where connamespace = 'public'::regnamespace
and conname in ('items_name_valid', 'categories_name_valid',
'item_templates_name_fr_valid', 'item_templates_name_en_valid',
'default_categories_name_fr_valid', 'default_categories_name_en_valid')
and pg_get_constraintdef(oid) like '%À-Ö%';
-- Publication realtime : attendu categories + household_members + items
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public' order by 1;
```
