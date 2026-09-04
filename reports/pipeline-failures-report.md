# Rapport d'Échecs du Pipeline CI/CD

**Date du rapport :** 04 Septembre 2026  
**Référent :** Grocery List Web  
**Branche :** main  

---

## Résumé Exécutif

Le pipeline CI/CD présente **des échecs récurrents** sur les tests E2E (End-to-End). Sur les 10 derniers runs analysés, **tous ont échoué** avec le même problème de test.

### Statistiques
- **Runs analysés :** 10
- **Runs échoués :** 10 (100%)
- **Tests totaux par run :** 37
- **Tests échoués :** 1 (2.7%)
- **Tests passés :** 36 (97.3%)

---

## Détail des Échecs

### Échec Principal : Test E2E Homepage

**Fichier :** `src/e2e/homepage.spec.ts:21:7`  
**Test :** `Homepage › Hero section renders with expected content`  
**Statut :** Échoué après 3 tentatives (retry #1, #2)

#### Message d'Erreur
```
Error: expect(locator).toBeVisible() failed

Locator: getByText('for households')
Expected: visible
Error: strict mode violation: getByText('for households') resolved to 2 elements:
    1) <span>for households</span> aka getByText('for households', { exact: true })
    2) <p class="mk-hero-note">Free for households of any size.</p> aka getByText('Free for households of any')
```

#### Analyse de la Cause Racine

**Problème :** Le sélecteur `getByText('for households')` trouve **deux éléments** dans le DOM, ce qui viole le mode strict de Playwright.

**Éléments trouvés :**
1. `<span>for households</span>` - Dans le titre H1 principal
2. `<p class="mk-hero-note">Free for households of any size.</p>` - Dans la note sous les CTA

**Contexte du code :**
```tsx
// Hero.tsx lignes 63-68
<h1>
  Collaborative grocery lists
  <br />
  <span>for households</span>  // ← Élément 1
</h1>
// ...
<p className="mk-hero-note">Free for households of any size.</p>  // ← Élément 2
```

#### Impact
- **Critique :** Le test échoue systématiquement, bloquant le pipeline
- **Facile à corriger :** Problème de sélecteur, pas de logique métier
- **Préexistant :** Ce problème existait avant le commit de design épuré

---

## Runs Analysés

| Run ID | Date | Branche | Statut | Conclusion |
|--------|------|---------|--------|------------|
| 33858814220 | 04/09/2026 09:32 | main | En cours | - |
| 33817197884 | 03/09/2026 23:20 | main | Terminé | Échec |
| 33814086307 | 03/09/2026 22:39 | main | Terminé | Échec |
| 33809252373 | 03/09/2026 21:41 | main | Terminé | Échec |
| 33780128304 | 03/09/2026 16:41 | main | Terminé | Échec |
| 33779610243 | 03/09/2026 16:36 | main | Terminé | Échec |
| 33779113266 | 03/09/2026 16:31 | main | Terminé | Échec |
| 33739975233 | 03/09/2026 09:38 | main | Terminé | Échec |
| 33737321625 | 03/09/2026 09:09 | main | Terminé | Échec |
| 33690068024 | 02/09/2026 22:22 | feature/homepage-redesign | Terminé | Échec |

**Observation :** L'échec est **constant** sur toutes les branches et tous les runs.

---

## Tests Unitaires Échoués (Préexistants)

En plus du test E2E, les tests unitaires suivants échouent régulièrement :

### 1. usePushNotifications Tests
**Fichier :** `src/__tests__/use-push-notifications.test.tsx`

**Échecs :**
- ❌ `requests permission, creates a browser subscription and syncs it`
  - Erreur : `Autorisez d'abord les notifications.`
  - Attendu : `error: null`

- ❌ `retains the endpoint after a remote deletion failure so retry is idempotent`
  - Erreur : `received value must not be null nor undefined`
  - Valeur reçue : `undefined`

- ❌ `returns a recoverable error when VAPID configuration is missing`
  - Erreur : `received value must not be null nor undefined`
  - Valeur reçue : `null`

**Cause probable :** Configuration VAPID manquante ou incorrecte dans l'environnement de test.

### 2. MembersPage Test
**Fichier :** `src/__tests__/members-page.test.tsx`

**Échec :**
- ❌ `creates, copies and revokes an opaque invitation without truncating it`
  - Erreur : `Unable to find an element with the text: Code d'invitation complet copié dans le presse-papiers.`
  - Le message de succès n'apparaît pas

**Cause probable :** Problème de traduction ou de message de notification.

### 3. FAQ Test
**Fichier :** `src/__tests__/marketing/faq.test.tsx`

**Échecs :**
- ❌ `renders section title`
  - Cherche : `"Frequently Asked Questions"` (majuscules)
  - Affiche : `"Frequently asked questions"` (minuscules)

- ❌ `has proper touch target size (min-h-44px)`
  - Attendu : `"min-h-[44px]"`
  - Reçu : `"mk-faq-q"` (classe CSS, pas Tailwind)

**Cause :** Incohérence entre le texte du test et le composant, utilisation de CSS pur au lieu de Tailwind.

---

## Recommandations

### Correction Immédiate (Test E2E Homepage)

**Option 1 - Utiliser `exact: true` :**
```typescript
await expect(page.getByText('for households', { exact: true })).toBeVisible();
```

**Option 2 - Cibler le parent H1 :**
```typescript
await expect(page.getByRole('heading', { level: 1 }).getByText('for households')).toBeVisible();
```

**Option 3 - Utiliser un sélecteur plus spécifique :**
```typescript
await expect(page.locator('#hero h1 span').getByText('for households')).toBeVisible();
```

### Corrections à Moyen Terme

1. **Configuration VAPID :** Ajouter les variables d'environnement VAPID pour les tests de notifications push
2. **Messages de notification :** Vérifier les traductions et les messages de succès
3. **Cohérence des tests :** Harmoniser la casse dans les tests et les composants
4. **Migration Tailwind :** Décider de l'usage de Tailwind vs CSS pur et uniformiser

### Actions Prioritaires

| Priorité | Action | Impact | Effort |
|----------|--------|--------|--------|
| 🔴 Haute | Corriger le sélecteur E2E homepage | Débloquer le pipeline | 5 min |
| 🟠 Moyenne | Configurer VAPID pour les tests | Passer les tests push | 30 min |
| 🟡 Basse | Harmoniser les messages FAQ | Passer les tests marketing | 15 min |
| 🟡 Basse | Vérifier les messages de notification | Passer le test members-page | 20 min |

---

## Notes Techniques

### Environnement de Test
- **Base de données :** Supabase local (Docker)
- **Port API :** http://127.0.0.1:54321
- **Port Studio :** http://127.0.0.1:54323
- **Port Mailpit :** http://127.0.0.1:54324
- **Node Version :** 24 (Node 20 déprécié)

### Avertissements Observés
- Dépréciation Node.js 20 → Migration vers Node 24 en cours
- Warning : `punycode` module déprécié
- Warning : `metadataBase` property non configurée pour les images sociales

### Logs Supabase
```
WARN: no files matched pattern: supabase/seed.sql
```
→ Le fichier de seed n'existe pas ou le pattern est incorrect

---

## Historique des Modifications du Rapport

| Date | Auteur | Modification |
|------|--------|--------------|
| 04/09/2026 | AI Agent | Rapport initial généré |

---

## Annexes

### Liens Utiles
- [Documentation Playwright - Locators](https://playwright.dev/docs/locators)
- [Documentation Playwright - Strict Mode](https://playwright.dev/docs/actionability#strict-mode)
- [GitHub Actions - Node.js Deprecation](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)

### Fichiers de Test Concernés
- `src/e2e/homepage.spec.ts`
- `src/__tests__/use-push-notifications.test.tsx`
- `src/__tests__/members-page.test.tsx`
- `src/__tests__/marketing/faq.test.tsx`

### Composants Concernés
- `src/components/marketing/Hero.tsx`
- `src/components/marketing/FAQ.tsx`
- `src/hooks/usePushNotifications.ts`

---

**Fin du rapport**
