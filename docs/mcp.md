# claude.ai Connector (MCP) | claude.ai 커넥터 (MCP)

[한국어](#korean) | [English](#english)

<a id="korean"></a>

## 한국어

견적서매니저 웹서버에는 MCP 엔드포인트(`/mcp`)가 내장되어 있습니다. claude.ai에 커스텀 커넥터로 등록하면 채팅에서 "ABC상사에 웹사이트 구축 견적서 써줘"처럼 요청해 견적서를 작성할 수 있습니다.

### 1. 서버 설정

`.env`에 다음을 추가하고 컨테이너를 다시 빌드합니다 (`docker compose up -d --build`).

```env
API_KEY=<openssl rand -hex 32 로 생성한 값>
PUBLIC_URL=https://invoice.example.com   # 선택: 응답에 견적서 링크(web_url) 포함
```

### 2. HTTPS로 외부 공개

claude.ai는 Anthropic 클라우드에서 접속하므로 `/mcp`가 인터넷에서 **HTTPS**로 접근 가능해야 합니다. nginx 리버스 프록시 예시:

```nginx
location /mcp {
    proxy_pass http://invoice-manager:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

### 3. claude.ai에 커넥터 추가

설정 → 커넥터 → **커스텀 커넥터 추가**

- **Request headers 항목이 보이는 경우 (권장)**
  - URL: `https://invoice.example.com/mcp`
  - Header: `Authorization` = `Bearer <API_KEY>`
- **Request headers 항목이 없는 경우**
  - URL: `https://invoice.example.com/mcp/<API_KEY>`
  - URL 자체가 비밀번호가 되므로 공유하지 마세요. nginx 접근 로그에 URL이 남으므로, 필요하면 해당 location에서 `access_log off;`를 설정하세요.

### 4. 사용

채팅에서 커넥터를 켜고 요청하면 됩니다. 제공되는 도구:

| 도구 | 설명 |
|---|---|
| `list_companies` | 발행 회사·계좌 조회 |
| `search_clients` / `create_client` | 거래처 검색 / 생성 |
| `list_note_templates` | 비고 템플릿 조회 |
| `list_invoices` / `get_invoice` | 견적서 목록 / 상세 |
| `create_invoice` / `update_invoice` | 견적서 생성 / 수정 (항상 draft로 생성) |
| `set_invoice_status` | 상태 변경 (draft / confirmed / discarded) |

삭제 도구는 없습니다. 필드 상세는 [api.md](api.md)와 같습니다.

### 키 교체

`.env`의 `API_KEY`를 바꾸고 `docker compose up -d`로 재시작한 뒤, claude.ai 커넥터 설정의 키(또는 URL)를 새 값으로 바꿉니다.

---

<a id="english"></a>

## English

The Invoice Manager web server has a built-in MCP endpoint (`/mcp`). Register it as a custom connector in claude.ai, then ask in chat, e.g. "Write a website build quotation for ABC Corp."

### 1. Server setup

Add the following to `.env` and rebuild the container (`docker compose up -d --build`).

```env
API_KEY=<generated with openssl rand -hex 32>
PUBLIC_URL=https://invoice.example.com   # optional: include a web_url link to each invoice in responses
```

### 2. Expose over HTTPS

claude.ai connects from Anthropic's cloud, so `/mcp` must be reachable from the internet over **HTTPS**. Example nginx reverse proxy:

```nginx
location /mcp {
    proxy_pass http://invoice-manager:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

### 3. Add the connector in claude.ai

Settings → Connectors → **Add custom connector**

- **If a Request headers section is shown (recommended)**
  - URL: `https://invoice.example.com/mcp`
  - Header: `Authorization` = `Bearer <API_KEY>`
- **If there is no Request headers section**
  - URL: `https://invoice.example.com/mcp/<API_KEY>`
  - The URL itself is the secret, so do not share it. It also appears in nginx access logs; set `access_log off;` in that location if needed.

### 4. Usage

Enable the connector in a chat and ask. Available tools:

| Tool | Description |
|---|---|
| `list_companies` | Issuing companies and bank accounts |
| `search_clients` / `create_client` | Search / create clients |
| `list_note_templates` | Note templates |
| `list_invoices` / `get_invoice` | List / get invoices |
| `create_invoice` / `update_invoice` | Create / update invoices (always created as draft) |
| `set_invoice_status` | Change status (draft / confirmed / discarded) |

There is no delete tool. Field details are the same as in [api.md](api.md).

### Rotating the key

Change `API_KEY` in `.env`, restart with `docker compose up -d`, then update the key (or URL) in the claude.ai connector settings.
