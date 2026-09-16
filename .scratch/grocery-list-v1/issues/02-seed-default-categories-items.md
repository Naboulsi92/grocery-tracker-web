# T1A: Seed default categories and items

**What to build:** Create a SQL seed migration that populates 10 default categories (bilingual fr/en) and 10 default items (bilingual fr/en) pre-assigned to matching categories. New households inherit these defaults.

**Blocked by:** T0 (schema migration)

**Status:** ready-for-agent

## Default categories (position order)
1. Légumes / Vegetables
2. Fruits
3. Produits laitiers / Dairy
4. Féculents / Grains
5. Viandes / Meats
6. Poissons / Fish
7. Épicerie / Pantry
8. Boissons / Beverages
9. Hygiène / Hygiene
10. Entretien / Household

## Default items (pre-assigned to category)
1. Lait / Milk → Produits laitiers
2. Pain / Bread → Féculents
3. Œufs / Eggs → Produits laitiers
4. Beurre / Butter → Produits laitiers
5. Fromage / Cheese → Produits laitiers
6. Yaourt / Yogurt → Produits laitiers
7. Poulet / Chicken → Viandes
8. Riz / Rice → Épicerie
9. Pâtes / Pasta → Épicerie
10. Huile / Oil → Épicerie

- [ ] SQL seed migration inserts into `default_categories` and `default_items`
- [ ] New households automatically get default categories + items (via trigger or RPC)
- [ ] Default items have `threshold = 1` and `quantity = 0` as sensible defaults
- [ ] `data-testid` convention established for default items: `item-row-{name_en_lowercase}`
