// config/mongodb.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Remove deprecated options
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Log connection state
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  Mongoose disconnected from MongoDB');
    });

  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('\nPlease check:');
    console.error('  1. MONGODB_URI is set correctly in .env file');
    console.error('  2. MongoDB Atlas IP whitelist includes your IP (or use 0.0.0.0/0 for testing)');
    console.error('  3. Database credentials are correct');
    console.error('  4. Special characters in password are URL-encoded (@ becomes %40)');
    console.error('\nYour current connection string pattern should be:');
    console.error('mongodb+srv://username:password@cluster.mongodb.net/database\n');
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed due to app termination');
    process.exit(0);
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

module.exports = connectDB;