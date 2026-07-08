# Widget Grist – Kanban EMM

Widget Kanban éditable pour la table EMM Grist.

## Fichiers

- `index.html` : page principale du widget.
- `styles.css` : design du Kanban.
- `app.js` : logique Grist + Kanban.
- `.nojekyll` : évite certains traitements GitHub Pages.

## Déploiement GitHub Pages

1. Créer un dépôt GitHub, par exemple `grist-emm-kanban-widget`.
2. Déposer ces fichiers à la racine du dépôt.
3. Aller dans **Settings > Pages**.
4. Choisir **Deploy from a branch**.
5. Branch : `main`, folder : `/root`.
6. Sauvegarder.
7. L'URL sera de type :
   `https://<organisation>.github.io/grist-emm-kanban-widget/`

## Configuration dans Grist

1. Ajouter un widget **Custom** sur la page contenant la table EMM.
2. Sélectionner la table EMM comme source.
3. Dans **Widget options**, saisir l'URL GitHub Pages du widget.
4. Accorder l'accès **Full document access**.
5. Mapper les colonnes demandées par le widget.

## Mapping recommandé

| Champ widget | Colonne Grist |
|---|---|
| Title | Service |
| ServiceUtilisateur | Service Utilisateur |
| Category | Catégorie |
| CaseType | Cas |
| Description | Description |
| DesiredDate | Date souhaitée |
| Priority | Prio |
| ModifiedAt | Modifiée le |
| Status | Statut |
| Assignees | Assignée à |
| Comment | Commentaire |
| RTU | RTU |
| Sprint | Sprint |
| CreatedBy | Créée par |
| CreatedAt | Créé le |
| Requester | CP/Demandeur |

## Points d'attention

- Le widget modifie les données Grist : il demande donc l'accès `full`.
- La colonne `Assignée à` est prévue pour du texte ou une Choice List. Si elle est une Reference List vers une table Contacts, il faudra une version dédiée qui manipule les identifiants internes des contacts.
- Le widget met à jour automatiquement `Modifiée le` à chaque modification ou déplacement de carte.
- Les statuts gérés sont : Nouveau, En cours DUD, En cours DT, En développement, En Test, En Test CU, Déployé.
