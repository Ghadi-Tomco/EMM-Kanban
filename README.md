# Grist Dashboard EMM — V3.5

Widget Grist éditable pour piloter la table `B_EMM` sous forme de Kanban.

## Évolutions V3.5

- Le panneau de filtres reprend le rendu du Dashboard Service Utilisateur :
  - un seul conteneur blanc ;
  - suppression des fonds colorés par ligne ;
  - séparateurs gris entre les filtres du référentiel, les filtres EMM et les options d’affichage.
- La vue compacte conserve désormais un espacement clair entre le panneau de filtres et le Kanban, même lorsque les KPI sont masqués.
- Toutes les fonctionnalités de la V3.4 sont conservées.

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
https://<compte>.github.io/<repo>/?v=3.5
```
