import assert from "node:assert/strict";
import test from "node:test";
import { normalizeItems, normalizeServiceKey, requestTago, unwrapTagoPayload } from "../scripts/lib/tago-client.mjs";

test("TAGO service keys are decoded exactly once", () => {
  assert.equal(normalizeServiceKey("abc%2Bdef%2Fghi%3D"), "abc+def/ghi=");
  assert.equal(normalizeServiceKey("abc+def/ghi="), "abc+def/ghi=");
});

test("TAGO singleton and array item responses have one shape", () => {
  assert.deepEqual(normalizeItems({ citycode: "11" }), [{ citycode: "11" }]);
  assert.deepEqual(normalizeItems([{ citycode: "11" }, { citycode: "21" }]), [
    { citycode: "11" },
    { citycode: "21" },
  ]);
  assert.deepEqual(normalizeItems(undefined), []);
});

test("TAGO response envelopes are normalized", () => {
  const normalized = unwrapTagoPayload({
    response: {
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
      body: { totalCount: 1, items: { item: { citycode: "11", cityname: "서울특별시" } } },
    },
  });
  assert.equal(normalized.resultCode, "00");
  assert.equal(normalized.totalCount, 1);
  assert.deepEqual(normalized.items, [{ citycode: "11", cityname: "서울특별시" }]);
});

test("TAGO requests retry temporary timeouts", async () => {
  let attempts = 0;
  const result = await requestTago({
    baseUrl: "https://example.test/TagoService",
    operation: "getItems",
    serviceKey: "test-key",
    retryDelayMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("temporary timeout");
        error.name = "TimeoutError";
        throw error;
      }
      return new Response(JSON.stringify({
        response: {
          header: { resultCode: "00", resultMsg: "OK" },
          body: { totalCount: 1, items: { item: { nodeid: "DJB1" } } },
        },
      }));
    },
  });

  assert.equal(attempts, 3);
  assert.equal(result.totalCount, 1);
});
