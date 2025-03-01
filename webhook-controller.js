const twitchService = require('./twitch');
const discordService = require('./discord');

// Contrôleur pour gérer les webhooks Twitch
async function handleTwitchWebhook(req, res) {
  console.log('Webhook POST reçu', JSON.stringify(req.headers, null, 2));
  console.log('Contenu:', JSON.stringify(req.body, null, 2));
  
  const { challenge, subscription, event } = req.body;
  
  // Validation de l'URL du webhook (challenge envoyé par Twitch)
  if (challenge) {
    console.log('🔗 Validation de Twitch reçue, retour du challenge');
    return res.status(200).send(challenge);
  }
  
  // Vérifier la signature du webhook (sauf pour la vérification initiale)
  if (!challenge && !twitchService.verifyTwitchSignature(req)) {
    console.error('🛑 Signature webhook invalide');
    return res.status(403).send('Signature invalide');
  }
  
  // Vérification si le webhook est en attente de validation
  if (subscription?.status === 'webhook_callback_verification_pending') {
    console.log('🔗 Webhook en attente de validation...');
    return res.status(200).send('Ok');
  }
  
  // Gestion des événements Twitch (stream online)
  if (subscription?.type === 'stream.online' && event) {
    console.log(`🔴 ${event.broadcaster_user_name} est en live !`);
    
    try {
      // Récupère l'accessToken Twitch
      const accessToken = await twitchService.fetchTwitchAccessToken();
      if (!accessToken) {
        console.error('❌ Impossible de récupérer le token Twitch');
        return res.status(500).send('Erreur token');
      }
      
      // Récupère les détails du stream
      const streamDetails = await twitchService.getStreamDetails(event.broadcaster_user_id);
      
      // Envoie une notification sur Discord
      await discordService.sendDiscordNotification(event, streamDetails);
    } catch (error) {
      console.error('❌ Erreur lors du traitement du webhook:', error);
      return res.status(500).send('Erreur interne');
    }
  } else {
    console.log('⚠️ Aucun événement "stream.online" détecté ou données manquantes.');
  }
  
  res.status(200).send('Ok');
}

module.exports = {
  handleTwitchWebhook
};