const axios = require('axios');
const { exec } = require('child_process');

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

async function startNgrokIfNeeded() {
  let ngrokUrl = await getNgrokUrl();
  if (!ngrokUrl) {
    console.log("Lancement de ngrok...");
    exec('ngrok http 3000', (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ Erreur lors du lancement de Ngrok: ${err.message}`);
        return;
      }
      console.log(`🌍 Ngrok en cours d'exécution...`);
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    ngrokUrl = await getNgrokUrl();
  }
  return ngrokUrl;
}

module.exports = {
  startNgrokIfNeeded,
};
