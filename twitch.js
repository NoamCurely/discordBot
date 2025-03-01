const axios = require('axios');
const fs = require('fs');
const config = require('./config');
const express = require('express');
const { TWITCH_CLIEN_ID } = require('./config');

const app = express();
app.use(express.json());

// Chemin du fichier JSON pour stocker les abonnements
const SUBSCRIPTIONS_FILE = 'subscriptions.json';
let accessToken = '';

// Fonction pour obtenir un jeton d'accès Twitch
async function fetchTwitchAccessToken() {
  try {
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: config.TWITCH_CLIENT_ID,
        client_secret: config.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'user:read:email',
      },
    });
    accessToken = response.data.access_token;
    console.log('✅ Twitch Access Token obtenu');
    return accessToken;
  } catch (error) {
        console.log(config.TWITCH_CLIENT_ID);
    console.error('❌ Erreur lors de la récupération du token Twitch:', error.response?.data || error);
    return null;
  }
}

// Fonction pour charger les abonnements depuis le fichier JSON
function loadSubscriptions() {
  if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
    const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
    return JSON.parse(data);
  }
  return {}; // Retourne un objet vide si le fichier n'existe pas
}

// Fonction pour sauvegarder les abonnements dans le fichier JSON
function saveSubscriptions(subscriptions) {
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
  console.log('📜 Fichier des abonnements mis à jour.');
}

