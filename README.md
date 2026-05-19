# TalkLight - La messagerie qui parle même sur petit débit

Application de messagerie instantanée web optimisée pour les connexions faibles ou instables.

## Stack

| Couche | Service |
|--------|---------|
| Base de données | [Neon PostgreSQL](https://neon.tech) (serverless) |
| Stockage médias | [Cloudinary](https://cloudinary.com) |
| Cache (optionnel) | Redis |
| Backend | Node.js, Express, Socket.io, Prisma |
| Frontend | React, Vite, TypeScript, TailwindCSS |

## Prérequis

1. **Créer un compte Neon** → https://neon.tech (gratuit)
2. **Créer un compte Cloudinary** → https://cloudinary.com (gratuit)

## Installation

### 1. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Modifiez `.env` avec vos identifiants :

- `DATABASE_URL` : URL de connexion Neon (trouvée dans le dashboard Neon)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` : depuis le dashboard Cloudinary

### 2. Installer les dépendances

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Migrer la base de données

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

### 4. Lancer l'application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

- Frontend : http://localhost:5173
- Backend API : http://localhost:3000

## Structure du projet

```
talklight/
├── backend/
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── socket/         # WebSocket handlers
│   │   ├── middleware/     # Auth, rate limiting
│   │   ├── lib/            # Prisma, Redis, Cloudinary
│   │   └── config/         # Configuration
│   └── prisma/schema.prisma
├── frontend/
│   └── src/
│       ├── components/     # UI components
│       ├── pages/          # Pages
│       ├── store/          # Zustand stores
│       └── lib/            # API, Socket, IndexedDB
├── .env.example
└── README.md
```

## API Endpoints

### Auth
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| POST | `/api/auth/refresh` | Rafraîchir token |
| GET | `/api/auth/me` | Profil connecté |

### Upload (Cloudinary)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/upload/avatar` | Upload avatar |
| POST | `/api/upload/image` | Upload image |
| POST | `/api/upload/audio` | Upload audio |

## License

MIT
