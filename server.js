require('dotenv').config(); // Carrega as variáveis do .env
const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Informações do .env
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const BASE_DOMAIN = process.env.BASE_DOMAIN;
const KOMMO_API_URL = `https://${BASE_DOMAIN}/api/v4`;

// Função para buscar todos os leads paginados
async function buscarTodosLeads() {
  let page = 1;
  let todosLeads = [];
  let temMais = true;

  while (temMais) {
    const response = await axios.get(`${KOMMO_API_URL}/leads`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      params: { limit: 50, page }
    });

    const leadsPagina = response.data._embedded?.leads || [];
    todosLeads = todosLeads.concat(leadsPagina);
    temMais = leadsPagina.length === 50; // Se a página veio cheia, tem próxima
    page++;
  }

  return todosLeads;
}

// Função para buscar pipelines e montar mapa status_id -> {pipeline_name, status_name}
async function buscarStatusMap() {
  const response = await axios.get(`${KOMMO_API_URL}/leads/pipelines`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });

  const pipelines = response.data._embedded.pipelines;
  const statusMap = {};

  pipelines.forEach(pipeline => {
    pipeline._embedded.statuses.forEach(status => {
      statusMap[status.id] = {
        pipeline_name: pipeline.name,
        status_name: status.name
      };
    });
  });

  return statusMap;
}

// Função para buscar campos personalizados
async function buscarCamposPersonalizados() {
  const response = await axios.get(`${KOMMO_API_URL}/leads/custom_fields`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });

  const campos = response.data._embedded.custom_fields;
  const mapaCampos = {};
  campos.forEach(campo => {
    mapaCampos[campo.id] = campo.name;
  });
  return mapaCampos;
}

// Rota para buscar leads formatados
app.get('/leads', async (req, res) => {
  try {
    const [todosLeads, statusMap, mapaCampos] = await Promise.all([
      buscarTodosLeads(),
      buscarStatusMap(),
      buscarCamposPersonalizados()
    ]);

    // Processar e formatar os leads
    const leadsFormatados = todosLeads.map(lead => {
      const statusInfo = statusMap[lead.status_id] || { pipeline_name: 'Desconhecido', status_name: 'Desconhecido' };
      const leadAchatado = {
        id: lead.id || '',
        name: lead.name || '',
        price: lead.price || '',
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

    // Retornar array simples (melhor para Power BI)
    res.json(leadsFormatados);

  } catch (error) {
    console.error('Erro ao buscar leads:', error.message);
    res.status(500).json({ erro: 'Erro ao buscar os dados dos leads.' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
