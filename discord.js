const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DISCORD_TOKEN, CHANNEL_ID, ROLE_ID } = require('./config');
const { getStreamDetails } = require('./twitch'); // Importez la fonction getStreamDetails

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

async function sendDiscordNotification(event) {
  if (!client.isReady()) {
    console.error('❌ Le bot Discord n\'est pas encore prêt.');
    return;
  }

  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) {
    console.error("❌ Impossible de trouver le canal Discord.");
    return;
  }

  try {
    console.log('Event reçu:', JSON.stringify(event, null, 2));

    // Récupérez les détails supplémentaires du stream via l'API Twitch
    const streamDetails = await getStreamDetails(event.broadcaster_user_id);
    if (!streamDetails) {
      console.error('❌ Impossible de récupérer les détails du stream.');
      return;
    }

    // Combinez les données du webhook et de l'API
    const combinedEvent = {
      ...event,
      title: streamDetails.title,
      game_name: streamDetails.game_name,
      viewer_count: streamDetails.viewer_count,
      thumbnail_url: streamDetails.thumbnail_url,
      started_at: streamDetails.started_at
    };

    console.log('Données combinées:', JSON.stringify(combinedEvent, null, 2));

    const streamTitle = combinedEvent.title;
    const streamUrl = `https://www.twitch.tv/${combinedEvent.broadcaster_user_login}`;
    const gameName = combinedEvent.game_name;

    const embed = new EmbedBuilder()
      .setColor('#9146FF')
      .setTitle(`${streamTitle}`)
      .setURL(streamUrl)
      .setDescription(`${combinedEvent.broadcaster_user_name} est en live !`)
      .addFields(
        { name: 'Jeux', value: `🎮 **${gameName}**`, inline: true },
      )
      .setImage(combinedEvent.thumbnail_url)
      .setFooter({ text: `Stream commencé à ${new Date(combinedEvent.started_at).toLocaleTimeString()}` });

    await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [embed] });
    console.log('✅ Notification Discord envoyée avec succès.');
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de la notification Discord:', error);
  }
}

client.login(DISCORD_TOKEN);

module.exports = {
  sendDiscordNotification,
};