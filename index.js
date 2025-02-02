require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const DISCORD_TOKEN = process.env.token_bot;
const CHANNEL_ID = process.env.channel_id;
const TWITCH_CLIENT_ID = process.env.twitch_client_id;
const TWITCH_CLIENT_SECRET = process.env.twitch_client_secret;
const TWITCH_USERNAME = process.env.twitch_username;
let CALLBACK_URL = process.env.callback_url; // URL publique mise à jour par Ngrok
let accessToken = '';

// Initialisation du bot Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Fonction pour obtenir le jeton d'accès Twitch
async function fetchTwitchAccessToken() {
  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      },
    });

    accessToken = response.data.access_token;
    console.log('✅ Twitch Access Token obtenu');
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du token Twitch:', error.response?.data || error);
  }
}

// Fonction pour récupérer l'ID du diffuseur Twitch
async function getBroadcasterUserId() {
  try {
    const response = await axios.get('https://api.twitch.tv/helix/users', {
      params: { login: TWITCH_USERNAME },
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const userId = response.data.data[0]?.id;
    if (userId) {
      console.log(`✅ ID du diffuseur ${TWITCH_USERNAME}: ${userId}`);
      return userId;
    } else {
      throw new Error('Diffuseur non trouvé');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de l\'ID du diffuseur:', error.response?.data || error);
    return null;
  }
}

// Fonction pour supprimer toutes les souscriptions Twitch existantes
async function clearExistingSubscriptions() {
  try {
    const response = await axios.get('https://api.twitch.tv/helix/eventsub/subscriptions', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    });

    for (const sub of response.data.data) {
      console.log(`🗑️ Suppression de la souscription: ${sub.id}`);
      await axios.delete(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': TWITCH_CLIENT_ID,
        },
      });
    }
    console.log('✅ Toutes les souscriptions ont été supprimées.');
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des souscriptions:', error.response?.data || error);
  }
}

// Fonction pour s'abonner aux événements Twitch
async function subscribeToTwitchEvents() {
  const broadcasterUserId = await getBroadcasterUserId();
  if (!broadcasterUserId) return;

  await clearExistingSubscriptions();

  try {
    const response = await axios.post(
      'https://api.twitch.tv/helix/eventsub/subscriptions',
      {
        type: 'stream.online',
        version: '1',
        condition: { broadcaster_user_id: broadcasterUserId },
        transport: {
          method: 'webhook',
          callback: CALLBACK_URL,
          secret: process.env.twitch_webhook_secret,
        },
      },
      {
        headers: {
          'Client-Id': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ Abonnement aux événements Twitch réussi:', response.data);
  } catch (error) {
    console.error('❌ Erreur lors de la souscription aux événements Twitch:', error.response?.data || error);
  }
}

app.post('/webhook/twitch', async (req, res) => {
  console.log('Webhook POST reçu', JSON.stringify(req.body, null, 2)); // Affiche la structure complète de la réponse de Twitch

  const { challenge, subscription, event } = req.body;

  // Validation de l'URL du webhook (challenge envoyé par Twitch)
  if (challenge) {
    console.log('🔗 Validation de Twitch reçue.');
    return res.send(challenge);
  }

  // Si la souscription est en statut "pending" (en attente de validation)
  if (subscription && subscription.status === 'webhook_callback_verification_pending') {
    console.log('🔗 Webhook est en attente de validation...');
    return res.sendStatus(200); // Attends la validation de Twitch
  }

  // Si l'événement est de type "live" (stream en direct)
  if (subscription && event && event.type === 'live') {
    console.log(`🔴 ${event.broadcaster_user_name} est en live !`);

    // Envoie la notification sur Discord
    /*if (channel) {
      channel.send(`🔴 **${event.broadcaster_user_name} est en live !**\n🎥 Regardez ici : https://twitch.tv/${event.broadcaster_user_login}`);
    } else {
      console.error("❌ Impossible de trouver le canal Discord.");
    }*/
    const channel = client.channels.cache.get(CHANNEL_ID);
      if (channel) {
        const streamTitle = event.title || "Live en cours !"; // Récupère le titre du live
        const streamUrl = `https://www.twitch.tv/${event.broadcaster_user_login}`;

        const message = `@everyone ${event.broadcaster_user_name} part en live Minecraft juste ici ${streamUrl} !\n` +
                  `${streamTitle} @imozne_ !discord !config !setup`;

        channel.send(message);
      } else {
          console.error("❌ Impossible de trouver le canal Discord.");
        }

  } else {
    console.log('❌ Aucun événement en direct détecté ou données manquantes:', subscription, event);
  }

  res.sendStatus(200);
});

// Fonction pour vérifier si ngrok est déjà en cours d'exécution
async function getNgrokUrl() {
  try {
    const { data } = await axios.get('http://localhost:4040/api/tunnels');
    if (data.tunnels && data.tunnels.length > 0) {
      return data.tunnels[0].public_url;
    } else {
      throw new Error('Aucun tunnel Ngrok actif trouvé.');
    }
  } catch (error) {
    console.error('❌ Impossible de récupérer l\'URL de Ngrok:', error.message);
    return null;
  }
}

// Fonction pour lancer Ngrok si nécessaire
async function startNgrokIfNeeded() {
  let ngrokUrl = await getNgrokUrl();
  if (!ngrokUrl) {
    // Lancer Ngrok si aucun tunnel actif
    console.log("Lancement de ngrok...");
    exec('ngrok http 3000', (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ Erreur lors du lancement de Ngrok: ${err.message}`);
        return;
      }
      console.log(`🌍 Ngrok en cours d'exécution...`);
    });

    // Attendre 5 secondes pour que ngrok démarre
    await new Promise(resolve => setTimeout(resolve, 5000));
    ngrokUrl = await getNgrokUrl();
  }
  return ngrokUrl;
}

// Lancer Ngrok et mettre à jour l'URL de callback
startNgrokIfNeeded().then(async (url) => {
  if (url) {
    CALLBACK_URL = `${url}/webhook/twitch`;
    console.log(`🚀 Nouvelle URL Webhook: ${CALLBACK_URL}`);

    await fetchTwitchAccessToken();
    await subscribeToTwitchEvents();
  }
});

// Connexion au bot Discord
client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

// Démarrer le bot Discord
client.login(DISCORD_TOKEN);

// Lancer le serveur Express
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur webhook lancé sur le port ${PORT}`);
});

