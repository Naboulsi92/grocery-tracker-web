---
description: Revue de code sur deux axes : Standards et Spécification
agent: general
---

Utilise le skill `code-review` pour réviser les changements depuis un point fixe (commit, branche, tag, ou merge-base) selon deux axes :

1. **Standards** : Le code suit-il les conventions de codage documentées de ce repo ?
2. **Spec** : Le code correspond-il à ce que l'issue/spec d'origine demandait ?

Ce skill lance deux sous-agents en parallèle et rapporte les résultats côte à côte.

Utilise cette commande quand :
- Tu veux réviser une branche, une PR, ou du travail en cours
- Tu demandes "review since X"
- Tu veux une revue complète avant merge

Arguments : $1 (la branche/commit/tag à réviser), $2 (optionnel : point de référence)
