import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { checkDatabaseHealth } from './database/index.js';

// Import des routes
import authRoutes from './routes/auth.js';
import servicesRoutes from './routes/services.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Middleware de sécurité
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// Configuration CORS
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware de compression
app.use(compression());

// Configuration des limites de taux
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 requêtes par IP par fenêtre de temps
  message: {
    error: 'Trop de requêtes depuis cette IP, réessayez plus tard.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging des requêtes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Routes de santé
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.environment,
      database: dbHealth,
      memory: process.memoryUsage(),
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Service temporairement indisponible',
    });
  }
});

// Route de base
app.get('/', (req, res) => {
  res.json({
    message: 'API Kaolack Services',
    version: '1.0.0',
    environment: config.app.environment,
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      services: '/api/services',
      admin: '/api/admin',
      docs: '/api/docs',
    },
  });
});

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/admin', adminRoutes);

// Route pour la documentation API
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'API Kaolack Services Documentation',
    version: '1.0.0',
    description: 'API pour la gestion des services administratifs de Kaolack',
    baseUrl: `${req.protocol}://${req.get('host')}/api`,
    endpoints: {
      authentication: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
        profile: 'GET /auth/profile',
        refresh: 'POST /auth/refresh',
        logout: 'POST /auth/logout',
      },
      services: {
        list: 'GET /services',
        get: 'GET /services/:id',
        request: 'POST /services/:id/request',
        myRequests: 'GET /services/requests/my',
        requestStatus: 'GET /services/requests/:id',
      },
      admin: {
        users: 'GET /admin/users',
        services: 'GET /admin/services',
        requests: 'GET /admin/requests',
        statistics: 'GET /admin/statistics',
      },
    },
  });
});

// Gestion des routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `La route ${req.method} ${req.originalUrl} n'existe pas`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/docs',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/services',
    ],
  });
});

// Middleware de gestion d'erreurs (doit être en dernier)
app.use(errorHandler);

export default app;