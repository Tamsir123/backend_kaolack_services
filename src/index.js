import http from 'http';
import app from './app.js';
import { initializeDatabase, disconnectDatabase } from './database/index.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 5000;

// Fonction de démarrage du serveur
const startServer = async () => {
  try {
    // Initialiser la base de données
    await initializeDatabase();
    
    // Créer le serveur HTTP
    const server = http.createServer(app);
    
    // Démarrer le serveur
    server.listen(PORT, () => {
      logger.info(`🚀 Serveur démarré sur http://localhost:${PORT}`);
      logger.info(`📊 API disponible sur http://localhost:${PORT}/api`);
      logger.info(`📋 Documentation API sur http://localhost:${PORT}/api/docs`);
    });

    // Gestion gracieuse des signaux d'arrêt
    const gracefulShutdown = async (signal) => {
      logger.info(`📡 Signal ${signal} reçu, arrêt gracieux du serveur...`);
      
      server.close(async () => {
        logger.info('🔄 Serveur HTTP fermé');
        
        try {
          await disconnectDatabase();
          logger.info('🛑 Serveur arrêté proprement');
          process.exit(0);
        } catch (error) {
          logger.error('❌ Erreur lors de l\'arrêt:', error);
          process.exit(1);
        }
      });
    };

    // Écouter les signaux d'arrêt
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
};

// Démarrer le serveur
startServer();