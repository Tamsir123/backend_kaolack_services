import { config as dotenvConfig } from 'dotenv';

// Charger les variables d'environnement
dotenvConfig();

export const config = {
  app: {
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 5000,
    name: 'Kaolack Services API',
    version: '1.0.0',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/klservices_db',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'votre-secret-jwt-super-securise',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'votre-refresh-secret-jwt-super-securise',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
  },
  
  cors: {
    allowedOrigins: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:3001'],
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: process.env.ALLOWED_MIME_TYPES 
      ? process.env.ALLOWED_MIME_TYPES.split(',')
      : [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
    uploadPath: process.env.UPLOAD_PATH || './uploads',
  },
  
  email: {
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@kaolackservices.sn',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    maxSize: process.env.LOG_MAX_SIZE || '10MB',
  },
};