// Fonction pour récupérer les abonnements actifs sur Twitch
async function getActiveSubscriptions() {
  try {
    const response = await axios.get('https://api.twitch.tv/helix/eventsub/subscriptions', {
      headers: {
        'Client-Id': config.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.data; // Retourne la liste des abonnements actifs
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des abonnements actifs:', error.response?.data || error);
    return [];
  }
}

// Fonction pour récupérer les IDs des diffuseurs
async function getBroadcasterUserId(streamers) {
  try {
    const userInfo = [];
    for (const username of streamers) {
      const response = await axios.get('https://api.twitch.tv/helix/users', {
        params: { login: username },
        headers: {
          'Client-Id': config.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const userData = response.data.data[0];
      if (userData) {
        console.log(`✅ ID du diffuseur ${username}: ${userData.id}`);
        userInfo.push({
          userId: userData.id,
          username: username
        });
      } else {
        console.error(`❌ Diffuseur non trouvé pour ${username}`);
      }
    }
    return userInfo;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des IDs des diffuseurs:', error.response?.data || error);
    return [];
  }
}

async function getStreamDetails(broadcasterId) {
        try {
          console.log('🔍 Récupération des détails du stream pour l\'ID:', broadcasterId);
      
          // Vérifier si le token est valide, sinon le renouveler
          if (!accessToken) {
            console.warn('⚠️ Token absent, récupération en cours...');
            accessToken = await fetchTwitchAccessToken();
            if (!accessToken) {
              throw new Error('Impossible d\'obtenir un token Twitch.');
            }
          }
      
          const response = await axios.get('https://api.twitch.tv/helix/streams', {
            params: { user_id: broadcasterId },
            headers: {
              'Client-Id': config.TWITCH_CLIENT_ID,
              Authorization: `Bearer ${accessToken}`,
            },
          });
      
          console.log('📊 Réponse de l\'API Twitch:', JSON.stringify(response.data, null, 2));
      
          const streamData = response.data.data[0];
          if (streamData) {
            console.log(`📊 Détails du stream récupérés pour ${streamData.user_name}`);
            return {
              game_name: streamData.game_name,
              title: streamData.title,
              viewer_count: streamData.viewer_count,
              thumbnail_url: streamData.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
              started_at: streamData.started_at
            };
          } else {
            console.log(`⚠️ Aucun stream actif trouvé pour l'ID ${broadcasterId}`);
            return null;
          }
        } catch (error) {
          // Gérer le cas de token expiré
          if (error.response?.status === 401) {
            console.warn('⚠️ Token expiré, régénération en cours...');
            accessToken = await fetchTwitchAccessToken();
            return await getStreamDetails(broadcasterId); // Réessayer après renouvellement du token
          }
          console.error('❌ Erreur lors de la récupération des détails du stream:', error.response?.data || error);
          return null;
        }
      }

      app.post('/webhook/twitch', async (req, res) => {
        console.log('📩 Webhook Twitch reçu:', JSON.stringify(req.body, null, 2));
      
        const { challenge, subscription, event } = req.body;
      
        if (challenge) {
          console.log('🔗 Validation de Twitch reçue.');
          return res.send(challenge);
        }
      
        if (event && event.type === 'live') {
          console.log(`🔴 ${event.broadcaster_user_name} est en live !`);
          
          // Récupérer les détails complets du stream via l'API Twitch
          const streamDetails = await getStreamDetails(event.broadcaster_user_id);
          
          if (streamDetails) {
            console.log('📊 Détails complets du stream:');
            console.log(`Titre: ${streamDetails.title}`);
            console.log(`Jeu: ${streamDetails.game_name}`);
            console.log(`Viewers: ${streamDetails.viewer_count}`);
            console.log(`Thumbnail: ${streamDetails.thumbnail_url}`);
            
          } else {
            console.error(`❌ Impossible de récupérer les détails du stream pour ${event.broadcaster_user_name}`);
          }
        }
      
        res.sendStatus(200);
      });

// Fonction pour s'abonner aux événements Twitch
async function subscribeToTwitchEvents(callbackUrl, streamers) {
  try {
    // Charge les abonnements existants
    const subscriptions = loadSubscriptions();
    
    // Récupère les infos des diffuseurs
    const broadcasterInfo = await getBroadcasterUserId(streamers);
    if (broadcasterInfo.length === 0) {
      throw new Error('Aucun ID de diffuseur trouvé');
    }
    
    // S'abonne aux événements pour chaque nouveau diffuseur
    for (const { userId, username } of broadcasterInfo) {
      if (!subscriptions[userId]) {
        // Si le streamer n'est pas déjà abonné
        const response = await axios.post(
          'https://api.twitch.tv/helix/eventsub/subscriptions',
          {
            type: 'stream.online',
            version: '1',
            condition: { broadcaster_user_id: userId },
            transport: {
              method: 'webhook',
              callback: callbackUrl,
              secret: config.TWITCH_WEBHOOK_SECRET,
            },
          },
          {
            headers: {
              'Client-Id': config.TWITCH_CLIENT_ID,
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        // Ajoute le streamer aux abonnements
        subscriptions[userId] = {
          username: username,
          subscribedAt: new Date().toISOString(),
        };
        console.log(`✅ Abonnement réussi pour l'utilisateur ${username} (${userId})`);
      } else {
        console.log(`⚠️ L'utilisateur ${username} (${userId}) est déjà abonné.`);
      }
    }
    
    // Sauvegarde les abonnements mis à jour
    saveSubscriptions(subscriptions);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'abonnement aux événements Twitch:', error.response?.data || error);
    return false;
  }
}

// Fonction pour vérifier la signature Twitch
function verifyTwitchSignature(req) {
  const messageId = req.headers['twitch-eventsub-message-id'];
  const timestamp = req.headers['twitch-eventsub-message-timestamp'];
  const signature = req.headers['twitch-eventsub-message-signature'];
  
  if (!messageId || !timestamp || !signature) {
    console.error('❌ En-têtes de signature Twitch manquants');
    return false;
  }
  
  const crypto = require('crypto');
  const message = messageId + timestamp + JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', config.TWITCH_WEBHOOK_SECRET)
    .update(message)
    .digest('hex');
  
  const expectedSignature = `sha256=${hmac}`;
  
  if (signature !== expectedSignature) {
    console.error('❌ Signature Twitch invalide');
    return false;
  }
  
  return true;
}

// Fonction pour ajouter un nouveau streamer
function updateStreamers(action, username, streamersList) {
  try {
    let streamers = [...streamersList]; // Copie pour éviter de modifier l'original
    
    if (action === 'add') {
      if (!streamers.includes(username)) {
        streamers.push(username);
        console.log(`✅ Streamer ${username} ajouté à la liste.`);
      } else {
        console.log(`⚠️ Streamer ${username} est déjà dans la liste.`);
      }
    } else if (action === 'remove') {
      const index = streamers.indexOf(username);
      if (index !== -1) {
        streamers.splice(index, 1);
        console.log(`✅ Streamer ${username} supprimé de la liste.`);
      } else {
        console.log(`⚠️ Streamer ${username} non trouvé dans la liste.`);
      }
    }
    
    // Sauvegarde la liste mise à jour dans le fichier index.json
    fs.writeFileSync('./index.json', JSON.stringify({ twitch_username: streamers }, null, 2));
    
    return streamers;
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour de la liste de streamers:`, error);
    return streamersList; // Retourne la liste originale en cas d'erreur
  }
}

module.exports = {
  fetchTwitchAccessToken,
  subscribeToTwitchEvents,
  getStreamDetails,
  verifyTwitchSignature,
  updateStreamers,
  getActiveSubscriptions
};