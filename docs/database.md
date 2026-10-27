# Database Schema | 데이터베이스 스키마

[English](#english) | [한국어](#korean)

SQLite (`data/invoice.db`). The schema is defined in one place, `TABLES` in [`app/src/config/database.js`](../app/src/config/database.js), and applied on every start.
SQLite(`data/invoice.db`)를 사용합니다. 스키마는 [`app/src/config/database.js`](../app/src/config/database.js)의 `TABLES` 한 곳에 정의되어 있고, 서버가 시작할 때마다 적용됩니다.

---

## English

### How migrations work
- On start (and right after a backup restore), missing tables and columns are created from `TABLES`.
- Columns listed in `DEPRECATED_COLUMNS` are dropped if present. Before dropping, the database is backed up to `data/invoice.db.before-<version>-<timestamp>.bak`.
- The whole migration runs in one transaction and rolls back on failure.
- To add a column, add it to `TABLES`. It must be nullable or have a constant `DEFAULT` so it can be added to existing databases.

### companies
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| name | TEXT | Company name (Korean) |
| name_en | TEXT | Company name (English) |
| business_number | TEXT | Tax ID |
| representative | TEXT | Representative name (Korean) |
| representative_en | TEXT | Representative name (English) |
| address | TEXT | Address (Korean) |
| address_en | TEXT | Address (English) |
| phone | TEXT | Phone number |
| phone_en | TEXT | Phone number (English) |
| email | TEXT | Email |
| email_en | TEXT | Email (English) |
| website | TEXT | Website URL |
| fax | TEXT | Fax number |
| logo_path | TEXT | Logo image path |
| stamp_path | TEXT | Signature/stamp image path |
| invoice_prefix | TEXT | Invoice number prefix (e.g., INV, ST42). Default `INV` |
| is_default | INTEGER | Default company (1/0) |
| smtp_host | TEXT | SMTP host |
| smtp_port | INTEGER | SMTP port. Default 587 |
| smtp_secure | INTEGER | Use SSL/TLS (1/0) |
| smtp_user | TEXT | SMTP username |
| smtp_pass | TEXT | SMTP password (stored as plain text) |
| smtp_from_name | TEXT | Sender name |
| smtp_from_email | TEXT | Sender email |
| created_at | DATETIME | Creation timestamp |

### bank_accounts
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| company_id | INTEGER FK | Owning company (deleted with the company) |
| bank_name | TEXT | Bank name (Korean) |
| bank_name_en | TEXT | Bank name (English) |
| account_number | TEXT | Account number |
| account_holder | TEXT | Account holder (Korean) |
| account_holder_en | TEXT | Account holder (English) |
| branch_en | TEXT | Branch (shown when the invoice's `show_branch` is on) |
| swift_code | TEXT | SWIFT code |
| bank_code | TEXT | Bank code (international transfer) |
| iban_code | TEXT | IBAN |
| swift_bank_branch | TEXT | Bank name & branch for international transfer |
| swift_bank_address | TEXT | Bank address for international transfer |
| swift_account_name | TEXT | Account name for international transfer |
| paypal_account | TEXT | PayPal account |
| is_enabled | INTEGER | Available for invoices (1/0) |
| sort_order | INTEGER | Display order |
| created_at | DATETIME | Creation timestamp |

### clients
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| name | TEXT | Client/company name |
| business_number | TEXT | Tax ID |
| contact_person | TEXT | Contact person name |
| phone | TEXT | Phone number |
| email | TEXT | Email address |
| address | TEXT | Address (`\n` for line breaks) |
| business_registration_path | TEXT | Uploaded business registration certificate (image/PDF) |
| created_at | DATETIME | Creation timestamp |

### invoices
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_number | TEXT UNIQUE | Invoice number (e.g., INV-2026-0001) |
| company_id | INTEGER FK | Issuing company |
| client_id | INTEGER FK | Client/recipient |
| project_name | TEXT | Project name (`\n` for line breaks) |
| issue_date | DATE | Invoice issue date |
| validity_period | TEXT | Validity period. Default `견적일로부터 1개월` |
| subtotal | REAL | Subtotal (supply amount) |
| tax_rate | REAL | Tax rate (%). Default 10 |
| tax_amount | REAL | Tax amount |
| total_amount | REAL | Total amount |
| notes | TEXT | Notes (JSON array of strings) |
| status | TEXT | `draft`, `confirmed` or `discarded` |
| currency | TEXT | KRW, USD, EUR, JPY, GBP, CNY. Default KRW |
| column_widths | TEXT | Saved item table column widths (JSON array) |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Update timestamp |

Per-invoice display options (1 = show, 0 = hide):

| Column | Default | Description |
|--------|---------|-------------|
| show_logo | 1 | Company logo |
| show_logo_watermark | 0 | Logo watermark |
| show_stamp | 1 | Signature/stamp |
| show_tax_id | 1 | Tax ID |
| show_website | 1 | Website row |
| show_fax | 1 | Fax row |
| show_client_address | 0 | Recipient info (address, phone, email) |
| show_bank_info | 1 | Bank account rows |
| show_swift | 0 | Show international (SWIFT) transfer info instead of local |
| show_paypal | 0 | PayPal account |
| show_account_holder | 1 | Account holder |
| show_branch | 0 | Branch |

### invoice_bank_accounts
Bank accounts shown on each invoice. New invoices link all enabled accounts of the company.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_id | INTEGER FK | Invoice (deleted with the invoice) |
| bank_account_id | INTEGER FK | Bank account (deleted with the account) |

`(invoice_id, bank_account_id)` is unique.

### invoice_tags
Tags attached to each invoice. An invoice can have several tags.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_id | INTEGER FK | Invoice (removed with the invoice) |
| tag_id | INTEGER FK | Tag (removed with the tag) |

`(invoice_id, tag_id)` is unique.

### tags
User-defined invoice tags, managed from the invoice list ("Manage Tags").

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| name | TEXT UNIQUE | Tag name (max 30 characters) |
| color | TEXT | Palette key: gray, red, orange, amber, green, teal, blue, indigo, purple, pink (default gray) |
| sort_order | INTEGER | Display order |
| created_at | DATETIME | Created at |

### invoice_items
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_id | INTEGER FK | Parent invoice (deleted with the invoice) |
| title | TEXT | Item title |
| details | TEXT | Item details (multi-line, text mode) |
| quantity | REAL | Quantity |
| unit_price | REAL | Unit price (itemized mode: sum of sub-items) |
| amount | REAL | Amount (text mode: qty × unit price, itemized mode: sum of sub-items) |
| sort_order | INTEGER | Display order |
| detail_mode | TEXT | `text` or `itemized` |

### invoice_item_details (itemized mode)
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| item_id | INTEGER FK | Parent invoice item (deleted with the item) |
| title | TEXT | Sub-item title (shown in bold) |
| description | TEXT | Sub-item description (shown on the next line) |
| quantity | REAL | Quantity |
| unit_price | REAL | Unit price |
| amount | REAL | Amount (qty × unit price) |
| sort_order | INTEGER | Display order |

### note_templates
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| title | TEXT | Template name |
| content | TEXT | Template content |
| is_default | INTEGER | Included in new invoices by default (1/0) |
| sort_order | INTEGER | Display order |
| created_at | DATETIME | Creation timestamp |

### email_templates
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| company_id | INTEGER FK | Owning company (deleted with the company) |
| name | TEXT | Template name |
| subject | TEXT | Subject (supports `{{variables}}`) |
| body | TEXT | Body (supports `{{variables}}`) |
| is_default | INTEGER | Default template (1/0) |
| created_at | DATETIME | Creation timestamp |

### email_log
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_id | INTEGER FK | Invoice (set to NULL when the invoice is deleted) |
| recipient_email | TEXT | Recipient |
| from_email | TEXT | Sender email |
| from_name | TEXT | Sender name |
| subject | TEXT | Subject |
| status | TEXT | `sent` or `failed` |
| error_message | TEXT | Error message when failed |
| sent_at | DATETIME | Sent timestamp |

### admin_settings
Single row (`id = 1`) with the admin login. Set with `npm run set-credentials`.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Always 1 |
| username | TEXT | Admin username |
| password_hash | TEXT | bcrypt hash |
| updated_at | DATETIME | Update timestamp |

### schema_version
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| version | TEXT | Schema version |
| applied_at | DATETIME | Applied timestamp |
| description | TEXT | Description |

---

## Korean

### 마이그레이션 방식
- 서버 시작 시(그리고 백업 복원 직후) `TABLES` 정의를 기준으로 빠진 테이블과 컬럼을 만듭니다.
- `DEPRECATED_COLUMNS`에 있는 컬럼이 남아 있으면 삭제합니다. 삭제 전에 `data/invoice.db.before-<버전>-<시각>.bak`으로 자동 백업합니다.
- 전체 마이그레이션은 하나의 트랜잭션으로 실행되며, 실패하면 롤백됩니다.
- 컬럼을 추가하려면 `TABLES`에 추가하세요. 기존 DB에도 추가될 수 있도록 NULL 허용이거나 상수 `DEFAULT`가 있어야 합니다.

### companies (회사 정보)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| name | TEXT | 회사명 (한글) |
| name_en | TEXT | 회사명 (영문) |
| business_number | TEXT | 사업자등록번호 |
| representative | TEXT | 대표자명 (한글) |
| representative_en | TEXT | 대표자명 (영문) |
| address | TEXT | 주소 (한글) |
| address_en | TEXT | 주소 (영문) |
| phone | TEXT | 전화번호 |
| phone_en | TEXT | 전화번호 (영문) |
| email | TEXT | 이메일 |
| email_en | TEXT | 이메일 (영문) |
| website | TEXT | 웹사이트 URL |
| fax | TEXT | 팩스번호 |
| logo_path | TEXT | 로고 이미지 경로 |
| stamp_path | TEXT | 서명/도장 이미지 경로 |
| invoice_prefix | TEXT | 견적서 번호 접두사 (예: INV, ST42). 기본값 `INV` |
| is_default | INTEGER | 기본 회사 여부 (1/0) |
| smtp_host | TEXT | SMTP 호스트 |
| smtp_port | INTEGER | SMTP 포트. 기본값 587 |
| smtp_secure | INTEGER | SSL/TLS 사용 여부 (1/0) |
| smtp_user | TEXT | SMTP 사용자명 |
| smtp_pass | TEXT | SMTP 비밀번호 (평문 저장) |
| smtp_from_name | TEXT | 보내는 사람 이름 |
| smtp_from_email | TEXT | 보내는 사람 이메일 |
| created_at | DATETIME | 생성일 |

### bank_accounts (계좌)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| company_id | INTEGER FK | 소속 회사 (회사 삭제 시 함께 삭제) |
| bank_name | TEXT | 은행명 (한글) |
| bank_name_en | TEXT | 은행명 (영문) |
| account_number | TEXT | 계좌번호 |
| account_holder | TEXT | 예금주 (한글) |
| account_holder_en | TEXT | 예금주 (영문) |
| branch_en | TEXT | 지점 (견적서의 `show_branch`가 켜져 있을 때 표시) |
| swift_code | TEXT | SWIFT 코드 |
| bank_code | TEXT | 은행 코드 (해외 송금용) |
| iban_code | TEXT | IBAN |
| swift_bank_branch | TEXT | 해외 송금용 은행명 및 지점 |
| swift_bank_address | TEXT | 해외 송금용 은행 주소 |
| swift_account_name | TEXT | 해외 송금용 예금주명 |
| paypal_account | TEXT | PayPal 계정 |
| is_enabled | INTEGER | 견적서에서 사용 가능 여부 (1/0) |
| sort_order | INTEGER | 정렬 순서 |
| created_at | DATETIME | 생성일 |

### clients (거래처)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| name | TEXT | 회사/담당자명 |
| business_number | TEXT | 사업자등록번호 |
| contact_person | TEXT | 담당자명 |
| phone | TEXT | 연락처 |
| email | TEXT | 이메일 |
| address | TEXT | 주소 (`\n`으로 줄바꿈) |
| business_registration_path | TEXT | 업로드한 사업자등록증 (이미지/PDF) |
| created_at | DATETIME | 생성일 |

### invoices (견적서)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| invoice_number | TEXT UNIQUE | 견적서 번호 (예: INV-2026-0001) |
| company_id | INTEGER FK | 발행 회사 |
| client_id | INTEGER FK | 거래처 |
| project_name | TEXT | 프로젝트명 (`\n`으로 줄바꿈) |
| issue_date | DATE | 견적일 |
| validity_period | TEXT | 유효기간. 기본값 `견적일로부터 1개월` |
| subtotal | REAL | 소계 (공급가액) |
| tax_rate | REAL | 부가세율 (%). 기본값 10 |
| tax_amount | REAL | 부가세 |
| total_amount | REAL | 합계 (총액) |
| notes | TEXT | 기타 문구 (문자열 JSON 배열) |
| status | TEXT | `draft`(작성중), `confirmed`(확정), `discarded`(폐기) |
| currency | TEXT | KRW, USD, EUR, JPY, GBP, CNY. 기본값 KRW |
| column_widths | TEXT | 항목 표 컬럼 폭 설정 (JSON 배열) |
| created_at | DATETIME | 생성일 |
| updated_at | DATETIME | 수정일 |

견적서별 표시 옵션 (1 = 표시, 0 = 숨김):

| 컬럼 | 기본값 | 설명 |
|------|--------|------|
| show_logo | 1 | 회사 로고 |
| show_logo_watermark | 0 | 로고 워터마크 |
| show_stamp | 1 | 서명/도장 |
| show_tax_id | 1 | 사업자등록번호 |
| show_website | 1 | 웹사이트 |
| show_fax | 1 | 팩스 |
| show_client_address | 0 | 수취인 정보 (주소, 전화번호, 이메일) |
| show_bank_info | 1 | 계좌정보 |
| show_swift | 0 | 국내 계좌 대신 해외 송금(SWIFT) 정보 표시 |
| show_paypal | 0 | PayPal 계정 |
| show_account_holder | 1 | 예금주 |
| show_branch | 0 | 지점 |

### invoice_bank_accounts (견적서별 표시 계좌)
견적서에 표시할 계좌입니다. 새 견적서는 회사의 사용 가능한 계좌가 모두 연결됩니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| invoice_id | INTEGER FK | 견적서 (견적서 삭제 시 함께 삭제) |
| bank_account_id | INTEGER FK | 계좌 (계좌 삭제 시 함께 삭제) |

`(invoice_id, bank_account_id)` 조합은 중복될 수 없습니다.

### invoice_tags (견적서별 태그)
견적서에 붙인 태그입니다. 견적서 하나에 여러 태그를 붙일 수 있습니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| invoice_id | INTEGER FK | 견적서 (견적서 삭제 시 함께 삭제) |
| tag_id | INTEGER FK | 태그 (태그 삭제 시 함께 삭제) |

`(invoice_id, tag_id)` 조합은 중복될 수 없습니다.

### tags (태그)
견적서 목록의 "태그 관리"에서 만드는 사용자 정의 태그입니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| name | TEXT UNIQUE | 태그 이름 (최대 30자) |
| color | TEXT | 색상 키: gray, red, orange, amber, green, teal, blue, indigo, purple, pink (기본 gray) |
| sort_order | INTEGER | 표시 순서 |
| created_at | DATETIME | 생성일 |

### invoice_items (견적 항목)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| invoice_id | INTEGER FK | 부모 견적서 (견적서 삭제 시 함께 삭제) |
| title | TEXT | 항목명 |
| details | TEXT | 세부 내역 (여러 줄 가능, text 모드용) |
| quantity | REAL | 수량 |
| unit_price | REAL | 단가 (itemized 모드: 세부항목 합계) |
| amount | REAL | 금액 (text 모드: 수량 × 단가, itemized 모드: 세부항목 합계) |
| sort_order | INTEGER | 정렬 순서 |
| detail_mode | TEXT | `text` 또는 `itemized` |

### invoice_item_details (세부항목, itemized 모드용)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| item_id | INTEGER FK | 부모 견적 항목 (항목 삭제 시 함께 삭제) |
| title | TEXT | 세부항목 제목 (볼드로 표시) |
| description | TEXT | 세부항목 설명 (다음 줄에 표시) |
| quantity | REAL | 수량 |
| unit_price | REAL | 단가 |
| amount | REAL | 금액 (수량 × 단가) |
| sort_order | INTEGER | 정렬 순서 |

### note_templates (기타 문구 템플릿)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| title | TEXT | 템플릿명 |
| content | TEXT | 템플릿 내용 |
| is_default | INTEGER | 새 견적서에 기본 포함 여부 (1/0) |
| sort_order | INTEGER | 정렬 순서 |
| created_at | DATETIME | 생성일 |

### email_templates (이메일 템플릿)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| company_id | INTEGER FK | 소속 회사 (회사 삭제 시 함께 삭제) |
| name | TEXT | 템플릿명 |
| subject | TEXT | 제목 (`{{변수}}` 지원) |
| body | TEXT | 본문 (`{{변수}}` 지원) |
| is_default | INTEGER | 기본 템플릿 여부 (1/0) |
| created_at | DATETIME | 생성일 |

### email_log (이메일 발송 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| invoice_id | INTEGER FK | 견적서 (견적서 삭제 시 NULL) |
| recipient_email | TEXT | 받는 사람 |
| from_email | TEXT | 보내는 사람 이메일 |
| from_name | TEXT | 보내는 사람 이름 |
| subject | TEXT | 제목 |
| status | TEXT | `sent`(발송) 또는 `failed`(실패) |
| error_message | TEXT | 실패 시 오류 메시지 |
| sent_at | DATETIME | 발송일시 |

### admin_settings (관리자 계정)
관리자 로그인 정보가 담긴 한 줄(`id = 1`)짜리 테이블입니다. `npm run set-credentials`로 설정합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 항상 1 |
| username | TEXT | 관리자 아이디 |
| password_hash | TEXT | bcrypt 해시 |
| updated_at | DATETIME | 수정일 |

### schema_version (스키마 버전)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| version | TEXT | 스키마 버전 |
| applied_at | DATETIME | 적용일 |
| description | TEXT | 설명 |

---

## Schema Version History | 스키마 버전 히스토리

| Version | Date | Description |
|---------|------|-------------|
| 1.4.0 | 2026-10 | Invoice tags (`tags`, `invoice_tags`) |
| 1.3.1 | 2026-10 | Schema cleanup: dropped unused columns (`companies.bank_info`, `bank_info_en`, `invoices.pdf_path`, `bank_accounts.branch`, `bank_address`, `bank_address_en`, `show_swift`, `show_paypal`). Migrations consolidated into one schema definition; a backup (`invoice.db.before-1.3.1-*.bak`) is created automatically before columns are dropped |
| 1.3.0 | 2026-03 | Multiple bank accounts per company (`bank_accounts`, `invoice_bank_accounts`); legacy `bank_info` migrated |
| 1.2.0 | 2026-03 | SMTP settings per company, email templates and email log |
| 1.1.0 | 2026-02 | Added itemized invoice details, status management, website/fax fields for companies, per-invoice display options & column widths, search indexes |
| 1.0.0 | - | Initial schema |
