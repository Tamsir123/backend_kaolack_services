import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log de l'erreur
  logger.error('Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Erreur Mongoose - ID invalide
  if (err.name === 'CastError') {
    const message = 'Ressource non trouvée';
    error = new AppError(message, 404);
  }

  // Erreur Mongoose - Validation
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400);
  }

  // Erreur Mongoose - Doublon
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} déjà existant`;
    error = new AppError(message, 400);
  }

  // Erreur JWT - Token invalide
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token invalide';
    error = new AppError(message, 401);
  }

  // Erreur JWT - Token expiré
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expiré';
    error = new AppError(message, 401);
  }

  // Erreur Prisma - Contrainte unique
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'champ';
    const message = `${field} déjà existant`;
    error = new AppError(message, 400);
  }

  // Erreur Prisma - Enregistrement non trouvé
  if (err.code === 'P2025') {
    const message = 'Ressource non trouvée';
    error = new AppError(message, 404);
  }

  // Erreur Prisma - Contrainte de clé étrangère
  if (err.code === 'P2003') {
    const message = 'Référence invalide';
    error = new AppError(message, 400);
  }

  // Erreur Zod - Validation
  if (err.name === 'ZodError') {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    error = new AppError(message, 400);
  }

  // Erreur Multer - Fichier trop volumineux
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'Fichier trop volumineux';
    error = new AppError(message, 400);
  }

  // Erreur Multer - Type de fichier non supporté
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Type de fichier non supporté';
    error = new AppError(message, 400);
  }

  // Réponse d'erreur
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Erreur serveur interne',
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        original: err 
      }),
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  });
};