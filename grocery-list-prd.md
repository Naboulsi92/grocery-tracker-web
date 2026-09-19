# Grocery List — Product Requirements Document (PRD)

**Version 1.1 — Document de référence produit**

---

## 1. Vue d'ensemble

**Grocery List** est une application web (PWA) de gestion partagée de l'inventaire domestique, pensée spécifiquement pour les couples. Elle résout un problème concret et quotidien : savoir en temps réel ce qui manque à la maison, sans doublons d'achat ni oublis, et sans avoir à se le demander verbalement.

**Problème résolu** : dans un foyer à deux, il est fréquent que les deux personnes ignorent l'état réel du stock (qui a acheté quoi, qu'est-ce qui manque), menant à des achats en double ou à des oublis.

**Proposition de valeur** : un inventaire unique, synchronisé en temps réel entre les deux membres du foyer, avec des alertes automatiques dès qu'un article passe sous un seuil défini.

**Public cible** : couples partageant un foyer (V1 strictement limitée à deux personnes).

---

## 2. Portée et principes directeurs

- **Deux personnes par foyer**, à égalité totale de droits — aucune hiérarchie, aucun rôle admin.
- **Simplicité avant tout** : pas de recherche, pas de résumé par email, articles en texte simple sans photo. Chaque fonctionnalité a dû se justifier face à cette exigence.
- **Synchronisation temps réel** : exigence non négociable, cœur du produit.
- **Hors-ligne en lecture seule** : sans connexion, l'inventaire déjà chargé reste consultable, mais aucune action n'est possible (voir section 4.12).
- **Gratuit** dans un premier temps.
- **Conforme RGPD** : hébergement en UE, droit à l'export/suppression des données.
- **Bilingue** : français et anglais, avec mode sombre.
- **Plateforme** : application web responsive (PWA), pensée mobile-first pour un usage en magasin. Une version Android native est envisagée dans un futur proche, une fois le produit validé.

---

## 3. Stack technique

