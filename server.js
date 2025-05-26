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
            '_embedded',
            '_links',
          ].includes(key)
        ) {
          if (typeof val === 'number' && val > 1000000000) {
            customFields[key] = new Date(val * 1000).toISOString();
          } else {
            customFields[key] = val;
          }
        }
      });

      // Flatten _embedded.companies para string separada por vírgula
      let companiesInfo = "";
      if (lead._embedded && lead._embedded.companies) {
        companiesInfo = lead._embedded.companies.map(c => c.id).join(", ");
      }

      // Extrair _links.self.href para string simples
      let selfHref = "";
      if (lead._links && lead._links.self && lead._links.self.href) {
        selfHref = lead._links.self.href;
      }

      // Ajuste para created_at e updated_at: 
      // Se já for string (ISO), deixar como está. Se número, converter.
      const createdAt = typeof lead.created_at === 'string' 
        ? lead.created_at 
        : (typeof lead.created_at === 'number' && lead.created_at > 1000000000 
          ? new Date(lead.created_at * 1000).toISOString() 
          : null);

      const updatedAt = typeof lead.updated_at === 'string' 
        ? lead.updated_at 
        : (typeof lead.updated_at === 'number' && lead.updated_at > 1000000000 
          ? new Date(lead.updated_at * 1000).toISOString() 
          : null);

      const safeLead = {
        id: lead.id,
        name: lead.name,
        status_id: lead.status_id,
        pipeline_id: lead.pipeline_id,
        price: lead.price,
        created_at: createdAt,
        updated_at: updatedAt,
        companies: companiesInfo,
        self_href: selfHref,
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
