# Grist Dashboard EMM — V3.4

Widget Grist éditable pour piloter la table `B_EMM` sous forme de Kanban.

## Évolutions V3.4

- Harmonisation visuelle avec le Dashboard Service Utilisateur :
  - même typographie et mêmes tailles ;
  - mêmes espacements, rayons, bordures et ombres ;
  - même style de boutons, listes déroulantes, filtres et KPI ;
  - cartes et colonnes Kanban rendues plus sobres.
- Le filtre `Service utilisateur` utilise la même barre de recherche avec autocomplétion que le Dashboard Service Utilisateur.
- Les valeurs vides stockées sous la forme `0` dans `Priorité Déploiement` sont ignorées et ne sont plus proposées dans la liste.
- Ajout de l’indication `Actualisé à HH:MM` à côté du titre.
- KPI conservés :
  - `Sujets en cours` ;
  - `P0 ou P1` ;
  - `En retard`.
- Conservation des filtres du référentiel services et des filtres opérationnels EMM.
- Conservation de l’édition, de la création, de la suppression et du drag & drop avec mise à jour partielle sécurisée.

## Fichiers

Déposer à la racine du dépôt GitHub Pages :

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `.nojekyll`

## Accès Grist

Le widget modifie les données sources et lit le référentiel des services. Il nécessite donc `Full document access`.

## Cache

Après publication, utiliser temporairement une URL du type :

```text
https://<compte>.github.io/<repo>/?v=3.4
```
