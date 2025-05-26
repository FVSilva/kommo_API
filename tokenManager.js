import fs from "fs-extra";
import axios from "axios";

const TOKEN_FILE = "./tokens.json";

// Substitua pelos dados reais da sua conta Kommo:
const CLIENT_ID = "224212f3-e5dc-4a76-a596-05445df20d9f";
const CLIENT_SECRET = "Fx7oKmSVMQDqcpgeQ3VwGD4vR0AIC1mpflyWdOOdJKzbbfZJYDu162bJdkTNdv5d";
const REDIRECT_URI = "https://oauth.pstmn.io/v1/callback";

export async function getTokens() {
  if (await fs.exists(TOKEN_FILE)) {
    const tokens = await fs.readJson(TOKEN_FILE);
    return tokens;
  }
  throw new Error("Arquivo de token não encontrado.");
}

export async function saveTokens(tokens) {
  tokens.expires_at = Date.now() + tokens.expires_in * 1000;
  await fs.writeJson(TOKEN_FILE, tokens, { spaces: 2 });
}

export async function refreshToken() {
  const tokens = await getTokens();
  const res = await axios.post("https://kommo.com/oauth2/access_token", {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    redirect_uri: REDIRECT_URI,
  });
  await saveTokens(res.data);
  console.log("✅ Novo token gerado com sucesso!");
  return res.data;
}

export async function getValidToken() {
  let tokens = await getTokens();
  const agora = Date.now();
  if (agora >= tokens.expires_at - 300000) { // 5 minutos antes de expirar
    tokens = await refreshToken();
  }
  return tokens.access_token;
}
