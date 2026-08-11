import { body, param, validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

// Validaciones para eventos
export const eventValidation = {
  create: [
    body('name').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 100 }),
    body('type').isIn(['botin', 'kill', 'supervivencia']).withMessage('Tipo inválido'),
    body('mode').isIn(['individual', 'duos', 'trios', 'escuadras', 'mixto']).withMessage('Modalidad inválida'),
    body('maxParticipants').optional().isInt({ min: 1, max: 1000 })
  ],
  update: [
    param('id').notEmpty().withMessage('ID requerido'),
    body('name').optional().trim().isLength({ max: 100 }),
    body('status').optional().isIn(['activo', 'finalizado', 'cancelado'])
  ]
};

export const participantValidation = {
  add: [
    param('eventId').notEmpty().withMessage('ID de evento requerido'),
    body('userId').trim().notEmpty().withMessage('ID de usuario requerido'),
    body('nickname').trim().notEmpty().withMessage('Nickname requerido').isLength({ max: 50 })
  ],
  addMatch: [
    param('participantId').notEmpty().withMessage('ID de participante requerido'),
    body('kills').optional().isInt({ min: 0 }),
    body('deaths').optional().isInt({ min: 0 }),
    body('position').optional().isInt({ min: 1 })
  ]
};