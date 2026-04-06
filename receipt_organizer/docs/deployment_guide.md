# Vercel 배포 가이드 (서버 기반 자동화)

이제 **모든 사용자가 API 키 입력 없이 무료로 안정적으로 쓸 수 있는** 서버레스(Serverless) 기반 구조로 코드가 모두 업그레이드 되었습니다! 작성된 코드에는 사용자 브라우저에서 서버(API)로 신호를 보내고 서버에서만 고객님의 API키를 꺼내서 구글에 요청하는 코드가 탑재되어 완벽한 보안을 유지합니다.

이 코드를 무료 호스팅 서비스인 **Vercel**에 배포하는 방법을 순서대로 안내해 드립니다. 

> [!IMPORTANT]
> 백엔드 서버(Node.js 등)를 고객님 컴퓨터에 복잡하게 설치하지 않아도 됩니다. 코드 뭉치를 통째로 GitHub에 올리고, Vercel 웹사이트에서 버튼 몇 번만 누르면 됩니다!

## 1. GitHub에 코드 올리기
1. [GitHub](https://github.com) 에 회원가입 후 로그인합니다.
2. 우측 상단의 **+** 버튼을 눌러 **New repository**를 클릭합니다.
3. 저장소 이름(예: `receipt-organizer`)을 입력하고 **Public** 또는 **Private**로 생성합니다.
4. 생성된 저장소 화면에서 `uploading an existing file` 버튼을 누릅니다.
5. 현재 컴퓨터에 생성된 폴더 내의 **모든 파일과 `api` 폴더**를 통째로 창에 드래그 앤 드롭해서 업로드한 뒤 **Commit changes**를 클릭합니다.
   *(대상: `index.html`, `styles.css`, `app.js`, `api` 폴더 등)*

## 2. Vercel로 무료 배포하기
1. [Vercel](https://vercel.com/) 에 접속하여 GitHub 계정으로 가입/로그인합니다.
2. **Add New...** > **Project**를 클릭합니다.
3. 방금 GitHub에 만든 `receipt-organizer` 저장소 항목 옆에 있는 **Import** 버튼을 누릅니다.
4. 배포 설정(Configure Project) 화면이 나타납니다. 다른 설정은 그대로 두시고, 가장 아래의 **Environment Variables (환경 변수)** 탭을 펼칩니다!

> [!CAUTION]
> 설정창을 넘어가기 전에 반드시 환경변수(API 키)를 입력해야 사이트가 정상 작동합니다!

5. 아래와 같이 2칸을 입력합니다.
   - **Name**: `GEMINI_API_KEY`
   - **Value**: (발급받으신 본인의 Gemini API 비밀 키 붙여넣기, 예: `AIzaSy...`)
6. **Add** 버튼을 눌러 추가합니다.
7. 아래쪽의 파란색 **Deploy** 버튼을 누릅니다.

## 3. 완료!
1~2분 뒤 배포가 완료되면 Vercel이 고유한 웹사이트 주소(URL)를 할당해 줍니다.
해당 주소로 접속하면 **고객님의 API 설정이 완벽히 숨겨진 상태로 동작하는 영수증 관리기**가 뜨게 되고, 이 주소를 팀원들이나 지인에게 공유하여 누구나 제한 없이 영수증 분석 기능을 이용하게 하실 수 있습니다!
