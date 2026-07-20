import { appendFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/tago-client.mjs";
import {
  assertEveryCityHasStops,
  chunkRows,
  fetchTagoStopsForCity,
  normalizeTagoStop,
  parseCityCodes,
} from "./lib/tago-sync.mjs";

await loadLocalEnv();

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

const serviceKey = process.env.TAGO_SERVICE_KEY;
const cityCodes = parseCityCodes(process.env.TAGO_CITY_CODES);
const dryRun = isEnabled(process.env.TAGO_SYNC_DRY_RUN);
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseSecretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

if (!serviceKey) throw new Error("TAGO_SERVICE_KEY가 없습니다.");
if (!dryRun && (!supabaseUrl || !supabaseSecretKey)) {
  throw new Error("실제 저장에는 SUPABASE_URL과 SUPABASE_SECRET_KEY가 필요합니다.");
}

const admin = dryRun
  ? null
  : createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const fetchedAt = new Date().toISOString();
const summaries = [];

console.log(`TAGO 버스정류소 동기화를 시작합니다. 도시 ${cityCodes.length}개 · ${dryRun ? "미리보기" : "Supabase 저장"}`);

for (const cityCode of cityCodes) {
  const fetched = await fetchTagoStopsForCity({ cityCode, serviceKey });
  const normalized = fetched.items
    .map((item) => normalizeTagoStop(item, cityCode, fetchedAt))
    .filter(Boolean);
  const unique = [...new Map(normalized.map((stop) => [`${stop.city_code}:${stop.local_id}`, stop])).values()];
  const skipped = fetched.items.length - normalized.length;

  if (admin) {
    for (const rows of chunkRows(unique)) {
      const { error } = await admin
        .from("transit_stops")
        .upsert(rows, { onConflict: "source,city_code,local_id" });
      if (error) throw new Error(`${cityCode}: Supabase 저장 실패 - ${error.message}`);
    }
  }

  summaries.push({ cityCode, received: fetched.items.length, saved: unique.length, skipped, requests: fetched.requestCount });
  const status = unique.length > 0 ? "✅" : "❌";
  console.log(`${status} ${cityCode}: ${unique.length.toLocaleString()}개 ${dryRun ? "정규화" : "저장"} (${fetched.requestCount}회 호출, 제외 ${skipped}개)`);
}

const totalSaved = summaries.reduce((sum, result) => sum + result.saved, 0);
const totalRequests = summaries.reduce((sum, result) => sum + result.requests, 0);
const markdown = [
  "## TAGO 버스정류소 동기화",
  "",
  `- 실행 모드: ${dryRun ? "미리보기(DB 저장 안 함)" : "Supabase 저장"}`,
  `- 도시: ${cityCodes.join(", ")}`,
  `- 정규화된 정류소: ${totalSaved.toLocaleString()}개`,
  `- TAGO 호출: ${totalRequests.toLocaleString()}회`,
  "",
  ...summaries.map((result) =>
    `- ${result.cityCode}: ${result.saved.toLocaleString()}개 (호출 ${result.requests}회, 제외 ${result.skipped}개)`),
  "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
assertEveryCityHasStops(summaries);
console.log(`완료: 총 ${totalSaved.toLocaleString()}개, TAGO ${totalRequests.toLocaleString()}회 호출`);
