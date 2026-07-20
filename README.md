# 환최몇?

> 대한민국의 대중교통으로 어디까지 갈 수 있을까요?

버스·지하철·기차만으로 두 지점을 이동할 때 필요한 **최소 환승 횟수**를 맞히는 지도 추리 게임입니다. GitHub Pages에서 바로 배포할 수 있는 정적 빌드와, 선택적으로 붙일 수 있는 Supabase 리더보드 뼈대를 함께 제공합니다.

## 지금 들어 있는 기능

- 10km / 50km / 100km+ / 전범위 난이도
- 문제당 90초 / 2분 / 3분 제한시간과 3초 카운트다운
- 마우스·터치 드래그, 휠 확대/축소, 주소 카드 위치 이동
- 역·정류장·노선 정보 검색(경로검색은 의도적으로 없음)
- 추리 메모, 제출 전 확인, 시간 종료 자동 제출
- 정답 노선 지도 표시와 버스·지하철·기차·도보 단계별 해설
- 5라운드 점수, 정확도, 브라우저 로컬 최고 기록
- 도보 구간 1km 이하로 구성된 16개 검증형 데모 문제
- 데스크톱 20:80 패널과 모바일 상·하 분할 반응형 UI

NAVER Web Dynamic Map Client ID를 등록하면 NAVER 지도를 사용합니다. Client ID가 없거나 인증에 실패할 때는 MapLibre + OpenFreeMap으로 자동 전환되므로 지도 없이 게임이 멈추지 않습니다.

## GitHub Pages에 올리기

1. GitHub에서 새 저장소를 만들고 이 폴더의 파일을 전부 업로드합니다.
2. 기본 브랜치 이름을 `main`으로 둡니다.
3. 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
4. `main`에 파일이 올라가면 `.github/workflows/deploy-pages.yml`이 자동으로 정적 게임을 빌드하고 배포합니다.
5. 저장소의 **Actions** 탭에서 `Deploy 환최몇 to GitHub Pages`가 성공했는지 확인합니다.

사용자 사이트 저장소가 `아이디.github.io`라면 `https://아이디.github.io/`, 일반 프로젝트 저장소라면 `https://아이디.github.io/저장소이름/`에서 열립니다. 빌드가 상대 경로를 사용하므로 두 경우 모두 별도 수정이 필요 없습니다.

## 로컬에서 실행하기

Node.js 22.13 이상과 pnpm 11이 필요합니다.

```bash
pnpm install
pnpm dev
```

- 개발 미리보기: `http://localhost:3000`
- GitHub Pages용 정적 빌드: `pnpm build:github`
- 전체 빌드·테스트: `pnpm test`

정적 산출물은 `dist-github/`에 만들어집니다.

## 파일 구조

```text
app/
  components/TransitGame.tsx  게임 상태·UI·점수 계산
  components/GameMap.tsx      지도·마커·정답 경로 렌더링
  data/questions.ts           검증형 문제 팩
github/                       GitHub Pages 정적 진입점
supabase/                     선택형 리더보드 DB·Edge Function
docs/API_SETUP.md             지도·교통 API 조사와 신청 방법
docs/DATA_PIPELINE.md         전국 문제 자동 생성 설계
.github/workflows/            GitHub Pages 자동 배포
```

## 꼭 알아둘 점

현재 버전은 아무 API 신청 없이 플레이할 수 있는 완성형 MVP입니다. 다만 정적 GitHub Pages만으로는 정답 데이터가 브라우저 번들에 포함되므로 개발자 도구로 답을 찾는 것을 완전히 막을 수 없습니다. 경쟁 리더보드를 운영할 때는 `supabase/`의 Edge Function처럼 **정답 판정과 점수 계산을 서버로 옮겨야** 합니다.

전국의 임의 지점을 매일 자동 생성하려면 ODsay 또는 자체 대중교통 그래프가 추가로 필요합니다. 신청 절차와 현실적인 데이터 조합은 [API 설정 가이드](docs/API_SETUP.md), 1km 도보 규칙을 포함한 생성 알고리즘은 [데이터 파이프라인](docs/DATA_PIPELINE.md)에 정리했습니다.

TAGO API 4종을 승인받았다면 인증키를 소스에 넣지 말고 [TAGO 3단계 확인 가이드](docs/TAGO_STEP3.md)에 따라 GitHub Actions에서 연결 검사부터 실행하세요. 네 API가 모두 정상인 것을 확인한 뒤 전국 데이터 수집을 시작합니다.

NAVER Maps 애플리케이션을 등록했다면 [NAVER 지도 연결 가이드](docs/NAVER_MAP_SETUP.md)에 따라 공개 Client ID를 GitHub Actions variable로 등록하세요. Client Secret은 저장소나 GitHub 설정에 넣지 않습니다.

## 데이터 표기

- 기본 지도: NAVER Web Dynamic Map
- 대체 지도: MapLibre GL JS + OpenFreeMap / OpenStreetMap contributors
- 데모 경로: 공개 운행계통을 바탕으로 게임용으로 정규화한 스냅샷

실서비스에서는 노선 개편에 맞춰 문제 팩의 `verifiedLabel`과 경로를 정기적으로 재검증하세요.
