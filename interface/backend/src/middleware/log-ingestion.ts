import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';

const LOG_LEVELS = ['error', 'warn', 'warning', 'info', 'debug', 'trace', 'fatal'] as const;

const logEntrySchema = Joi.object({
  timestamp: Joi.string().isoDate().required(),
  level: Joi.string()
    .lowercase()
    .valid(...LOG_LEVELS)
    .required(),
  message: Joi.string().trim().max(2000).required(),
  service: Joi.string().trim().max(128).optional(),
  category: Joi.string().trim().max(128).optional(),
  source: Joi.string().trim().max(128).optional(),
  requestId: Joi.string().trim().max(128).optional(),
  userId: Joi.string().trim().max(128).optional(),
  environment: Joi.string().trim().max(128).optional()
}).unknown(true);

const validateWithSchema = (
  schema: Joi.Schema,
  value: unknown,
  onError: (details: string[]) => Response
) => {
  const { error, value: validated } = schema.validate(value, {
    abortEarly: false,
    stripUnknown: false,
    convert: true
  });

  if (error) {
    const details = error.details.map(detail => detail.message);
    return onError(details);
  }

  return validated;
};

export const validateLogEntry = (req: Request, res: Response, next: NextFunction): void | Response => {
  const validated = validateWithSchema(logEntrySchema, req.body, details =>
    res.status(400).json({
      error: 'Invalid log entry',
      details
    })
  );

  if (!validated) {
    return;
  }

  req.body = validated;
  next();
};

export const validateBatchLogEntries = (req: Request, res: Response, next: NextFunction): void | Response => {
  const batchSchema = Joi.array().items(logEntrySchema).min(1).max(500).required();
  const validated = validateWithSchema(batchSchema, req.body, details =>
    res.status(400).json({
      error: 'Invalid log batch',
      details
    })
  );

  if (!validated) {
    return;
  }

  req.body = validated;
  next();
};

export const rateLimitSingleLog = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many log submissions. Please slow down.'
  },
  keyGenerator: req => `${req.ip}:frontend-log`
});

export const rateLimitBatchLogs = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many batched log submissions. Please slow down.'
  },
  keyGenerator: req => `${req.ip}:frontend-log-batch`
});
