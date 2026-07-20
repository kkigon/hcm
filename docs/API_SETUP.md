# 지도·대중교통 API 조사 및 설정 가이드

조사 기준일: 2026-07-17

## 권장 조합

| 목적 | MVP(현재 구현) | 한국 지도 품질 우선 | 전국 정답 자동 생성 |
|---|---|---|---|
| 베이스맵 | MapLibre + OpenFreeMap | NAVER Web Dynamic Map | 어느 지도든 가능 |
| 역·정류장 정보 | 검증 문제 팩 | TAGO + ODsay 정보 API | TAGO/지역 API를 주기 수집 |
| 최소 환승 판정 | 저장된 정답 | 저장된 정답 | ODsay v1.8 또는 자체 그래프 |
| 점수·리더보드 | localStorage | Supabase | Supabase Edge Function |

무료 공공 API만 조합해도 정류장과 노선은 모을 수 있지만, 전국 버스·도시철도·철도를 하나의 그래프로 합쳐 최소 환승을 계산해 주는 단일 공공 API는 없습니다. 그래서 **정보 표시는 TAGO, 정답 후보 계산은 ODsay 또는 자체 그래프, 최종 문제는 사전 검증 후 저장**하는 구성이 현실적입니다.

## 1. 지도 선택

### 현재 기본값: MapLibre + OpenFreeMap

- MapLibre GL JS는 브라우저에서 벡터 지도를 렌더링하는 오픈소스 라이브러리입니다.
- OpenFreeMap은 가입과 API 키 없이 사용할 수 있는 MapLibre 스타일 URL을 제공합니다.
- 현재 `GameMap.tsx`는 `https://tiles.openfreemap.org/styles/positron`을 사용합니다.
- 장점: GitHub Pages에 올리는 즉시 실행, 비용·키 관리 없음.
- 단점: 국내 POI와 대중교통 표기가 네이버 지도보다 부족할 수 있음.

