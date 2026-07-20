# 4단계 — TAGO 정류장 데이터를 Supabase에 저장하기

TAGO API 4종 연결 검사가 모두 성공했다면, 다음 목표는 API를 게임 브라우저에서 직접 호출하는 것이 아니라 관리자 배치가 정류장 스냅샷을 Supabase에 저장하게 만드는 것입니다.

첫 실행은 서울 도시코드 `11` 하나로 검증합니다. 전국 코드를 한 번에 넣지 마세요. TAGO 개발계정은 API별 일일 호출 한도가 있으므로 도시별로 나눠 동기화하는 편이 안전합니다.

## 1. Supabase 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 **New project**를 누릅니다.
2. 프로젝트 이름은 `hwanchwemyeot`처럼 알아보기 쉽게 정합니다.
3. 데이터베이스 비밀번호는 비밀번호 관리자에 저장합니다. GitHub나 코드에는 넣지 않습니다.
4. 한국 사용자 중심이면 가까운 리전을 선택합니다.
5. 프로젝트 생성이 끝날 때까지 기다립니다.

## 2. DB 스키마 설치하기

1. Supabase 왼쪽 메뉴에서 **SQL Editor**를 엽니다.
2. **New query**를 누릅니다.
3. 저장소의 `supabase/schema.sql` 전체 내용을 붙여넣습니다.
4. **Run**을 누릅니다.
5. **Table Editor**에서 `transit_stops`, `game_questions`, `leaderboard_scores`가 보이는지 확인합니다.

`transit_stops`에는 PostGIS 위치 컬럼과 공간 인덱스가 포함됩니다. 정답과 수집 원본은 브라우저에서 직접 읽지 못하도록 RLS와 권한 차단이 적용됩니다.

## 3. GitHub Actions 비밀값 추가하기

GitHub 저장소 `https://github.com/kkigon/hcm`에서 **Settings → Secrets and variables → Actions → Secrets**로 이동합니다.

다음 두 Repository secret을 추가합니다.

| Name | 넣을 값 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트의 `https://...supabase.co` URL |
| `SUPABASE_SECRET_KEY` | Supabase **Settings → API Keys**의 `sb_secret_...` 키 |

`SUPABASE_SECRET_KEY`는 RLS를 우회하는 관리자 키입니다. 코드, Issue, 채팅, GitHub variable, 브라우저용 `VITE_*` 값에 넣으면 안 됩니다. 기존 `service_role` 키도 코드가 호환하지만 새 프로젝트에서는 `sb_secret_...` 키를 권장합니다.

## 4. 서울 데이터로 미리보기 실행하기

1. GitHub 저장소의 **Actions** 탭을 엽니다.
2. 왼쪽에서 **Sync TAGO bus stops to Supabase**를 선택합니다.
3. **Run workflow**를 누릅니다.
4. `city_codes`는 `11`로 둡니다.
5. `dry_run`을 체크한 상태로 실행합니다.
6. 실행이 성공하면 Summary에서 정류장 개수와 TAGO 호출 횟수를 확인합니다.

미리보기는 TAGO 응답을 정규화하지만 DB에는 쓰지 않습니다. 이 단계가 실패하면 Supabase 설정과 무관하므로 TAGO 오류만 먼저 확인합니다.

## 5. 서울 데이터를 실제 저장하기

1. 같은 워크플로를 다시 실행합니다.
2. `city_codes`는 `11`로 둡니다.
3. 이번에는 `dry_run` 체크를 끕니다.
4. 성공 후 Supabase **Table Editor → transit_stops**에서 행이 생성됐는지 확인합니다.
5. 같은 도시를 다시 실행해도 `(source, city_code, local_id)` 기준으로 갱신되며 중복 행은 생기지 않습니다.

## 6. 여기까지 성공한 뒤 할 일

정류장 저장 성공은 문제 생성 기반의 첫 부분일 뿐입니다. TAGO만으로 최소환승 정답은 계산되지 않습니다. 다음 단계에서는 다음 중 하나를 선택해야 합니다.

1. **권장 초기안: ODsay 관리자용 경로 엔진**을 신청해 후보 정답을 만들고 TAGO로 노선 존재를 교차 검증합니다.
2. **장기안: 자체 그래프**를 만들기 위해 TAGO 노선, 노선별 정류장 순서, 지하철·철도 운행 데이터를 단계적으로 수집합니다.

빠른 출시에는 1번이 적합합니다. ODsay 키는 플레이어 브라우저에 넣지 않고 문제 생성 워크플로에서만 사용합니다.

## 로컬 실행(선택)

`.env.local`에 아래 값을 넣은 뒤 실행할 수 있습니다.

```dotenv
TAGO_SERVICE_KEY=일반_인증키_Decoding
TAGO_CITY_CODES=11
TAGO_SYNC_DRY_RUN=true
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
```

```bash
pnpm tago:sync-stops
```

`.env.local`은 커밋하지 않습니다.
