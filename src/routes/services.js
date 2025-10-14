import { Router } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { AppError, errors } from '../utils/errors.js';
import { authenticateToken, requireAgent } from '../middleware/auth.js';

const router = Router();

// Schémas de validation
const serviceRequestSchema = z.object({
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  scheduledAt: z.string().datetime().optional(),
});

// GET /api/services - Liste des services disponibles
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
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
    logger.error('Services list error:', error);
    next(error);
  }
});

// GET /api/services/:id - Détails d'un service
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const prisma = getPrismaClient();
    
    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      return next(errors.SERVICE_NOT_FOUND);
    }

    res.json({
      success: true,
      message: 'Service récupéré avec succès',
      data: {
        service,
      },
    });

  } catch (error) {
    logger.error('Service details error:', error);
    next(error);
  }
});

// POST /api/services/:id/request - Faire une demande de service
router.post('/:id/request', authenticateToken, async (req, res, next) => {
  try {
    const { id: serviceId } = req.params;
    const validatedData = serviceRequestSchema.parse(req.body);
    
    const prisma = getPrismaClient();

    // Vérifier que le service existe
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service || !service.isActive) {
      return next(errors.SERVICE_NOT_FOUND);
    }

    // Créer la demande de service
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        userId: req.user.id,
        serviceId,
        description: validatedData.description,
        priority: validatedData.priority,
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        status: 'PENDING',
      },
      include: {
        service: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    logger.info(`Nouvelle demande de service: ${serviceRequest.id} par ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Demande de service créée avec succès',
      data: {
        serviceRequest,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(new AppError(message, 400));
    }
    
    logger.error('Service request error:', error);
    next(error);
  }
});

// GET /api/services/requests/my - Mes demandes de service
router.get('/requests/my', authenticateToken, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    
    const requests = await prisma.serviceRequest.findMany({
      where: { userId: req.user.id },
      include: {
        service: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      message: 'Demandes récupérées avec succès',
      data: {
        requests,
        count: requests.length,
      },
    });

  } catch (error) {
    logger.error('My requests error:', error);
    next(error);
  }
});

// GET /api/services/requests/:id - Détails d'une demande
router.get('/requests/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const prisma = getPrismaClient();
    
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        service: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        documents: true,
      },
    });

    if (!serviceRequest) {
      return next(errors.REQUEST_NOT_FOUND);
    }

    // Vérifier que l'utilisateur peut accéder à cette demande
    if (req.user.role === 'CITIZEN' && serviceRequest.userId !== req.user.id) {
      return next(errors.INSUFFICIENT_PERMISSIONS);
    }

    res.json({
      success: true,
      message: 'Demande récupérée avec succès',
      data: {
        serviceRequest,
      },
    });

  } catch (error) {
    logger.error('Service request details error:', error);
    next(error);
  }
});

// Schéma de validation pour l'extrait de naissance
const birthCertificateSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  birthPlace: z.string().min(2, 'Le lieu de naissance doit contenir au moins 2 caractères'),
  fatherName: z.string().min(2, 'Le nom du père doit contenir au moins 2 caractères'),
  motherName: z.string().min(2, 'Le nom de la mère doit contenir au moins 2 caractères'),
  purpose: z.string().min(5, 'Le motif doit contenir au moins 5 caractères'),
  urgency: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
  deliveryMethod: z.enum(['PICKUP', 'MAIL']).default('PICKUP'),
  contactPhone: z.string().min(8, 'Numéro de téléphone invalide'),
  contactEmail: z.string().email('Adresse email invalide'),
});

// POST /api/services/birth-certificate/request - Demande d'extrait de naissance
router.post('/birth-certificate/request', authenticateToken, async (req, res, next) => {
  try {
    const validatedData = birthCertificateSchema.parse(req.body);
    const prisma = getPrismaClient();

    // Vérifier si le service "Extrait de naissance" existe, sinon le créer
    let birthCertService = await prisma.service.findFirst({
      where: { name: 'Extrait de naissance' }
    });

    if (!birthCertService) {
      birthCertService = await prisma.service.create({
        data: {
          name: 'Extrait de naissance',
          description: 'Demande d\'extrait de naissance pour les citoyens de Kaolack',
          category: 'CIVIL_STATUS',
          price: 1000,
          processingTime: 3,
          requiredDocuments: ['Pièce d\'identité', 'Justificatif de domicile'],
          isActive: true,
        }
      });
    }

    // Créer la demande de service
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        serviceId: birthCertService.id,
        userId: req.user.id,
        status: 'PENDING',
        priority: validatedData.urgency === 'URGENT' ? 'HIGH' : 'NORMAL',
        description: `Demande d'extrait de naissance pour ${validatedData.firstName} ${validatedData.lastName}`,
        metadata: {
          ...validatedData,
          requestType: 'birth-certificate',
          submittedAt: new Date().toISOString(),
        },
      },
      include: {
        service: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Créer une notification pour les agents
    await prisma.notification.create({
      data: {
        title: 'Nouvelle demande d\'extrait de naissance',
        message: `Une nouvelle demande d'extrait de naissance a été soumise par ${req.user.firstName} ${req.user.lastName}`,
        type: 'NEW_REQUEST',
        priority: validatedData.urgency === 'URGENT' ? 'HIGH' : 'NORMAL',
        targetRole: 'AGENT',
        relatedId: serviceRequest.id,
        metadata: {
          serviceRequestId: serviceRequest.id,
          requestType: 'birth-certificate',
          urgency: validatedData.urgency,
        },
      },
    });

    logger.info(`Nouvelle demande d'extrait de naissance: ${serviceRequest.id} par ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Demande d\'extrait de naissance créée avec succès',
      data: {
        requestId: serviceRequest.id,
        serviceRequest,
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(new AppError(message, 400));
    }
    
    logger.error('Birth certificate request error:', error);
    next(error);
  }
});

// GET /api/services/requests - Liste des demandes (pour les agents/admin)
router.get('/requests', authenticateToken, requireAgent, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, priority, type } = req.query;
    const skip = (page - 1) * limit;
    const prisma = getPrismaClient();

    // Construire les filtres
    const filters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (type) {
      filters.metadata = {
        path: ['requestType'],
        equals: type,
      };
    }

    // Récupérer les demandes avec pagination
    const [requests, totalCount] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: filters,
        include: {
          service: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit),
      }),
      prisma.serviceRequest.count({ where: filters }),
    ]);

    res.json({
      success: true,
      message: 'Demandes récupérées avec succès',
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      },
    });

  } catch (error) {
    logger.error('Requests list error:', error);
    next(error);
  }
});

// PUT /api/services/requests/:id/status - Mettre à jour le statut d'une demande
router.put('/requests/:id/status', authenticateToken, requireAgent, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    const prisma = getPrismaClient();

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return next(new AppError('Statut invalide', 400));
    }

    // Mettre à jour la demande
    const updatedRequest = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status,
        ...(comment && {
          metadata: {
            ...(await prisma.serviceRequest.findUnique({ where: { id } })).metadata,
            lastUpdate: {
              status,
              comment,
              updatedBy: req.user.email,
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      },
      include: {
        service: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Créer une notification pour l'utilisateur
    await prisma.notification.create({
      data: {
        userId: updatedRequest.userId,
        title: 'Mise à jour de votre demande',
        message: `Le statut de votre demande "${updatedRequest.service.name}" a été mis à jour : ${status}`,
        type: 'STATUS_UPDATE',
        priority: 'NORMAL',
        relatedId: updatedRequest.id,
        metadata: {
          serviceRequestId: updatedRequest.id,
          newStatus: status,
          comment: comment || null,
        },
      },
    });

    logger.info(`Demande ${id} mise à jour par ${req.user.email}: ${status}`);

    res.json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: { serviceRequest: updatedRequest },
    });

  } catch (error) {
    logger.error('Status update error:', error);
    next(error);
  }
});

// GET /api/services/requests/stats - Statistiques des demandes
router.get('/requests/stats', authenticateToken, requireAgent, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();

    const [
      totalRequests,
      pendingRequests,
      inProgressRequests,
      completedRequests,
      urgentRequests,
      todayRequests,
      birthCertificateRequests,
    ] = await Promise.all([
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({ where: { status: 'PENDING' } }),
      prisma.serviceRequest.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.serviceRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.serviceRequest.count({ where: { priority: 'HIGH' } }),
      prisma.serviceRequest.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          metadata: {
            path: ['requestType'],
            equals: 'birth-certificate',
          },
        },
      }),
    ]);

    res.json({
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: {
        total: totalRequests,
        byStatus: {
          pending: pendingRequests,
          inProgress: inProgressRequests,
          completed: completedRequests,
        },
        urgent: urgentRequests,
        today: todayRequests,
        byType: {
          birthCertificate: birthCertificateRequests,
        },
      },
    });

  } catch (error) {
    logger.error('Stats error:', error);
    next(error);
  }
});

export default router;