# Grist EMM Kanban Widget — V3

Custom widget Grist pour piloter la table EMM sous forme de dashboard Kanban éditable.

## Nouveautés V3

- Titre simplifié : `Dashboard EMM`.
- Header beaucoup plus compact.
- Suppression du sous-titre et du libellé `Pilotage EMM`.
- Indicateurs revus : `En retard`, `Urgents`, `À 7 jours`, `Total`.
- Suppression de l’indicateur `Déployés`.
- Filtres repliés par défaut.
- Barre de recherche, tri et boutons plus compacts.
- Style des sélecteurs modernisé.
- Design général moins dense.

## Installation

Déposer les fichiers à la racine du dépôt GitHub Pages :

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `.nojekyll`

Puis mettre à jour l’URL du widget dans Grist, si besoin avec un suffixe de cache :

```text
https://<compte>.github.io/<repo>/?v=3
```

## Accès Grist

Le widget modifie les données sources et nécessite donc un accès complet au document Grist.
