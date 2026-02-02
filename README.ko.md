# 견적서 관리 시스템 (Invoice Manager)

다국어 지원(한글/영문)하는 자체 호스팅 기반 견적서 생성 및 관리 웹 애플리케이션입니다.

[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?logo=github&logoColor=white)](https://github.com/icq4ever/invoiceManager) 

**언어**: [English](README.md) | [한국어](README.ko.md)

## 주요 기능

- 다중 회사 견적서 생성
- 다국어 지원 (한글/영문)
- 거래처 관리
- 동적 항목 추가 및 자동 계산
- 재사용 가능한 기타 문구 템플릿
- PDF 내보내기 및 인쇄
- 다크 모드 지원
- 백업 & 복원
- Docker 배포 지원

## 스크린샷

### 견적서 목록 & 미리보기
![견적서 미리보기](assets/preview.png)

### PDF 출력
![PDF 출력](assets/output.png)

## 빠른 시작

```bash
# 저장소 복제
git clone https://github.com/yourusername/invoice-manager.git
cd invoice-manager

# 환경설정
cp .env.example .env
# .env 파일 수정

# Docker로 실행
docker-compose up --build -d

# http://localhost:3000 접속
```

## 기술 스택

- **백엔드**: Node.js + Express.js
- **데이터베이스**: SQLite
- **프론트엔드**: EJS + Tailwind CSS
- **배포**: Docker

## 문서

| 문서 | 설명 |
|------|------|
| [설치 가이드](docs/installation.md) | 설치 방법 & 환경 변수 |
| [사용 가이드](docs/usage.md) | 애플리케이션 사용법 |
| [Docker 배포](docs/docker.md) | Docker 배포 & Nginx 설정 |
| [데이터베이스](docs/database.md) | 데이터베이스 스키마 참조 |
| [문제 해결](docs/troubleshooting.md) | 일반적인 문제 & 해결책 |

## 후원

Invoice Manager가 도움이 되었다면 개발을 지원해주세요:

- [GitHub Sponsors](https://github.com/sponsors/icq4ever)
- 카카오페이: <br/>
<img src="assets/kakaoDonation.jpg" alt="Kakao Pay" width="300">

## 라이선스

**GNU Affero General Public License v3 (AGPL v3)**

- 자유롭게 사용 및 수정 가능
- 수정 사항은 AGPL v3로 공유 필수
- 웹 서비스 사용 시 소스 코드 공개 필수

자세한 내용은 [LICENSE](LICENSE) 파일 참고.

## 로드맵

- [x] 견적서 상태 관리 (작성중, 확정, 폐기)
- [ ] 이메일로 견적서 전달
- [ ] 결제 추적
- [ ] 다중 사용자 지원

## 기여

1. 저장소 포크
2. 기능 브랜치 생성
3. 풀 리퀘스트 제출

## 변경 이력

### v1.1.0
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

### v1.0.1
- 견적서 복제 시 접두사가 복제되지 않는 버그 수정
- 버그 수정 및 개선

### v1.0.0
- 최초 릴리즈

---

**버전**: 1.1.0 | Node.js, Express, Tailwind CSS로 제작
