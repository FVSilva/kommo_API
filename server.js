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
    const mapaCampos = {};
    campos.forEach(campo => {
      mapaCampos[campo.id] = campo.name;
    });

    // 2. Buscar pipelines e status para mapear nomes das etapas
    const pipelinesResponse = await axios.get(`${KOMMO_API_URL}/leads/pipelines`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });

    const pipelines = pipelinesResponse.data._embedded.pipelines;
    const statusMap = {}; // status_id -> { pipeline_name, status_name }
    pipelines.forEach(pipeline => {
      pipeline._embedded.statuses.forEach(status => {
        statusMap[status.id] = {
          pipeline_name: pipeline.name,
          status_name: status.name
        };
      });
    });

    // 3. Buscar todos os leads com paginação completa
    let todosLeads = [];
    let page = 1;
    let temMais = true;

    while (temMais) {
      console.log(`Buscando página ${page} de leads...`);
      const leadsResponse = await axios.get(`${KOMMO_API_URL}/leads`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        params: { limit: 50, page }
      });

      const leadsPagina = leadsResponse.data._embedded?.leads || [];
      console.log(`Página ${page} retornou ${leadsPagina.length} leads.`);
      todosLeads = todosLeads.concat(leadsPagina);

      temMais = leadsPagina.length === 50; // Se veio 50, pode ter mais página
      page++;
    }

    console.log(`Total de leads buscados: ${todosLeads.length}`);

    // 4. Formatar leads para envio
    const leadsFormatados = todosLeads.map(lead => {
      const statusInfo = statusMap[lead.status_id] || {
        pipeline_name: 'Desconhecido',
        status_name: 'Desconhecido'
      };

      const leadAchatado = {
        id: lead.id || '',
        name: lead.name || '',
        price: lead.price || 0,
        status_id: lead.status_id || '',
        pipeline_id: lead.pipeline_id || '',
        pipeline_name: statusInfo.pipeline_name,
        status_name: statusInfo.status_name,
        created_at: lead.created_at ? new Date(lead.created_at * 1000).toISOString() : '',
        updated_at: lead.updated_at ? new Date(lead.updated_at * 1000).toISOString() : '',
      };

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

    // Enviar a resposta como JSON
    res.json({ leads: leadsFormatados });
  } catch (error) {
    console.error('Erro ao buscar leads:', error);
    res.status(500).json({ erro: 'Erro ao buscar os dados dos leads.' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
