import assert from "node:assert/strict";
import { QUESTIONS } from "../app/data/questions.ts";

const earthRadiusMeters = 6_371_000;
const toRadians = (value) => value * Math.PI / 180;

function distanceMeters([lng1, lat1], [lng2, lat2]) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lineLengthMeters(coordinates) {
  return coordinates.slice(1).reduce((sum, point, index) => sum + distanceMeters(coordinates[index], point), 0);
}

const seenIds = new Set();
const difficultyCounts = new Map();

for (const question of QUESTIONS) {
  assert.ok(!seenIds.has(question.id), `duplicate question id: ${question.id}`);
  seenIds.add(question.id);
  difficultyCounts.set(question.difficulty, (difficultyCounts.get(question.difficulty) ?? 0) + 1);
  assert.ok(question.origin.walkMeters <= 1000, `${question.id}: origin walk exceeds 1km`);
  assert.ok(question.destination.walkMeters <= 1000, `${question.id}: destination walk exceeds 1km`);

  const transitLegs = question.legs.filter((leg) => leg.mode !== "walk");
  assert.equal(
    question.minimumTransfers,
    Math.max(0, transitLegs.length - 1),
    `${question.id}: transfer answer does not match transit boardings`,
  );

  for (const leg of question.legs.filter((item) => item.mode === "walk")) {
    const geometryDistance = lineLengthMeters(leg.coordinates);
    assert.ok(geometryDistance <= 1000, `${question.id}: walk leg ${leg.from} → ${leg.to} is ${Math.round(geometryDistance)}m`);
  }

  if (question.difficulty === "10") assert.ok(question.distanceKm <= 20, `${question.id}: outside 10km band`);
  if (question.difficulty === "50") assert.ok(question.distanceKm > 20 && question.distanceKm <= 70, `${question.id}: outside 50km band`);
  if (question.difficulty === "100") assert.ok(question.distanceKm > 70, `${question.id}: outside 100km+ band`);
}

for (const difficulty of ["10", "50", "100"]) {
  assert.ok((difficultyCounts.get(difficulty) ?? 0) >= 5, `${difficulty}km band needs at least five unique questions`);
}

console.log(`Validated ${QUESTIONS.length} questions: five per band, unique IDs, transfer counts, and every walk leg ≤ 1km.`);
