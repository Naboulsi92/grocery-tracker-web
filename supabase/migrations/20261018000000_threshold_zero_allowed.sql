-- Évolution produit : le seuil 0 devient un seuil valide.
-- Règle générale inchangée : un article est « à acheter » si quantité <= seuil.
-- Seuil 0 ⇒ « à acheter » seulement et seulement si la quantité atteint 0
-- (l'article redevient normal dès qu'une nouvelle quantité > 0 est saisie).
--
-- Constraints renommées pour coller à la sémantique (non négatif, 0 inclus) :
--   items_threshold_positive           (low_stock_threshold > 0)   → items_threshold_non_negative (>= 0)
--   item_templates_threshold_positive  (suggested_threshold > 0)   → item_templates_threshold_non_negative (>= 0)
--
-- NULL-safety inchangée (ticket #222) : un CHECK vide passe pour NULL,
-- le seuil vidé par un changement d'unité reste « en attente de ressaisie ».
-- Les négatifs restent rejetés ; l'entier reste garanti par items_threshold_integer.
-- Forward-only, idempotent (convention du dépôt : if not exists).

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'items_threshold_positive') then
    alter table public.items drop constraint items_threshold_positive;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_threshold_non_negative') then
    alter table public.items
      add constraint items_threshold_non_negative check (low_stock_threshold >= 0);
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'item_templates_threshold_positive') then
    alter table public.item_templates drop constraint item_templates_threshold_positive;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'item_templates_threshold_non_negative') then
    alter table public.item_templates
      add constraint item_templates_threshold_non_negative check (suggested_threshold >= 0);
  end if;
end $$;

-- Aucune normalisation de données nécessaire : 0 était refusé, donc aucune
-- ligne existante ne porte 0 ; les seuils déployés restent tous >= 1.

-- Métadonnée : le commentaire de colonne posé par 20261014000000 dit encore
-- « otherwise > 0 integer » — aligné ici sur la nouvelle sémantique.
comment on column public.items.low_stock_threshold is
  'NULL = cleared by a unit change (PRD §4.4), awaiting manual re-entry; otherwise >= 0 integer (0 = flagged for buying only when quantity reaches 0).';

notify pgrst, 'reload schema';
