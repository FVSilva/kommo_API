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

      if (lead.custom_fields_values) {
        lead.custom_fields_values.forEach((field) => {
          const fieldName = field.field_name || field.field_code || field.field_id;
          const value = field.values?.[0]?.value ?? null;
          customFields[fieldName] = value;
        });
      }

      return {
        id: lead.id,
        name: lead.name,
        status_id: lead.status_id,
        pipeline_id: lead.pipeline_id,
        price: lead.price,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        custom_fields: customFields,
      };
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
