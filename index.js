require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const DISCORD_TOKEN = process.env.token_bot;
const CHANNEL_ID = process.env.channel_id;
const TWITCH_CLIENT_ID = process.env.twitch_client_id;
const TWITCH_CLIENT_SECRET = process.env.twitch_client_secret;
const TWITCH_USERNAME = process.env.twitch_username;
const CALLBACK_URL = process.env.callback_url; // URL publique (ex: ngrok)
let accessToken = '';

// Initialisation du client Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Fonction pour obtenir le jeton d'accès Twitch
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

// Fonction pour vérifier les souscriptions existantes
async function checkExistingSubscriptions() {
  try {
    const response = await axios.get(
      'https://api.twitch.tv/helix/eventsub/subscriptions',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': TWITCH_CLIENT_ID,
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des souscriptions :', error);
    return [];
  }
}

// Fonction pour supprimer une souscription existante
async function deleteSubscription(subscriptionId) {
  try {
    const response = await axios.delete(
      `https://api.twitch.tv/helix/eventsub/subscriptions`,
      {
        data: {
          id: subscriptionId,
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': TWITCH_CLIENT_ID,
        },
      }
    );
    console.log('Souscription supprimée avec succès:', response.data);
  } catch (error) {
    console.error('Erreur lors de la suppression de la souscription :', error);
  }
}

async function getBroadcasterUserId() {
  try {
    const response = await axios.get('https://api.twitch.tv/helix/users', {
      params: {
        login: TWITCH_USERNAME, // Nom d'utilisateur Twitch
      },
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    const userId = response.data.data[0]?.id; // L'ID du diffuseur
    if (userId) {
      console.log(`ID du diffuseur ${TWITCH_USERNAME}: ${userId}`);
      return userId;
    } else {
      throw new Error('Diffuseur non trouvé');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'ID du diffuseur :', error);
    return null;
  }
}


async function subscribeToTwitchEvents() {
  const broadcasterUserId = await getBroadcasterUserId(); // Récupère l'ID du diffuseur
  if (!broadcasterUserId) {
    console.error("Impossible de récupérer l'ID du diffuseur.");
    return;
  }

  // Vérifier les souscriptions existantes
  const existingSubscriptions = await checkExistingSubscriptions();
  const existingSubscription = existingSubscriptions.find(
    (sub) => sub.condition.broadcaster_user_id === broadcasterUserId
  );

  if (existingSubscription) {
    console.log('Souscription existante trouvée, suppression en cours...');
    await deleteSubscription(existingSubscription.id);
  }

  // Créer une nouvelle souscription
  try {
    const response = await axios.post(
      'https://api.twitch.tv/helix/eventsub/subscriptions',
      {
        type: 'stream.online',
        version: '1',
        condition: { broadcaster_user_id: broadcasterUserId }, // Utilise l'ID du diffuseur
        transport: {
          method: 'webhook',
          callback: CALLBACK_URL,
          secret: process.env.twitch_webhook_secret, // Clé secrète pour valider la signature
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
    console.log('Abonnement aux événements Twitch réussi:', response.data);
  } catch (error) {
    console.error('Erreur lors de la souscription aux événements Twitch:', error.response.data);
  }
}

// Fonction pour gérer la validation du webhook (challenge)
app.post('/webhook/twitch', async (req, res) => {
  const { challenge, subscription, event } = req.body;

  // Étape de validation de Twitch (vérification du challenge)
  if (challenge) {
    console.log('Validation de Twitch reçue.');
    return res.send(challenge); // Renvoi du challenge pour confirmer la connexion du webhook
  }

  // Vérifie si l'événement correspond à un stream en ligne
  if (subscription && event && event.type === 'stream.online') {
    console.log(`🔴 ${event.broadcaster_user_name} est en live !`);

    // Envoi d'un message sur Discord
    const channel = client.channels.cache.get(CHANNEL_ID);

    if (channel) {
      channel.send(
        `🔴 **${event.broadcaster_user_name} est en live !**\nRegardez ici : https://twitch.tv/${event.broadcaster_user_name}`
      );
    }
  }

  res.sendStatus(200); // Réponse à Twitch pour confirmer la réception du message
});

// Connexion du bot Discord et abonnement aux événements Twitch
client.once('ready', async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  await fetchTwitchAccessToken();
  await subscribeToTwitchEvents();
});

// Connexion du bot Discord
client.login(DISCORD_TOKEN);

// Lancer le serveur pour recevoir les notifications webhook
app.listen(PORT, () => console.log(`Serveur webhook lancé sur le port ${PORT}`));

