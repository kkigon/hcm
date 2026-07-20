import assert from "node:assert/strict";
import test from "node:test";
import {
  assertEveryCityHasStops,
  chunkRows,
  fetchTagoStopsForCity,
  normalizeTagoStop,
  parseCityCodes,
} from "../scripts/lib/tago-sync.mjs";

test("TAGO city codes are validated and de-duplicated", () => {
  assert.deepEqual(parseCityCodes("11, 25 11"), ["11", "25"]);
  assert.throws(() => parseCityCodes(""), /TAGO_CITY_CODES/);
  assert.throws(() => parseCityCodes("seoul"), /2~5자리 숫자/);
});

test("TAGO bus stops are normalized for Supabase", () => {
  assert.deepEqual(
    normalizeTagoStop(
      { citycode: "11", nodeid: "SEOUL001", nodenm: "서울역", nodeno: "02001", gpslati: "37.5547", gpslong: "126.9707" },
      "11",
      "2026-07-20T00:00:00.000Z",
    ),
    {
      source: "tago_bus_stop",
      city_code: "11",
      local_id: "SEOUL001",
      name: "서울역",
      stop_number: "02001",
      mode: "bus",
      latitude: 37.5547,
      longitude: 126.9707,
      is_active: true,
      fetched_at: "2026-07-20T00:00:00.000Z",
    },
  );
  assert.equal(normalizeTagoStop({ nodeid: "bad", nodenm: "좌표 없음" }, "11"), null);
});

test("TAGO stop pagination continues until totalCount is collected", async () => {
  const pages = [];
  const result = await fetchTagoStopsForCity({
    cityCode: "11",
    serviceKey: "test-key",
    pageSize: 2,
    request: async ({ params }) => {
      pages.push(params.pageNo);
      return params.pageNo === 1
        ? { totalCount: 3, items: [{ nodeid: "1" }, { nodeid: "2" }] }
        : { totalCount: 3, items: [{ nodeid: "3" }] };
    },
  });

  assert.deepEqual(pages, [1, 2]);
  assert.equal(result.items.length, 3);
  assert.equal(result.requestCount, 2);
});

test("Supabase upserts are split into bounded chunks", () => {
  assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.throws(() => chunkRows([1], 0), /1 이상의 정수/);
});

test("a zero-row TAGO response fails instead of reporting a successful sync", () => {
  assert.doesNotThrow(() => assertEveryCityHasStops([{ cityCode: "25", saved: 3076 }]));
  assert.throws(
    () => assertEveryCityHasStops([{ cityCode: "11", saved: 0 }]),
    /TAGO가 정류장을 반환하지 않은 도시코드.*11/,
  );
});
