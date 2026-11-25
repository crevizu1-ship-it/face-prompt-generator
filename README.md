# Face Dataset Studio

미드저니 얼굴 학습용 랜덤 프롬프트 생성기. `index.html`을 브라우저로 열면 동작합니다.

- 1~200개 생성, 기본 무표정 비율 80% (반올림하여 정확한 개수 지정)
- 선택된 헤어·머리 각도·의상·배경을 셔플한 뒤 고르게 순환하여 샘플링
- 배경 40종: 단색 스튜디오, 실내, 실외. 전체 해제하면 배경 프롬프트 생략.
- 전체/개별 복사 및 TXT 저장
- 공통 프롬프트와 미드저니 파라미터 수정
- 네트워크, API 키, 서버, 외부 라이브러리 불필요

## GitHub Pages

저장소 루트에 `index.html`을 커밋하고 Settings → Pages → Deploy from a branch → main / (root) → Save를 선택합니다. 저장소 공개 여부 및 GitHub 요금제에 따라 Pages 사용 가능 여부가 다릅니다.

## 생성 규칙

얼굴형·눈 색·머리 색은 무작위로 변경하지 않습니다. 특정 배경과 얼굴이 과하게 연관되지 않도록 배경을 다양화하고, 실내·실외는 흐릿하게 묘사합니다. 동일 인물 참조 이미지를 Midjourney에 별도 적용하고, 실제 얼굴 일치 여부와 각도를 검수하세요.

## 스타일 목록

무표정: `neutral facial expression, relaxed facial muscles, closed lips`

### 헤어 (65종)

| 한국어 | 영어 프롬프트 |
|---|---|
| 긴 생머리 | long straight hair |
| 매끈한 장발 | sleek long straight hair |
| 허리 길이 생머리 | waist-length straight hair |
| 중간 길이 생머리 | medium-length straight hair |
| 어깨 길이 생머리 | shoulder-length straight hair |
| 긴 레이어드컷 | long layered hair |
| 중간 레이어드컷 | medium layered hair |
| 버터플라이컷 | butterfly haircut |
| 허쉬컷 | soft shag haircut |
| 울프컷 | wolf cut |
| 샤기컷 | shag haircut |
| 히메컷 | hime cut |
| 긴 S컬 | long S-shaped waves |
| 굵은 웨이브 | long loose waves |
| 자연스러운 웨이브 | natural wavy hair |
| 물결 웨이브 | mermaid waves |
| 할리우드 웨이브 | Hollywood waves |
| 비치 웨이브 | soft beach waves |
| 잔웨이브 | fine wavy hair |
| 히피펌 | loose spiral curls |
| 풍성한 곱슬머리 | voluminous curly hair |
| C컬 단발 | inward-curled bob |
| C컬 중단발 | shoulder-length C-curl hair |
| 칼단발 | sleek blunt bob |
| 턱선 단발 | chin-length bob |
| 롱보브 | long bob |
| 웨이브 단발 | wavy bob |
| 프렌치 보브 | French bob |
| 레이어드 단발 | layered bob |
| 숏컷 | short cropped hair |
| 픽시컷 | pixie cut |
| 긴 머리 5:5 가르마 | long hair with middle part |
| 긴 머리 7:3 가르마 | long hair with deep side part |
| 한쪽 귀 뒤로 넘긴 머리 | hair tucked behind one ear |
| 양쪽 귀 뒤로 넘긴 머리 | hair tucked behind both ears |
| 앞머리 없는 올백 | slicked-back hair |
| 일자 앞머리 장발 | long hair with blunt bangs |
| 시스루뱅 장발 | long hair with wispy bangs |
| 커튼뱅 장발 | long hair with curtain bangs |
| 사이드뱅 장발 | long hair with side-swept bangs |
| 풀뱅 단발 | bob with full bangs |
| 시스루뱅 단발 | bob with wispy bangs |
| 짧은 처피뱅 | short choppy bangs |
| 높은 포니테일 | high ponytail |
| 낮은 포니테일 | low ponytail |
| 중간 높이 포니테일 | mid-height ponytail |
| 사이드 포니테일 | side ponytail |
| 웨이브 포니테일 | wavy ponytail |
| 버블 포니테일 | bubble ponytail |
| 반묶음 | half-up half-down hair |
| 반묶음 웨이브 | half-up half-down wavy hair |
| 반묶음 번 | half-up bun |
| 높은 번 | high bun |
| 낮은 번 | low bun |
| 깔끔한 번 | sleek bun |
| 자연스러운 번 | loose messy bun |
| 양쪽 번 | space buns |
| 높은 양갈래 | high twin tails |
| 낮은 양갈래 | low twin tails |
| 양갈래 땋은 머리 | twin braids |
| 한쪽 땋은 머리 | side braid |
| 프렌치 브레이드 | French braid |
| 더치 브레이드 | Dutch braid |
| 피쉬테일 브레이드 | fishtail braid |
| 뒤로 넘긴 웨이브 | swept-back wavy hair |

