require('dotenv').config();
const express = require('express');
const { startNgrokIfNeeded } = require('./ngrok');
const { fetchTwitchAccessToken, subscribeToTwitchEvents, getBroadcasterUserId } = require('./twitch');
const { sendDiscordNotification } = require('./discord');
const { PORT } = require('./config');
const axios = require('axios');
const { TWITCH_CLIENT_ID } = require('./config');

// Initialisation du serveur Express
const app = express();
app.use(express.json());

// Route pour le webhook Twitch
app.post('/webhook/twitch', async (req, res) => {
  console.log('Webhook POST reçu', JSON.stringify(req.body, null, 2));

  const { challenge, subscription, event } = req.body;

  // Validation de l'URL du webhook (challenge envoyé par Twitch)
  if (challenge) {
    console.log('🔗 Validation de Twitch reçue.');
    return res.send(challenge);
  }

  // Si la souscription est en attente de validation
  if (subscription && subscription.status === 'webhook_callback_verification_pending') {
    console.log('🔗 Webhook est en attente de validation...');
    return res.sendStatus(200);
  }

  // Si l'événement est de type "live" (stream en direct)
  if (subscription && event && event.type === 'live') {
    console.log(`🔴 ${event.broadcaster_user_name} est en live !`);

    // Récupère l'accessToken
    const accessToken = await fetchTwitchAccessToken();

    if (!accessToken) {
      console.error('❌ Impossible de récupérer le token Twitch');
      return res.sendStatus(500);
    }

    // Récupère les détails supplémentaires du stream
    const streamDetails = await getStreamDetails(event.broadcaster_user_id, accessToken);
    if (streamDetails) {
      event.game_name = streamDetails.game_name; // Ajoute le nom du jeu à l'événement
      event.title = streamDetails.title;
    }

    sendDiscordNotification(event); // Envoie la notification sur Discord
  } else {
    console.log('❌ Aucun événement en direct détecté ou données manquantes:', subscription, event);
  }

  res.sendStatus(200);
});

// Fonction pour récupérer les détails du stream
async function getStreamDetails(broadcasterUserId, accessToken) {
  try {
    const response = await axios.get('https://api.twitch.tv/helix/streams', {
      params: { user_id: broadcasterUserId },
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.data.data.length > 0) {
      return response.data.data[0]; // Retourne les détails du stream
    } else {
      throw new Error('Aucun stream en cours trouvé.');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des détails du stream:', error.response?.data || error);
    return null;
  }
}

// Fonction pour démarrer l'application
async function startApp() {
  // Démarre Ngrok et récupère l'URL publique
  const ngrokUrl = await startNgrokIfNeeded();
  if (ngrokUrl) {
    const callbackUrl = `${ngrokUrl}/webhook/twitch`;
    console.log(`🚀 Nouvelle URL Webhook: ${callbackUrl}`);

    // Récupère le token Twitch et s'abonne aux événements
    await fetchTwitchAccessToken();
    await subscribeToTwitchEvents(callbackUrl);
  }

  // Démarre le serveur Express
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Serveur webhook lancé sur le port ${PORT}`);
  });
}

// Démarre l'application
startApp();
