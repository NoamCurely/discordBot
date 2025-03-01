const mongoose = require('mongoose');
const config = require('./config');

// Connexion à MongoDB
async function connectDB() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
  } catch (error) {
    console.error('❌ Erreur de connexion à MongoDB:', error);
    process.exit(1);
  }
}

module.exports = connectDB;