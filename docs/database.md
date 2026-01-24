# Database Schema | 데이터베이스 스키마

[English](#english) | [한국어](#korean)

---

## English

### Companies Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| name | TEXT | Company name (Korean) |
| name_en | TEXT | Company name (English) |
| representative | TEXT | Representative name (Korean) |
| representative_en | TEXT | Representative name (English) |
| business_number | TEXT | Tax ID |
| address | TEXT | Address (Korean) |
| address_en | TEXT | Address (English) |
| phone | TEXT | Phone number |
| email | TEXT | Email |
| bank_info | TEXT | Bank account info (Korean) |
| bank_info_en | TEXT | Bank account info (English) |
| logo_path | TEXT | Logo image path |
| stamp_path | TEXT | Signature/stamp image path |
| invoice_prefix | TEXT | Invoice number prefix (e.g., INV, S42) |
| is_default | BOOLEAN | Default company flag |
| created_at | DATETIME | Creation timestamp |

### Clients Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| name | TEXT | Client/company name |
| business_number | TEXT | Tax ID |
| contact_person | TEXT | Contact person name |
| phone | TEXT | Phone number |
| email | TEXT | Email address |
| address | TEXT | Address |
| created_at | DATETIME | Creation timestamp |

### Invoices Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_number | TEXT | Invoice number (e.g., INV-2026-0001) |
| company_id | INTEGER FK | Issuing company |
| client_id | INTEGER FK | Client/recipient |
| project_name | TEXT | Project name |
| issue_date | DATE | Invoice issue date |
| validity_period | TEXT | Validity period |
| subtotal | REAL | Subtotal (supply amount) |
| tax_rate | REAL | Tax rate (%) |
| tax_amount | REAL | Tax amount |
| total_amount | REAL | Total amount |
| notes | TEXT | Additional notes (JSON array) |
| status | TEXT | Invoice status |
| currency | TEXT | Currency (KRW, USD, EUR, JPY, GBP, CNY) |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Update timestamp |

### Invoice Items Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_id | INTEGER FK | Parent invoice |
| title | TEXT | Item title |
| details | TEXT | Item details (multiline) |
| quantity | REAL | Quantity |
| unit_price | REAL | Unit price |
| amount | REAL | Total amount (qty × unit_price) |
| sort_order | INTEGER | Display order |

### Note Templates Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| title | TEXT | Template name |
| content | TEXT | Template content |
| is_default | BOOLEAN | Include in new invoices by default |
| sort_order | INTEGER | Display order |
| created_at | DATETIME | Creation timestamp |

---

## Korean

### Companies (회사 정보) 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| name | TEXT | 회사명 (한글) |
| name_en | TEXT | 회사명 (영문) |
| representative | TEXT | 대표자명 (한글) |
| representative_en | TEXT | 대표자명 (영문) |
| business_number | TEXT | 사업자등록번호 |
| address | TEXT | 주소 (한글) |
| address_en | TEXT | 주소 (영문) |
| phone | TEXT | 전화번호 |
| email | TEXT | 이메일 |
| bank_info | TEXT | 계좌정보 (한글) |
| bank_info_en | TEXT | 계좌정보 (영문) |
| logo_path | TEXT | 로고 이미지 경로 |
| stamp_path | TEXT | 서명/도장 이미지 경로 |
| invoice_prefix | TEXT | 견적서 번호 접두사 (예: INV, S42) |
| is_default | BOOLEAN | 기본 회사 여부 |
| created_at | DATETIME | 생성일 |

### Clients (거래처) 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| name | TEXT | 회사/담당자명 |
| business_number | TEXT | 사업자등록번호 |
| contact_person | TEXT | 담당자명 |
| phone | TEXT | 연락처 |
| email | TEXT | 이메일 |
| address | TEXT | 주소 |
| created_at | DATETIME | 생성일 |

### Invoices (견적서) 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| invoice_number | TEXT | 견적서 번호 (예: INV-2026-0001) |
| company_id | INTEGER FK | 발행 회사 |
| client_id | INTEGER FK | 거래처 |
| project_name | TEXT | 프로젝트명 |
| issue_date | DATE | 견적일 |
| validity_period | TEXT | 유효기간 |
| subtotal | REAL | 소계 (공급가액) |
| tax_rate | REAL | 부가세율 (%) |
| tax_amount | REAL | 부가세 |
| total_amount | REAL | 합계 (총액) |
| notes | TEXT | 기타 문구 (JSON 배열) |
| status | TEXT | 상태 |
| currency | TEXT | 통화 (KRW, USD, EUR, JPY, GBP, CNY) |
| created_at | DATETIME | 생성일 |
| updated_at | DATETIME | 수정일 |

### Invoice Items (견적 항목) 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| invoice_id | INTEGER FK | 부모 견적서 |
| title | TEXT | 항목명 |
| details | TEXT | 세부 내역 (여러 줄 가능) |
| quantity | REAL | 수량 |
| unit_price | REAL | 단가 |
| amount | REAL | 금액 (수량 × 단가) |
| sort_order | INTEGER | 정렬 순서 |

### Note Templates (기타 문구 템플릿) 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 고유 ID |
| title | TEXT | 템플릿명 |
| content | TEXT | 템플릿 내용 |
| is_default | BOOLEAN | 기본 포함 여부 |
| sort_order | INTEGER | 정렬 순서 |
| created_at | DATETIME | 생성일 |
