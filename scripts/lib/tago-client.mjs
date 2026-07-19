import { readFile } from "node:fs/promises";

const DEFAULT_TIMEOUT_MS = 15_000;

export async function loadLocalEnv(path = ".env.local") {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(name in process.env)) process.env[name] = value;
  }
}

export function normalizeServiceKey(value) {
  const key = value?.trim();
  if (!key) return "";
  try {
    return key.includes("%") ? decodeURIComponent(key) : key;
  } catch {
    return key;
  }
}

export function normalizeItems(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

export function unwrapTagoPayload(payload) {
  const response = payload?.response ?? payload;
  const header = response?.header ?? {};
  const body = response?.body ?? {};
  const resultCode = String(header.resultCode ?? "");
  const resultMessage = String(header.resultMsg ?? "");
  const items = normalizeItems(body?.items?.item);
  return {
    resultCode,
    resultMessage,
    body,
    items,
    totalCount: Number(body?.totalCount ?? items.length),
  };
}

function xmlErrorMessage(source) {
  const tags = ["returnAuthMsg", "resultMsg", "errMsg", "returnReasonCode"];
  const messages = tags
    .map((tag) => source.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"))?.[1]?.trim())
    .filter(Boolean);
  return messages.join(" · ") || "JSON이 아닌 응답을 받았습니다.";
}

export async function requestTago({ baseUrl, operation, params = {}, serviceKey, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const key = normalizeServiceKey(serviceKey);
  if (!key) {
    throw new Error("TAGO_SERVICE_KEY가 없습니다. GitHub Actions secret 또는 .env.local에 일반 인증키(Decoding)를 등록하세요.");
  }

  const url = new URL(operation, `${baseUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("_type", "json");
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  }

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new Error(`${operation} 호출에 실패했습니다: ${error?.name === "TimeoutError" ? "15초 시간 초과" : "네트워크 오류"}`);
  }

  const source = await response.text();
  let payload;
  try {
    payload = JSON.parse(source);
  } catch {
    throw new Error(`${operation}: ${xmlErrorMessage(source)}`);
  }

  const normalized = unwrapTagoPayload(payload);
  const succeeded = response.ok && ["0", "00"].includes(normalized.resultCode);
  if (!succeeded) {
    throw new Error(
      `${operation}: ${normalized.resultMessage || `HTTP ${response.status}`} (resultCode ${normalized.resultCode || "없음"})`,
    );
  }
  return normalized;
}
