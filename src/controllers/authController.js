const authService = require('../services/authservice');

class AuthController {
    async register(req, res) {
        try {
            const { email, name, password, phone } = req.body;
            
            // Basic validation
            if (!phone || !name) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number and name are required'
                });
            }
            
            // Validate phone format (basic validation)
            if (!/^\+?[\d\s\-\(\)]+$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phone number format'
                });
            }
            
            const result = await authService.register({ email, name, password, phone });
            
            res.status(201).json({
                success: true,
                data: result,
                message: 'Customer registered successfully'
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
    
    async login(req, res) {
        try {
            const { phone, password } = req.body;
            
            if (!phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
            }
            
            const result = await authService.login(phone, password);
            
            res.status(200).json({
                success: true,
                data: result,
                message: 'Login successful'
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(401).json({
                success: false,
                error: error.message
            });
        }
    }
    
    async getProfile(req, res) {
        try {
            res.status(200).json({
                success: true,
                data: { user: req.user },
                message: 'Profile retrieved successfully'
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user profile'
            });
        }
    }
}



module.exports = new AuthController();