import assert from "node:assert/strict";
import test from "node:test";
import { normalizeItems, normalizeServiceKey, unwrapTagoPayload } from "../scripts/lib/tago-client.mjs";

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