### 머리 각도 (34종)

| 한국어 | 영어 프롬프트 |
|---|---|
| 정면 | straight-on front view, head upright |
| 왼쪽 살짝 회전 | head turned slightly left |
| 오른쪽 살짝 회전 | head turned slightly right |
| 왼쪽 3/4 | left three-quarter view |
| 오른쪽 3/4 | right three-quarter view |
| 왼쪽 측면에 가깝게 | left near-profile view |
| 오른쪽 측면에 가깝게 | right near-profile view |
| 완전 왼쪽 측면 | full left side profile |
| 완전 오른쪽 측면 | full right side profile |
| 정면 턱 살짝 위 | front view, chin slightly raised |
| 정면 턱 위 | front view, chin raised |
| 정면 턱 살짝 아래 | front view, chin slightly lowered |
| 정면 턱 아래 | front view, chin lowered |
| 정면 고개 깊게 아래 | front view, head bowed downward |
| 왼쪽 사선 위 | left three-quarter view, chin raised |
| 오른쪽 사선 위 | right three-quarter view, chin raised |
| 왼쪽 사선 아래 | left three-quarter view, chin lowered |
| 오른쪽 사선 아래 | right three-quarter view, chin lowered |
| 왼쪽 측면 위 | left side profile, chin raised |
| 오른쪽 측면 위 | right side profile, chin raised |
| 왼쪽 측면 아래 | left side profile, chin lowered |
| 오른쪽 측면 아래 | right side profile, chin lowered |
| 정면 왼쪽 기울임 | front view, head tilted toward left shoulder |
| 정면 오른쪽 기울임 | front view, head tilted toward right shoulder |
| 왼쪽 사선 기울임 | left three-quarter view, gentle sideways head tilt |
| 오른쪽 사선 기울임 | right three-quarter view, gentle sideways head tilt |
| 왼쪽 어깨 너머 | looking back over left shoulder, face clearly visible |
| 오른쪽 어깨 너머 | looking back over right shoulder, face clearly visible |
| 살짝 높은 카메라 | slightly high-angle portrait, head upright |
| 살짝 낮은 카메라 | slightly low-angle portrait, head upright |
| 위에서 왼쪽 사선 | high-angle left three-quarter portrait |
| 위에서 오른쪽 사선 | high-angle right three-quarter portrait |
| 아래에서 왼쪽 사선 | low-angle left three-quarter portrait |
| 아래에서 오른쪽 사선 | low-angle right three-quarter portrait |

### 의상 (60종)

| 한국어 | 영어 프롬프트 |
|---|---|
| 흰색 기본 티셔츠 | plain white crew-neck T-shirt |
| 검은색 기본 티셔츠 | plain black crew-neck T-shirt |
| 회색 티셔츠 | plain gray T-shirt |
| 네이비 티셔츠 | navy blue T-shirt |
| 베이지 티셔츠 | beige T-shirt |
| 연분홍 티셔츠 | pale pink T-shirt |
| 하늘색 티셔츠 | light blue T-shirt |
| 스트라이프 티셔츠 | striped T-shirt |
| 흰색 브이넥 | white V-neck T-shirt |
| 검은색 브이넥 | black V-neck T-shirt |
| 라운드넥 긴팔 | long-sleeved crew-neck shirt |
| 흰색 셔츠 | white button-up shirt |
| 검은색 셔츠 | black button-up shirt |
| 하늘색 셔츠 | light blue button-up shirt |
| 체크 셔츠 | plaid shirt |
| 오버사이즈 셔츠 | oversized cotton shirt |
| 아이보리 블라우스 | ivory blouse |
| 검은색 블라우스 | black blouse |
| 실크 블라우스 | silk blouse |
| 라운드넥 니트 | crew-neck knit sweater |
| 크림색 니트 | cream knit sweater |
| 회색 니트 | gray knit sweater |
| 검은색 니트 | black knit sweater |
| 브이넥 니트 | V-neck sweater |
| 터틀넥 니트 | black turtleneck sweater |
| 아이보리 터틀넥 | ivory turtleneck sweater |
| 목이 낮은 니트 | scoop-neck knit top |
| 단추 카디건 | button-front cardigan |
| 베이지 카디건 | beige cardigan |
| 크롭 카디건 | cropped cardigan |
| 흰색 민소매 | white sleeveless top |
| 검은색 민소매 | black sleeveless top |
| 골지 민소매 | ribbed tank top |
| 스포츠 티셔츠 | athletic T-shirt |
| 트레이닝 재킷 | zip-up track jacket |
| 회색 맨투맨 | gray crew-neck sweatshirt |
| 흰색 맨투맨 | white sweatshirt |
| 후드티 | casual hoodie, hood down |
| 검은 후드 집업 | black zip-up hoodie, hood down |
| 청재킷 | blue denim jacket |
| 검은 가죽 재킷 | black leather jacket |
| 봄버 재킷 | bomber jacket |
| 검은 블레이저 | black blazer over a plain top |
| 베이지 블레이저 | beige blazer |
| 트위드 재킷 | tweed jacket |
| 트렌치코트 | light beige trench coat |
| 울 코트 | wool coat |
| 흰색 폴로셔츠 | white polo shirt |
| 네이비 폴로셔츠 | navy polo shirt |
| 오프숄더 니트 | off-shoulder knit top |
| 스퀘어넥 상의 | square-neck top |
| 검은색 심플 원피스 | simple black dress |
| 꽃무늬 원피스 | subtle floral dress |
| 아이보리 원피스 | simple ivory dress |
| 흰색 크롭티 | plain white cropped T-shirt |
| 검은색 크롭티 | plain black cropped T-shirt |
| 데님 셔츠 | denim shirt |
| 리넨 셔츠 | linen shirt |
| 세일러칼라 블라우스 | sailor-collar blouse |
| 새틴 셔츠 | satin shirt |

