const express = require('express');
const fs = require('fs');
const connectDB = require('./connection');
const config = require('./config');
const { startNgrokIfNeeded } = require('./ngrok');
const { fetchTwitchAccessToken, subscribeToTwitchEvents, updateStreamers } = require('./twitch');
const { handleTwitchWebhook } = require('./webhook-controller');

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Récupérer la liste des streamers
function getStreamers() {
  try {
    const data = fs.readFileSync('./index.json', 'utf8');
    const { twitch_username } = JSON.parse(data);
    return twitch_username || [];
  } catch (error) {
    console.error('❌ Erreur lors de la lecture de index.json:', error);
    return [];
  }
}

// Route pour le webhook Twitch
app.post('/webhook/twitch', handleTwitchWebhook);

// Route pour ajouter un nouveau streamer
app.post('/add-streamer', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).send('Le nom d\'utilisateur est requis.');
  }

  try {
    const streamers = getStreamers();
    const updatedStreamers = updateStreamers('add', username, streamers);
    
    // Réabonnement aux webhooks pour inclure le nouveau streamer
    const callbackUrl = `${global.baseUrl}/webhook/twitch`;
    await subscribeToTwitchEvents(callbackUrl, updatedStreamers);
    
    res.status(200).send(`Streamer ${username} ajouté avec succès.`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout du streamer:', error);
    res.status(500).send('Erreur lors de l\'ajout du streamer.');
  }
});

// Route pour supprimer un streamer
app.delete('/remove-streamer', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).send('Le nom d\'utilisateur est requis.');
  }

  try {
    const streamers = getStreamers();
    const updatedStreamers = updateStreamers('remove', username, streamers);
    res.status(200).send(`Streamer ${username} supprimé avec succès.`);
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du streamer:', error);
    res.status(500).send('Erreur lors de la suppression du streamer.');
  }
});

// Route pour vérifier l'état du serveur
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Fonction pour démarrer l'application
async function startApp() {
  try {
    // Connecter à la base de données
    await connectDB();
    
    // Démarre Ngrok et récupère l'URL publique
    const ngrokUrl = await startNgrokIfNeeded();
    const baseUrl = ngrokUrl || config.BASE_URL;
    
    if (!baseUrl) {
        console.log(config.BASE_URL);
      throw new Error('❌ Aucune URL de base disponible. Configurez BASE_URL ou activez Ngrok.');
    }
    
    // Stocke l'URL de base pour une utilisation globale
    global.baseUrl = baseUrl;
    
    // Construit l'URL de callback pour le webhook
    const callbackUrl = `${baseUrl}/webhook/twitch`;
    console.log(`🚀 Nouvelle URL Webhook: ${callbackUrl}`);

    // Récupère le token Twitch
    const accessToken = await fetchTwitchAccessToken();
    if (!accessToken) {
      throw new Error('❌ Impossible de récupérer le token Twitch');
    }

    // S'abonne aux événements Twitch
    const streamers = getStreamers();
    await subscribeToTwitchEvents(callbackUrl, streamers);

    // Démarre le serveur Express
    app.listen(config.PORT, '0.0.0.0', () => {
      console.log(`✅ Serveur webhook lancé sur le port ${config.PORT}`);
      console.log(`🌐 URL de base: ${baseUrl}`);
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage de l\'application:', error.message);
    process.exit(1); // Quitte l'application en cas d'erreur critique
  }
}

// Démarre l'application
startApp();