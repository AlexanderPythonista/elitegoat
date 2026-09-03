import express from 'express';
import { getPayments, createPayment, updatePayment, deletePayment } from '../controllers/paymentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router=express.Router();
router.use(authenticate,authorize('admin','root'));
router.get('/',getPayments); router.post('/',createPayment); router.put('/:id',updatePayment); router.delete('/:id',deletePayment);
export default router;
