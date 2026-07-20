import { readFile } from "node:fs/promises";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 3;

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

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function requestTago({
  baseUrl,
  operation,
  params = {},
  serviceKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = 750,
  fetchImpl = fetch,
}) {
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

  const attempts = Math.max(1, Math.trunc(maxAttempts));
  let response;
  let lastNetworkError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = undefined;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      const retryableStatus = response.status === 429 || response.status >= 500;
      if (!retryableStatus || attempt === attempts) break;
    } catch (error) {
      lastNetworkError = error;
      if (attempt === attempts) break;
    }

    if (retryDelayMs > 0) await wait(retryDelayMs * attempt);
  }

  if (!response) {
    const reason = ["TimeoutError", "AbortError"].includes(lastNetworkError?.name)
      ? `${Math.round(timeoutMs / 1000)}초 시간 초과`
      : "네트워크 오류";
    throw new Error(`${operation} 호출에 실패했습니다: ${reason} (${attempts}회 시도)`);
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
