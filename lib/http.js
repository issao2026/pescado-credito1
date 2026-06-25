// lib/http.js
// Helpers HTTP comuns para os endpoints serverless. CORS, leitura de JSON, respostas padronizadas.

export const ALLOWED_METHODS = ["POST", "OPTIONS"];

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function preflight(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function methodGuard(req, res, methods = ["POST"]) {
  if (!methods.includes(req.method)) {
    setCors(res);
    res.status(405).json({ erro: "metodo_nao_permitido", esperado: methods });
    return false;
  }
  return true;
}

export async function readJSON(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 25 * 1024 * 1024) {
        reject(new Error("payload_muito_grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error("json_invalido: " + e.message));
      }
    });
    req.on("error", reject);
  });
}

export function ok(res, payload) {
  setCors(res);
  res.status(200).json(payload);
}

export function fail(res, status, codigo, detalhe) {
  setCors(res);
  res.status(status).json({ erro: codigo, detalhe: detalhe || null });
}

export function isApiKeyMissing() {
  return !process.env.ANTHROPIC_API_KEY;
}

export function inferirMediaType(nomeArquivo, fallback = "image/jpeg") {
  const n = (nomeArquivo || "").toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".pdf")) return "application/pdf";
  return fallback;
}
