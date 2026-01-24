# Installation Guide | 설치 가이드

[English](#english) | [한국어](#korean)

---

## English

### Prerequisites
- Docker & Docker Compose installed
- Port 3000 available (or configure in docker-compose.yml)

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/invoice-manager.git
   cd invoice-manager
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```env
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=your-secret-key-here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD_HASH=bcrypt-hashed-password
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up --build -d
   ```

4. **Access the application**
   - Open browser: `http://localhost:3000`
   - Login with credentials from `.env`

### Manual Setup (without Docker)

1. **Install dependencies**
   ```bash
   cd app
   npm install
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start the application**
   ```bash
   npm start
   ```

### Change Admin Password

1. **Generate password hash**
   ```bash
   npm run hash-password
   ```

   Or with Docker:
   ```bash
   docker exec -it invoice-manager npm run hash-password
   ```

2. **Update `.env` file**
   ```env
   ADMIN_PASSWORD_HASH='<paste-the-generated-hash-here>'
   ```

3. **Restart the application**
   ```bash
   docker-compose restart invoice-manager
   ```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment (development/production) | production |
| PORT | Server port | 3000 |
| SESSION_SECRET | Session encryption key | fallback-secret-key |
| ADMIN_USERNAME | Login username | admin |
| ADMIN_PASSWORD_HASH | bcrypt hashed password | (required) |
| HTTPS | Enable HTTPS in production | false |
| TZ | Timezone | Asia/Seoul |

---

## Korean

### 필수 조건
- Docker & Docker Compose 설치
- 포트 3000 사용 가능 (필요시 docker-compose.yml에서 변경)

### Docker로 빠른 시작

1. **저장소 복제**
   ```bash
   git clone https://github.com/yourusername/invoice-manager.git
   cd invoice-manager
   ```

2. **환경설정 파일 생성**
   ```bash
   cp .env.example .env
   ```

   `.env` 파일 수정:
   ```env
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=your-secret-key-here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD_HASH=bcrypt-hashed-password
   ```

3. **Docker Compose로 실행**
   ```bash
   docker-compose up --build -d
   ```

4. **애플리케이션 접속**
   - 브라우저: `http://localhost:3000`
   - `.env`의 계정으로 로그인

### 수동 설치 (Docker 없이)

1. **의존성 설치**
   ```bash
   cd app
   npm install
   ```

2. **환경설정 파일 생성**
   ```bash
   cp .env.example .env
   ```

3. **애플리케이션 실행**
   ```bash
   npm start
   ```

### 관리자 비밀번호 변경

1. **비밀번호 해시 생성**
   ```bash
   npm run hash-password
   ```

   Docker에서:
   ```bash
   docker exec -it invoice-manager npm run hash-password
   ```

2. **`.env` 파일 수정**
   ```env
   ADMIN_PASSWORD_HASH='<생성된-해시-붙여넣기>'
   ```

3. **애플리케이션 재시작**
   ```bash
   docker-compose restart invoice-manager
   ```

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| NODE_ENV | 실행 환경 (development/production) | production |
| PORT | 서버 포트 | 3000 |
| SESSION_SECRET | 세션 암호화 키 | fallback-secret-key |
| ADMIN_USERNAME | 로그인 사용자명 | admin |
| ADMIN_PASSWORD_HASH | bcrypt 해시된 비밀번호 | (필수) |
| HTTPS | 프로덕션 HTTPS 활성화 | false |
| TZ | 타임존 | Asia/Seoul |
