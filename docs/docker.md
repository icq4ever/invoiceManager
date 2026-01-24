# Docker Deployment | Docker 배포

[English](#english) | [한국어](#korean)

---

## English

### Docker Compose Configuration

```yaml
services:
  invoice:
    build: .
    container_name: invoice-manager
    restart: unless-stopped
    expose:
      - "3000"
    volumes:
      - invoice-data:/app/data          # SQLite database
      - invoice-uploads:/app/uploads    # Company images
    env_file:
      - .env
    environment:
      - TZ=Asia/Seoul
      - NODE_ENV=production
    networks:
      - shared

volumes:
  invoice-data:
  invoice-uploads:

networks:
  shared:
    external: true
```

### Nginx Reverse Proxy Setup

Add to nginx.conf:

```nginx
upstream docker-invoice {
    server invoice-manager:3000;
}

server {
    listen 80;
    server_name invoice.example.com;
    server_tokens off;

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://docker-invoice;
    }
}
```

### Useful Commands

```bash
# Start
docker-compose up -d

# Rebuild
docker-compose up --build -d

# View logs
docker-compose logs -f invoice-manager

# Restart
docker-compose restart invoice-manager

# Stop
docker-compose down
```

---

## Korean

### Docker Compose 설정

```yaml
services:
  invoice:
    build: .
    container_name: invoice-manager
    restart: unless-stopped
    expose:
      - "3000"
    volumes:
      - invoice-data:/app/data          # SQLite 데이터베이스
      - invoice-uploads:/app/uploads    # 회사 이미지
    env_file:
      - .env
    environment:
      - TZ=Asia/Seoul
      - NODE_ENV=production
    networks:
      - shared

volumes:
  invoice-data:
  invoice-uploads:

networks:
  shared:
    external: true
```

### Nginx 리버스 프록시 설정

nginx.conf에 추가:

```nginx
upstream docker-invoice {
    server invoice-manager:3000;
}

server {
    listen 80;
    server_name invoice.example.com;
    server_tokens off;

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://docker-invoice;
    }
}
```

### 유용한 명령어

```bash
# 시작
docker-compose up -d

# 재빌드
docker-compose up --build -d

# 로그 확인
docker-compose logs -f invoice-manager

# 재시작
docker-compose restart invoice-manager

# 중지
docker-compose down
```
