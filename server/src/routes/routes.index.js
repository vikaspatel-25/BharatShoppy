import express from 'express';
import { searchLocations } from '../controllers/locationController.js';
import {getProducts} from '../controllers/productController.js'
const router = express.Router();

router.get('/searchLocations',searchLocations);
router.get('/products',getProducts)

export default router;