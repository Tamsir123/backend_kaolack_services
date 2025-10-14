export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message, statusCode = 500) => {
  return new AppError(message, statusCode);
};

// Erreurs prédéfinies courantes
export const errors = {
  // Erreurs d'authentification (401)
  INVALID_CREDENTIALS: new AppError('Email ou mot de passe incorrect', 401),
  TOKEN_INVALID: new AppError('Token invalide', 401),
  TOKEN_EXPIRED: new AppError('Token expiré', 401),
  ACCESS_DENIED: new AppError('Accès refusé', 401),
  
  // Erreurs d'autorisation (403)
  INSUFFICIENT_PERMISSIONS: new AppError('Permissions insuffisantes', 403),
  ACCOUNT_DISABLED: new AppError('Compte désactivé', 403),
  
  // Erreurs de ressource (404)
  USER_NOT_FOUND: new AppError('Utilisateur non trouvé', 404),
  SERVICE_NOT_FOUND: new AppError('Service non trouvé', 404),
  REQUEST_NOT_FOUND: new AppError('Demande non trouvée', 404),
  RESOURCE_NOT_FOUND: new AppError('Ressource non trouvée', 404),
  
  // Erreurs de validation (400)
  INVALID_INPUT: new AppError('Données d\'entrée invalides', 400),
  MISSING_REQUIRED_FIELDS: new AppError('Champs obligatoires manquants', 400),
  INVALID_EMAIL_FORMAT: new AppError('Format d\'email invalide', 400),
  WEAK_PASSWORD: new AppError('Mot de passe trop faible', 400),
  
  // Erreurs de conflit (409)
  EMAIL_ALREADY_EXISTS: new AppError('Cet email existe déjà', 409),
  USER_ALREADY_EXISTS: new AppError('Cet utilisateur existe déjà', 409),
  DUPLICATE_ENTRY: new AppError('Entrée dupliquée', 409),
  
  // Erreurs serveur (500)
  DATABASE_ERROR: new AppError('Erreur de base de données', 500),
  EMAIL_SEND_ERROR: new AppError('Erreur d\'envoi d\'email', 500),
  FILE_UPLOAD_ERROR: new AppError('Erreur de téléchargement de fichier', 500),
  INTERNAL_SERVER_ERROR: new AppError('Erreur serveur interne', 500),
  
  // Erreurs de service (503)
  SERVICE_UNAVAILABLE: new AppError('Service temporairement indisponible', 503),
  DATABASE_UNAVAILABLE: new AppError('Base de données indisponible', 503),
};

// Fonction utilitaire pour créer une réponse d'erreur
export const createErrorResponse = (error, req = null) => {
  const response = {
    success: false,
    error: {
      message: error.message,
      status: error.status || 'error',
      statusCode: error.statusCode || 500,
    },
    timestamp: new Date().toISOString(),
  };

  // Ajouter des informations de débogage en développement
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    if (req) {
      response.debug = {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      };
    }
  }

  return response;
};

// Fonction pour valider et normaliser les erreurs
export const normalizeError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  // Convertir les erreurs communes en AppError
  if (error.name === 'ValidationError') {
    return new AppError('Données de validation invalides', 400);
  }

  if (error.name === 'CastError') {
    return new AppError('Format de données invalide', 400);
  }

  if (error.code === 11000) {
    return new AppError('Données dupliquées', 409);
  }

  // Erreur générique pour tout le reste
  return new AppError('Erreur serveur interne', 500);
};