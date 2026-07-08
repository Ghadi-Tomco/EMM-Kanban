# Grist EMM Kanban Widget — V2

Widget Kanban éditable pour une table Grist de suivi EMM.

## Fichiers

- `index.html`
- `styles.css`
- `app.js`
- `.nojekyll`

## Déploiement GitHub Pages

1. Remplacer les fichiers existants du dépôt GitHub Pages par ceux-ci.
2. Vérifier que GitHub Pages est activé sur `main` / `/ (root)`.
3. Attendre la republication GitHub Pages.
4. Faire un rechargement fort dans Grist : `Ctrl + F5` ou `Cmd + Shift + R`.

## Accès Grist requis

Le widget modifie les lignes de la table source. Il nécessite donc un accès Grist avec écriture / Full document access.

## Mapping conseillé

| Champ widget | Colonne Grist |
|---|---|
| `Title` | `Service` |
| `ServiceUtilisateur` | `Service Utilisateur` |
| `Category` | `Catégorie` |
| `CaseType` | `Cas` |
| `Description` | `Description` |
| `DesiredDate` | `Date souhaitée` |
| `Priority` | `Prio` |
| `ModifiedAt` | `Modifiée le` |
| `Status` | `Statut` |
| `Assignees` | `Assignée à` |
| `Comment` | `Commentaire` |
| `RTU` | `RTU` |
| `Sprint` | `Sprint` |
| `CreatedBy` | `Créée par` |
| `CreatedAt` | `Créé le` |
| `Requester` | `CP/Demandeur` |

## Notes

- La colonne `Assignée à` est prévue pour être du texte ou une Choice List simple.
- Si `Assignée à` est une Reference List vers une table Contacts, il faudra une version spécifique pour gérer les identifiants internes Grist.
- La colonne `Service` est utilisée comme titre de carte. Si vous ajoutez une vraie colonne `Titre`, mappez `Title` vers cette colonne.
