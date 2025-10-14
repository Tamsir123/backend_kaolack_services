import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../database/index.js';
import { config } from '../config/index.js';
import { errors, AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Middleware pour vérifier le token JWT
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return next(errors.ACCESS_DENIED);
    }

    // Vérifier le token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Récupérer l'utilisateur depuis la base de données
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return next(errors.USER_NOT_FOUND);
    }

    if (!user.isActive) {
      return next(errors.ACCOUNT_DISABLED);
    }

    // Ajouter l'utilisateur à la requête
    req.user = user;
    next();

  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return next(errors.TOKEN_INVALID);
    }
    
    if (error.name === 'TokenExpiredError') {
      return next(errors.TOKEN_EXPIRED);
    }
    
    next(new AppError('Erreur d\'authentification', 401));
  }
};

// Middleware pour vérifier les rôles
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(errors.ACCESS_DENIED);
    }

    if (!roles.includes(req.user.role)) {
      return next(errors.INSUFFICIENT_PERMISSIONS);
    }

    next();
  };
};

// Middleware pour vérifier si l'utilisateur est admin
export const requireAdmin = requireRole('ADMIN');

// Middleware pour vérifier si l'utilisateur est agent ou admin
export const requireAgent = requireRole('AGENT', 'ADMIN');

// Middleware pour vérifier si l'utilisateur est propriétaire ou admin
export const requireOwnershipOrAdmin = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(errors.ACCESS_DENIED);
      }

      // Les admins ont accès à tout
      if (req.user.role === 'ADMIN') {
        return next();
      }

      // Vérifier si l'utilisateur est propriétaire de la ressource
      const resourceUserId = await getResourceUserId(req);
      
      if (req.user.id !== resourceUserId) {
        return next(errors.INSUFFICIENT_PERMISSIONS);
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      next(new AppError('Erreur de vérification des permissions', 500));
    }
  };
};

// Middleware optionnel pour récupérer l'utilisateur si token présent
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const prisma = getPrismaClient();
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (error) {
    // En cas d'erreur, continuer sans utilisateur
    next();
  }
};

// Fonction utilitaire pour générer un token
export const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Fonction utilitaire pour générer un refresh token
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

// Fonction pour vérifier un refresh token
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    throw new AppError('Refresh token invalide', 401);
  }
};