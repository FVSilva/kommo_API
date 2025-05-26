require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const accessToken = process.env.ACCESS_TOKEN;
const baseDomain = process.env.BASE_DOMAIN;

app.use(express.json());

app.get('/leads', async (req, res) => {
  try {
    const response = await axios.get(`https://${baseDomain}/api/v4/leads`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const leads = response.data._embedded.leads.map((lead) => {
      const customFields = {};

      // Extrair campos personalizados
      if (lead.custom_fields_values) {
        lead.custom_fields_values.forEach((field) => {
          const fieldName = field.field_name || field.field_code || `field_${field.field_id}`;
          let value = field.values?.[0]?.value ?? null;

          // Converter timestamps numéricos para ISO string
          if (typeof value === 'number' && value > 1000000000) {
            value = new Date(value * 1000).toISOString();
          }

          customFields[fieldName] = value;
        });
      }

      // Extrair outros campos extras diretos no objeto lead
      Object.entries(lead).forEach(([key, val]) => {
        if (
          ![
            'id',
            'name',
            'status_id',
            'pipeline_id',
            'price',
            'created_at',
            'updated_at',
            'custom_fields_values',
          ].includes(key)
        ) {
          // Converter timestamp numérico para ISO string, se aplicável
          if (typeof val === 'number' && val > 1000000000) {
            customFields[key] = new Date(val * 1000).toISOString();
          } else {
            customFields[key] = val;
          }
        }
      });

      const safeLead = {
        id: lead.id,
        name: lead.name,
        status_id: lead.status_id,
        pipeline_id: lead.pipeline_id,
        price: lead.price,
        created_at: new Date(lead.created_at * 1000).toISOString(),
        updated_at: new Date(lead.updated_at * 1000).toISOString(),
        ...customFields,
      };

      // Sanitizar arrays ou objetos para evitar erro no Power BI
      Object.keys(safeLead).forEach((key) => {
        const value = safeLead[key];
        if (Array.isArray(value)) {
          safeLead[key] = value.join(', ');
        } else if (typeof value === 'object' && value !== null) {
          safeLead[key] = JSON.stringify(value);
        }
      });

      return safeLead;
    });

    res.json(leads);
  } catch (error) {
    console.error('Erro ao buscar leads:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao buscar leads.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
