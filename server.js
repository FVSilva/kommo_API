require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const baseDomain = process.env.BASE_DOMAIN;

const tokensFilePath = path.join(__dirname, 'tokens.json');

app.use(express.json());

// ---------- Gerenciamento de Token ----------

function salvarTokens(access_token, refresh_token, expires_in) {
  const expires_at = Date.now() + expires_in * 1000;
  const tokenData = { access_token, refresh_token, expires_at };
  fs.writeFileSync(tokensFilePath, JSON.stringify(tokenData, null, 2));
}

function carregarTokens() {
  if (fs.existsSync(tokensFilePath)) {
    const data = fs.readFileSync(tokensFilePath);
    return JSON.parse(data);
  }
  return { access_token: null, refresh_token: null, expires_at: 0 };
}

async function renovarToken() {
  const { refresh_token } = carregarTokens();
  console.log('🔄 Renovando token...');

  try {
    const response = await axios.post(`https://${baseDomain}/oauth2/access_token`, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token,
      redirect_uri: redirectUri,
    }, {
      headers: { 'Content-Type': 'application/json' },
    });

    const { access_token, refresh_token: novoRefresh, expires_in } = response.data;
    salvarTokens(access_token, novoRefresh, expires_in);
    console.log(`✅ Token renovado com sucesso! Válido por ${expires_in} segundos.`);
  } catch (error) {
    console.error('❌ Erro ao renovar token:', error.response?.data || error.message);
    throw error;
  }
}

// ---------- API ----------

async function buscarLeads() {
  const { access_token } = carregarTokens();

  try {
    const response = await axios.get(`https://${baseDomain}/api/v4/leads`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

// ---------- Rotas ----------

app.get('/leads', async (req, res) => {
  try {
    const leads = await buscarLeads();
    res.json(leads);
  } catch (error) {
    if (error.response?.status === 401) {
      try {
        await renovarToken();
        const leads = await buscarLeads();
        res.json(leads);
      } catch {
        res.status(500).json({ error: 'Erro ao renovar token e buscar leads.' });
      }
    } else {
      res.status(500).json({ error: 'Erro ao buscar leads.' });
    }
  }
});

app.get('/refresh-token', async (req, res) => {
  try {
    await renovarToken();
    res.send('Token renovado com sucesso.');
  } catch (err) {
    res.status(500).send('Erro ao renovar token.');
  }
});

// ---------- Timer automático para renovar token ----------

setInterval(async () => {
  const { expires_at } = carregarTokens();
  const tempoRestante = expires_at - Date.now();

  if (tempoRestante < 15 * 60 * 1000) { // menos de 15 minutos
    console.log('⏰ Token quase expirando. Renovando...');
    try {
      await renovarToken();
    } catch (err) {
      console.error('⚠️ Erro ao renovar token automaticamente.');
    }
  }
}, 10 * 60 * 1000); // verifica a cada 10 minutos

// ---------- Inicialização ----------

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
