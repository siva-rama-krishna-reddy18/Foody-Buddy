const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class AuthService {
    async register(userData) {
        const { email, name, password, phone } = userData;
        
        if (!phone) {
            throw new Error('Phone number is required');
        }
        
        // Use the correct model name (check your schema - might be 'Customer' not 'customers')
        const existingCustomer = await prisma.customer.findUnique({  // Changed to 'customer'
            where: { phone }
        });
        
        if (existingCustomer) {
            throw new Error('Customer already exists');
        }
        
        // Create customer
        const customer = await prisma.customer.create({  // Changed to 'customer'
            data: {
                phone,
                name,
                email
            },
            select: {
                phone: true,
                name: true,
                email: true,
                city: true,
                country: true
            }
        });
        
        const token = this.generateToken(customer.phone);
        
        return { user: customer, token };
    }
    
    async login(phone, password) {
        const customer = await prisma.customer.findUnique({  // Changed to 'customer'
            where: { phone }
        });
        
        if (!customer) {
            throw new Error('Invalid credentials');
        }
        
        const token = this.generateToken(customer.phone);
        
        return {
            user: {
                phone: customer.phone,
                name: customer.name,
                email: customer.email,
                city: customer.city,
                country: customer.country
            },
            token
        };
    }
    
    generateToken(customerId) {
        return jwt.sign(
            { customerId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
    }
}

module.exports = new AuthService();

