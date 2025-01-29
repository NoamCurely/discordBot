require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const DISCORD_TOKEN = process.env.token_bot;
const CHANNEL_ID = process.env.channel_id;

const TWITCH_CLIENT_ID = process.env.twitch_client_id;
const TWITCH_CLIENT_SECRET = process.env.twitch_client_secret;
const TWITCH_USERNAME = process.env.twitch_username;

async function fetchTwitchAccessToken() {
  const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
  });

  accessToken = response.data.access_token;
  console.log('Twitch Access Token obtenu');
}

// Fonction pour vérifier si la chaîne est en live
async function checkIfChannelIsLive() {
  if (!accessToken) return;

  try {
    const response = await axios.get(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
      {
        headers: {
          'Client-Id': TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = response.data.data;

    if (data.length > 0) {
      // La chaîne est en live
      const stream = data[0];
      const channel = client.channels.cache.get(CHANNEL_ID);

      if (channel) {
        channel.send({
          content: `🔴 **${stream.user_name} est en live !**\nRegardez le stream ici : https://twitch.tv/${stream.user_name}\n**Titre :** ${stream.title}\n🎮 **Jeu :** ${stream.game_name}`,
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du live Twitch :', error);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/*client.once('ready', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  const channel = client.channels.cache.get(CHANNEL_ID);

  if (channel) {
    channel.send('Hello ! 👋 Ceci est un message automatique de mon bot Discord.');
  } else {
    console.error('Impossible de trouver le salon. Vérifiez le CHANNEL_ID.');
  }
});*/

client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);

  // Récupérer le token d'accès Twitch
  fetchTwitchAccessToken();

  // Vérifier régulièrement si la chaîne est en live (toutes les 5 minutes)
  setInterval(checkIfChannelIsLive, 5 * 60 * 1000);
});

client.login(DISCORD_TOKEN);

