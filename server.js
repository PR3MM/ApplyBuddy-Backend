import express from 'express'; 
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import router from './routes/index.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
dotenv.config();
 
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (about 1 req/second)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));


connectDB();

// Health check endpoint (before rate limiting for monitoring)
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {}
    };

    // Check MongoDB connection
    try {
      const mongoose = await import('mongoose');
      if (mongoose.default.connection.readyState === 1) {
        health.services.mongodb = 'connected';
      } else {
        health.services.mongodb = 'disconnected';
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.mongodb = 'error';
      health.status = 'degraded';
    }

    // Check Redis connection
    try {
      const { default: client } = await import('./redis.js');
      await client.ping();
      health.services.redis = 'connected';
    } catch (error) {
      health.services.redis = 'disconnected';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.use('/',router);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack, error: err })
  });
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const server = app.listen(PORT, () => {
  console.log(`Server running on website at http://localhost:${PORT}`);
});