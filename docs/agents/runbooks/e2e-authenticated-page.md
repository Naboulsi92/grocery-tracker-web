# Runbook : harnais E2E authentifié (`authenticatedPage`) — spec #237

Source de vérité de la doctrine et des compteurs du harnais E2E. Ticket : #237 (concerne le ticket-choiceout + PRD §comptes-de-test + §8). Précédents : #141 (socle seed 3 comptes), #142 (fixture + storageState + fail-fast), #144 (slice P0 web-first), #238 (vague de migration skips + garde-fous).

## Compteurs (recomptage du 17 oct 2026, HEAD `e2f7cf7`)

| Compteur | Référence du ticket (14 oct) | Au 15 oct (validation preview) | HEAD du runbook | Doctrine |
|---|---|---|---|---|
| `test.skip` conditionnels (sans backend) | 71 | 0 | **0** (26 gates `browserName !== 'chromium'` restantes, documentées) | Toute spec exigeant des écritures **échoue** via `requireWrites`\/`requireSeedPassword` (message explicite : variable d'env manquante), plus jamais de skip silencieux. |
| Délais fixes `waitForTimeout` | 6 | 6 conservés (annotés) | **5** (4 real-time + 1 tab-return ; le 6ᵉ était un commentaire de `fixtures.ts`) | **0 settle-sleep**. Les 5 restants sont des délais *intentionnels annotés* : pacing de stimulus (l'attente **est** l'input du test), fenêtre de quiescence/observation d'assertion négative, gap inter-événements `visibilitychange`. 
| Specs branchées sur `authenticatedPage` | 4/28 | 15/28 | **17/28** (household + empty-states rejoignent la vague) | Toute spec qui n'a besoin que d'une page authentifiée consomme la session seedée ; les exceptions sont la classe documentée ci-dessous. |
| Rejeux d'inscription UI (`signUp`\/`createHousehold`) | — | ~69 tests | **81 sites → 12 fichiers incriminés**, la classe KEEP est celle du ledger | Un seul site rejeu d'inscription est « l'exception » : `signup-flow.spec` (PRD §8). |
| Collection E2E | 292 tests / 28 specs | 292 | **292 / 28** | Invariant : aucun test supprimé ou ajouté par la migration (chantier de harnais pur). |

Recette de recomptage :

```bash
# sauts (attendu : 26 sites Chromium-gates sur 3 fichiers)
(src/e2e) rg 'test\.skip|test\.fixme|skipIf|describe\.skip' -c
# délais (attendu : 5 sites réels + 1 commentaire fixtures.ts)
(src/e2e) rg 'waitForTimeout' -c
# specs authentifiées (attendu : 17)
ls src/e2e/*.spec.ts | rg -l 'authenticatedPage' | wc -l
```

## La whitelist des sauts (exception documentée)

26 sites, tous `test.skip(browserName !== 'chromium', ...)` : `mobile-responsiveness.spec.ts` (21, dont 3 tests PWA banner), `homepage.spec.ts` (4, viewport), `i18n.spec.ts` (1, langage). Raison : la CI et le showruns n'exercent que le projet Chromium (`playwright.config.ts`, devise config : un seul projet). Toute nouvelle spec sans exigence inter-navigateurs n'a pas besoin de gate ; interdiction d'introduire un `test.skip` lié à l'absence de backend.

## Doctrine des délais fixes restants

Les 5 `waitForTimeout` sont des délais d'**input**, pas de *settle* : l'attente n'attend pas un état UI mais **produit un intervalle** (stimulus, quiescence, gap) que l'assertion en aval mesure. Remplacement interdit par un `toBeVisible`-like : il n'existe pas d'observable équivalent (fuite du wording : remplacer par un *serveur fetch* attendu → ne vérifie plus la vérité mesurée). Validés en ticket #237 par le fondateur le 15-10 (commentaire ticket).

| Site | Durée | Pourquoi |
|---|---|---|
| `real-time.spec.ts` ×1 | 50 ms | pacing du stimulus : updates rapides successives et distinctes (l'attente EST l'input). |
| `real-time.spec.ts` ×2 | 100 ms | pacing du stimulus race : updates entrelacées non-lockstep. |
| `real-time.spec.ts` ×1 | 1500 ms | fenêtre de quiescence : assertion **négative** (pas de notif duplicate) — le retour avancé viderait le test. |
| `tab-return.spec.ts` ×1 | 300 ms | gap inter-événements : `visibilitychange` hidden→visible — laisse le handler `hidden` tourner avant le `visible`. |

## La classe KEEP : exceptions documentées aux sessions seedées

Fondation : `create_household` RPC refuse un compte qui a déjà un foyer ; le slot d'invitation est un par foyer ; les drains (`deleteAllItems`, `clearCatalog`) partagent les items ; les counts exacts à l'échelle foyer sont globaux → un substrat partagé les casse en parallèle. Ledger complet par site dans la PR #237 (session d'analyse) ; les classes :

- **KEEP-JOURNEY (parcours)** — le signup/join EST le comportement testé : `join-household.spec` (25 sites : onboarding US1–US22, attacker lockout #226, détour #58), `signup-flow.spec` (exception PRD §8), multi-user onboarding `real-time.spec:188` (US 70), `app-flow.spec:56` (invite→join→"(2)"), `dashboard-shell.spec` états no-household (2), `auth-navigation.spec` (1), `error-states.spec` (6, écran join no-household), `password-reset.spec` (rotation du mot de passe par admin — annihilerait le tampon seedé).
- **KEEP-SUBSTRATE (foyer frais nécessaire)** — écritures déstabilisantes sur substrat partagé : drains & états vides (`empty-states` ×10), counts exacts customs (categories/items), isolation du fork 2 foyers (P0-5 #107), revive « Lait » (seed), locale par compte → EN (impacte tous les tests FR si compte seedé), foyer plein 2/2 + joins 1→2 & real-time observers (household ×13, real-time ×4 incl. P0-2/P0-3/P1-10 history/notif cleaning), lifecycle quit/2→1 (×3), `to-buy.spec` sublime `beforeEach` frais + `clearCatalog` (18+ tests), `accessibility.spec:505` (nom fixe « Test Category » — collision si partagé).
- **MIGRATE fait** (cette vague, 4 fichiers / 12 tests) : `household.spec` (lectures foyer 1\/2 via `accountRole`), `empty-states.spec` (3 lectures catalogues + état 1-membre foyer 2 + unique-item /to-buy + cleanup), `items.spec` (realtime userA\/userB seedés), `categories.spec` (realtime userA\/userB + fix cleanup `newCategoryName` + drag clavier lecture seule).

Règle émergente (codifiée) : migrer un test = (1) substrat requis par ses écrans seulement est au-delà de foyer1\/foyer2 ; (2) nom unique + cleanup dans `finally` dès qu'il écrit sur le foyer seedé ; (3) jamais de drain ni de count foyer-géographique sur substrat partagé.

## Convention pour les nouvelles specs E2E

1. Besoin d'un foyer (n'importe lequel), lecture seule ou création\/suppression de sa propre entité → `authenticatedPage` (rôle par défaut `household1.userA`) ; `test.use({ accountRole: 'household2.userA' })` si foyer isolé 1\/2 utile ; `accountRole: 'household1.userB'` si point de vue membre (non-owner).
2. Second membre dans un même test → `ensureAuthenticatedPage(browser, 'household1.userB')` (contexte Business séparé, close dans `finally`) — mirorer `real-time.spec.ts`.
3. Besoin d'un foyer vierge\/vide, d'un count foyer-local global, d'un join 1→2 réel ou de slot d'invitation → substrat frais `page` + `account` + `createHousehold`\/`signUp` + `requireWrites()` (fail-fast sans backend).
4. Nettoyage dans `finally` (création dans le `try` + cleanup qui en dépend), jamais hors du `finally`.
5. Jamais de `test.skip` conditionnel en absence de backend — les gardes fail-fast remplissent le rôle.
6. Session seedée : `storageState` + tampon (`password`, `backend`) dans `test-results/prd-seed-<role>*.json` ; tampon périmé → une seule reconnexion fraîche, vérifiée par le nom de foyer affiché (`header-household-name`) ; pas de boucle.

## Sémantique parallèle & CI

- CI : `workers=1`, `fullyParallel=true` — les substrats frais restent exclusifs de leur test, le foyer seedé n'est lu que séquentiellement.
- Local : workers multi-cœurs — tout test MIGRATE qui **écrit** sur foyer 1\/2 le fait avec nom unique + cleanup `finally` ; les utilisateurs de garde en lecture ne mutent rien. Le seeding global (globalSetup) re-crée les 3 comptes + 2 foyers à chaque exécution : l'état résiduel d'une exécution précédente meurt à la suivante.
- Sans backend local, la suite échoue franc sur les specs d'écriture (attendu, lisible dans le messager de garde) et passe sur les specs lecture-seule\/publiques.

## Références

- Spéc du ticket #237 (ledger des 97 sites, classification MJ\/KJ\/KS\/KE, borderline arbitrés).
- `src/e2e/fixtures.ts` (seam unique : `test`, `authenticatedPage`, `accountRole`, `requireWrites`, `requireSeedPassword`, `ensureAuthenticatedPage`).
- `src/e2e/global-setup.ts` + `quality/prd-accounts.ts` + `quality/__tests__/prd-accounts.test.ts` (seeding, topologie, gardes unitaires).
- Playwright config : `playwright.config.ts` (gates CI/local, blocage sans backend).
- Discipline migrations et staging : `supabase-migration-sync.md`, `staging-discipline.md`.