### 미세 표정 (20종)

| 한국어 | 영어 프롬프트 |
|---|---|
| 옅은 미소 | very subtle closed-mouth smile |
| 미세한 미소 | faint smile |
| 살짝 올라간 입꼬리 | slightly upturned mouth corners |
| 부드러운 눈빛 | soft relaxed gaze |
| 살짝 벌린 입술 | lips slightly parted |
| 편안한 표정 | calm relaxed facial expression |
| 살짝 생각하는 표정 | subtly thoughtful expression |
| 약간 진지한 표정 | slightly serious expression |
| 미세하게 놀란 표정 | very mildly surprised expression |
| 한쪽 눈썹 살짝 올림 | one eyebrow slightly raised |
| 양쪽 눈썹 살짝 올림 | eyebrows slightly raised |
| 약간 궁금한 표정 | subtly curious expression |
| 약간 걱정스러운 표정 | very subtle concerned expression |
| 약간 슬픈 표정 | very subtle sad expression |
| 미세하게 찌푸린 눈썹 | slightly furrowed brows |
| 살짝 수줍은 미소 | faint shy closed-mouth smile |
| 약간 자신감 있는 표정 | subtly confident expression |
| 아주 옅은 한쪽 미소 | subtle asymmetric smile |
| 미세한 집중 표정 | subtly focused expression |
| 살짝 편안하게 감은 눈 | eyes gently closed |

### 배경 (40종)

| 한국어 | 영어 프롬프트 |
|---|---|
| 흰색 스튜디오 | plain white studio backdrop |
| 밝은 회색 스튜디오 | plain light gray studio backdrop |
| 중간 회색 스튜디오 | plain medium gray studio backdrop |
| 차콜 스튜디오 | plain charcoal gray studio backdrop |
| 검은색 스튜디오 | plain black studio backdrop |
| 아이보리 스튜디오 | plain ivory studio backdrop |
| 베이지 스튜디오 | plain beige studio backdrop |
| 연분홍 스튜디오 | plain pale pink studio backdrop |
| 연하늘색 스튜디오 | plain pale blue studio backdrop |
| 세이지 그린 스튜디오 | plain muted sage green studio backdrop |
| 연보라 스튜디오 | plain muted lavender studio backdrop |
| 웜그레이 스튜디오 | plain warm gray studio backdrop |
| 흐린 회색 그라데이션 | subtle gray gradient studio backdrop |
| 흐린 베이지 그라데이션 | subtle beige gradient studio backdrop |
| 흰 벽 | simple white interior wall |
| 콘크리트 벽 | plain concrete wall |
| 벽돌 벽 | softly blurred brick wall |
| 목재 벽 | softly blurred wooden wall |
| 커튼 | softly blurred neutral curtains |
| 창가 | softly blurred window-side interior |
| 거실 | softly blurred minimalist living room |
| 침실 | softly blurred tidy bedroom |
| 카페 | softly blurred quiet cafe interior |
| 도서관 | softly blurred library shelves |
| 사무실 | softly blurred modern office interior |
| 복도 | softly blurred clean indoor hallway |
| 전시 공간 | softly blurred minimalist gallery interior |
| 실내 식물 | softly blurred indoor plants |
| 나무와 잎 | softly blurred green foliage |
| 공원 | softly blurred quiet park |
| 잔디밭 | softly blurred grassy field |
| 정원 | softly blurred garden |
| 숲길 | softly blurred forest path |
| 해변 | softly blurred sandy beach |
| 바다 | softly blurred ocean background |
| 호숫가 | softly blurred lakeside background |
| 산 풍경 | softly blurred distant mountains |
| 도시 거리 | softly blurred quiet city street |
| 건물 외벽 | softly blurred modern building facade |
| 옥상 | softly blurred rooftop cityscape |
