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

    const leadsRaw = response.data._embedded?.leads || [];

    const leads = leadsRaw.map((lead) => {
      const customFields = {};

      // Extrair e "achatar" campos personalizados
      if (Array.isArray(lead.custom_fields_values)) {
        lead.custom_fields_values.forEach((field) => {
          // Definir o nome do campo: tenta field_name > field_code > field_id
          const fieldName = field.field_name || field.field_code || `field_${field.field_id}`;

          // Pegar o primeiro valor disponível e substituir null por string vazia
          let value = "";
          if (Array.isArray(field.values) && field.values.length > 0) {
            value = field.values[0]?.value ?? "";
          }

          // Se for timestamp numérico, converter para ISO string (ex: 1672531200)
          if (typeof value === "number" && value > 1000000000) {
            value = new Date(value * 1000).toISOString();
          }

          // Converter arrays ou objetos para string para não quebrar no Power BI
          if (Array.isArray(value)) {
            value = value.join(", ");
          } else if (value && typeof value === "object") {
            value = JSON.stringify(value);
          }

          // Garantir que não tenha null ou undefined
          if (value === null || value === undefined) {
            value = "";
          }

          customFields[fieldName] = value;
        });
      }

      // Campos básicos do lead, convertendo timestamps para ISO string
      const safeLead = {
        id: lead.id ?? "",
        name: lead.name ?? "",
        status_id: lead.status_id ?? "",
        pipeline_id: lead.pipeline_id ?? "",
        price: lead.price ?? 0,
        created_at: lead.created_at ? new Date(lead.created_at * 1000).toISOString() : "",
        updated_at: lead.updated_at ? new Date(lead.updated_at * 1000).toISOString() : "",
        // Empresas associadas, transformar lista de objetos em string
        companies: (lead._embedded?.companies || [])
          .map((c) => c.id ?? "")
          .filter((id) => id !== "")
          .join(", "),
        // Link para o lead
        self_href: lead._links?.self?.href || "",
        ...customFields,
      };

      // Se alguma propriedade for array ou objeto, transformar em string para evitar erros
      Object.keys(safeLead).forEach((key) => {
        const val = safeLead[key];
        if (Array.isArray(val)) {
          safeLead[key] = val.join(", ");
        } else if (val && typeof val === "object") {
          safeLead[key] = JSON.stringify(val);
        }

        // Garantir que nunca seja null ou undefined
        if (safeLead[key] === null || safeLead[key] === undefined) {
          safeLead[key] = "";
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
