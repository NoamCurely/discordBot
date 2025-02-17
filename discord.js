const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DISCORD_TOKEN, CHANNEL_ID } = require('./config');
const embed = new EmbedBuilder();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

const roleId = process.env.role_id;

function sendDiscordNotification(event) {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel) {
        console.log('Event reçu:', JSON.stringify(event, null, 2));
          const streamTitle = event.title;
          const streamUrl = `https://www.twitch.tv/${event.broadcaster_user_login}`;
          const gameName = event.game_name || "Un jeu génial !";
      
          const embed = new EmbedBuilder()
            .setColor('#9146FF') // Couleur Twitch
            .setTitle(`${streamTitle}`)
            .setURL(streamUrl)
            .setDescription(`${event.broadcaster_user_name} est en live !`)
            .addFields({ name: '\u200B', value: `🎮 **${gameName}**`, inline: true })
            .setImage(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${event.broadcaster_user_login}-640x360.jpg`);
      
          // Envoi du message avec l'embed
          channel.send({ content: '<@&${roleId}>', embeds: [embed] });
        } else {
          console.error("❌ Impossible de trouver le canal Discord.");
        }
      }
      
client.login(DISCORD_TOKEN);

module.exports = {
  sendDiscordNotification,
};
