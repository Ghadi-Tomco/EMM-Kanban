# Grist Dashboard EMM — V3.6

Widget Grist éditable pour piloter la table `B_EMM` sous forme de Kanban.

## Évolution V3.6

- barre `Rechercher un mot clé` élargie sur la deuxième ligne de filtres ;
- largeur alignée sur la logique de mise en page du Dashboard Service Utilisateur ;
- filtres `Catégorie`, `Cas`, `Priorité` et `Assignée à` rendus plus compacts ;
- comportement responsive conservé : la recherche occupe toute la ligne sur les écrans intermédiaires et les filtres repassent sur une colonne sur mobile.

## Fonctionnalités conservées

- filtres du référentiel des services utilisateurs ;
- KPI `Sujets en cours`, `P0 ou P1` et `En retard` ;
- création, édition et suppression de cartes ;
- drag & drop avec mise à jour partielle sécurisée ;
- vue compacte ;
- indication `Actualisé à HH:MM`.

## Fichiers

Déposer à la racine du dépôt GitHub Pages :

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `.nojekyll`

## Accès Grist

Le widget modifie les données sources et lit le référentiel des services. Il nécessite `Full document access`.

## Cache

Après publication, utiliser temporairement une URL du type :

```text
https://<compte>.github.io/<repo>/?v=3.6
```
