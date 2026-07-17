const endpoint = "https://api.odsay.com/v1/api/searchPubTransPathT";

function readArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "");
    const value = values[index + 1];
    if (key && value) result[key] = value;
  }
  return result;
}

const args = readArgs(process.argv.slice(2));
const apiKey = process.env.ODSAY_API_KEY;

if (!apiKey) {
  console.error("ODSAY_API_KEY 환경변수가 필요합니다. 키는 명령 인자나 소스에 직접 넣지 마세요.");
  process.exit(1);
}

for (const key of ["sx", "sy", "ex", "ey"]) {
  if (!Number.isFinite(Number(args[key]))) {
    console.error(`--${key} 좌표가 필요합니다.`);
    process.exit(1);
  }
}

const query = new URLSearchParams({
  apiKey,
  SX: args.sx,
  SY: args.sy,
  EX: args.ex,
  EY: args.ey,
  OPT: "0",
  SearchPathType: "0",
  output: "json",
});

const response = await fetch(`${endpoint}?${query}`);
const payload = await response.json();

if (!response.ok || payload.error) {
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
