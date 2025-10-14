import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPrismaClient } from '../database/index.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError, errors } from '../utils/errors.js';
import { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  authenticateToken 
} from '../middleware/auth.js';

const router = Router();

// Schémas de validation
const registerSchema = z.object({
  email: z.string().email('Format d\'email invalide'),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  firstName: z.string()
    .min(2, 'Le prénom doit contenir au moins 2 caractères')
    .max(50, 'Le prénom ne peut pas dépasser 50 caractères'),
  lastName: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères'),
  phone: z.string()
    .regex(/^(\+221)?[0-9]{9}$/, 'Format de téléphone invalide (ex: +221123456789 ou 123456789)')
    .optional(),
  address: z.string().max(255, 'L\'adresse ne peut pas dépasser 255 caractères').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Format d\'email invalide'),
  password: z.string().min(1, 'Le mot de passe est obligatoire'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obligatoire'),
});

// POST /api/auth/register - Inscription d'un nouvel utilisateur
router.post('/register', async (req, res, next) => {
  try {
    // Validation des données
    const validatedData = registerSchema.parse(req.body);
    
    const prisma = getPrismaClient();

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return next(errors.EMAIL_ALREADY_EXISTS);
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(validatedData.password, config.bcrypt.saltRounds);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        address: validatedData.address,
        role: 'CITIZEN', // Rôle par défaut
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Générer les tokens
    const accessToken = generateToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Sauvegarder le refresh token en base
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    logger.info(`Nouvel utilisateur inscrit: ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: config.jwt.expiresIn,
        },
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(new AppError(message, 400));
    }
    
    logger.error('Registration error:', error);
    next(error);
  }
});

// POST /api/auth/login - Connexion d'un utilisateur
router.post('/login', async (req, res, next) => {
  try {
    // Validation des données
    const { email, password } = loginSchema.parse(req.body);
    
    const prisma = getPrismaClient();

    // Récupérer l'utilisateur avec le mot de passe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return next(errors.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      return next(errors.ACCOUNT_DISABLED);
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return next(errors.INVALID_CREDENTIALS);
    }

    // Générer les tokens
    const accessToken = generateToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Mettre à jour le refresh token et la dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken,
        lastLogin: new Date(),
      },
    });

    // Retourner les données utilisateur sans le mot de passe
    const { password: _, refreshToken: __, ...userWithoutPassword } = user;

    logger.info(`Utilisateur connecté: ${user.email}`);

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: userWithoutPassword,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: config.jwt.expiresIn,
        },
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(new AppError(message, 400));
    }
    
    logger.error('Login error:', error);
    next(error);
  }
});

// GET /api/auth/profile - Récupérer le profil utilisateur
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Profil récupéré avec succès',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    logger.error('Profile error:', error);
    next(error);
  }
});

// POST /api/auth/refresh - Rafraîchir le token d'accès
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    
    // Vérifier le refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    const prisma = getPrismaClient();

    // Vérifier que le refresh token correspond à celui en base
    const user = await prisma.user.findFirst({
      where: { 
        id: decoded.userId,
        refreshToken,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return next(errors.TOKEN_INVALID);
    }

    // Générer un nouveau access token
    const newAccessToken = generateToken(user.id, user.role);

    res.json({
      success: true,
      message: 'Token rafraîchi avec succès',
      data: {
        user,
        tokens: {
          accessToken: newAccessToken,
          refreshToken, // Garde le même refresh token
          expiresIn: config.jwt.expiresIn,
        },
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(new AppError(message, 400));
    }
    
    logger.error('Refresh token error:', error);
    next(error);
  }
});

// POST /api/auth/logout - Déconnexion
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();

    // Supprimer le refresh token de la base
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null },
    });

    logger.info(`Utilisateur déconnecté: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Déconnexion réussie',
    });

  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
});

export default router;