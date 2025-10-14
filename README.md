# Kaolack Services - Backend

Backend API pour la plateforme Kaolack Services.

## Structure du projet

```
backend/
├── src/
│   ├── index.js          # Point d'entrée principal
│   ├── app.js           # Configuration Express
│   ├── config/          # Configuration de l'application
│   ├── database/        # Configuration base de données
│   ├── middleware/      # Middlewares Express
│   ├── routes/          # Routes API
│   └── utils/           # Utilitaires
├── prisma/
│   └── schema.prisma    # Schéma de base de données
├── test-*.js            # Fichiers de test
└── package.json
```

## Installation

```bash
cd backend
npm install
```

## Configuration

1. Créer un fichier `.env` avec les variables d'environnement nécessaires
2. Configurer la base de données dans `prisma/schema.prisma`

## Scripts disponibles

- `npm start` - Démarrer le serveur en production
- `npm run dev` - Démarrer le serveur en mode développement avec nodemon
- `npm run db:generate` - Générer le client Prisma
- `npm run db:push` - Pousser le schéma vers la base de données
- `npm run db:migrate` - Exécuter les migrations de base de données
- `npm test` - Exécuter les tests

## API Endpoints

- `/api/auth` - Authentification
- `/api/services` - Gestion des services
- `/api/admin` - Administration

## Technologies utilisées

- Node.js
- Express.js
- Prisma ORM
- JWT pour l'authentification
- Winston pour les logs