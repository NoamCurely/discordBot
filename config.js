require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/twitch-discord-bot',
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
  TWITCH_WEBHOOK_SECRET: process.env.TWITCH_WEBHOOK_SECRET,
  DISCORD_TOKEN: process.env.TOKEN_BOT,
  CHANNEL_ID: process.env.CHANNEL_ID,
  ROLE_ID: process.env.ROLE_ID,
  NGROK_AUTHTOKEN: process.env.NGROK_AUTHTOKEN,
  USE_NGROK: process.env.NODE_ENV !== 'production',
  BASE_URL: process.env.BASE_URL || null,
};