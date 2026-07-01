# Stockcave Project 명세서

## 1. 프로젝트 개요 (Overview)

* **목적:** 기성 증권사 앱의 한계를 넘어, 가족 구성원 개개인의 독립된 멀티 증권 계좌 잔고를 한눈에 관리하고 향후 자산 배분 및 히스토리 추적의 기반이 되는 풀스택 웹 시스템 구축.
* **핵심 가치:** * 가족 간 계좌의 철저한 독립성 유지 (자산 통합 뷰 없음).
* 외부 유출 없는 강력한 폐쇄형 보안 시스템.
* 향후 기능 확장이 언제든 가능한 유연한 아키텍처 확보.


* **배포 환경:** Ubuntu 리눅스 서버 + Docker 컨테이너 환경 기반 24시간 상시 구동.

---

## 2. 기술 스택 (Tech Stack)

| 레이어 | 선택된 기술 | 채택 사유 |
| --- | --- | --- |
| **프레임워크** | **Next.js (TypeScript)** | 프론트엔드와 백엔드 API를 하나로 관리하는 최신 풀스택 트렌드, 안전한 타입 가이드 제공 |
| **데이터베이스** | **SQLite** | 별도 서버 설치 불필요, 데이터베이스 전체가 **'파일 한 개'**로 관리되어 백업 및 Docker 배포 최적화 |
| **ORM (DB 제어)** | **Prisma** | SQL 없이 타입스크립트 코드로 DB 제어 가능, 향후 스키마 변경 시 자동 마이그레이션 지원 |
| **스타일링** | **Tailwind CSS** | HTML 태그 내에 직접 디자인 속성을 주입하여 빠른 유틸리티 기반 레이아웃 구현 |

---

## 3. 데이터베이스 스키마 설계 (Database Schema)

데이터 모델은 `Member(인원) ➡️ Account(계좌) ➡️ StockBalance(주식)`의 3층 구조(1:N 관계)를 따르며, 향후 미국 주식 확장을 위한 통화 필드가 선반영되었습니다.

```prisma
// 1. 가족 구성원 테이블
model Member {
  id            Int            @id @default(autoincrement())
  name          String         @unique                      // 가족 이름 (예: "홍길동")
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  accounts      Account[]
}

// 2. 증권 계좌 테이블
model Account {
  id            Int            @id @default(autoincrement())
  broker        String                                      // 증권사 코드 (예: "KB", "NAMUH")
  accountName   String                                      // 계좌 별칭 (예: "국내주식용", "해외ISA")
  appKey        String                                      // 암호화된 App Key
  secretKey     String                                      // 암호화된 Secret Key
  accountNo     String                                      // 계좌번호
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  memberId      Int
  member        Member         @relation(fields: [memberId], references: [id], onDelete: Cascade)
  balances      StockBalance[]
}

// 3. 실시간 주식 잔고 테이블
model StockBalance {
  id            Int      @id @default(autoincrement())
  ticker        String                                    // 종목 코드 (예: "005930")
  stockName     String                                    // 종목명 (예: "삼성전자")
  quantity      Int                                       // 보유 수량
  avgBuyPrice   Float                                     // 매입 단가
  currentPrice  Float                                     // 실시간 현재가
  currency      String   @default("KRW")                  // 통화 구분 (기본값: 원화)
  updatedAt     DateTime @updatedAt
  accountId     Int
  account       Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, ticker]) // 한 계좌 내 종목 중복 방지
}

```

---

## 4. API 통신 및 보안 레이어 (API & Security)

### A. 증권사 API 통신 매커니즘

* **Server-to-Server 통신:** 웹 브라우저가 아닌 Next.js 백엔드 서버가 증권사 API와 직접 통신하여 Key 유출 위험 원천 차단.
* **토큰 캐싱 기법:** 24시간 유효한 Access Token을 매일 최초 1회만 발급받아 서버 메모리/DB에 저장 후 재사용. (불필요한 중복 호출 방지 및 차단 리스크 제거)
* **API Throttling 기법:** 여러 계좌 동기화 시, 초당 호출 제한을 피하기 위해 서버 단에서 미세한 시간차(예: 0.1초 delay)를 두고 순차적으로 요청 송신.