공식 문서: [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs), [OpenFreeMap Quick Start](https://openfreemap.org/quick_start/)

### 최선의 국내 지도: NAVER Web Dynamic Map

NAVER 지도 API v3는 드래그, 확대/축소, 교통·지형·파노라마, GeoJSON 데이터 레이어를 지원합니다. JavaScript 로드 파라미터는 현재 `ncpKeyId`입니다.

신청 순서:

1. [NAVER Cloud Platform](https://console.ncloud.com/)에 가입합니다.
2. **Services → Application Services → Maps → Application**으로 이동합니다.
3. 새 애플리케이션을 만들고 **Dynamic Map**을 선택합니다. 선택하지 않으면 429 오류가 날 수 있습니다.
4. Web service URL에 다음을 등록합니다.
   - `http://localhost`
   - `https://kkigon.github.io`
   - 포트 번호와 `/hcm` 같은 URI 경로는 제외합니다.
5. 발급된 Client ID를 확인합니다. JavaScript 지도에는 Client ID만 쓰고 Client Secret은 넣지 않습니다. GitHub에는 Actions repository variable `VITE_NAVER_MAP_CLIENT_ID`로 등록합니다.
6. SDK는 `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=CLIENT_ID` 형태로 로드합니다.

등록한 웹 서비스 URL과 실제 페이지 URL이 다르면 인증이 실패합니다. Web Dynamic Map 등의 무료 사용은 대표 계정 정책이 적용되므로 콘솔에서 대표 계정과 현재 요금·쿼터를 반드시 확인하세요.

공식 문서: [Client ID 발급](https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Client-ID.html), [Hello World](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html), [NAVER Maps 애플리케이션 등록](https://guide.ncloud-docs.com/docs/en/maps-app)

현재 코드는 `VITE_NAVER_MAP_CLIENT_ID`가 있으면 NAVER Dynamic Map을 사용하고, 값이 없거나 인증에 실패하면 MapLibre + OpenFreeMap으로 자동 전환합니다. 설정 절차는 [NAVER 지도 연결 가이드](NAVER_MAP_SETUP.md)를 따르세요.

### 차선책: Kakao Map

Kakao Map은 새 앱에서 지도 기능을 별도로 활성화해야 하며 JavaScript SDK에는 REST 키가 아닌 **JavaScript 키**를 사용합니다. 장소 검색 REST API는 주소·좌표·지하철역 카테고리 검색에 쓸 수 있지만, Client Secret 성격의 키를 브라우저에 넣으면 안 됩니다.

공식 문서: [Kakao Map 시작하기](https://developers.kakao.com/docs/en/kakaomap/common), [Kakao Local API](https://developers.kakao.com/docs/ko/local/dev-guide)

## 2. 공공 대중교통 데이터: 국토교통부 TAGO

[공공데이터포털](https://www.data.go.kr/)에서 회원가입 후 각 API의 **활용신청**을 누릅니다. 아래 API는 무료·자동승인 개발계정이 제공되고, 공개 페이지 기준 개발 트래픽은 일 10,000건입니다. 운영 트래픽은 활용사례 등록 후 증액 신청할 수 있습니다.

- [TAGO 버스정류소정보](https://www.data.go.kr/data/15098534/openapi.do): 도시코드, 정류장 ID·명칭·좌표
- [TAGO 버스노선정보](https://www.data.go.kr/data/15098529/openapi.do): 노선 기본정보와 정류장 목록
- [TAGO 지하철정보](https://www.data.go.kr/data/15098554/openapi.do): 역, 출구별 버스노선, 주변 시설, 시간표
- [TAGO 열차정보](https://www.data.go.kr/data/15098552/openapi.do): KTX 포함 출·도착역 기반 운행시간표와 역 목록

주의사항:

- 지역별 제공 범위와 ID 체계가 다르므로 `source`, `city_code`, `local_id`를 함께 저장하세요.
- 키를 GitHub 저장소에 커밋하지 마세요. 대량 수집은 로컬 스크립트나 서버에서 실행합니다.
- 승인 직후에는 [TAGO 3단계 확인 가이드](TAGO_STEP3.md)에 따라 `TAGO_SERVICE_KEY`를 GitHub Actions secret으로 등록하고 네 API 연결 검사를 실행하세요. 공공데이터포털 화면에 표시되는 두 키 중 **일반 인증키(Decoding)**를 사용합니다.
- TAGO는 노선·정류장 정보를 제공하지만 전국 통합 최소환승 답을 직접 반환하지 않습니다.
- 브라우저에서 직접 호출하면 키 노출, CORS, 일일 쿼터 문제가 생기므로 캐시 DB를 두는 편이 안전합니다.

## 3. 정답 경로 엔진: ODsay

ODsay의 대중교통 길찾기 v1.8 `searchPubTransPathT`는 출발·도착 WGS84 좌표(`SX`, `SY`, `EX`, `EY`)를 받아 도시 내/도시 간 대중교통 경로를 반환합니다. 도시 간 결과는 출발지→터미널, 터미널→도착지 도시 내 구간을 별도로 연결해야 완전한 경로가 된다는 점이 공식 가이드에 명시되어 있습니다.

신청 순서:

1. [ODsay LAB](https://lab.odsay.com/)에 가입합니다.
2. **Application → 애플리케이션 등록**에서 서비스 유형을 고릅니다.
3. 브라우저 호출이면 Web 플랫폼과 GitHub Pages 도메인을 등록합니다.
4. 서버 호출이면 Server 플랫폼과 호출 서버의 고정 공인 IP를 등록합니다.
5. 발급된 API Key는 저장소에 커밋하지 않습니다.
6. 무료/유료 유형별 일일 호출 제한이 다르므로 애플리케이션 화면의 현재 제한을 확인합니다.

공식 가이드: [ODsay 애플리케이션·API 가이드](https://lab.odsay.com/guide/guide?platform=web), [v1.8 API Reference](https://lab.odsay.com/guide/releaseReference?platform=web)

게임에서는 ODsay 경로검색을 플레이어 브라우저에 제공하지 않는 것을 권장합니다. 키와 정답이 노출되고 사용자가 그대로 정답을 검색할 수 있기 때문입니다. 정답 생성은 관리자용 배치 작업에서만 수행하고, 검증된 결과만 문제 DB에 저장하세요. Server Key는 고정 IP 인증이 필요하므로 유동 IP 기반 Edge Function에 바로 연결하기 전에 ODsay에 사용 가능한 인증 방식을 확인해야 합니다.

## 4. Supabase 선택 설정

코어 게임은 DB 없이 실행됩니다. 공개 리더보드와 서버 채점을 붙일 때만 Supabase가 필요합니다.

1. [Supabase](https://supabase.com/)에서 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. Supabase CLI 설치 후 `supabase functions deploy submit-score --no-verify-jwt`를 실행합니다.
4. Dashboard의 Edge Function Secrets에서 `ALLOWED_ORIGIN=https://내아이디.github.io`를 설정합니다.
5. 정답 테이블은 브라우저에서 읽을 수 없고, 점수 INSERT는 Edge Function의 서버 키만 수행하도록 유지합니다.
6. 프런트에서 필요한 것은 Project URL과 publishable/anon key뿐입니다. `service_role` 또는 secret key는 절대 GitHub Pages 코드에 넣지 마세요.

Supabase는 노출된 public 테이블에 RLS를 켜야 하며, service role/secret key는 RLS를 우회하므로 브라우저에 노출하면 안 됩니다.

공식 문서: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Edge Function CORS](https://supabase.com/docs/guides/functions/cors), [Function Secrets](https://supabase.com/docs/guides/functions/secrets)

## 5. 운영 권장 순서

1. 현재 문제 팩으로 GitHub Pages MVP를 공개합니다.
2. 사용자 피드백으로 제한시간·점수·난이도 구간을 조정합니다.
3. TAGO 키를 신청해 역·정류장 검색 데이터를 주기적으로 수집합니다.
4. ODsay 또는 자체 그래프로 후보 문제를 생성하되, 관리자 검수 후에만 공개합니다.
5. 경쟁 기능을 넣을 때 Supabase 서버 채점과 리더보드를 활성화합니다.
6. 노선 개편에 맞춰 문제 스냅샷을 월 1회 이상 재검증합니다.
