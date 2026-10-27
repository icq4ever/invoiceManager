# Changelog | 변경 이력

[English](#english) | [한국어](#korean)

---

## English

### v1.4.1 (2026-10-27)
- Invoice list: tags and the tag button sit next to the project title instead of on a separate line, so rows keep their height and titles stay aligned
- Tag button is always visible (tag icon) instead of appearing only on hover; on mobile it sits next to the status
- Long project titles wrap on their own while tags stay on the right; number, date, amount, status and action columns no longer break mid-word

### v1.4.0 (2026-10-27)
- Invoice list filters
  - Status filter buttons (All / Draft / Confirmed / Discarded) with counts
  - Custom tags: tag filter buttons next to the status filter; status and tag filters combine
  - Filters are kept while searching and paging
- Custom tags
  - "Manage Tags" on the invoice list: add, rename, recolor (10 colors) and delete tags
  - Add or remove tags per invoice with "+ Tag" on each row; an invoice can have several tags
  - Duplicating an invoice copies its tags; deleting a tag keeps the invoices
  - API/MCP invoice details include `tags`
- Invoice form: negative unit prices allowed (e.g. discount lines)
- Schema v1.4.0: added `tags` and `invoice_tags` tables (created automatically on startup)

### v1.3.2 (2026-10-24)
- Email PDF now matches the web print view ([#11](https://github.com/icq4ever/invoiceManager/issues/11))
  - Removed `≡`-like glyphs at line ends (CRLF line breaks from textareas)
  - Multi-line item details no longer overlap the next row
  - Proper space above the total amount when the project/recipient column is taller
  - Logo size and signature position (centered on "(인)") match the web view
  - All text printed in black; only the total amount stays blue
- Invoice view: wider project title (wraps less) while the recipient table keeps its width
- More space below the invoice header (view, print and email PDF)

### v1.3.1 (2026-10-23)
- Database schema cleanup (schema v1.3.1)
  - Consolidated 37 incremental `ALTER TABLE` migrations into a single schema definition; older databases still get missing columns added automatically
  - Dropped unused columns: `companies.bank_info`, `bank_info_en`, `invoices.pdf_path`, `bank_accounts.branch`, `bank_address`, `bank_address_en`, `show_swift`, `show_paypal`
  - Automatic backup (`data/invoice.db.before-1.3.1-<timestamp>.bak`) before columns are dropped; the migration rolls back on failure
- Itemized sub-items: title shown in bold with the description on the next line (invoice view, print and email PDF)
- Restoring a database backup now upgrades its schema immediately (previously only after a restart)
- Fixed inline script `SyntaxError` in the invoice view when a project name contains a real line break, e.g. invoices created via the API/MCP ([#10](https://github.com/icq4ever/invoiceManager/issues/10))
- Fixed names with `&` showing up as `&amp;` in email subjects/bodies

### v1.3.0 (2026-10-23)
- AI support: REST API and remote MCP server ([API](docs/api.md), [MCP](docs/mcp.md))
  - REST API (`/api/v1`): companies, clients, note templates, invoice create/list/get/update/status
  - MCP server (`/mcp`) for claude.ai custom connectors, Claude Code and other MCP clients (9 invoice tools)
  - Auth via `Authorization: Bearer <API_KEY>` or `/mcp/<API_KEY>`; disabled until `API_KEY` is set. Optional `PUBLIC_URL` adds a `web_url` link
- Drag-and-drop reordering for invoice items and sub-items, collapsible items in the invoice form
- Resizable label column in From/To info tables, matching the PDF layout width
- Removed "(부가세 제외)" label; EN "excl. Tax" → "ex. Tax"

### v1.2.6 (2026-03-31)
- Consolidated "Recipient Info" toggle: address, phone, and email shown together
- Client address `\n` displayed as space in detail view, line breaks in PDF
- Replaced LICENSE with AGPL-3.0 full text for GitHub detection
- Display client phone in invoice view and email PDF

### v1.2.5 (2026-03-31)
- Added recipient address display option (toggle per invoice, supports multi-line with Shift+Enter)
- Renamed "Date" label to "Issued" in English locale
- Fixed email body newline rendering (textarea line breaks now show as `<br>` in HTML email)
- Sanitized template variables: `\n` in project name replaced with space to prevent subject truncation
- Email template uses English company name (`company_name_en`) when invoice language is English
- Made "From Email" field readonly in email send modal (determined by SMTP settings)
- Improved email PDF layout to match HTML invoice preview
  - Logo rendering fix (NaN error resolved)
  - Bottom-aligned left/right header columns
  - Full-width summary section (Subtotal/Tax/Total)
  - Dynamic row height for multi-line addresses
  - Notes positioned at page bottom
  - Bank/PayPal display respects invoice preview settings

### v1.2.4
- Added business registration certificate upload for clients (image/PDF)
- Added client detail page with document preview and download
- Client name in list is now clickable to view details
- Added shared Nginx reverse proxy setup guide to README

### v1.2.3 (2026-03-24)
- Added email invoice delivery with SMTP settings and templates
- PDF generation using PDFKit (no Chromium dependency)
- Email PDF attachment now reflects user-adjusted column widths from the invoice view
- Moved admin credentials from .env to database (`set-credentials` command)
- Fixed Docker build: removed app bind mount to prevent cross-platform native module issues
- Respects user language preference in PDF generation

### v1.2.2 (2026-02-03)
- Added data reset feature to dashboard with confirmation dialog
- Invoice number column now visible in desktop view (640px+) instead of XL only (1280px+)
- Fixed newline handling in invoice details for proper text formatting
- Updated README with 6 detailed screenshots showcasing all major features

### v1.2.1 (2026-02-03)
- Hotfix: header layout on invoice preview/edit page

### v1.2.0 (2026-02-03)
- Mobile UI improvements
  - Added GitHub and Bug Report links to mobile side menu
  - Full-width divider between navigation sections
  - Improved dashboard stat card padding
  - Added clear (X) button to search input
- Shortened restore description text for single-line display
- Various UI consistency improvements

### v1.1.0 (2026-02-02)
- Added itemized invoice details mode (sub-items with individual pricing)
- Added invoice status management with dropdown (draft/confirmed/discarded)
- Edit disabled for confirmed/discarded invoices
- Delete confirmation with "cannot restore" warning
- Hybrid search and pagination for invoice/client lists
- Simplified restore UI (full backup only)
- Added database schema version tracking
- Improved invoice view table styling
- Added GitHub link to navigation menu
- Added website and fax fields for company information
- Per-invoice display options (stamp, website, fax, bank info visibility)
- Resizable table columns in invoice preview - drag column headers to adjust widths (saved per invoice)
- Duplicate button in invoice preview page
- Dynamic version badge in navigation header (from package.json)
- Fixed PDF/browser preview style inconsistency (border colors and item group separators)

### v1.0.1 (2026-01-30)
- Fixed invoice prefix not being duplicated when copying invoices
- Bug fixes and improvements

### v1.0.0 (2026-01-25)
- Initial release

---

## Korean

### v1.4.1 (2026-10-27)
- 견적서 목록: 태그와 태그 버튼을 별도 줄이 아닌 프로젝트 제목 옆에 표시 (행 높이 유지, 제목 정렬)
- 태그 버튼을 마우스를 올릴 때만이 아니라 항상 표시 (태그 아이콘), 모바일은 상태 옆에 배치
- 긴 프로젝트 제목은 제목 안에서만 줄바꿈되고 태그는 오른쪽에 유지, 번호/견적일/금액/상태/액션 칸이 글자 단위로 끊기지 않음

### v1.4.0 (2026-10-27)
- 견적서 목록 필터
  - 상태별 필터 버튼 (전체 / 작성중 / 확정 / 폐기) 및 개수 표시
  - 커스텀 태그 필터: 상태 필터 옆에 태그 버튼, 상태와 태그 필터를 함께 적용
  - 검색과 페이지 이동 시에도 필터 유지
- 커스텀 태그
  - 견적서 목록의 "태그 관리"에서 태그 추가, 이름/색상(10가지) 변경, 삭제
  - 각 행의 "+ 태그"로 견적서마다 태그를 붙이거나 해제 (여러 개 가능)
  - 견적서 복제 시 태그도 복사, 태그를 삭제해도 견적서는 유지
  - API/MCP 견적서 상세에 `tags` 추가
- 견적서 폼: 음수 단가 입력 가능 (할인 항목 등)
- 스키마 v1.4.0: `tags`, `invoice_tags` 테이블 추가 (시작 시 자동 생성)

### v1.3.2 (2026-10-24)
- 이메일 PDF를 웹 인쇄 화면과 일치하도록 수정 ([#11](https://github.com/icq4ever/invoiceManager/issues/11))
  - 줄 끝에 찍히던 `≡` 모양 문자 제거 (입력칸의 CRLF 줄바꿈)
  - 여러 줄 세부 내역이 아래 행과 겹치던 문제 수정
  - 프로젝트명/수신 칸이 더 길 때 견적금액 위 간격이 없던 문제 수정
  - 로고 크기와 사인 위치("(인)" 기준 정렬)를 웹 화면과 일치
  - 모든 글자를 검정으로 출력 (합계 금액만 파란색 유지)
- 견적서 보기: 프로젝트명 폭을 넓혀 줄바꿈 감소 (수신 정보 표 폭은 유지)
- 견적서 헤더 아래 간격 확대 (화면, 인쇄, 이메일 PDF)

### v1.3.1 (2026-10-23)
- 데이터베이스 스키마 정리 (스키마 v1.3.1)
  - 누적된 37개의 `ALTER TABLE` 마이그레이션을 하나의 스키마 정의로 통합 (이전 DB는 빠진 컬럼이 자동으로 추가됨)
  - 사용하지 않는 컬럼 삭제: `companies.bank_info`, `bank_info_en`, `invoices.pdf_path`, `bank_accounts.branch`, `bank_address`, `bank_address_en`, `show_swift`, `show_paypal`
  - 컬럼 삭제 전 자동 백업 (`data/invoice.db.before-1.3.1-<시각>.bak`), 실패 시 전체 롤백
- 세부항목: 제목은 볼드, 설명은 다음 줄에 표시 (견적서 보기, 인쇄, 이메일 PDF)
- DB 백업 복원 시 재시작 없이 바로 스키마가 업데이트되도록 개선
- 프로젝트명에 실제 줄바꿈이 들어간 경우(API/MCP로 생성한 견적서 등) 견적서 보기 화면의 스크립트 `SyntaxError` 수정 ([#10](https://github.com/icq4ever/invoiceManager/issues/10))
- 이메일 제목/본문에서 `&`가 `&amp;`로 표시되던 문제 수정

### v1.3.0 (2026-10-23)
- AI 지원: REST API 및 원격 MCP 서버 ([API](docs/api.md), [MCP](docs/mcp.md))
  - REST API (`/api/v1`): 회사·거래처·비고 템플릿 조회, 견적서 생성/목록/조회/수정/상태 변경
  - MCP 서버 (`/mcp`): claude.ai 커스텀 커넥터, Claude Code 등 MCP 클라이언트 지원 (견적서 도구 9개)
  - 인증: `Authorization: Bearer <API_KEY>` 헤더 또는 `/mcp/<API_KEY>`. `API_KEY` 설정 전에는 비활성. `PUBLIC_URL` 설정 시 `web_url` 링크 제공
- 견적서 작성 폼에서 항목·세부항목 드래그 정렬, 항목 접기/펼치기
- 공급자/수신 정보 표의 라벨 컬럼 폭 조절 (PDF 레이아웃 폭과 일치)
- "(부가세 제외)" 문구 삭제, 영문 "excl. Tax" → "ex. Tax"

### v1.2.6 (2026-03-31)
- "수취인 정보" 토글로 통합: 주소, 전화번호, 이메일을 함께 표시
- 클라이언트 주소의 `\n`을 상세 화면에서는 공백으로, PDF에서는 줄바꿈으로 표시
- GitHub 라이선스 인식을 위해 LICENSE를 AGPL-3.0 전문으로 교체
- 견적서 보기 및 이메일 PDF에 클라이언트 전화번호 표시

### v1.2.5 (2026-03-31)
- 수취인 주소 표시 옵션 추가 (견적서별 토글, Shift+Enter로 여러 줄 입력 지원)
- 영문 로케일에서 "Date" 라벨을 "Issued"로 변경
- 이메일 본문 줄바꿈 처리 수정 (입력한 줄바꿈이 HTML 이메일에서 `<br>`로 표시)
- 템플릿 변수 정리: 제목이 잘리지 않도록 프로젝트명의 `\n`을 공백으로 치환
- 견적서 언어가 영문이면 이메일 템플릿에 영문 회사명(`company_name_en`) 사용
- 이메일 발송 창의 "보내는 사람" 이메일을 읽기 전용으로 변경 (SMTP 설정에 따라 결정)
- 이메일 PDF 레이아웃을 HTML 견적서 미리보기와 일치하도록 개선
  - 로고 렌더링 수정 (NaN 오류 해결)
  - 좌우 헤더 컬럼 하단 정렬
  - 합계 영역(소계/부가세/합계) 전체 폭 표시
  - 여러 줄 주소에 맞춰 행 높이 자동 조절
  - 기타 문구를 페이지 하단에 배치
  - 계좌/PayPal 표시가 견적서 미리보기 설정을 따르도록 개선

### v1.2.4
- 클라이언트별 사업자등록증 업로드 기능 추가 (이미지/PDF)
- 클라이언트 상세 보기 페이지 추가 (문서 미리보기 및 다운로드)
- 클라이언트 목록에서 이름 클릭 시 상세 페이지로 이동
- 공유 Nginx 리버스 프록시 설정 가이드 README에 추가

### v1.2.3 (2026-03-24)
- 이메일 견적서 발송 기능 추가 (SMTP 설정 및 템플릿 지원)
- PDFKit 기반 PDF 생성 (Chromium 의존성 제거)
- 이메일 PDF 첨부 시 사용자가 조정한 컬럼 크기가 반영되도록 개선
- 관리자 인증 정보를 .env에서 데이터베이스로 이전 (`set-credentials` 명령어)
- Docker 빌드 수정: 크로스 플랫폼 네이티브 모듈 충돌 방지를 위해 app 바인드 마운트 제거
- PDF 생성 시 사용자 언어 설정 반영

### v1.2.2 (2026-02-03)
- 대시보드에 데이터 초기화 기능 추가 (확인 대화상자 포함)
- 견적서 번호 컬럼이 데스크탑 뷰(640px+)에서 표시되도록 개선 (기존 XL 1280px+ → SM 640px+)
- 견적서 세부내역에서 줄바꿈 처리 개선
- README에 주요 기능을 보여주는 6개의 상세 스크린샷 추가

### v1.2.1 (2026-02-03)
- 핫픽스: 견적서 미리보기/편집 페이지 헤더 레이아웃 수정

### v1.2.0 (2026-02-03)
- 모바일 UI 개선
  - 모바일 사이드 메뉴에 GitHub 및 버그 리포트 링크 추가
  - 네비게이션 섹션 간 전체 너비 구분선
  - 대시보드 통계 카드 패딩 개선
  - 검색창 초기화(X) 버튼 추가
- 복원 설명 텍스트 한 줄로 단축
- 다양한 UI 일관성 개선

### v1.1.0 (2026-02-02)
- 세부항목별 입력 모드 추가 (개별 금액 입력 가능)
- 견적서 상태 관리 드롭다운 추가 (작성중/확정/폐기)
- 확정/폐기 상태에서 수정 버튼 비활성화
- 삭제 시 "복원 불가" 경고 메시지 추가
- 견적서/클라이언트 목록 검색 및 페이지네이션 추가
- 복원 UI 간소화 (전체 백업만 지원)
- 데이터베이스 스키마 버전 관리 추가
- 견적서 보기 테이블 스타일 개선
- 상단 메뉴에 GitHub 링크 추가
- 회사 정보에 웹사이트/팩스 필드 추가
- 견적서별 표시 옵션 저장 (서명, 웹사이트, 팩스, 계좌정보)
- 견적서 미리보기에서 테이블 컬럼 폭 조절 기능 (헤더 드래그로 폭 조절, 견적서별 설정 저장)
- 견적서 미리보기에서 복제 버튼 추가
- 네비게이션 헤더에 동적 버전 표시 (package.json 연동)
- PDF/브라우저 미리보기 스타일 불일치 수정 (테두리 색상 및 항목 그룹 구분선)

### v1.0.1 (2026-01-30)
- 견적서 복제 시 접두사가 복제되지 않는 버그 수정
- 버그 수정 및 개선

### v1.0.0 (2026-01-25)
- 최초 릴리즈
