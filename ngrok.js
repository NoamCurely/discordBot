const axios = require('axios');
const { spawn } = require('child_process');

async function getNgrokUrl() {
  try {
    console.log("🔍 Vérification de l'URL Ngrok...");
    const { data } = await axios.get('http://127.0.0.1:4040/api/tunnels'); // Utiliser IPv4
    if (data.tunnels && data.tunnels.length > 0) {
      console.log("✅ Ngrok trouvé:", data.tunnels[0].public_url);
      return data.tunnels[0].public_url;
    } else {
      console.warn("⚠️ Aucun tunnel Ngrok actif trouvé.");
      return null;
    }
  } catch (error) {
    console.error('❌ Impossible de récupérer l\'URL de Ngrok:', error.message);
    return null;
  }
}

async function startNgrokIfNeeded() {
  let ngrokUrl = await getNgrokUrl();
  
  if (!ngrokUrl) {
    console.log("🚀 Lancement de Ngrok...");
    
    const ngrokProcess = spawn('ngrok', ['http', '3000'], {
      detached: true,
      stdio: 'ignore'
    });

    ngrokProcess.unref(); // Laisse tourner Ngrok en arrière-plan

    console.log("⏳ Attente que Ngrok soit prêt...");
    await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5s

    ngrokUrl = await getNgrokUrl();
    if (!ngrokUrl) {
      console.error("❌ Ngrok n'a pas réussi à démarrer.");
    }
  }
  
  return ngrokUrl;
}

module.exports = {
  startNgrokIfNeeded,
};