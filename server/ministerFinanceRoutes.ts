import { Router } from 'express';
import { getMinisterFinancialStatus } from './ministerFinanceController';

const router = Router();

router.get('/:ministroId', getMinisterFinancialStatus);

export default router;
