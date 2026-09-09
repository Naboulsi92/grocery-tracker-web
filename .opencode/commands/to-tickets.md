---
description: Décompose un plan/spec en tickets avec blocages
agent: general
---

Utilise le skill `to-tickets` pour décomposer un plan, spec, ou conversation en un ensemble de tickets.

Ce skill :
- Crée des tickets "tracer-bullet" avec dépendances claires
- Identifie les blocages (blocking edges) entre tickets
- Publie dans le tracker configuré (fichiers locaux native links)

Utilise cette commande quand :
- Tu as un plan/spec à découper en tâches exécutables
- Tu veux clarifier les dépendances entre tâches
- Tu veux un plan d'action structuré

Arguments : $1 (le plan/spec à découper), $2 (priorité ou contraintes)