### B. 3중 보안 구조

1. **양방향 암호화 (AES-256):** DB 파일 유출에 대비하여, 계좌의 `appKey`와 `secretKey`는 무조건 암호화된 외계어 문자열 상태로 DB에 저장.
2. **환경 변수(`.env`) 격리:** 암호화에 사용되는 마스터 패스워드는 소스코드가 아닌 Ubuntu/Docker 환경 변수로 격리 관리.
3. **진입 장벽 레이어:** 대시보드 접근 전, 가족 공용 **PIN 번호(비밀번호) 인증** 과정을 거쳐야만 메인 화면 진입 허용.

---

## 5. UI/UX 및 컴포넌트 구조 (User Interface)

> **💡 제약 조건:** 최종 UI 디자인 스타일과 레이아웃은 유저님이 외부 툴(v0, Figma 등)을 이용해 직접 커스텀하여 입힐 예정. 프로그램은 데이터 전달 및 기본 컴포넌트 구조의 유연성 확보에 집중함.

### A. 화면 흐름 (User Flow)

1. `/login` ➡️ PIN 번호 입력 및 인증
2. `/dashboard` ➡️ 대시보드 메인 진입 (인증 실패 시 진입 불가)
3. `최상단 탭` ➡️ 가족 구성원 선택 (독립 뷰 전환)
4. `중간 카드` ➡️ 해당 인원의 등록된 증권 계좌 목록 표시
5. `하단 테이블` ➡️ 선택된 계좌의 실시간 주식 잔고 출력 (종목명, 수량, 매입단가, 현재가, 수익률, 평가금액)

### B. Next.js 핵심 폴더 구조 (Boilerplate Blueprint)

* `app/page.tsx` : 메인 진입점 (인증 여부 체크 및 라우팅)
* `app/login/page.tsx` : PIN 인증 화면
* `app/dashboard/page.tsx` : 대시보드 메인 레이아웃 원본
* `components/MemberTabs.tsx` : 가족 선택 탭 컴포넌트
* `components/AccountCards.tsx` : 계좌 목록 카드 컴포넌트
* `components/StockTable.tsx` : 주식 잔고 출력용 표 컴포넌트 (유저님의 커스텀 디자인이 입혀질 핵심 타겟)

---

## 6. 미래 확장성 로드맵 (Future Roadmap)

현재 MVP 빌드 단계에서는 구현하지 않으나, 나중에 코드를 갈아엎지 않고 붙일 수 있도록 아키텍처 수준에서 미리 배려해 둔 서랍 속 기능들입니다.

1. **목표 비중 설정 기능:** 인당 종목별 목표 % 입력 후 `[실제 비중 - 목표 비중]`의 단순 갭(Gap) 수치 시각화.
2. **자산 누적 추이 그래프:** Ubuntu 서버 스케줄러(Cron)를 이용해 매일 밤 장 마감 후 총자산 스냅샷을 SQLite에 누적 ➡️ 향후 ApexCharts 등으로 시계열 라인 차트 구현.
3. **전일 대비 등락률 표시:** 증권사 API가 제공하는 전일 종가 데이터를 매핑하여 화면에 당일 등락 퍼센트(%) 표현.
4. **개별 종목 주가 히스토리 차트:** 주식 행 클릭 시, 야후 파이낸스 혹은 증권사 기간별 시세 API를 실시간 호출해 팝업 차트 렌더링 (우리 DB 용량에 부담 주지 않는 구조).

---
## 📂 Next.js + Prisma + Docker 프로젝트 구조안 (Boilerplate Blueprint)

우리가 리눅스 서버에 올릴 프로젝트 폴더의 전체 모습입니다. 파이썬 프로젝트에서 모듈별로 폴더를 나누듯, 역할별로 깔끔하게 격리했습니다.

