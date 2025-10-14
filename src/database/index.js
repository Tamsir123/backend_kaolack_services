import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Instance globale de Prisma Client pour éviter les reconnections multiples
let prisma;

// Fonction pour initialiser Prisma Client
export const initializeDatabase = async () => {
  try {
    if (!prisma) {
      prisma = new PrismaClient({
        log: [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ],
        errorFormat: 'pretty',
      });

      // Écouter les événements de log
      prisma.$on('query', (e) => {
        logger.debug('Query:', e.query);
        logger.debug('Params:', e.params);
        logger.debug('Duration:', `${e.duration}ms`);
      });

      prisma.$on('error', (e) => {
        logger.error('Prisma error:', e);
      });

      prisma.$on('warn', (e) => {
        logger.warn('Prisma warning:', e);
      });

      // Tester la connexion
      await prisma.$connect();
      logger.info('✅ Base de données connectée avec succès');
    }

    return prisma;
  } catch (error) {
    logger.error('❌ Erreur de connexion à la base de données:', error);
    throw error;
  }
};

// Fonction pour fermer la connexion
export const disconnectDatabase = async () => {
  try {
    if (prisma) {
      await prisma.$disconnect();
      logger.info('🔌 Connexion à la base de données fermée');
    }
  } catch (error) {
    logger.error('❌ Erreur lors de la fermeture de la base de données:', error);
  }
};

// Getter pour obtenir l'instance Prisma
export const getPrismaClient = () => {
  if (!prisma) {
    throw new Error('Base de données non initialisée. Appelez initializeDatabase() d\'abord.');
  }
  return prisma;
};

// Fonction de sanité pour vérifier la connexion
export const checkDatabaseHealth = async () => {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return { status: 'healthy', message: 'Base de données accessible' };
  } catch (error) {
    return { status: 'unhealthy', message: error.message };
  }
};

// Export par défaut de l'instance (sera undefined jusqu'à l'initialisation)
export default getPrismaClient;