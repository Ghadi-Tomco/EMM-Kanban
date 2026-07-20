# Grist Dashboard EMM — V3.7

Widget Grist éditable pour piloter la table `B_EMM` sous forme de Kanban.

## Schéma pris en charge

- Service Utilisateur
- Catégorie
- Cas
- Description
- Date souhaitée
- Prio
- Modifée le
- Statut
- Assignée à
- Commentaire
- Cible
- RTU
- Créée par
- Créé le
- CP/Demandeur
- Service

La colonne `Sprint` n'est plus utilisée.

## Statuts Kanban

- Nouveau
- En attente CU
- En cours DUD
- En cours DT
- En conception
- Terminé

## Compatibilité des types Grist

Aucun type de colonne n'est imposé dans le mapping. Grist propose donc toute colonne,
qu'elle soit Texte, Date, DateTime, Choice, ChoiceList, Référence ou Liste de références.
Le widget charge les métadonnées de la table sélectionnée pour afficher les libellés des
références et convertir correctement les valeurs lors des mises à jour.

## Dates de pilotage

La colonne `Cible` est utilisée en priorité pour le tri par échéance et le calcul des retards.
Lorsque `Cible` est vide, le widget utilise `Date souhaitée`.

## Fichiers

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `.nojekyll`

## Accès Grist

Le widget modifie les données sources et lit les référentiels des colonnes de référence. Il
nécessite `Full document access`.

## Cache

```text
https://<compte>.github.io/<repo>/?v=3.7
```
