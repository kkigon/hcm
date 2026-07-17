import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the 환최몇 game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>환최몇\?/i);
  assert.match(html, /대한민국 대중교통 환승 추리 게임/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("GitHub Pages build is a self-contained static entry", async () => {
  const html = await readFile(new URL("../dist-github/index.html", import.meta.url), "utf8");
  const files = await readdir(new URL("../dist-github/", import.meta.url));

  assert.match(html, /<html lang="ko">/);
  assert.match(html, /환최몇\? — 대한민국 대중교통 환승 추리 게임/);
  assert.match(html, /\.\/assets\//);
  assert.ok(files.includes(".nojekyll"));
});

test("question bank contains every difficulty and the 1km rule", async () => {
  const source = await readFile(new URL("../app/data/questions.ts", import.meta.url), "utf8");
  const ids = [...source.matchAll(/\n\s+id: "([a-z0-9-]+)",\n\s+difficulty:/g)].map((match) => match[1]);

  assert.ok(ids.length >= 10, `expected at least 10 questions, got ${ids.length}`);
  assert.match(source, /difficulty: "10"/);
  assert.match(source, /difficulty: "50"/);
  assert.match(source, /difficulty: "100"/);
  assert.match(source, /환승 도보 1km 이내/);
});
