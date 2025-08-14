const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'Access token required' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const customer = await prisma.customer.findUnique({  // Changed to 'customer'
            where: { phone: decoded.customerId },
            select: { 
                phone: true, 
                email: true, 
                name: true,
                city: true,
                country: true
            }
        });
        
        if (!customer) {
            return res.status(401).json({ 
                success: false, 
                error: 'Customer not found' 
            });
        }
        
        req.user = {
            id: customer.phone,
            phone: customer.phone,
            email: customer.email,
            name: customer.name,
            city: customer.city,
            country: customer.country
        };
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(403).json({ 
            success: false, 
            error: 'Invalid token' 
        });
    }
};

module.exports = { authenticateToken };