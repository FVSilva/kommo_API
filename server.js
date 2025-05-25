require('dotenv').config();
const express = require('express');
const { fetch } = globalThis; // ✅
const app = express();

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const refreshToken = process.env.REFRESH_TOKEN;
const baseDomain = process.env.BASE_DOMAIN; // Ex: munizeco.amocrm.com

let accessToken = null;

// Função para atualizar o token usando refresh_token
async function refreshAccessToken() {
  try {
    const response = await fetch(`https://${baseDomain}/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao renovar token: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    console.log('✅ Novo token obtido com sucesso.');
  } catch (error) {
    console.error('❌ Erro ao renovar token:', error.message);
  }
}

// Middleware para garantir token atualizado
async function ensureToken(req, res, next) {
  if (!accessToken) {
    console.log('🔄 Token não encontrado. Renovando...');
    await refreshAccessToken();
  }
  next();
}

// Endpoint para retornar os leads
app.get('/leads', ensureToken, async (req, res) => {
  try {
    const response = await fetch(`https://${baseDomain}/api/v4/leads`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar leads: ${response.status}`);
    }

    const data = await response.json();
    res.json(data); // Power BI vai usar esse JSON
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza token automaticamente a cada 25 min (precaução)
setInterval(() => {
  console.log('🔄 Atualizando token...');
  refreshAccessToken();
}, 1000 * 60 * 25);

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  await refreshAccessToken(); // Inicializa com o token
});
