import express from 'express';
import { searchLocations } from '../controllers/locationService.js';

const router = express.Router();

router.get('/searchLocations',searchLocations);

export default router;