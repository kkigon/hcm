# 3단계 — TAGO API 승인 직후 할 일

이 단계의 목표는 데이터를 수집하는 것이 아니라, 신청한 네 API가 같은 인증키로 실제 응답하는지 먼저 확인하는 것입니다.

## GitHub에서 확인하기

1. `https://github.com/kkigon/hcm`을 엽니다.
2. **Settings → Secrets and variables → Actions**로 이동합니다.
3. **New repository secret**을 누릅니다.
4. Name에 `TAGO_SERVICE_KEY`를 정확히 입력합니다.
5. Secret에는 공공데이터포털의 **일반 인증키(Decoding)** 값을 붙여넣습니다.
6. **Add secret**을 누릅니다.
7. 저장소의 **Actions** 탭을 엽니다.
8. 왼쪽에서 **Check TAGO API access**를 선택합니다.
9. **Run workflow → Run workflow**를 누릅니다.
10. 실행 결과를 열어 네 항목이 모두 초록색 체크인지 확인합니다.

정상 결과는 다음 네 줄입니다.

```text
✅ 버스정류소정보: 정상
✅ 버스노선정보: 정상
✅ 지하철정보: 정상
✅ 열차정보: 정상
```

실패하면 인증키를 채팅이나 Issue에 올리지 말고, 실패한 API 이름과 오류 문구만 공유합니다.

## 로컬에서 확인하기

```bash
cp .env.example .env.local
```

`.env.local`의 `TAGO_SERVICE_KEY=` 뒤에 일반 인증키(Decoding)를 넣고 실행합니다.

```bash
pnpm tago:check
```

`.env.local`은 Git에서 제외되며 커밋되지 않습니다.
