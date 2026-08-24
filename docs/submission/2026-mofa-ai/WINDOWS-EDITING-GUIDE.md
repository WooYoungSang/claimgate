# Windows에서 참가신청서 수정·PDF 생성

## 1. Markdown 수정

메모장 또는 VS Code로 `claimgate-oda-participation-application.md`를 엽니다.

대괄호로 표시된 항목만 실제 정보로 교체합니다.

- `[☐ 개인　☐ 팀]` → 예: `☑ 개인　☐ 팀`
- `[성명 또는 팀장명]`
- `[010-0000-0000]`
- `[name@example.com]`
- `[소속 또는 해당 없음]`
- `[팀명 또는 개인 참가]`
- 팀원 정보
- `[월]`, `[일]`, `[성명]`

개인 참가라면 팀명과 팀원 칸에 `해당 없음`을 입력합니다.

## 2. 서명 삽입

`SIGNATURE-PAD.html`을 Edge/Chrome에서 열어 서명하고 `signature.png`로 저장합니다. 저장한 파일을 Markdown 파일과 같은 폴더에 둡니다. PDF 생성 시 두 번째 쪽 서명란에 자동 삽입됩니다.

## 3. PDF 생성

`EXPORT-SUBMISSION-PDFS-WINDOWS.cmd`를 더블클릭하거나 PowerShell 창에서 `.\EXPORT-SUBMISSION-PDFS-WINDOWS.cmd`를 실행합니다. 참가신청서·제품기획서·개인정보 동의서 PDF가 함께 생성됩니다.

순수 Windows CMD가 Microsoft Edge의 PDF 엔진을 실행하여 세 제출 PDF를 생성합니다. PowerShell 실행 정책 변경, 관리자 권한, 물리 프린터와 LibreOffice는 필요하지 않습니다.
