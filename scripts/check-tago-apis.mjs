import { appendFile } from "node:fs/promises";
import { loadLocalEnv, requestTago } from "./lib/tago-client.mjs";

await loadLocalEnv();

const serviceKey = process.env.TAGO_SERVICE_KEY;
const checks = [
  {
    name: "버스정류소정보",
    baseUrl: "https://apis.data.go.kr/1613000/BusSttnInfoInqireService",
    operation: "getCtyCodeList",
    params: { pageNo: 1, numOfRows: 1 },
  },
  {
    name: "버스노선정보",
    baseUrl: "https://apis.data.go.kr/1613000/BusRouteInfoInqireService",
    operation: "getCtyCodeList",
    params: { pageNo: 1, numOfRows: 1 },
  },
  {
    name: "지하철정보",
    baseUrl: "https://apis.data.go.kr/1613000/SubwayInfo",
    operation: "GetKwrdFndSubwaySttnList",
    params: { pageNo: 1, numOfRows: 1, subwayStationName: "서울" },
  },
  {
    name: "열차정보",
    baseUrl: "https://apis.data.go.kr/1613000/TrainInfo",
    operation: "GetCtyCodeList",
    params: {},
  },
];

console.log("TAGO API 4종 연결을 확인합니다. 인증키 값은 출력하지 않습니다.\n");

const results = [];
for (const check of checks) {
  try {
    const response = await requestTago({ ...check, serviceKey });
    results.push({ name: check.name, ok: true, count: response.totalCount });
    console.log(`✅ ${check.name}: 정상 (조회 결과 ${response.totalCount.toLocaleString()}건)`);
  } catch (error) {
    results.push({ name: check.name, ok: false, message: error.message });
    console.error(`❌ ${check.name}: ${error.message}`);
  }
}

const passed = results.filter((result) => result.ok).length;
const summary = [
  "## TAGO API 연결 확인",
  "",
  ...results.map((result) =>
    result.ok ? `- ✅ ${result.name}: 정상` : `- ❌ ${result.name}: ${result.message}`,
  ),
  "",
  passed === checks.length
    ? "네 API가 모두 정상입니다. 다음 단계인 수집 범위 설정으로 진행할 수 있습니다."
    : "실패한 API의 활용신청 상태와 인증키 종류를 확인한 뒤 다시 실행하세요.",
  "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
}

if (passed !== checks.length) process.exitCode = 1;
