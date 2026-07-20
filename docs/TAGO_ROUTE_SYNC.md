# 5단계 — TAGO 버스노선을 Supabase에 저장하기

대전 정류장이 `transit_stops`에 저장됐다면 다음 단계는 대전의 노선 ID와 노선번호, 기점·종점, 첫차·막차, 배차간격을 `transit_services`에 저장하는 것입니다. 이후 노선별 경유 정류장 순서를 수집할 때 이 노선 ID를 사용합니다.

## 1. 새 테이블 설치하기

기존 테이블과 데이터는 지우지 않습니다.

1. Supabase Dashboard에서 **SQL Editor**를 엽니다.
2. **New query**를 누릅니다.
3. 저장소의 최신 `supabase/schema.sql` 전체 내용을 붙여넣습니다.
4. **Run**을 누릅니다.
5. **Table Editor**에 `transit_services`가 생겼는지 확인합니다.

스키마는 `create table if not exists`를 사용하므로 기존 `transit_stops` 3,076행은 유지됩니다. `transit_services`도 관리자 배치만 읽고 쓸 수 있게 브라우저의 `anon`, `authenticated` 권한을 차단합니다.

## 2. 대전 노선 미리보기

1. GitHub 저장소의 **Actions** 탭을 엽니다.
2. 왼쪽에서 **Sync TAGO bus routes to Supabase**를 선택합니다.
3. **Run workflow**를 누릅니다.
4. `city_codes`는 `25`로 둡니다.
5. `dry_run`은 체크한 채 실행합니다.
6. 성공한 실행의 Summary에서 정규화된 노선 수와 TAGO 호출 횟수를 확인합니다.

수집기는 `getRouteNoList`로 노선 ID 목록을 받은 뒤 각 노선의 `getRouteInfoIem` 결과를 합칩니다. 따라서 호출 횟수는 대략 `노선 목록 페이지 수 + 노선 수`입니다.

## 3. Supabase에 실제 저장

1. 같은 워크플로에서 **Run workflow**를 다시 누릅니다.
2. `city_codes`는 `25`로 둡니다.
3. `dry_run` 체크를 끕니다.
4. 워크플로가 성공하면 Summary의 `DB 확인` 행 수를 봅니다.
5. Supabase **Table Editor → transit_services**에서 `city_code = 25`, `source = tago_bus_route`인 행을 확인합니다.

같은 워크플로를 다시 실행해도 `(source, city_code, local_id)` 기준으로 갱신되므로 중복되지 않습니다. 인증키와 Supabase 관리자 키는 기존 GitHub Actions secret을 그대로 사용하므로 새 비밀값을 등록할 필요가 없습니다.

## 4. 성공 기준

- 워크플로가 초록색으로 끝납니다.
- Summary의 정규화된 노선 수가 0보다 큽니다.
- 실제 저장 실행에서는 `DB 확인` 수도 0보다 큽니다.
- `transit_services`의 기점·종점 또는 첫차·막차 정보가 일부 행에 채워져 있습니다.

여기까지 완료하면 다음 개발 단계는 `getRouteAcctoThrghSttnList`를 노선별로 호출해 `노선 → 정류장 → 정차순서` 연결 테이블을 만드는 것입니다. 이 연결이 생겨야 환승 그래프의 버스 간선을 계산할 수 있습니다.

## 로컬 실행(선택)

정류장 동기화와 동일한 `.env.local`을 사용합니다.

```bash
pnpm tago:sync-routes
```
