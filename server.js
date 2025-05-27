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
    // Buscar todos os campos personalizados
    const camposResponse = await axios.get(`${KOMMO_API_URL}/leads/custom_fields`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    });
    const mapaCampos = {};
    camposResponse.data._embedded.custom_fields.forEach(campo => {
      mapaCampos[campo.id] = campo.name;
    });

    // Buscar todos os pipelines e status para mapear nomes
    const pipelinesResponse = await axios.get(`${KOMMO_API_URL}/leads/pipelines`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    });

    const pipelineMap = {};
    const statusMap = {};
    pipelinesResponse.data._embedded.pipelines.forEach(pipeline => {
      pipelineMap[pipeline.id] = pipeline.name;
      pipeline.statuses.forEach(status => {
        statusMap[status.id] = status.name;
      });
    });

    // Paginar todos os leads
    const todosLeads = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const leadsResponse = await axios.get(`${KOMMO_API_URL}/leads`, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`
        },
        params: {
          limit: 250,
          page
        }
      });

      const leads = leadsResponse.data._embedded.leads;
      todosLeads.push(...leads);
      hasMore = leads.length === 250;
      page++;
    }

    // Formatar os leads
    const leadsFormatados = todosLeads.map(lead => {
      const leadAchatado = {
        id: lead.id || '',
        name: lead.name || '',
        price: lead.price || '',
        status_id: lead.status_id || '',
        status_name: statusMap[lead.status_id] || '',
        pipeline_id: lead.pipeline_id || '',
        pipeline_name: pipelineMap[lead.pipeline_id] || '',
        created_at: lead.created_at ? new Date(lead.created_at * 1000).toISOString() : '',
        updated_at: lead.updated_at ? new Date(lead.updated_at * 1000).toISOString() : '',
      };

      if (Array.isArray(lead.custom_fields_values)) {
        lead.custom_fields_values.forEach(campo => {
          const nomeCampo = mapaCampos[campo.field_id] || `Campo ${campo.field_id}`;
          const valor = Array.isArray(campo.values)
            ? campo.values.map(v => v.value || v.enum_id || '').join(', ')
            : '';
          leadAchatado[nomeCampo] = valor;
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
