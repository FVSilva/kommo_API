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
    // 1. Buscar campos personalizados
    const camposResponse = await axios.get(`${KOMMO_API_URL}/leads/custom_fields`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const campos = camposResponse.data._embedded.custom_fields;

    const camposValidos = campos.map(c => c.id);
    const mapaCampos = {};
    campos.forEach(campo => {
      mapaCampos[campo.id] = campo.name;
    });

    // 2. Buscar pipelines e mapear status_id para pipeline e nome do status
    const statusResponse = await axios.get(`${KOMMO_API_URL}/leads/pipelines`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const pipelines = statusResponse.data._embedded.pipelines;

    const statusInfoMap = {};
    pipelines.forEach(pipeline => {
      pipeline._embedded.statuses.forEach(status => {
        statusInfoMap[status.id] = {
          pipeline_name: pipeline.name,
          status_name: status.name
        };
      });
    });

    // 3. Paginar leads
    let leads = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const leadsResponse = await axios.get(`${KOMMO_API_URL}/leads`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        params: { limit: 50, page: page }
      });

      const novosLeads = leadsResponse.data._embedded?.leads || [];
      leads = leads.concat(novosLeads);
      hasMore = novosLeads.length === 50;
      page++;
    }

    // 4. Formatar os leads
    const leadsFormatados = leads.map(lead => {
      const statusInfo = statusInfoMap[lead.status_id] || {
        pipeline_name: 'Desconhecido',
        status_name: 'Desconhecido'
      };

      const leadAchatado = {
        id: lead.id || '',
        name: lead.name || '',
        price: lead.price || '',
        status_id: lead.status_id || '',
        pipeline_name: statusInfo.pipeline_name,
        status_name: statusInfo.status_name,
        created_at: lead.created_at ? new Date(lead.created_at * 1000).toISOString() : '',
        updated_at: lead.updated_at ? new Date(lead.updated_at * 1000).toISOString() : '',
      };

      if (Array.isArray(lead.custom_fields_values)) {
        lead.custom_fields_values.forEach(campo => {
          if (camposValidos.includes(campo.field_id)) {
            const nomeCampo = mapaCampos[campo.field_id] || `Campo ${campo.field_id}`;
            const valor = Array.isArray(campo.values)
              ? campo.values.map(v => v.value || v.enum_id || '').join(', ')
              : '';
            leadAchatado[nomeCampo] = valor;
          }
        });
      }

      return leadAchatado;
    });

    res.json(leadsFormatados);
  } catch (error) {
    console.error('Erro ao buscar leads:', error.message);
    res.status(500).json({ erro: 'Erro ao buscar os dados dos leads.' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
