import winston from 'winston';
import { config } from '../config/index.js';

// Format personnalisé pour les logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Configuration des transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: customFormat,
    level: config.logging.level,
  })
];

// Ajouter le transport fichier seulement en production
if (config.app.environment === 'production') {
  transports.push(
    new winston.transports.File({
      filename: config.logging.file,
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
    })
  );
}

// Créer l'instance du logger
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
  exitOnError: false,
});

// Stream pour Morgan (middleware de logging HTTP)
export const morganStream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export default logger;