| Composant | Choix | Justification |
|---|---|---|
| Frontend | Next.js (React) + TypeScript + Tailwind CSS | Aligné avec l'expérience JavaScript/React du fondateur ; TypeScript retenu pour la sécurité de typage dès le départ |
| Composants UI | shadcn/ui | Composants accessibles, construits sur Tailwind (pas de changement d'outil de style) |
| Backend & base de données | Supabase (PostgreSQL) | Realtime natif (exigence n°1), Auth intégrée (email + Google + Apple), hébergement disponible en région UE (Francfort) pour la conformité RGPD |
| Synchronisation temps réel | Supabase Realtime | Push instantané des changements aux deux appareils connectés |
| Notifications push | Web Push API (via service worker) + Supabase Edge Functions | Standard PWA, fonctionne sur Android et iOS (16.4+) une fois l'app installée sur l'écran d'accueil |
| Cache hors-ligne | Service worker (Cache API / IndexedDB léger) | Permet la consultation en lecture seule sans connexion |
| Hébergement frontend | Vercel | Intégration native avec Next.js, déploiement automatique |
| Internationalisation | next-i18next | Français / anglais |

**Note PWA** : l'application doit inclure un fichier manifest et un service worker pour permettre l'installation sur l'écran d'accueil, débloquer les notifications push (y compris sur iPhone), et gérer le cache hors-ligne en lecture seule.

---

## 4. Fonctionnalités détaillées

### 4.1 Authentification

- Connexion par **email/mot de passe**, **Google**, ou **Apple**.
- **Vérification d'email obligatoire** avant utilisation, pour les comptes créés par email.
- **Mot de passe oublié** : email avec code de réinitialisation, valable 15 minutes.
- **Modification du mot de passe** : réservée aux comptes email (Google/Apple gèrent leur propre sécurité), nécessite la saisie du mot de passe actuel.

### 4.2 Onboarding et foyer

- À la première connexion : saisie du prénom et du nom.
- Choix : rejoindre un foyer existant (code ou QR code) ou en créer un nouveau.
- Le nom du foyer prend par défaut le nom de famille du créateur (ex. « Foyer Nabulsi »), mais reste modifiable à tout moment, y compris dès l'inscription.
- **Foyer limité à deux personnes** pour la V1.
- Une fois le foyer complet (2/2 membres), le **code et le QR code d'invitation deviennent automatiquement invalides** — impossible d'inviter une troisième personne.
- Le code d'invitation **expire aussi après 24 heures**, même si le foyer n'est pas encore complet — il faut en régénérer un nouveau passé ce délai.
- Le créateur (ou l'autre membre) peut **régénérer un nouveau code** à tout moment si l'ancien a été partagé par erreur ; l'ancien code est alors immédiatement invalidé.
- Un code invalide ou expiré affiche un message d'erreur invitant à le ressaisir.
- **QR code scanné hors de l'application** (via l'appareil photo natif, sans avoir de compte) : ouvre un **lien profond** vers l'application, avec le code d'invitation déjà pré-rempli une fois l'inscription terminée — pas besoin de le ressaisir manuellement.

### 4.3 Catégories

- **Catégories par défaut** : communes à tous les foyers, ni modifiables ni supprimables (structure de base garantie).
- **Catégories personnalisées** : créées par un foyer, visibles et éditables/supprimables uniquement par ce foyer. Le **nom d'une catégorie personnalisée doit être unique** au sein du foyer (insensible à la casse).
- **Suppression bloquée si non vide** : un foyer ne peut pas supprimer une catégorie personnalisée tant qu'elle contient encore des articles ; un message explicite invite à d'abord déplacer ou supprimer les articles concernés (ex. « Déplacez ou supprimez d'abord les 3 articles de cette catégorie »).
- **Ordre des catégories** : personnalisable par foyer via glisser-déposer (recommandation technique : librairie dédiée type dnd-kit pour la robustesse tactile et l'accessibilité clavier).
- Chaque article appartient à **une seule catégorie**.

### 4.4 Articles et inventaire

- Articles en **texte simple**, sans photo ni icône.
- Certains articles sont **pré-remplis par défaut** pour tous les foyers (ex. lait, pain). Un foyer peut les renommer ou les modifier localement (ex. préciser une marque) **sans impacter les autres foyers** (mécanisme de « fork » par foyer).
- **Nom d'article unique dans tout le foyer** (tous catégories confondues) — impossible de créer deux articles portant le même nom, même dans des catégories différentes. Cette unicité s'applique aussi face aux **articles par défaut non encore forkés** : si un article générique (ex. « Lait ») existe encore dans sa version par défaut pour ce foyer, il n'est pas possible d'en créer un second du même nom tant que le générique n'a pas été renommé.
- **Unités disponibles** : kilogramme, gramme, litre, millilitre, unité — choisies via liste déroulante, jamais saisies librement.
  - kg / litre / unité : nombres entiers uniquement (pas de décimales), incrément de 1, jamais négatif.
  - gramme / millilitre : incrément de 100 via les boutons, mais saisie manuelle libre possible (ex. 150 g), toujours en entiers, jamais négatif.
- **L'unité est modifiable après création** (pour corriger une erreur de saisie). Changer l'unité **vide les champs quantité et seuil**, qui doivent être ressaisis manuellement — pas de conversion automatique ni de conservation de valeurs devenues incohérentes.
- **Quantité et seuil** sont saisis manuellement à la création, et modifiables ensuite. Le **seuil est obligatoire** et doit être un nombre strictement positif (supérieur à 0).
- **Ajustement du stock** : boutons plus/moins pour les petits ajustements, et **saisie manuelle** (tap sur la valeur) pour les grands écarts.
- **Achat (réapprovisionnement)** : l'utilisateur renseigne uniquement la quantité achetée (la différence) ; l'application additionne automatiquement au stock existant.
- **Consommation** : toujours saisie manuellement — l'application ne peut pas détecter automatiquement ce qui est consommé.
- Un article dont le stock atteint **0 reste visible** dans la liste (pour être réapprovisionné) ; il ne disparaît que si l'utilisateur le supprime manuellement.
- **Modification/suppression d'un article** : accessible depuis l'écran d'accueil (icône dédiée par article). Le nom doit contenir au moins une lettre. La suppression demande une confirmation explicite et renvoie immédiatement à l'écran d'accueil.
- Toute validation de nom (article, catégorie, foyer) **exige au moins une lettre** — rejette les entrées composées uniquement de chiffres ou de symboles.

### 4.5 Liste de courses (alertes de réapprovisionnement)

- Écran séparé listant automatiquement tous les articles dont la quantité est **inférieure ou égale à leur seuil** (`quantité ≤ seuil`).
- Un article ne peut être « coché » que lorsqu'une **nouvelle quantité dépassant strictement le seuil** est saisie — jamais par une case à cocher libre.
- Une fois coché, l'article **reste visible** dans la liste (avec son statut visuel de complétion) jusqu'à ce que l'utilisateur **quitte l'écran** ; il disparaît seulement à la prochaine ouverture.
- État vide : message positif (« Tout est en stock »), pas de liste vide silencieuse.

### 4.6 Notifications

- Quand un article franchit son seuil (que ce soit par une modification ou dès la création d'un article), **seul le membre qui n'a pas fait l'action** reçoit la notification.
- **Une seule notification par franchissement** de seuil — pas de répétition tant que l'article reste sous le seuil.
- Canaux disponibles, au choix de chaque utilisateur : **notification push**, **badge** sur l'icône de l'application, ou les deux. **Pas d'option email.**
- **Rappel quotidien optionnel** à une heure choisie par l'utilisateur, qui ne se déclenche que s'il reste des articles en attente dans la liste de courses.

### 4.7 Historique

- Écran séparé listant les **20 dernières actions** (modifications et suppressions d'articles et de catégories uniquement — les achats/réapprovisionnements n'y figurent pas, ils sont visibles directement via le compteur de chaque article).
- Rotation automatique : la 21ᵉ action supprime la plus ancienne de la base de données.
- Chaque entrée affiche : l'action, l'auteur, et un horodatage relatif.

### 4.8 Droits et permissions

- **Égalité totale** entre les deux membres du foyer — aucun rôle spécial, aucune hiérarchie.
- **Un membre ne peut jamais retirer l'autre** du foyer (pour éviter d'aggraver un conflit de couple). Seul celui qui souhaite partir peut quitter le foyer, de son propre chef.
- Si un membre quitte le foyer (volontairement ou par erreur), il **perd l'accès à l'inventaire** ; l'autre membre **garde tout intact**.
- Les autres risques inhérents à l'égalité totale (suppression accidentelle) sont volontairement laissés à la gestion du couple, sans mécanisme de médiation intégré. Les conflits d'édition simultanée sont gérés techniquement (voir 4.12).

### 4.9 Compte utilisateur

- Modification du prénom/nom à tout moment, **indépendante** du nom du foyer.
- **Suppression de compte** : suit la même logique que « quitter le foyer » (l'autre membre garde l'inventaire), avec une **période de rétention de 7 jours** avant effacement définitif des données personnelles, conformément au RGPD. Pendant ces 7 jours, l'utilisateur peut **annuler la suppression à tout moment** en se reconnectant, ce qui restaure immédiatement son compte.

### 4.10 Localisation et apparence

- Application disponible en **français et anglais**.
- **Mode sombre** inclus.

### 4.11 Légal et conformité

- Politique de confidentialité et conditions d'utilisation conformes aux normes de l'UE (RGPD) : droit à l'export et à la suppression des données, consentement explicite à l'inscription, base légale claire pour chaque traitement de données.

### 4.12 Connectivité et résolution de conflits

- **Hors-ligne = lecture seule.** Le service worker garde en cache le dernier état connu de l'inventaire : sans connexion, l'utilisateur peut consulter son inventaire et sa liste de courses, mais toute action (boutons plus/moins, cocher, ajouter, modifier, supprimer) est désactivée. Un bandeau discret indique « Hors connexion — lecture seule ».
- **Micro-coupure pendant une action** : si la connexion tombe pendant qu'une action est en cours (ex. ajustement d'une quantité), cette action précise est mise en attente quelques secondes et renvoyée automatiquement dès le retour du réseau. Si la coupure se prolonge, le mode lecture seule prend le relais.
- **Écrans nécessitant une connexion active** (connexion/inscription, rejoindre un foyer) : un écran bloquant dédié s'affiche en l'absence de réseau, avec option de réessayer.
- **Résolution de conflit d'édition simultanée** : politique du **dernier qui écrit gagne** (*last write wins*) — si les deux membres modifient le même article au même moment, la dernière écriture enregistrée dans la base de données l'emporte, sans fusion ni notification de conflit.

---

## 5. Modèle de données

### Entités principales

- **HOUSEHOLDS** : `id`, `name` (max. 50 caractères), `invite_code`, `created_at`
- **USERS** : `id`, `household_id`, `first_name` (max. 50), `last_name` (max. 50), `email`, `auth_provider`, `notification_type`, `reminder_time`, `language`
- **CATEGORIES** : `id`, `household_id` (null = catégorie par défaut), `name` (max. 50), `is_default`, `position`
- **ITEMS** : `id`, `household_id` (null = article par défaut), `category_id`, `name` (max. 50, unique par foyer), `unit`, `quantity`, `threshold`, `last_modified_by`, `already_notified`, `updated_at`
- **HISTORY** : `id`, `household_id`, `performed_by`, `action_type`, `item_name`, `performed_at`

### Relations

- Un foyer regroupe plusieurs utilisateurs (max. 2 en V1), possède ses catégories et articles personnalisés, et journalise son historique.
- Une catégorie contient plusieurs articles.

### Règles d'implémentation clés

- **Fork par foyer** : toute modification d'un article par défaut crée une copie propre au foyer, sans jamais altérer l'original partagé (impossible pour les catégories, qui sont verrouillées).
- **Ordre des catégories** : une table de jointure séparée (`household_id`, `category_id`, `position`) permet à chaque foyer d'avoir son propre ordre, y compris sur les catégories par défaut partagées.
- **Notification unique** : le champ `already_notified` sur `ITEMS` évite les alertes répétées tant que l'article reste sous le seuil ; il repasse à faux dès que le stock redépasse le seuil.
- **Unicité du nom d'article** : contrainte unique sur (`household_id`, `name`) au niveau base de données, insensible à la casse — applicable également aux articles par défaut tant qu'ils n'ont pas été forkés par le foyer.
- **Unicité du nom de catégorie** : contrainte unique sur (`household_id`, `name`) pour les catégories personnalisées, insensible à la casse.
- **Suppression de catégorie bloquée si non vide** : vérification applicative (et contrainte `ON DELETE RESTRICT` côté base) empêchant la suppression tant que des articles y sont rattachés.
- **Résolution de conflit** : `updated_at` mis à jour à chaque écriture ; la valeur la plus récente fait foi (last write wins), sans verrouillage optimiste en V1.
- **Valeurs figées** :
  - `unit` : `kg`, `g`, `l`, `ml`, `unite`
  - `notification_type` : `push`, `badge`, `both`
  - `language` : `fr`, `en`
  - `action_type` : `modification`, `suppression`
  - `auth_provider` : `email`, `google`, `apple`

### Sécurité d'accès (Row Level Security)

- Un utilisateur ne peut lire/modifier que les données dont le `household_id` correspond à son propre foyer.
- Les catégories et articles par défaut sont lisibles par tous mais jamais modifiables directement ; toute tentative déclenche un fork.
- L'historique n'est visible que par les membres du foyer concerné.
- La table `HOUSEHOLDS` elle-même (nom du foyer, code d'invitation) n'est lisible et modifiable que par ses propres membres — aucun autre utilisateur ne peut consulter le code d'invitation ou renommer un foyer auquel il n'appartient pas.

### Robustesse de la synchronisation temps réel

Supabase Realtime peut manquer des événements pendant une coupure réseau ou une mise en veille de l'appareil. À la reconnexion, l'application doit **recharger intégralement l'état de l'inventaire** depuis la base plutôt que de compter uniquement sur le flux temps réel pour « rattraper » les événements manqués — sans quoi un utilisateur pourrait rester avec une vue obsolète sans le savoir.

### Sécurité applicative

- **Code d'invitation** : limité à 5 tentatives erronées avant un blocage temporaire d'une minute, pour empêcher le brute-force ; expire aussi automatiquement après 24 heures.
- **Session utilisateur** : session longue durée avec renouvellement automatique tant que l'utilisateur ne se déconnecte pas explicitement (pas d'expiration courte, pour un usage fluide multi-quotidien).

### Comportement en cascade

- Un foyer n'est jamais supprimé tant qu'il lui reste au moins un membre.
- Si les deux membres ont quitté ou supprimé leur compte, le foyer devient orphelin : ses catégories personnalisées, articles forkés et historique sont supprimés automatiquement (`ON DELETE CASCADE`).
- Les catégories et articles par défaut ne sont jamais affectés, puisqu'ils n'appartiennent à aucun foyer.

---

## 6. Écrans de l'application

| Écran | Description courte |
|---|---|
| Page d'accueil (marketing) | Présente l'application aux visiteurs, met en avant les bénéfices, incite à l'inscription |
| Connexion / inscription | Email + mot de passe, Google, Apple ; bascule entre les deux modes |
| Onboarding (profil + foyer) | Saisie prénom/nom, puis choix rejoindre (code/QR) ou créer un foyer |
| Accueil / inventaire | Liste des articles par catégorie, boutons plus/moins, saisie manuelle, accès liste de courses / historique / réglages |
| Liste de courses | Articles sous ou à leur seuil, coché uniquement lors d'un réapprovisionnement suffisant |
| Ajout d'un article | Nom, catégorie (avec création à la volée), unité, quantité initiale, seuil |
| Modification d'un article | Renommage, changement de catégorie/unité, seuil, suppression avec confirmation |
| Réglages de notifications | Choix push/badge, rappel quotidien programmable |
| Historique | 20 dernières modifications/suppressions, avec auteur et horodatage |
| Gestion des catégories | Réorganisation par glisser-déposer, création, édition/suppression des catégories personnalisées |
| Partage du code d'invitation | QR code et code texte à copier, régénération avec confirmation ; état « foyer complet » une fois les deux membres présents |
| Réglages du foyer | Nom du foyer, liste des membres, accès au code d'invitation, quitter le foyer |
| Réglages du compte | Profil, mot de passe (comptes email), langue, mode sombre, déconnexion, suppression de compte |
| Guide et FAQ | Explication du fonctionnement en 4 étapes, questions fréquentes en accordéon |
| États vides | Liste de courses vide, catégorie sans article |
| Bandeau hors-ligne (lecture seule) | Affiché sur l'inventaire/liste de courses quand il n'y a pas de connexion ; actions désactivées |
| Écran hors connexion bloquant | Réservé aux écrans nécessitant une connexion active (connexion, rejoindre un foyer), avec option de réessayer |

---

## 7. Règles de validation transversales

- Tout champ de nom (article, catégorie, foyer, prénom, nom) doit contenir **au moins une lettre** — rejette les entrées uniquement numériques ou symboliques.
- Tout champ de nom est limité à **50 caractères**.
- Le **nom d'un article doit être unique** dans tout le foyer, tous catégories confondues (insensible à la casse), y compris face aux articles par défaut non encore renommés.
- Le **nom d'une catégorie personnalisée doit être unique** au sein du foyer (insensible à la casse).
- Les champs de quantité et de seuil n'acceptent que des **entiers positifs**, jamais de décimales ni de valeurs négatives, quelle que soit l'unité.
- Le seuil est **obligatoire** et doit être strictement supérieur à 0.
- Toute suppression (article, compte) demande une **confirmation explicite** rappelant la conséquence exacte de l'action.

---

## 8. Stratégie de tests

Vu le profil du fondateur (testeur QA, expérience JavaScript), la suite de tests end-to-end est un livrable central du projet, pas une réflexion après coup. **Playwright** est retenu comme outil principal plutôt que Cypress, car il gère nativement plusieurs contextes de navigateur dans un même test — indispensable pour valider la synchronisation temps réel entre les deux membres d'un foyer.

### Convention de sélecteurs

Chaque élément interactif ou porteur d'information testable (boutons, champs, lignes d'article, messages d'erreur/succès) doit exposer un attribut **`data-testid`** avec un nom **descriptif et fonctionnel**, plutôt que de s'appuyer sur des classes CSS ou du texte affiché (fragile dès qu'on traduit l'appli en anglais, ou qu'on change un libellé). Convention de nommage : `zone-element-action` en kebab-case.

Exemples :
- `data-testid="item-row-tomates"` (ligne d'un article dans l'inventaire)
- `data-testid="item-quantity-increment"` / `data-testid="item-quantity-decrement"`
- `data-testid="item-threshold-input"`
- `data-testid="household-name-save-button"`
- `data-testid="invite-code-regenerate-confirm"`
- `data-testid="error-name-required-letter"`

Cette convention doit être posée dès les premiers composants développés, pas ajoutée après coup — elle conditionne la stabilité de toute la suite Playwright.

### Comptes de test

Trois adresses dédiées, réservées exclusivement aux tests automatisés, pour couvrir à la fois les scénarios de synchronisation intra-foyer et d'isolation inter-foyers :

| Adresse | Rôle | Foyer |
|---|---|---|
| `e2e.household1.userA@e2e.grocerylist.test` | Premier membre (ex. Karim) | Foyer de test n°1 |
| `e2e.household1.userB@e2e.grocerylist.test` | Second membre (ex. Sarah) | Foyer de test n°1 (même foyer que userA, via code d'invitation) |
| `e2e.household2.userA@e2e.grocerylist.test` | Membre isolé | Foyer de test n°2 (séparé, sert à vérifier qu'aucune donnée ne fuite entre foyers) |

Domaine en `.test` : réservé officiellement aux environnements de test (RFC 2606), jamais routable — aucun risque d'envoyer un vrai email par erreur.

Les deux premières couvrent les scénarios de synchronisation temps réel et d'égalité des droits (1, 2, 4). La troisième sert spécifiquement à vérifier l'isolation des données (RLS, fork par foyer) : s'assurer que ce compte ne voit jamais rien du foyer n°1, même en cas de bug de filtrage.

**Seeding direct, sans passer par la vérification d'email.** Ces trois comptes sont créés directement via l'**API admin de Supabase** (`supabase.auth.admin.createUser`, avec `email_confirm: true`), dans un script de setup exécuté avant la suite Playwright — aucun email n'est envoyé, aucune attente de confirmation. Le foyer, les catégories et les articles nécessaires à chaque scénario peuvent être insérés de la même façon, pour démarrer chaque test directement dans l'état voulu plutôt que de reconstruire le parcours complet à chaque fois.

**Exception à garder** : un test séparé, indépendant de ces trois comptes fixtures, doit passer par le **vrai parcours d'inscription** (avec une boîte mail réellement accessible, via IMAP ou un service comme Mailosaur) pour vérifier que le lien de confirmation fonctionne réellement en production. Le seeding direct accélère la majorité des tests, mais ce chemin critique doit rester couvert par au moins un scénario de bout en bout authentique.

### Scénarios critiques (priorité P0)

1. **Synchronisation temps réel** : un utilisateur A modifie une quantité ; un utilisateur B, déjà connecté sur un autre écran/session, voit le changement se refléter sans rafraîchir la page.
2. **Notification à sens unique** : quand A fait passer un article sous son seuil, seul B reçoit l'alerte ; A n'en reçoit aucune.
3. **Notification unique par franchissement** : faire baisser puis remonter puis rebaisser un article sous son seuil ne doit générer qu'une notification par passage sous le seuil, pas une par modification.
4. **Égalité des droits** : vérifier que les deux comptes d'un même foyer ont accès aux mêmes actions, sans distinction (aucune action réservée à un « créateur »).
5. **Fork par foyer** : modifier un article par défaut (ex. renommer « Lait ») dans le foyer A ne doit avoir aucun impact sur le foyer B.
6. **Foyer complet** : une fois deux membres dans un foyer, une tentative de rejoindre avec l'ancien code (même valide auparavant) doit échouer.

### Scénarios importants (priorité P1)

7. **Validation des champs** : rejet des noms sans lettre, rejet des valeurs négatives/décimales, seuil obligatoire strictement positif, unicité du nom d'article.
8. **Changement d'unité** : vérifier que quantité et seuil sont bien vidés et doivent être ressaisis.
9. **Cycle de vie du foyer** : quitter le foyer retire l'accès à l'inventaire ; l'autre membre le conserve intact.
10. **Historique** : rotation correcte après 20 entrées (la 21ᵉ action supprime bien la plus ancienne).
11. **Mode lecture seule hors-ligne** : couper le réseau simulé, vérifier que la consultation reste possible mais que toute action est bloquée.
12. **Sécurité du code d'invitation** : blocage après 5 tentatives erronées.

### Note technique

Les scénarios mono-utilisateur (7 à 12) s'écrivent de façon classique, un seul contexte de navigateur par test. Les scénarios de synchronisation (1 à 3) exploitent la capacité de Playwright à ouvrir **deux contextes de navigateur isolés dans le même test** (un par membre du foyer), ce qui permet de vérifier visuellement, dans le même script, qu'une action de A se reflète bien chez B sans rafraîchissement — un scénario nettement plus laborieux à reproduire avec Cypress.

---

## 9. Hors périmètre (V1)

- Recherche dans l'inventaire.
- Mode hors-ligne en écriture (ajout/modification hors connexion) — seule la lecture seule est prise en charge.
- Résumé de notifications par email.
- Photos ou icônes sur les articles.
- Plus de deux personnes par foyer.
- Verrouillage optimiste ou fusion de conflits fine (V1 reste en « dernier qui écrit gagne »).
- Application mobile native (Android envisagé après validation du produit).

---

## 10. Workflow Git et déploiement

**Modèle de branches retenu** (inspiré de Git Flow) :

- **`feature/*`** : une branche par fonctionnalité, créée à partir de `develop`. Une fois le travail terminé, une Pull Request la fusionne dans `develop`.
- **`develop`** : branche d'intégration continue, reflète l'état du produit prêt pour la prochaine mise en production.
- **`release/*`** : ouverte quand `develop` a accumulé assez de fonctionnalités stables pour une mise en production ; sert à la finalisation, la QA et la correction de bugs avant le lancement.
- **`master`** : reçoit la fusion finale de la branche `release/*`, ce qui déclenche le déploiement en production ; la release est ensuite refusionnée dans `develop` pour que le travail futur reste à jour.

**Adaptation aux forfaits gratuits retenus** :

- **Supabase (gratuit)** : limité à 2 projets actifs par organisation. `develop` et `release/*` partagent donc le **même projet Supabase de non-production** (staging), tandis que `master` pointe vers un second projet dédié à la **production**. Pour les branches `feature/*`, le développement s'appuie sur la **CLI Supabase en local** (`supabase start`, Postgres dans Docker) plutôt que sur un projet cloud par fonctionnalité, pour rester dans la limite des 2 projets gratuits.
  - Supabase propose une fonctionnalité de branchement de base de données facturée à l'heure ; sa disponibilité sur le forfait gratuit n'est pas garantie et doit être vérifiée sur la documentation à jour avant d'en dépendre pour ce workflow.
  - Un projet gratuit inactif pendant 7 jours se met en pause automatiquement (réactivation manuelle, redémarrage à froid de quelques secondes) — un point d'attention si le projet de staging reste inutilisé plusieurs jours d'affilée.
- **Vercel (gratuit)** : chaque Pull Request, `feature/*` comme `release/*`, génère automatiquement une URL de prévisualisation ; seule `master` déclenche un déploiement en production. Le forfait gratuit couvre ce workflow nativement, sans adaptation nécessaire.
- **GitHub (gratuit)** : dépôts privés, branches et Pull Requests illimités. Seul point à surveiller : si la suite Playwright tourne en CI (GitHub Actions) à chaque push, le forfait gratuit inclut un quota mensuel de minutes d'exécution — large pour un projet à deux personnes, mais pas illimité.

## 11. Points restant à traiter (hors produit)

- **Branding** : logo, identité visuelle, icônes de l'application.
- **Contenu des emails transactionnels** : vérification de compte, réinitialisation de mot de passe.
- **Analytics** : indicateurs de succès (inscriptions, rétention, usage).
- **Déploiement / CI** : pipeline de mise en production via Vercel.
- **Rédaction finale** du contenu du Guide et de la FAQ (contenu actuel à titre d'exemple, à enrichir).
