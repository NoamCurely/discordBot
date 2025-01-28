require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const DISCORD_TOKEN = process.env.token_bot;

const CHANNEL_ID = process.env.channel_id;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  const channel = client.channels.cache.get(CHANNEL_ID);

  if (channel) {
    channel.send('Hello ! 👋 Ceci est un message automatique de mon bot Discord.');
  } else {
    console.error('Impossible de trouver le salon. Vérifiez le CHANNEL_ID.');
  }
});

client.login(DISCORD_TOKEN);

