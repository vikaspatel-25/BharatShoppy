import express from 'express';
import { searchLocations } from '../controllers/locationController.js';
import {getProducts} from '../controllers/productController.js'
import { globalSearch } from '../controllers/globalSearchController.js';
import getStores from '../controllers/storeController.js';

const router = express.Router();

router.get('/searchLocations',searchLocations);
router.get('/products',getProducts);
router.get("/stores", getStores);
router.get('/search',globalSearch)

export default router;