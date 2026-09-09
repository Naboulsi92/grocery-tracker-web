---
description: Diagnostique et debug un problème difficile
agent: general
---

Utilise le skill `diagnosing-bugs` pour diagnostiquer des bugs complexes ou des régressions de performance.

Ce skill suit un cycle de diagnostic rigoureux :
1. **Phase 1** : Boucle de feedback serrée - reproduire le problème
2. **Phase 2** : Investigation evidence-first (logs CI, repro, etc.)
3. **Phase 3** : Tracer le bug dans un ticket GitHub avant de fixer
4. **Phase 4** : Appliquer le fix

Utilise cette commande quand :
- Quelque chose est cassé/throwing/failing/slow
- Un bug résiste aux tentatives de debug classiques
- Tu veux comprendre la racine d'un problème avant de fixer

Arguments : $1 (description du problème), $2 (étapes de reproduction si connues)