```text
family-stock-portfolio/
├── app/                           # [Next.js 앱 라우터 영역 (페이지 및 API)]
│   ├── layout.tsx                 # 전체 웹사이트의 기본 레이아웃 (폰트, 스타일 등)
│   ├── page.tsx                   # 메인 진입점 (PIN 인증 여부 체크 후 리다이렉트)
│   ├── login/                     
│   │   └── page.tsx               # PIN 번호 입력 화면 (유저님 커스텀 영역)
│   ├── dashboard/                 
│   │   └── page.tsx               # 메인 대시보드 화면 (가족 탭, 계좌 카드가 배치되는 곳)
│   └── api/                       # [백엔드 API 라우트 영역 (파이썬 Flask/FastAPI의 라우트 역할)]
│       ├── auth/                  
│       │   └── route.ts           # 사용자가 입력한 PIN 번호가 맞는지 검증하는 API
│       └── stock/                 
│           └── route.ts           # 증권사 API 호출 및 실시간 잔고를 반환하는 핵심 백엔드 API
│
├── components/                    # [화면을 이루는 레고 블록 컴포넌트 (유저님 커스텀 영역)]
│   ├── MemberTabs.tsx             # 가족 구성원 선택 탭
│   ├── AccountCards.tsx           # 증권사 계좌 목록 카드
│   └── StockTable.tsx             # 실시간 주식 잔고 출력용 표
│
├── prisma/                        # [데이터베이스 관리 영역]
│   ├── schema.prisma              # 우리가 앞서 확정한 DB 설계도 파일
│   └── dev.db                     # 실제 데이터가 저장될 SQLite 단일 파일 (자동 생성됨)
│
├── lib/                           # [공통 유틸리티 함수 영역]
│   ├── prisma.ts                  # DB 연결을 효율적으로 관리하는 싱글톤 객체
│   └── crypto.ts                  # AppKey, SecretKey를 숨겨줄 AES-256 암호화/복호화 함수
│
├── .env                           # 암호화 마스터 키 및 보안 환경 변수 파일 (Git 제외)
├── .gitignore                     # Git 업로드 제외 목록 설정 파일
├── Dockerfile                     # Next.js 앱을 빌드하기 위한 도커 이미지 생성 명세서
└── docker-compose.yml             # Ubuntu 서버에서 컨테이너를 24시간 가동할 오케스트레이션 파일

```

---

## 🛠️ 핵심 파일들의 역할 및 아키텍처 흐름

1. **`lib/crypto.ts` (보안관):** 유저님이 화면에서 계좌 정보를 입력하면, 이 녀석이 작동해 Key를 암호화한 뒤 DB(`dev.db`)에 집어넣습니다. 반대로 증권사에 토큰을 요청할 때는 복호화해서 가져옵니다.
2. **`app/api/stock/route.ts` (엔진):** 이 대시보드의 심장입니다. 브라우저에서 요청이 오면 DB에서 계좌 정보를 긁어와 증권사와 통신(토큰 캐싱, Throttling 적용)한 뒤 가공된 데이터를 프론트엔드로 넘겨줍니다.
3. **`Dockerfile` & `docker-compose.yml` (포장 박스):** 소스코드가 완성되면 이 파일들을 통해 프로그램 전체를 하나의 박스(도커 이미지)로 포장합니다. Ubuntu 서버에서는 이 박스만 실행하면 소스코드 유출 없이 24시간 안전하게 구동됩니다.

---

유저님이 다른 툴로 디자인하신 HTML/CSS는 `app/login/page.tsx`, `app/dashboard/page.tsx` 및 `components/` 폴더 안의 파일들에 스며들게 됩니다. 데이터 구조와 백엔드 API가 이 폴더 구조대로 딱 잡혀있어야 유저님이 나중에 디자인을 입히실 때 헷갈리지 않고 자리를 찾을 수 있습니다.