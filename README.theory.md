L’objectif métier de la base de données des jeux est de fournir un service interne permettant d’obtenir des données pour toutes les applications provenant de tous les app stores.
De nombreuses autres applications chez Voodoo utiliseront cette API.

# Question 1

## Énoncé

Nous prévoyons de mettre ce projet en production. Selon vous, quels sont les éléments manquants pour rendre ce projet prêt pour la production ?
Merci de détailler un plan d’action.

## Réponse 

Il manque certaines informations pour répondre à cette question, en particulier le niveau de fonctionnalité, de sécurité, et de conformité aux standards attendus. 

En conséquence, la réponse est décomposée en trois scénarios potentiels aux exigences croissantes, avec les évolutions correspondantes à apporter à l'application.

### Mise en prod d'une beta utilisée uniquement en interne

Si on souhaite simplement déployer une beta en prod pour faire une démo à des parties prenantes et que les seuls utilisateurs sont les développeurs eux-mêmes (ou des utilisateurs de confiance), alors il est concevable de déployer l'application telle quelle, sans changement.

Dans ce scénario, l'utilisation d'une "vraie" base de données plutôt qu'une base SQLite pourra toutefois s'avérer utile, notamment pour tirer partie des services cloud associés (backup automatique, par exemple).

Un autre apport intéressant dès ce stade consisterait à découpler la couche "métier" (business/services) et la couche "api" (web/controllers) qui aujourd'hui n'en forment qu'une seule au niveau du back. Ceci permettrait d'améliorer la structure globale de l'architecture applicative et sa maintenabilité à moyen terme. Le passage en TypeScript pour remplacer le JS natif serait également un plus bienvenu.

### Mise en prod d'une release candidate utilisée uniquement en interne

Si on souhaite mettre en prod une version release candidate à usage interne exclusivement, avec des utilisateurs variés (niveau débutant/moyen/confirmé, profil technique/métier/data, etc), il parait judicieux d'améliorer le contrôle des entrées et la gestion des erreurs.

S'agissant du contrôle des entrées, une librairie de validation des inputs (type, longueur, format, ...) doit être intégrée a minima côté back, et idéalement côté back ET front.

Concernant la gestion des erreurs, il serait intéressant d'unifier la gestion des erreurs côté back pour éviter d'avoir des répétitions telles que res.status(400) dans chaque route, et de détecter et traiter ces erreurs côté front avec une UI appropriée (boite de dialogue ou équivalent).

L'identification et la définition des cas d'erreurs permettra de compléter efficacement le plan de test de l'application, celui-ci devant être invoqué automatiquement par le pipeline de déploiement en production.

Il sera également opportun à ce stade de compléter et rationnaliser le système de log: utiliser une librairie dédiée à cet aspect, flagger correctement le niveau des messages (info/warn/error) plutôt que de travailler uniquement avec console.log.

### Mise en prod d'une release candidate ouverte sur l'extérieur

On envisage ici le cas où l'on souhaite rendre l'application accessible à un public très large et divers, potentiellement malveillant; ce contexte entraine des exigences de sécurité et de fonctionnalité accrues.

En termes de sécurité, on veillera notamment à mettre en place :
- un contrôle strict de toute forme d'injection malicieuse (XSS, SQL, CSRF);
- la sécurisation des headers de réponse grâce à des solutions comme le package "helmet"
- un système d'authentification et d'autorisation pour un meilleure pilotage des droits d'accès à l'application;
- un système de monitoring et d'alerte pour superviser facilement l'application et être notifié des erreurs;
- des étapes supplémentaires dans le pipeline de déploiement, par exemple un "npm audit" pour vérifier la sécurité des dépendances, voire un contrôle de code type sonar.

Fonctionnellement, il pourra être utile d'affiner la gestion du flux réseau pour améliorer l'UI/UX :
- chargement progressif (skeleton, progressive rendering) en cas de lenteur, tant côté serveur (ddos) que user (3g)
- gestion des retries si les requêtes HTTP sont susceptibles d'échecs ponctuels

### Performances

La question des performances est éludée ici car elle ne figure pas explicitement dans la question et peut s'appliquer indépendamment du scénario.

On notera toutefois les pistes générales suivantes pour se rapprocher d'une application "prod-ready" sur ce plan :
- Scaling horizontal (load-balancing)
- Mise en cache des ressources (un redis côté back pour les jeux, par exemple),
- Packaging des assets UI


# Question 2

## Énoncé

Imaginons que notre équipe data livre désormais de nouveaux fichiers chaque jour dans le bucket S3, et que notre service doit ingérer ces fichiers quotidiennement via l’API de populate.
Pourriez-vous décrire une solution adaptée pour automatiser cela ? N'hésitez pas à proposer des changements architecturaux.

## Réponse

Pour automatiser l'ingestion de nouveaux jeux dans la BDD, on peut envisager de travailler en mode "PUSH" ou en mode "PULL".

### Mode PUSH

Au niveau d'AWS, il est possible d'écouter les évènements qui affectent un bucket S3.

Une solution est donc d'écouter la création d'un objet sur le bucket (évènement "s3:ObjectCreated:*"), et de déclencher l'action de populate sur la base de cet évènement.

AWS propose d'associer un évènement S3 à une fonction Lambda. Cette dernière pourrait donc invoquer l'API populate en lui passant en paramètre l'url du nouveau fichier.

Le mode PUSH est à privilégier pour optimiser les performances, mais peut se révéler fragile dans certaines circonstances (si l'API est down, par exemple).

### Mode PULL

L'idée est ici d'invoquer à intervalles réguliers le traitement suivant : 
- Récupérer les fichiers sur le bucket S3
- Insérer les jeux manquants et mettre à jour ceux qui existent déjà
- (Supprimer les fichiers du bucket S3 ?)

La façon la plus triviale de mettre en place ce système est d'utiliser une boucle de "setTimeout" ou un "setInterval".

Il est toutefois préférable d'utiliser une librairie de cron (node-cron ou équivalent), ou mieux encore un service cloud de cron.

Le mode PULL est à privilégier si l'intégrité des données constitue un enjeu fort et/ou que la performance est un enjeu secondaire.