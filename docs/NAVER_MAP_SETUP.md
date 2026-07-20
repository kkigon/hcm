# NAVER 지도 연결 — 사용자가 해야 할 일

## 1. NAVER Cloud 애플리케이션 확인

1. NAVER Cloud Console에서 **Services → Application Services → Maps → Application**으로 이동합니다.
2. 환최몇 애플리케이션을 열고 `Dynamic Map`이 선택됐는지 확인합니다.
3. Web 서비스 URL에는 다음 호스트를 등록합니다. 포트 번호와 `/hcm` 같은 경로는 넣지 않습니다.
   - `https://kkigon.github.io`
   - 로컬 개발도 사용할 경우 `http://localhost`
4. 인증 정보에서 **Client ID**만 복사합니다.
5. **Client Secret은 복사하거나 GitHub에 등록하지 않습니다.**

## 2. GitHub Actions variable 등록

1. `https://github.com/kkigon/hcm/settings/variables/actions`를 엽니다.
2. **New repository variable**을 누릅니다.
3. Name에 `VITE_NAVER_MAP_CLIENT_ID`를 입력합니다.
4. Value에 NAVER Maps **Client ID**를 붙여넣습니다.
5. **Add variable**을 누릅니다.

## 3. GitHub Pages 다시 배포

1. `https://github.com/kkigon/hcm/actions/workflows/deploy-pages.yml`을 엽니다.
2. **Run workflow → Run workflow**를 누릅니다.
3. 배포가 끝나면 `https://kkigon.github.io/hcm/`을 새로고침합니다.
4. 지도 오른쪽 아래 표시가 `NAVER 지도 · 경로검색 없음`인지 확인합니다.

`OPEN MAP · NAVER 대체 지도`라고 나오면 표시 위에 마우스를 올려 오류 설명을 확인하고, Client ID와 Web 서비스 URL을 다시 확인합니다.
