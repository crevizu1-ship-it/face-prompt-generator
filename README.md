# Face Dataset Studio

[**🚀 웹사이트 바로 실행 (Face Dataset Studio)**](https://crevizu1-ship-it.github.io/face-prompt-generator/)


얼굴 학습용 장면을 무작위로 구성하고 다섯 이미지 모델에 맞는 영어 프롬프트를 만드는 도구입니다. 웹페이지 상단의 **오프라인용 HTML 저장**을 누르거나 저장소의 `index.html`을 내려받아 브라우저로 여세요. 생성 규칙과 스타일 목록이 파일 하나에 들어 있어 오프라인에서도 생성·비교·복사·TXT 저장을 할 수 있습니다. 실제 이미지 생성은 원하는 모델에 프롬프트와 참조 이미지를 넣어 진행합니다.

- 한 번에 1~200개 생성 또는 추가, 기본 무표정 비율 80%
- 촬영 구도는 얼굴 클로즈업 70%, 상반신 30%가 기본값입니다. 슬라이더로 비율을 조절할 수 있습니다.
- 선택된 헤어·머리 각도·의상·배경을 셔플한 뒤 고르게 순환하여 샘플링
- 배경 40종 중 선택한 장소에 맞춰 날씨·시간대·조명 조합을 무작위로 고릅니다. 세 항목은 각각 켜고 끌 수 있습니다.
- 개별 복사에 성공하면 해당 프롬프트 버튼에 **✓ 복사됨**이 표시됩니다. 전체 복사 시 선택한 모델의 모든 프롬프트에 체크가 표시됩니다. TXT 저장도 지원합니다.
- 공통 프롬프트와 미드저니 파라미터 수정
- 네트워크, API 키, 서버, 외부 라이브러리 불필요

## 모델별 프롬프트 비교

**02 · 스타일 라이브러리**에서 스타일을 고른 뒤 **03 · 생성 모델**에서 사용할 모델을 선택하세요. 기본값은 Midjourney입니다. 모델 아래에서 **생성할 장면 수**를 정하고 **랜덤 프롬프트 생성**을 누르면 **04 · 생성 결과**에 목록이 표시됩니다. 모델을 추가하거나 해제해도 현재 장면의 표정·헤어·의상·구도·환경은 유지됩니다.

Midjourney에서 **Pro / Mega**를 선택하면 생성할 장면 수와 추가할 장면 수가 40·80·120·160·200개 단위로 맞춰집니다. 예를 들어 기본 20개는 40개로, 직접 입력한 41개는 80개로 올림합니다. 이미 생성한 목록은 유지되며, 다음 생성이나 추가부터 적용됩니다.

기존 목록에 이어 만들려면 결과 아래의 **추가할 장면 수**를 입력하고 **장면 더 추가**를 누르세요. 기존 장면과 개별 복사 체크는 유지되고, 현재 설정은 추가분에 적용됩니다. 예를 들어 20개에 5개를 추가하면 21~25번이 생깁니다. 전체 복사와 TXT 저장은 누적된 목록을 사용합니다. 미드저니 묶음은 같은 파라미터를 쓰는 미복사 장면끼리 순서대로 구성합니다. 목록을 처음부터 다시 만들려면 상단의 **랜덤 프롬프트 생성**을 누르세요.

| 모델 | 이 생성기의 출력 방식 | 공식 작성 가이드 |
|---|---|---|
| Midjourney | 구도·표정·포즈를 먼저 두고, 기본 문구와 긴 조명 묘사를 짧은 시각 표현으로 압축합니다. 전용 파라미터는 맨 끝에 붙입니다. | [Midjourney Prompt Basics](https://docs.midjourney.com/hc/en-us/articles/32023408776205-Prompt-Basics) |
| GPT Image | 촬영 목표, 포즈·표정, 헤어·의상, 배경·촬영 조건을 여러 줄로 정리합니다. | [OpenAI Image prompting](https://developers.openai.com/api/docs/guides/image-prompting) |
| Gemini (Nano Banana) | 인물이 무엇을 입고 어떤 구도로 어디에서 촬영되는지 자연스러운 문단으로 묘사합니다. | [Google 이미지 생성 가이드](https://ai.google.dev/gemini-api/docs/image-generation) |
| FLUX.2 | 인물과 포즈를 앞에 두고 촬영 스타일과 환경이 뒤따르는 캡션을 작성합니다. | [Black Forest Labs FLUX.2 가이드](https://docs.bfl.ai/guides/prompting_guide_flux2) |
| Stable Diffusion XL | 구도·표정·스타일·환경을 간결한 묘사로 묶어 긍정 프롬프트 입력란에 붙여넣을 수 있게 합니다. | [Stability AI SDXL 가이드](https://stability.ai/sdxl-aws-documentation) |

결과 옆에는 공백 기준 본문 단어 수가 표시됩니다. Midjourney 파라미터는 단어 수에서 제외합니다. 사용자가 입력한 문구에는 길이 제한을 두지 않습니다. 개별 복사는 선택한 프롬프트 본문만 복사합니다. 전체 복사와 TXT 저장은 화면에 선택한 모델을 따르며, 여러 모델을 비교할 때는 장면 번호와 모델명도 함께 기록합니다.

## 미드저니에서 여러 장면 실행하기

1. **03 · 생성 모델**에서 **Midjourney**를 선택합니다.
2. **미드저니 요금제 / 복사 방식**과 **생성할 장면 수**를 정한 뒤 **랜덤 프롬프트 생성**을 누릅니다. 기본 선택은 Basic입니다. Fast·Turbo 모드에서는 Basic이 최대 4개, Standard가 10개, Pro·Mega가 40개까지 한 묶음으로 입력할 수 있습니다. Relax 모드에서는 **한 개씩 · Relax 포함**을 선택하세요. [Midjourney 공식 묶음 입력 안내](https://docs.midjourney.com/hc/en-us/articles/32761322355597-Permutations)
3. **04 · 생성 결과**에서 **다음 묶음 복사**를 누르고 **미드저니 열기**로 이동합니다. Imagine 입력창에 붙여넣어 전송하고, 생성 건수 확인 창이 뜨면 확인합니다. 각 장면마다 GPU 시간이 사용됩니다.
4. 생성기로 돌아와 같은 버튼으로 다음 묶음을 복사합니다. 진행 숫자와 체크는 복사에 성공하면 갱신됩니다. 개별 복사한 미드저니 항목도 건너뜁니다.

예를 들어 Standard에서 새 장면 20개를 생성하면 10개씩 두 번 붙여넣으면 됩니다. 묶음은 장면별 완성 문구와 공통 파라미터를 보존합니다. 이미 중괄호 조합이나 반복 옵션을 넣은 경우에는 해당 프롬프트를 한 개씩 복사합니다.

## GitHub Pages

저장소 루트에 `index.html`을 커밋하고 Settings → Pages → Deploy from a branch → main / (root) → Save를 선택합니다. 저장소 공개 여부 및 GitHub 요금제에 따라 Pages 사용 가능 여부가 다릅니다.

## 생성 규칙

얼굴형·눈 색·머리 색은 무작위로 변경하지 않습니다. 특정 배경과 얼굴이 과하게 연관되지 않도록 배경을 다양화하고, 실내·실외는 흐릿하게 묘사합니다. 동일 인물 참조 이미지를 사용할 모델에 별도로 첨부하고, 실제 얼굴 일치 여부와 각도를 검수하세요.

**표정과 촬영 구도**는 한 번에 생성할 개수에 각 비율을 곱해 반올림하고, 순서를 각각 섞습니다. 기본 설정으로 20개를 생성하면 무표정 16개와 미세 표정 4개, 얼굴 클로즈업 14개와 상반신 6개가 나옵니다. 얼굴 클로즈업을 0%로 설정하면 모두 상반신, 100%로 설정하면 모두 클로즈업입니다.

**날씨·시간대·조명**은 기본적으로 모두 켜져 있습니다. 배경별로 어울리는 조합 하나를 고른 뒤 켜진 항목만 결과 태그와 영어 프롬프트에 넣습니다.

| 선택한 배경 | 생성 예시 |
|---|---|
| 스튜디오 | 정면 소프트박스. 날씨와 시간대는 생략합니다. |
| 일반 실내 (거실·카페·사무실 등) | 이른 저녁, 따뜻한 실내 정면광. 날씨는 생략합니다. |
| 창가 | 창밖에 가벼운 비가 오는 늦은 오후, 얼굴에 닿는 저대비 창가광 |
| 자연 (공원·숲길·산 등) | 맑은 해질 무렵, 얼굴 앞쪽에서 오는 따뜻한 빛 |
| 해안 (해변·바다) | 흐린 늦은 오후, 부드러운 바닷가 확산광 |
| 도시 (거리·건물 외벽·옥상) | 맑은 아침, 주변 건물에서 부드럽게 반사되는 빛 |
| 배경 전체 해제 | 배경·날씨·시간대·조명을 모두 생략합니다. |

자동 선택 목록에서는 짙은 안개, 폭우, 눈보라, 강한 역광 등 얼굴을 가리거나 알아보기 어렵게 만드는 조건을 제외했습니다. 사용자가 작성한 공통 프롬프트와 촬영 조건은 각 모델 본문에 반영하고, 미드저니 파라미터 입력란은 Midjourney 결과에만 적용합니다.

## 브라우저 테스트

Node.js 22 이상과 Chrome이 설치된 환경에서 아래 명령으로 실행합니다. Playwright는 테스트에만 사용합니다.

```sh
npm install --no-save --package-lock=false playwright-core
node --test tests/generator.test.cjs
```

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
