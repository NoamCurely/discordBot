const { Client, GatewayIntentBits } = require('discord.js');
const { DISCORD_TOKEN, CHANNEL_ID } = require('./config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

function sendDiscordNotification(event) {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (channel) {
    const streamTitle = event.title || "Live en cours !";
    const streamUrl = `https://www.twitch.tv/${event.broadcaster_user_login}`;

    const message = `@everyone ${event.broadcaster_user_name} part en live Minecraft juste ici ${streamUrl} !\n` +
                    `${streamTitle} @imozne_ !discord !config !setup`;

    channel.send(message);
  } else {
    console.error("❌ Impossible de trouver le canal Discord.");
  }
}

client.login(DISCORD_TOKEN);

module.exports = {
  sendDiscordNotification,
};
