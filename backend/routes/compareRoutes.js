const express = require('express');
const compareController = require('../controllers/compareController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);
router.get('/', compareController.getCompareItems);
router.post('/', compareController.addToCompare);
router.delete('/clear', compareController.clearCompare);
router.delete('/:productId', compareController.removeFromCompare);

module.exports = router;
