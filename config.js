require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DISCORD_TOKEN: process.env.token_bot,
  CHANNEL_ID: process.env.channel_id,
  TWITCH_CLIENT_ID: process.env.twitch_client_id,
  TWITCH_CLIENT_SECRET: process.env.twitch_client_secret,
  TWITCH_USERNAME: process.env.twitch_username,
  TWITCH_WEBHOOK_SECRET: process.env.twitch_webhook_secret,
  CALLBACK_URL: process.env.callback_url,
};
