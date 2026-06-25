// lib/anthropic.js
// Wrapper unico para chamadas Claude. Centraliza timeout, retry, parsing JSON.
// Nunca expor a chave no frontend. Toda chamada passa por aqui no servidor.

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

let _client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ausente. Configurar no painel da Vercel.");
  }
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: DEFAULT_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    });
  }
  return _client;
}

/**
 * Chamada simples de texto. Retorna a string completa.
 */
export async function callText({ system, user, model = DEFAULT_MODEL, maxTokens = 4096, temperature = 0 }) {
  const client = getClient();
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
  });
  return extractText(resp);
}

/**
 * Chamada com input multimodal (imagens base64 + texto). Retorna string.
 */
export async function callVision({ system, contentBlocks, model = DEFAULT_MODEL, maxTokens = 4096, temperature = 0 }) {
  const client = getClient();
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: contentBlocks }],
  });
  return extractText(resp);
}

/**
 * Chama Claude e exige resposta em JSON valido. Faz parse e devolve objeto.
 * Estrategia anti-alucinacao: instrui a IA a retornar SOMENTE JSON, sem markdown.
 * Se a resposta vier com cerca ```json, limpa antes de parsear.
 */
export async function callJSON({ system, user, contentBlocks, model = DEFAULT_MODEL, maxTokens = 4096, temperature = 0 }) {
  const sys = (system || "") + "\n\nIMPORTANTE: responda SOMENTE com JSON valido. Sem markdown, sem cercas, sem texto antes ou depois. Comece com { e termine com }.";
  let raw;
  if (contentBlocks) {
    raw = await callVision({ system: sys, contentBlocks, model, maxTokens, temperature });
  } else {
    raw = await callText({ system: sys, user, model, maxTokens, temperature });
  }
  return parseJSONStrict(raw);
}

function extractText(resp) {
  if (!resp || !resp.content) return "";
  return resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export function parseJSONStrict(raw) {
  if (!raw) throw new Error("Resposta vazia da IA");
  let s = raw.trim();
  // Remover cercas markdown se vierem
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  // Se vier texto antes/depois, tentar extrair primeiro objeto
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first > 0 || (first !== -1 && last !== -1 && (first !== 0 || last !== s.length - 1))) {
    s = s.slice(first, last + 1);
  }
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error("IA retornou JSON invalido: " + e.message + " | raw: " + raw.slice(0, 300));
  }
}

/**
 * Helper para criar bloco de imagem a partir de base64.
 * mediaType: image/jpeg, image/png, image/webp, image/gif
 */
export function imageBlock(base64, mediaType = "image/jpeg") {
  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data: base64 },
  };
}

export function textBlock(text) {
  return { type: "text", text };
}

/**
 * Helper para construir bloco de PDF (Claude aceita PDF como input).
 */
export function pdfBlock(base64) {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: base64 },
  };
}
