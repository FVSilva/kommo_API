require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const baseDomain = process.env.BASE_DOMAIN;

let accessToken = process.env.ACCESS_TOKEN;
let refreshToken = process.env.REFRESH_TOKEN;

let tokenExpiresIn = 3600; // valor padrão em segundos (1h), pode ajustar conforme sua API

app.use(express.json());

async function renovarToken() {
  console.log('🔄 Renovando token...');
  try {
    const response = await axios.post(`https://${baseDomain}/oauth2/access_token`, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    tokenExpiresIn = response.data.expires_in || 3600; // pegar tempo que token expira, padrão 1h

    console.log('✅ Token renovado com sucesso!');
    console.log(`Token válido por ${tokenExpiresIn} segundos`);

    // Programar próxima renovação 60s antes de expirar
    setTimeout(renovarToken, (tokenExpiresIn - 60) * 1000);

  } catch (error) {
    if (error.response) {
      console.error(`❌ Erro ao renovar token: ${error.response.status} - ${error.response.data.error_description || error.response.data.error}`);
    } else {
      console.error('❌ Erro ao renovar token:', error.message);
    }
    // Tentar renovar de novo em 1 minuto para não travar o ciclo
    setTimeout(renovarToken, 60 * 1000);
  }
}

async function buscarLeads() {
  try {
    const response = await axios.get(`https://${baseDomain}/api/v4/leads`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Erro ao buscar leads: ${error.response.status} - ${error.response.data.error || error.response.data.message}`);
    } else {
      console.error('❌ Erro ao buscar leads:', error.message);
    }
    throw error;
  }
}

app.get('/leads', async (req, res) => {
  try {
    let leads = await buscarLeads();
    res.json(leads);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      try {
        await renovarToken();
        const leads = await buscarLeads();
        res.json(leads);
      } catch (error2) {
        res.status(500).json({ error: 'Erro ao renovar token e buscar leads.' });
      }
    } else {
      res.status(500).json({ error: 'Erro ao buscar leads.' });
    }
  }
});

// Ao iniciar o servidor, já renova o token e inicia o ciclo automático
renovarToken();

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
