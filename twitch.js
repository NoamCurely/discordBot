const axios = require('axios');
const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_USERNAME } = require('./config');

let accessToken = '';

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

async function subscribeToTwitchEvents(callbackUrl) {
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
          callback: callbackUrl,
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

module.exports = {
  fetchTwitchAccessToken,
  subscribeToTwitchEvents,
};
