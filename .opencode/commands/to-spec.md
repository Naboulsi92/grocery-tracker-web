---
description: Transforme la conversation actuelle en spec et publie dans l'issue tracker
agent: general
---

Utilise le skill `to-spec` pour transformer la conversation actuelle en une spec et la publier dans l'issue tracker.

Ce skill :
- Synthétise la conversation en une spec structurée
- Ne fait pas d'interview - utilise ce qui a déjà été discuté
- Publie la spec comme issue dans le tracker configuré

Utilise cette commande quand :
- Vous avez déjà discuté d'un sujet et voulez formaliser
- Tu veux une spec sans passer par une interview
- Tu veux tracker une décision dans l'issue tracker

Arguments : $1 (titre de la spec), $2 (labels optionnels)
