// routes/orderRoutes.js
const express = require('express');
const OrderController = require('../controllers/orderController');
const router = express.Router();

// Order Management Routes
router.post('/place', OrderController.placeOrder);
router.get('/history/:customerId', OrderController.getOrderHistory);
router.get('/:orderId', OrderController.getOrderDetails);
router.put('/:orderId/status', OrderController.updateOrderStatus);
router.delete('/:orderId/cancel', OrderController.cancelOrder);

// Cart Management Routes  
router.post('/cart/add', OrderController.addToCart);
router.get('/cart/:customerId', OrderController.getCart);
router.put('/cart/update', OrderController.updateCartItem);
router.delete('/cart/:customerId/:productId', OrderController.removeFromCart);
router.delete('/cart/:customerId', OrderController.clearCart);

module.exports = router;