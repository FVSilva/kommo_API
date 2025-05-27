require('dotenv').config();
const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const BASE_DOMAIN = process.env.BASE_DOMAIN;
const KOMMO_API_URL = `https://${BASE_DOMAIN}/api/v4`;

app.get('/leads', async (req, res) => {
  try {
    // 1. Buscar todos os campos personalizados
    const camposResponse = await axios.get(`${KOMMO_API_URL}/leads/custom_fields`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });

    const campos = camposResponse.data._embedded.custom_fields;

    // Criar um mapa de field_id => nome_do_campo
    const mapaCampos = {};
    campos.forEach(campo => {
      mapaCampos[campo.id] = campo.name;
    });

    // Lista com todos os nomes dos campos para garantir presença em todos os leads
    const nomesCampos = Object.values(mapaCampos);

    // 2. Buscar todos os leads com paginação (para garantir todos leads)
    let leads = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const leadsResponse = await axios.get(`${KOMMO_API_URL}/leads`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        params: { limit: 50, page }
      });

      const novosLeads = leadsResponse.data._embedded?.leads || [];
      leads = leads.concat(novosLeads);
      hasMore = novosLeads.length === 50;
      page++;
    }

    // 3. Formatar leads e garantir todos os campos
    const leadsFormatados = leads.map(lead => {
      const leadAchatado = {
        id: lead.id || '',
        name: lead.name || '',
        price: lead.price || '',
        status_id: lead.status_id || '',
        pipeline_id: lead.pipeline_id || '',
        created_at: lead.created_at ? new Date(lead.created_at * 1000).toISOString() : '',
        updated_at: lead.updated_at ? new Date(lead.updated_at * 1000).toISOString() : '',
      };

      // Inicializar todos os campos personalizados como vazios
      nomesCampos.forEach(nomeCampo => {
        leadAchatado[nomeCampo] = '';
      });

      // Preencher valores dos campos que o lead possui
      if (Array.isArray(lead.custom_fields_values)) {
        lead.custom_fields_values.forEach(campo => {
          const nomeCampo = mapaCampos[campo.field_id] || `Campo ${campo.field_id}`;
          const valor = Array.isArray(campo.values) && campo.values.length > 0
            ? campo.values.map(v => v.value || v.enum_id || '').join(', ')
            : '';
          leadAchatado[nomeCampo] = valor;
        });
      }

      return leadAchatado;
    });

    res.json({ leads: leadsFormatados });
  } catch (error) {
    console.error('Erro ao buscar leads:', error.message);
    res.status(500).json({ erro: 'Erro ao buscar os dados dos leads.' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
