# WebGame

모바일/데스크톱에서 즐길 수 있는 멀티 게임 웹 플랫폼입니다.
바닐라 JS 기반 SPA로 구축되어 있어 프레임워크 의존성 없이 가볍게 실행됩니다.

## 🚀 시작하기

### 로컬 실행

단순히 `index.html`을 브라우저에서 열면 됩니다. 또는 로컬 서버를 사용할 수 있습니다.

```bash
# Python
python -m http.server 8000

# Node.js (npx)
npx serve .

# PowerShell
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 열어주세요.

## 🎮 게임 목록

| 게임 | 설명 |
|------|------|
| **Sirtet** | 블록이 아래서 위로 올라가는 퍼즐 게임 |
| **뱀게임** | 클래식 뱀 게임 — 먹이를 먹고 자라세요! |
| **사과게임** | 사과를 드래그하여 합계가 10이 되게 하는 퍼즐 게임! |

## 📁 프로젝트 구조

```
webGame/
├── index.html              # 진입점 HTML
├── css/
│   └── main.css            # 전역 스타일
├── js/
│   ├── app.js              # SPA 진입점 (라우팅, 렌더링)
│   ├── registry.js         # GameRegistry (게임 등록/관리)
│   ├── router.js           # Hash 기반 라우터
│   └── games/
│       ├── sirtet.js       # Sirtet (역중력 블록 쌓기)
│       ├── snake.js        # 뱀게임
│       └── fruit-box.js    # 사과게임 (퍼즐)
├── docs/
│   └── developer-guide.md  # 새 게임 추가 가이드
└── README.md
```

## 🛠️ 새로운 게임 추가하기

자세한 가이드는 **[Developer Guide](docs/developer-guide.md)**를 참조하세요.

간단히 요약하면:

1. `js/games/` 폴더에 새 게임 파일 생성
2. `GameRegistry.register()` 로 게임 등록
3. `index.html`에 `<script>` 태그 추가

## 🎮 조작법

### Sirtet

| 키 | 동작 |
|----|------|
| ← → | 좌우 이동 |
| ↓ | 회전 |
| ↑ | 소프트 라이즈 (부드럽게 올리기) |
| Space | 하드 라이즈 (강하게 올리기) |
| P | 일시 정지 |

### 뱀게임

| 키 | 동작 |
|----|------|
| ↑ ↓ ← → | 방향 전환 |
| Enter / Space | 게임 시작 |

### 사과게임

| 입력 | 동작 |
|------|------|
| 드래그 (마우스/터치) | 사과 선택 및 이동 — 합계가 10이 되면 사라짐 |
| Enter / Space | 게임 시작 |

## 📜 License

MIT
