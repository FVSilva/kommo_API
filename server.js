require('dotenv').config(); // Carrega as variáveis do .env
const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Informações do .env
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const BASE_DOMAIN = process.env.BASE_DOMAIN;
const KOMMO_API_URL = `https://${BASE_DOMAIN}/api/v4`;

// Rota para buscar os leads
app.get('/leads', async (req, res) => {
  try {
    // 1. Buscar campos personalizados
    const camposResponse = await axios.get(`${KOMMO_API_URL}/leads/custom_fields`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    });

    const campos = camposResponse.data._embedded.custom_fields;

    // Criar um mapa de campo_id => nome_do_campo
    const mapaCampos = {};
    campos.forEach(campo => {
      mapaCampos[campo.id] = campo.name;
    });

    // 2. Buscar os leads
    const leadsResponse = await axios.get(`${KOMMO_API_URL}/leads`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    });

    const leads = leadsResponse.data._embedded.leads;

    // 3. Processar cada lead e achatar os campos personalizados
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

    // Enviando como objeto para o Power BI interpretar corretamente
    res.json({ leads: leadsFormatados });
  } catch (error) {
    console.error('Erro ao buscar leads:', error.message);
    res.status(500).json({ erro: 'Erro ao buscar os dados dos leads.' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
