# Invoice Manager API v1

[한국어](#korean) | [English](#english)

<a id="korean"></a>

견적서 매니저에 견적서를 생성·조회·수정하기 위한 JSON API입니다.
이 문서는 AI 에이전트에게 그대로 전달해 사용할 수 있도록 작성되었습니다.

## 기본 정보

- **Base URL**: `{BASE_URL}/api/v1` (예: `http://localhost:3006/api/v1`)
- **인증**: 모든 요청에 `Authorization: Bearer {API_KEY}` 헤더 필수
- **요청/응답 형식**: JSON (`Content-Type: application/json`)
- **금액 단위**: 숫자(number)로 전달. 원화는 원 단위 정수 (예: `1500000`)
- **날짜 형식**: `YYYY-MM-DD`

> 서버 설정: `.env`에 `API_KEY=...`를 지정해야 API가 활성화됩니다 (`openssl rand -hex 32`로 생성). 미설정 시 모든 요청이 `503`을 반환합니다.

## 권장 작업 순서 (AI용)

1. `GET /companies` — 발행 회사 확인. 보통 `is_default: true` 회사를 사용하므로 `company_id`는 생략해도 됩니다.
2. `GET /clients?q=거래처명` — 기존 거래처 검색. 있으면 `client_id` 사용, 없으면 견적서 생성 시 `client` 객체로 전달(자동 생성).
3. (선택) `GET /note-templates` — 비고 문구 확인.
4. `POST /invoices` — 견적서 생성. 생성 결과는 항상 `draft` 상태입니다.
5. 응답의 `total_amount`와 항목별 `amount`를 확인하고, 필요하면 `PATCH /invoices/{id}`로 수정.
6. 사용자에게 `web_path`(예: `/invoices/12`)를 안내해 웹에서 확인·PDF 출력하도록 합니다.

**주의**
- 금액(`amount`, `subtotal`, `tax_amount`, `total_amount`)은 서버가 계산합니다. 보내지 마세요.
- 견적서 상태를 `confirmed`로 바꾸는 것은 사용자가 명시적으로 요청했을 때만 하세요.
- 삭제 API는 없습니다. 필요 없는 견적서는 상태를 `discarded`로 변경합니다.
- 알 수 없는 필드를 보내면 `400` 에러가 납니다 (오타 방지). 필드명은 정확히 snake_case로 보내세요.

---

## 견적서 (Invoices)

### POST /invoices — 견적서 생성

#### 요청 필드

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `project_name` | string | ✅ | | 프로젝트명 (견적서 제목) |
| `items` | Item[] | ✅ | | 견적 항목 (1개 이상) |
| `company_id` | integer | | 기본 회사 | 발행 회사 ID |
| `client_id` | integer \| null | | null | 기존 거래처 ID. `client`와 동시 사용 불가 |
| `client` | object | | | `{ name, business_number?, contact_person?, phone?, email?, address? }` — 이름이 **정확히** 일치하는 거래처가 있으면 그것을 사용하고, 없으면 새로 생성 |
| `issue_date` | string | | 오늘 | 견적일 `YYYY-MM-DD` |
| `validity_period` | string | | `"견적일로부터 1개월"` | 유효기간 문구 |
| `currency` | string | | `"KRW"` | `KRW` `USD` `EUR` `JPY` `GBP` `CNY` 중 하나 |
| `tax_rate` | number | | `10` | 부가세율(%). 부가세 없음은 `0` |
| `notes` | string[] | | 기본 비고 템플릿 | 비고 문구 목록. 생략 시 기본(`is_default`) 비고 템플릿이 들어감. 비고 없이 하려면 `[]` |
| `invoice_number` | string | | 자동 생성 | 견적번호. 생략 시 `{회사 prefix}-{연도}-{4자리 순번}` 자동 생성. 중복 시 `409` |

#### Item — 두 가지 형태 중 하나

**(A) 단순 항목** — 제목 + 설명 텍스트 + 수량 × 단가

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `title` | string | ✅ | | 항목명 |
| `unit_price` | number | ✅ | | 단가 |
| `quantity` | number | | `1` | 수량 |
| `details` | string | | `""` | 세부 설명 (줄바꿈 `\n` 가능) |

금액 = `quantity × unit_price`

**(B) 세부 내역 항목** — 하위 항목들의 합계가 항목 금액이 됨

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `title` | string | ✅ | 항목명 |
| `sub_items` | SubItem[] | ✅ | 1개 이상. 이 형태에서는 `details`를 쓸 수 없고, 항목의 `quantity`/`unit_price`는 무시됨 |

SubItem:

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `title` | string | △ | `""` | 세부 항목명 (`title`, `description` 중 최소 하나) |
| `description` | string | △ | `""` | 세부 설명 |
| `quantity` | number | | `1` | 수량 |
| `unit_price` | number | | `0` | 단가 |

항목 금액 = Σ(`quantity × unit_price`)

#### 합계 계산

```
subtotal     = Σ 항목 금액
tax_amount   = subtotal × tax_rate / 100
total_amount = subtotal + tax_amount
```

#### 예시

```http
POST /api/v1/invoices
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "project_name": "ABC상사 웹사이트 구축",
  "client": { "name": "ABC상사", "contact_person": "김철수", "email": "kim@abc.co.kr" },
  "issue_date": "2026-10-23",
  "items": [
    {
      "title": "UI/UX 디자인",
      "details": "메인 1p + 서브 5p\n반응형 포함",
      "quantity": 1,
      "unit_price": 2000000
    },
    {
      "title": "개발",
      "sub_items": [
        { "title": "프론트엔드", "description": "React 기반", "quantity": 10, "unit_price": 300000 },
        { "title": "백엔드", "description": "API 및 관리자", "quantity": 5, "unit_price": 400000 }
      ]
    }
  ],
  "notes": [
    "본 업체는 일반과세사업자로, 견적금액은 공급가액에 세액이 포함되어 있습니다.",
    "최종 비용은 실제 작업 난이도에 따라 조정될 수 있습니다."
  ]
}
```

#### 응답 `201 Created`

견적서 객체(아래 [Invoice 객체](#invoice-객체)) + `client_created`(boolean, `client`로 새 거래처가 생성되었는지).

---

### GET /invoices — 견적서 목록

| 쿼리 | 설명 |
|---|---|
| `q` | 프로젝트명 / 거래처명 / 견적번호 부분 검색 |
| `status` | `draft` \| `confirmed` \| `discarded` |
| `limit` | 기본 20, 최대 100 |
| `offset` | 기본 0 |

```json
{
  "total": 1, "limit": 20, "offset": 0,
  "invoices": [
    {
      "id": 1, "invoice_number": "TST-2026-0001", "status": "draft",
      "project_name": "ABC상사 웹사이트 구축", "issue_date": "2026-10-23",
      "currency": "KRW", "total_amount": 7700000,
      "client_name": "ABC상사", "company_name": "테스트회사"
    }
  ]
}
```

### GET /invoices/{id} — 견적서 상세

[Invoice 객체](#invoice-객체)를 반환합니다. 없으면 `404`.

### PATCH /invoices/{id} — 견적서 수정

`POST /invoices`와 같은 필드를 사용하되 **모두 선택**입니다. 보낸 필드만 변경됩니다.

- `items`를 보내면 기존 항목 **전체가 교체**됩니다 (부분 수정 불가). 항목 하나만 바꾸려면 `GET`으로 받은 `items`를 수정해 전체를 다시 보내면 됩니다. 응답에 포함된 `amount`, `detail_mode`는 그대로 둬도 무시되고 서버가 다시 계산합니다.
- `tax_rate`만 바꿔도 합계가 재계산됩니다.
- `company_id`를 바꾸면 견적서에 표시할 계좌가 새 회사의 기본 계좌로 재설정됩니다. 견적번호는 바뀌지 않습니다.

```json
{ "tax_rate": 0, "notes": ["부가세 별도입니다."] }
```

응답: 수정된 [Invoice 객체](#invoice-객체) + `client_created`.

### POST /invoices/{id}/status — 상태 변경

```json
{ "status": "confirmed" }
```

`status`: `draft`(작성중) \| `confirmed`(확정) \| `discarded`(폐기). 응답: [Invoice 객체](#invoice-객체).

### Invoice 객체

```json
{
  "id": 1,
  "invoice_number": "TST-2026-0001",
  "status": "draft",
  "company": { "id": 1, "name": "테스트회사" },
  "client": { "id": 1, "name": "ABC상사" },
  "project_name": "ABC상사 웹사이트 구축",
  "issue_date": "2026-10-23",
  "validity_period": "견적일로부터 1개월",
  "currency": "KRW",
  "tax_rate": 10,
  "subtotal": 7000000,
  "tax_amount": 700000,
  "total_amount": 7700000,
  "notes": ["..."],
  "items": [
    {
      "title": "UI/UX 디자인", "detail_mode": "text",
      "quantity": 1, "unit_price": 2000000, "amount": 2000000,
      "details": "메인 1p + 서브 5p\n반응형 포함"
    },
    {
      "title": "개발", "detail_mode": "itemized",
      "quantity": 1, "unit_price": 5000000, "amount": 5000000,
      "sub_items": [
        { "title": "프론트엔드", "description": "React 기반", "quantity": 10, "unit_price": 300000, "amount": 3000000 },
        { "title": "백엔드", "description": "API 및 관리자", "quantity": 5, "unit_price": 400000, "amount": 2000000 }
      ]
    }
  ],
  "web_path": "/invoices/1",
  "created_at": "2026-10-23 07:28:54",
  "updated_at": "2026-10-23 07:28:54"
}
```

`company`, `client`는 지정되지 않은 경우 `null`입니다. 서버에 `PUBLIC_URL`이 설정되어 있으면 `web_url`(전체 링크, 예: `https://invoice.example.com/invoices/1`)이 함께 포함됩니다.

---

## 참조 데이터

### GET /companies — 발행 회사 목록

```json
{
  "companies": [
    {
      "id": 1, "name": "테스트회사", "name_en": "Test Co.",
      "business_number": "123-45-67890", "representative": "홍길동",
      "invoice_prefix": "TST", "is_default": true,
      "bank_accounts": [
        { "id": 1, "bank_name": "국민은행", "account_number": "123-456", "account_holder": "테스트회사", "is_enabled": true }
      ]
    }
  ]
}
```

### GET /clients — 거래처 목록/검색

쿼리 `q`: 거래처명·담당자명 부분 검색 (생략 시 전체).

```json
{
  "clients": [
    { "id": 1, "name": "ABC상사", "business_number": null, "contact_person": "김철수",
      "phone": null, "email": "kim@abc.co.kr", "address": null }
  ]
}
```

### POST /clients — 거래처 생성

```json
{ "name": "ABC상사", "business_number": "...", "contact_person": "...", "phone": "...", "email": "...", "address": "..." }
```

`name`만 필수. 같은 이름의 거래처가 이미 있으면 `409`. 응답 `201`: 생성된 거래처 객체.

### GET /note-templates — 비고 템플릿

```json
{
  "note_templates": [
    { "id": 1, "title": "일반과세사업자 안내", "content": "본 업체는 일반과세사업자로, ...", "is_default": true }
  ]
}
```

견적서의 `notes`에는 템플릿 ID가 아니라 `content` 문자열을 넣습니다.

---

## 에러

모든 에러는 다음 형식입니다.

```json
{
  "error": "Validation failed",
  "details": [
    "project_name is required",
    "items[1].unit_price is required (or provide sub_items)"
  ]
}
```

| 코드 | 의미 |
|---|---|
| `400` | 요청 형식 오류·검증 실패 (`details`에 필드별 원인) |
| `401` | API 키 없음/불일치 |
| `404` | 리소스 또는 엔드포인트 없음 |
| `409` | 견적번호 중복, 거래처 이름 중복 |
| `503` | 서버에 `API_KEY` 미설정 (API 비활성) |

`400`의 `details`를 읽고 해당 필드를 고쳐 다시 요청하면 됩니다.

## curl 예시

```bash
export BASE=http://localhost:3006/api/v1
export KEY=your-api-key

curl -H "Authorization: Bearer $KEY" "$BASE/clients?q=ABC"

curl -X POST "$BASE/invoices" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"project_name":"유지보수","client_id":1,"items":[{"title":"월 유지보수","quantity":12,"unit_price":300000}]}'
```

---

<a id="english"></a>

# Invoice Manager API v1 (English)

A JSON API for creating, reading, and updating invoices (quotations) in Invoice Manager.
This document is written so it can be handed to an AI agent as-is.

## Basics

- **Base URL**: `{BASE_URL}/api/v1` (e.g. `http://localhost:3006/api/v1`)
- **Authentication**: every request requires the `Authorization: Bearer {API_KEY}` header
- **Format**: JSON requests and responses (`Content-Type: application/json`)
- **Amounts**: send as numbers. KRW amounts are whole won (e.g. `1500000`)
- **Dates**: `YYYY-MM-DD`

> Server setup: the API is enabled by setting `API_KEY=...` in `.env` (generate one with `openssl rand -hex 32`). If it is not set, every request returns `503`.

## Recommended workflow (for AI agents)

1. `GET /companies` — check the issuing companies. The company with `is_default: true` is normally used, so `company_id` can usually be omitted.
2. `GET /clients?q=<client name>` — search existing clients. Use `client_id` if found; otherwise pass a `client` object when creating the invoice (it is created automatically).
3. (Optional) `GET /note-templates` — check the available note texts.
4. `POST /invoices` — create the invoice. New invoices are always in `draft` status.
5. Check `total_amount` and each item's `amount` in the response; fix anything with `PATCH /invoices/{id}` if needed.
6. Give the user the `web_path` (e.g. `/invoices/12`) so they can review it and export the PDF in the web UI.

**Notes**
- Amounts (`amount`, `subtotal`, `tax_amount`, `total_amount`) are calculated by the server. Do not send them.
- Only change an invoice's status to `confirmed` when the user explicitly asks for it.
- There is no delete endpoint. Set the status to `discarded` for invoices that are no longer needed.
- Unknown fields cause a `400` error (to catch typos). Use the exact snake_case field names.

---

## Invoices

### POST /invoices — Create an invoice

#### Request fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `project_name` | string | ✅ | | Project name (invoice title) |
| `items` | Item[] | ✅ | | Line items (at least one) |
| `company_id` | integer | | default company | Issuing company ID |
| `client_id` | integer \| null | | null | Existing client ID. Cannot be combined with `client` |
| `client` | object | | | `{ name, business_number?, contact_person?, phone?, email?, address? }` — uses the client whose name matches **exactly**, or creates a new one if none exists |
| `issue_date` | string | | today | Issue date `YYYY-MM-DD` |
| `validity_period` | string | | `"견적일로부터 1개월"` | Validity period text (e.g. `"1 month from issue date"`) |
| `currency` | string | | `"KRW"` | One of `KRW` `USD` `EUR` `JPY` `GBP` `CNY` |
| `tax_rate` | number | | `10` | VAT rate (%). Use `0` for no VAT |
| `notes` | string[] | | default note templates | List of note texts. If omitted, the default (`is_default`) note templates are used. Send `[]` for no notes |
| `invoice_number` | string | | auto-generated | Invoice number. If omitted, generated as `{company prefix}-{year}-{4-digit sequence}`. `409` if it already exists |

#### Item — one of two forms

**(A) Simple item** — title + description text + quantity × unit price

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | string | ✅ | | Item name |
| `unit_price` | number | ✅ | | Unit price |
| `quantity` | number | | `1` | Quantity |
| `details` | string | | `""` | Description (line breaks with `\n` allowed) |

Amount = `quantity × unit_price`

**(B) Itemized item** — the item amount is the sum of its sub-items

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Item name |
| `sub_items` | SubItem[] | ✅ | At least one. `details` cannot be used in this form, and the item's own `quantity`/`unit_price` are ignored |

SubItem:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | string | △ | `""` | Sub-item name (at least one of `title` or `description`) |
| `description` | string | △ | `""` | Sub-item description |
| `quantity` | number | | `1` | Quantity |
| `unit_price` | number | | `0` | Unit price |

Item amount = Σ(`quantity × unit_price`)

#### Totals

```
subtotal     = Σ item amounts
tax_amount   = subtotal × tax_rate / 100
total_amount = subtotal + tax_amount
```

#### Example

```http
POST /api/v1/invoices
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "project_name": "ABC Corp. Website Build",
  "client": { "name": "ABC Corp.", "contact_person": "Jane Kim", "email": "jane@abc.com" },
  "issue_date": "2026-10-23",
  "currency": "USD",
  "tax_rate": 0,
  "validity_period": "1 month from issue date",
  "items": [
    {
      "title": "UI/UX Design",
      "details": "1 main page + 5 sub pages\nResponsive layout included",
      "quantity": 1,
      "unit_price": 2000
    },
    {
      "title": "Development",
      "sub_items": [
        { "title": "Frontend", "description": "React-based", "quantity": 10, "unit_price": 300 },
        { "title": "Backend", "description": "API and admin", "quantity": 5, "unit_price": 400 }
      ]
    }
  ],
  "notes": ["Final cost may be adjusted depending on actual work complexity."]
}
```

#### Response `201 Created`

The invoice object (see [Invoice object](#invoice-object)) plus `client_created` (boolean: whether a new client was created from `client`).

---

### GET /invoices — List invoices

| Query | Description |
|---|---|
| `q` | Partial match on project name / client name / invoice number |
| `status` | `draft` \| `confirmed` \| `discarded` |
| `limit` | Default 20, max 100 |
| `offset` | Default 0 |

```json
{
  "total": 1, "limit": 20, "offset": 0,
  "invoices": [
    {
      "id": 1, "invoice_number": "TST-2026-0001", "status": "draft",
      "project_name": "ABC Corp. Website Build", "issue_date": "2026-10-23",
      "currency": "USD", "total_amount": 7000,
      "client_name": "ABC Corp.", "company_name": "Test Company"
    }
  ]
}
```

### GET /invoices/{id} — Get an invoice

Returns an [Invoice object](#invoice-object). `404` if not found.

### PATCH /invoices/{id} — Update an invoice

Uses the same fields as `POST /invoices`, but **all are optional**. Only the fields you send are changed.

- Sending `items` **replaces all existing items** (no partial item updates). To change a single item, take the `items` from `GET`, edit them, and send the whole list back. The `amount` and `detail_mode` fields from the response can be left in; they are ignored and recalculated by the server.
- Changing only `tax_rate` also recalculates the totals.
- Changing `company_id` resets the bank accounts shown on the invoice to the new company's default accounts. The invoice number does not change.

```json
{ "tax_rate": 0, "notes": ["VAT not included."] }
```

Response: the updated [Invoice object](#invoice-object) plus `client_created`.

### POST /invoices/{id}/status — Change status

```json
{ "status": "confirmed" }
```

`status`: `draft` \| `confirmed` \| `discarded`. Response: [Invoice object](#invoice-object).

### Invoice object

```json
{
  "id": 1,
  "invoice_number": "TST-2026-0001",
  "status": "draft",
  "company": { "id": 1, "name": "Test Company" },
  "client": { "id": 1, "name": "ABC Corp." },
  "project_name": "ABC Corp. Website Build",
  "issue_date": "2026-10-23",
  "validity_period": "1 month from issue date",
  "currency": "USD",
  "tax_rate": 0,
  "subtotal": 7000,
  "tax_amount": 0,
  "total_amount": 7000,
  "notes": ["..."],
  "items": [
    {
      "title": "UI/UX Design", "detail_mode": "text",
      "quantity": 1, "unit_price": 2000, "amount": 2000,
      "details": "1 main page + 5 sub pages\nResponsive layout included"
    },
    {
      "title": "Development", "detail_mode": "itemized",
      "quantity": 1, "unit_price": 5000, "amount": 5000,
      "sub_items": [
        { "title": "Frontend", "description": "React-based", "quantity": 10, "unit_price": 300, "amount": 3000 },
        { "title": "Backend", "description": "API and admin", "quantity": 5, "unit_price": 400, "amount": 2000 }
      ]
    }
  ],
  "web_path": "/invoices/1",
  "created_at": "2026-10-23 07:28:54",
  "updated_at": "2026-10-23 07:28:54"
}
```

`company` and `client` are `null` when not set. If `PUBLIC_URL` is set on the server, `web_url` (full link, e.g. `https://invoice.example.com/invoices/1`) is included as well.

---

## Reference data

### GET /companies — Issuing companies

```json
{
  "companies": [
    {
      "id": 1, "name": "테스트회사", "name_en": "Test Company",
      "business_number": "123-45-67890", "representative": "Gildong Hong",
      "invoice_prefix": "TST", "is_default": true,
      "bank_accounts": [
        { "id": 1, "bank_name": "KB Kookmin Bank", "account_number": "123-456", "account_holder": "Test Company", "is_enabled": true }
      ]
    }
  ]
}
```

### GET /clients — List / search clients

Query `q`: partial match on client name or contact person (all clients if omitted).

```json
{
  "clients": [
    { "id": 1, "name": "ABC Corp.", "business_number": null, "contact_person": "Jane Kim",
      "phone": null, "email": "jane@abc.com", "address": null }
  ]
}
```

### POST /clients — Create a client

```json
{ "name": "ABC Corp.", "business_number": "...", "contact_person": "...", "phone": "...", "email": "...", "address": "..." }
```

Only `name` is required. `409` if a client with the same name already exists. Response `201`: the created client object.

### GET /note-templates — Note templates

```json
{
  "note_templates": [
    { "id": 1, "title": "일반과세사업자 안내", "content": "본 업체는 일반과세사업자로, ...", "is_default": true }
  ]
}
```

An invoice's `notes` takes the `content` strings, not template IDs.

---

## Errors

All errors use this format:

```json
{
  "error": "Validation failed",
  "details": [
    "project_name is required",
    "items[1].unit_price is required (or provide sub_items)"
  ]
}
```

| Code | Meaning |
|---|---|
| `400` | Malformed request or validation failure (`details` lists the cause per field) |
| `401` | Missing or invalid API key |
| `404` | Resource or endpoint not found |
| `409` | Duplicate invoice number or client name |
| `503` | `API_KEY` not set on the server (API disabled) |

On a `400`, read `details`, fix the listed fields, and retry the request.

## curl examples

```bash
export BASE=http://localhost:3006/api/v1
export KEY=your-api-key

curl -H "Authorization: Bearer $KEY" "$BASE/clients?q=ABC"

curl -X POST "$BASE/invoices" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"project_name":"Maintenance","client_id":1,"items":[{"title":"Monthly maintenance","quantity":12,"unit_price":300000}]}'
```
