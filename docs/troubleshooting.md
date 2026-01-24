# Troubleshooting | 문제 해결

[English](#english) | [한국어](#korean)

---

## English

### Application won't start
```bash
# Check logs
docker-compose logs -f invoice-manager

# Rebuild container
docker-compose down
docker-compose up --build -d
```

### Database locked error
```bash
# Restart the application
docker-compose restart invoice-manager
```

### Uploads not visible
- Verify Docker volume is mounted: `docker volume ls`
- Check file permissions in uploads directory
- Ensure uploads directory exists:
  ```bash
  docker-compose exec invoice-manager ls -la /app/uploads
  ```

### Performance Tips
1. **Database Optimization**: Regular SQLite maintenance
2. **Image Optimization**: Compress logo/stamp images before upload
3. **Browser Cache**: Clear cache if styles don't update
4. **Timezone**: Set TZ variable to match your location

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

### Security Notes
- **Authentication**: Express-session with httpOnly cookies
- **Password Storage**: bcrypt hashing
- **Input Validation**: Server-side validation for all inputs
- **File Upload**: Restricted to image files (jpeg, jpg, png, gif, webp)
- **Database**: SQLite with parameterized queries (SQL injection prevention)

---

## Korean

### 애플리케이션 실행 안 됨
```bash
# 로그 확인
docker-compose logs -f invoice-manager

# 컨테이너 재빌드
docker-compose down
docker-compose up --build -d
```

### 데이터베이스 잠금 오류
```bash
# 애플리케이션 재시작
docker-compose restart invoice-manager
```

### 업로드된 파일이 보이지 않음
- Docker 볼륨이 제대로 마운트되었는지 확인: `docker volume ls`
- 파일 권한 확인
- 업로드 디렉토리 확인:
  ```bash
  docker-compose exec invoice-manager ls -la /app/uploads
  ```

### 성능 최적화 팁
1. **데이터베이스 최적화**: 주기적인 SQLite 유지보수
2. **이미지 최적화**: 업로드 전 로고/서명 이미지 압축
3. **브라우저 캐시**: 스타일 업데이트 시 캐시 삭제
4. **타임존**: 위치에 맞는 TZ 변수 설정

### 지원 브라우저
- Chrome/Edge 90 이상
- Firefox 88 이상
- Safari 14 이상
- 모바일 브라우저 (iOS Safari, Chrome Mobile)

### 보안 참고사항
- **인증**: Express-session + httpOnly 쿠키
- **비밀번호**: bcrypt 해싱으로 안전 저장
- **입력 검증**: 서버 측 검증
- **파일 업로드**: 이미지 파일만 허용 (jpeg, jpg, png, gif, webp)
- **데이터베이스**: 매개변수화된 쿼리로 SQL 주입 방지
