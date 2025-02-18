const axios = require('axios');
const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = require('./config');
const { twitch_username } = require('./index.json');

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
    return accessToken;  // Retourne le token pour une utilisation immédiate
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du token Twitch:', error.response?.data || error);
    return null;
  }
}

/*async function getBroadcasterUserId() {
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
    console.error(`❌ Erreur lors de la récupération de l\'ID du diffuseur:${TWITCH_USERNAME}`, error.response?.data || error);
    return null;
  }
}*/

async function getBroadcasterUserId() {
  try {
    const userIds = [];
    for (const username of twitch_username) {  // Parcours tous les streamers du JSON
      const response = await axios.get('https://api.twitch.tv/helix/users', {
        params: { login: username },
        headers: {
          'Client-Id': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const userId = response.data.data[0]?.id;
      if (userId) {
        console.log(`✅ ID du diffuseur ${username}: ${userId}`);
        userIds.push(userId);
      } else {
        console.error(`❌ Diffuseur non trouvé pour ${username}`);
      }
    }
    return userIds;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des IDs des diffuseurs:', error.response?.data || error);
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

/*async function subscribeToTwitchEvents(callbackUrl) {
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
}*/

async function subscribeToTwitchEvents(callbackUrl) {
  const broadcasterUserIds = await getBroadcasterUserId();
  if (!broadcasterUserIds || broadcasterUserIds.length === 0) return;

  await clearExistingSubscriptions();

  for (const broadcasterUserId of broadcasterUserIds) {
    try {
      console.log(`🔄 Abonnement en cours pour l'ID: ${broadcasterUserId}`);

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

      console.log(`✅ Abonnement réussi pour ${broadcasterUserId}:`, response.data);
    } catch (error) {
      console.error(`❌ Erreur lors de la souscription pour ${broadcasterUserId}:`, error.response?.data || error);
    }

    // 🔴 Ajoute une pause pour éviter de spammer Twitch (2 secondes)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Exporte les éléments nécessaires
module.exports = {
  fetchTwitchAccessToken,
  getBroadcasterUserId,
  clearExistingSubscriptions,
  subscribeToTwitchEvents,
  accessToken, // Exporte l'accessToken pour une utilisation ailleurs
};
