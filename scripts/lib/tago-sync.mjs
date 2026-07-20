import { requestTago } from "./tago-client.mjs";

export const TAGO_BUS_STOP_BASE_URL = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService";
export const TAGO_BUS_STOP_PAGE_SIZE = 999;

export function parseCityCodes(value) {
  const cityCodes = [...new Set(String(value ?? "")
    .split(/[\s,]+/)
    .map((cityCode) => cityCode.trim())
    .filter(Boolean))];

  if (cityCodes.length === 0) {
    throw new Error("TAGO_CITY_CODES가 없습니다. 예: 서울 11, 대전 25 또는 11,25");
  }
  const invalid = cityCodes.find((cityCode) => !/^\d{2,5}$/.test(cityCode));
  if (invalid) throw new Error(`도시코드는 2~5자리 숫자여야 합니다: ${invalid}`);
  return cityCodes;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

export function normalizeTagoStop(item, fallbackCityCode, fetchedAt = new Date().toISOString()) {
  const cityCode = cleanText(item?.citycode ?? item?.cityCode ?? fallbackCityCode);
  const localId = cleanText(item?.nodeid ?? item?.nodeId);
  const name = cleanText(item?.nodenm ?? item?.nodeNm);
  const stopNumber = cleanText(item?.nodeno ?? item?.nodeNo) || null;
  const latitude = Number(item?.gpslati ?? item?.gpsLati);
  const longitude = Number(item?.gpslong ?? item?.gpsLong);

  if (!cityCode || !localId || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 30 || latitude > 40 || longitude < 120 || longitude > 135) return null;

  return {
    source: "tago_bus_stop",
    city_code: cityCode,
    local_id: localId,
    name,
    stop_number: stopNumber,
    mode: "bus",
    latitude,
    longitude,
    is_active: true,
    fetched_at: fetchedAt,
  };
}

export async function fetchTagoStopsForCity({
  cityCode,
  serviceKey,
  pageSize = TAGO_BUS_STOP_PAGE_SIZE,
  request = requestTago,
}) {
  const items = [];
  let pageNo = 1;
  let totalCount = Number.POSITIVE_INFINITY;
  let requestCount = 0;

  while (items.length < totalCount) {
    const response = await request({
      baseUrl: TAGO_BUS_STOP_BASE_URL,
      operation: "getSttnNoList",
      params: { cityCode, pageNo, numOfRows: pageSize },
      serviceKey,
    });
    requestCount += 1;
    totalCount = Math.max(0, Number(response.totalCount) || 0);
    items.push(...response.items);

    if (response.items.length === 0 || totalCount === 0) break;
    pageNo += 1;
    if (pageNo > 10_000) throw new Error(`${cityCode}: 비정상적으로 많은 페이지가 반환되어 수집을 중단했습니다.`);
  }

  return { items, requestCount, totalCount };
}

export function chunkRows(rows, size = 500) {
  if (!Number.isInteger(size) || size < 1) throw new Error("청크 크기는 1 이상의 정수여야 합니다.");
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}
