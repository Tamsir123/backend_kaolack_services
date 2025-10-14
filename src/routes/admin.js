import { Router } from 'express';
import { getPrismaClient } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Middleware pour toutes les routes admin
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/users - Liste des utilisateurs
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, isActive } = req.query;
    
    const prisma = getPrismaClient();
    
    const where = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          _count: {
            select: {
              serviceRequests: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      message: 'Utilisateurs récupérés avec succès',
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });

  } catch (error) {
    logger.error('Admin users list error:', error);
    next(error);
  }
});

// GET /api/admin/services - Liste des services (gestion)
router.get('/services', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    
    const services = await prisma.service.findMany({
      include: {
        _count: {
          select: {
            serviceRequests: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      message: 'Services récupérés avec succès',
      data: {
        services,
        count: services.length,
      },
    });

  } catch (error) {
    logger.error('Admin services list error:', error);
    next(error);
  }
});

// GET /api/admin/requests - Liste des demandes de service
router.get('/requests', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, priority } = req.query;
    
    const prisma = getPrismaClient();
    
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          service: true,
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    res.json({
      success: true,
      message: 'Demandes récupérées avec succès',
      data: {
        requests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });

  } catch (error) {
    logger.error('Admin requests list error:', error);
    next(error);
  }
});

// GET /api/admin/statistics - Statistiques générales
router.get('/statistics', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    
    const [
      totalUsers,
      activeUsers,
      totalServices,
      activeServices,
      totalRequests,
      requestsByStatus,
      requestsByPriority,
      recentRequests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.service.count(),
      prisma.service.count({ where: { isActive: true } }),
      prisma.serviceRequest.count(),
      prisma.serviceRequest.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.serviceRequest.groupBy({
        by: ['priority'],
        _count: { priority: true },
      }),
      prisma.serviceRequest.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 derniers jours
          },
        },
      }),
    ]);

    // Transformer les données groupées
    const statusStats = requestsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    const priorityStats = requestsByPriority.reduce((acc, item) => {
      acc[item.priority] = item._count.priority;
      return acc;
    }, {});

    res.json({
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
        },
        services: {
          total: totalServices,
          active: activeServices,
          inactive: totalServices - activeServices,
        },
        requests: {
          total: totalRequests,
          recent: recentRequests,
          byStatus: statusStats,
          byPriority: priorityStats,
        },
      },
    });

  } catch (error) {
    logger.error('Admin statistics error:', error);
    next(error);
  }
});

export default router;