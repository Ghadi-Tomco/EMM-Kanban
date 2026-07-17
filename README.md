# Dashboard EMM — V3.3

Widget Kanban éditable pour la table `B_EMM` dans Grist.

## Évolutions de cette version

### Filtres en trois lignes

1. **Filtres du référentiel des services utilisateurs** :
   - Service utilisateur ;
   - Communauté ;
   - Département ;
   - Statut de déploiement ;
   - Priorité de déploiement.

   Les quatre dernières informations sont lues dans `REF_Services Utilisateurs`. Si aucune colonne explicite `Statut Déploiement` n'est trouvée, le widget utilise `Avancement Matrice de déploiement`.

2. **Filtres des sujets EMM** :
   - recherche par mot-clé ;
   - catégorie ;
   - cas ;
   - priorité ;
   - personne assignée.

   Le filtre Sprint a été retiré du menu. Le champ Sprint reste disponible dans la fiche d'édition d'une carte.

3. **Actions d'affichage** :
   - tri ;
   - masquer / afficher les filtres ;
   - vue compacte / détaillée.

### Indicateurs

Les KPI sont placés sous les filtres et utilisent le même style que le Dashboard Service Utilisateur :

- `Sujets en cours` : cartes dont le statut n'est pas `Déployé` ;
- `P0 ou P1` : cartes P0/P1 non déployées ;
- `En retard` : cartes non déployées dont la date souhaitée est passée.

L'indicateur `À 7 jours` a été supprimé.

### Design

- Couleurs métier réservées aux priorités et aux échéances en retard.
- Catégories, cas et colonnes de statut affichés dans des tons neutres.
- Listes déroulantes modernisées.
- Bouton `Nouvelle carte` légèrement assombri.
- Conservation du glisser-déposer, de l'édition latérale et des correctifs de mise à jour partielle.

## Installation

Déposer à la racine d'un dépôt GitHub Pages :

- `index.html`
- `styles.css`
- `app.js`
- `.nojekyll`

Configurer ensuite le custom widget Grist avec l'URL GitHub Pages et accorder `Full document access`.

Le mapping des colonnes de `B_EMM` reste identique à la version précédente. Le champ `Service Utilisateur` accepte une colonne texte ou une référence Grist.
