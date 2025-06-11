console.log("server.js 시작됨"); // 서버 실행 시작 로그 출력

const express = require("express"); // Express 프레임워크 가져오기
const app = express(); // Express 애플리케이션 생성
const multer = require("multer"); // 파일 업로드 처리를 위한 Multer 모듈 가져오기
const path = require("path"); // 파일 경로 처리를 위한 Path 모듈 가져오기
const MongoClient = require("mongodb").MongoClient; // MongoDB 연결을 위한 클라이언트 가져오기
const ObjectId = require("mongodb").ObjectId; // MongoDB ObjectId 생성 및 처리용 모듈 가져오기
const bodyParser = require("body-parser"); // 요청 본문을 받기 위한 Body-parser 모듈 가져오기
const session = require("express-session"); // 세션 관리를 위한 Express-session 모듈 가져오기
const { promises } = require("dns"); // DNS 관련 비동기 작업을 위한 Promises 모듈 가져오기
//const port = process.env.PORT || 5000; // 서버 포트 설정 (환경 변수 또는 기본값 5000)

const url = 'mongodb+srv://plzz:test1234@cluster0.65etpdx.mongodb.net/myboard?retryWrites=true&w=majority'; // MongoDB 연결 URL 정의

let mydb; // MongoDB 데이터베이스 객체를 저장할 변수 선언

// 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true })); // URL-encoded 형식의 요청 본문 파싱
app.use(express.json()); // JSON 형식의 요청 본문 파싱
app.use(express.static("public")); // public 폴더의 정적 파일 제공 (CSS, 이미지 등)
app.use(session({
  secret: '비밀코드', // 세션 암호화 키 설정
  resave: false, // 변경되지 않은 세션도 저장 여부 (false: 저장 안 함)
  saveUninitialized: true // 초기화되지 않은 세션도 저장 여부 (true: 저장)
}));
app.set("view engine", "ejs"); // 뷰 엔진을 EJS로 설정

// 업로드된 파일을 저장할 경로와 파일 이름 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) { // 파일 저장 경로 설정
    cb(null, 'public/uploads/'); // 파일을 public/uploads/ 폴더에 저장
  },
  filename: function (req, file, cb) { // 파일 이름 설정
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); // 고유한 파일 이름 생성 (타임스탬프 + 랜덤 숫자)
    cb(null, uniqueSuffix + path.extname(file.originalname)); // 파일 이름에 원본 확장자 추가
  }
});

const upload = multer({ storage: storage }); // Multer 인스턴스 생성 (파일 업로드 설정 적용)

app.get("/", (req, res) => { // 루트 경로 요청 처리
  res.redirect("/enter"); // /enter 경로로 리다이렉트
})

// 로그인/회원가입 진입 화면
app.get("/enter", function (req, res) { // /enter 경로 요청 처리
  res.render("enter.ejs"); // enter.ejs 페이지 렌더링
});

// MongoDB 연결
MongoClient.connect(url) // MongoDB 서버에 연결 시도
  .then((client) => { // 연결 성공 시
    mydb = client.db("myboard"); // myboard 데이터베이스 선택
    console.log("MongoDB 연결 성공"); // 연결 성공 로그 출력

    app.listen(5000, function () { // 서버 시작
      console.log("포트 5000에서 서버 대기 중..."); // 서버 실행 로그 출력
    });
  })
  .catch((err) => { // 연결 실패 시
    console.log("MongoDB 연결 실패:", err); // 연결 실패 로그 출력
  });

app.post("/register", upload.single("image"), async (req, res) => { // 회원가입 요청 처리
  if (!mydb) { // 데이터베이스 연결 확인
    console.error("DB가 아직 연결되지 않음"); // DB 미연결 로그 출력
    return res.status(500).send("DB 연결 실패"); // 클라이언트에 에러 응답
  }

  const { name, instaId, id, pw } = req.body; // 요청 본문에서 사용자 정보 추출
  const image = req.file ? "/uploads/" + req.file.filename : null; // 업로드된 이미지 경로 설정 (없으면 null)

  console.log("[register 요청]", req.body, "파일:", req.file); // 회원가입 요청 정보 로그 출력

  if (!name || !instaId || !id || !pw) { // 필수 입력값 확인
    return res.status(400).send("입력값 오류"); // 입력값 누락 시 에러 응답
  }

  try {
    // 중복 확인
    const user = await mydb.collection("users").findOne({ // users 컬렉션에서 중복 사용자 조회
      $or: [{ id }, { instaId }], // id 또는 instaId가 이미 존재하는지 확인
    });

    if (user) { // 중복 사용자 존재 시
      console.log(`사용자 존재: id=${id}, instaId=${instaId}`); // 중복 사용자 로그 출력
      if (user.id === id) return res.status(400).send("이미 존재하는 아이디입니다."); // ID 중복 응답
      if (user.instaId === instaId) return res.status(400).send("이미 존재하는 인스타 ID입니다."); // 인스타 ID 중복 응답
    } else {
      console.log(`사용자 없음: id=${id}, instaId=${instaId}`); // 중복 없음 로그 출력
    }

    // 데이터 삽입
    const result = await mydb.collection("users").insertOne({ // users 컬렉션에 새 사용자 데이터 삽입
      name, // 사용자 이름
      instaId, // 인스타 ID
      id, // 로그인 ID
      pw, // 비밀번호
      image, // 프로필 이미지 경로
    });

    console.log("[회원가입 성공]", result.insertedId); // 회원가입 성공 로그 출력
    req.session.user = { id, name, instaId, image }; // 세션에 사용자 정보 저장
    res.redirect("/home"); // 홈 페이지로 리다이렉트
    console.log("리다이렉트 시도: /home"); // 리다이렉트 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("회원가입 에러:", err); // 에러 로그 출력
    res.status(500).send("회원가입 실패"); // 클라이언트에 에러 응답
  }
});

app.post("/login", async (req, res) => { // 로그인 요청 처리
  if (!mydb) { // 데이터베이스 연결 확인
    console.error("DB가 아직 연결되지 않음"); // DB 미연결 로그 출력
    return res.status(500).send("DB 연결 실패"); // 클라이언트에 에러 응답
  }

  const { id, pw } = req.body; // 요청 본문에서 로그인 정보 추출
  console.log("로그인 요청:", req.body); // 로그인 요청 정보 로그 출력

  try {
    const user = await mydb.collection("users").findOne({ id, pw }); // users 컬렉션에서 사용자 조회
    console.log("로그인 findOne 결과:", user); // 조회 결과 로그 출력

    if (!user) { // 사용자 없으면
      return res.status(401).send("아이디 또는 비밀번호가 잘못되었습니다."); // 인증 실패 응답
    }

    req.session.user = { // 세션에 사용자 정보 저장
      id: user.id, // 로그인 ID
      name: user.name, // 사용자 이름
      instaId: user.instaId, // 인스타 ID
      image: user.image, // 프로필 이미지 경로
    };
    res.redirect("/home"); // 홈 페이지로 리다이렉트
    console.log("리다이렉트 시도: /home"); // 리다이렉트 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("로그인 에러:", err); // 에러 로그 출력
    res.status(500).send("로그인 중 에러 발생"); // 클라이언트에 에러 응답
  }
});

app.get("/home", async (req, res) => { // 홈 페이지 요청 처리
  const myUser = req.session.user; // 세션에서 현재 사용자 정보 가져오기
  console.log("home 라우트 호출됨, 세션:", myUser); // 홈 라우트 호출 로그 출력

  if (!myUser || !myUser.instaId) { // 세션 또는 instaId 없으면
    console.log("로그인된 사용자 정보 없음"); // 세션 없음 로그 출력
    return res.redirect("/enter"); // 로그인 페이지로 리다이렉트
  }

  const myInstaId = myUser.instaId; // 현재 사용자의 인스타 ID 저장
  console.log("현재 로그인 instaId:", myInstaId); // 현재 인스타 ID 로그 출력

  try {
    // matchedFollow에서 팔로우 정보 가져오기
    const followDocs = await mydb
      .collection("matchedFollow")
      .find({ follower_instaId: myInstaId })
      .toArray(); // 사용자가 팔로우하는 사람들 조회
    console.log("followDocs:", followDocs); // 팔로우 데이터 로그 출력

    const followingIds = followDocs.map((doc) => doc.following_instaId); // 팔로우하는 사람들의 인스타 ID 추출
    followingIds.push(myInstaId); // 자신의 인스타 ID 추가 (내 게시물 포함)
    console.log("followingIds:", followingIds); // 팔로우 ID 목록 로그 출력

    // Promise.all로 병렬 쿼리 실행
    const [stories, users, posts, follows] = await Promise.all([ // 여러 컬렉션에서 데이터 병렬 조회
      mydb
        .collection("story")
        .find({ instaId: { $in: followingIds } }) // 팔로우한 사람들의 스토리 조회
        .sort({ _id: -1 }) // 최신순 정렬
        .toArray(),
      mydb.collection("users").find().toArray(), // 모든 사용자 데이터 조회
      mydb
        .collection("post")
        .find({ instaId: { $in: followingIds } }) // 팔로우한 사람들의 게시물 조회
        .sort({ _id: -1 }) // 최신순 정렬
        .toArray(),
      mydb.collection("follow").find().toArray(), // 모든 팔로우 데이터 조회
    ]);
    console.log("stories:", stories.length, "users:", users.length, "posts:", posts.length, "follows:", follows.length); // 조회된 데이터 개수 로그 출력

    // followMap 생성
    const followMap = {}; // 팔로우한 사람들의 이름 매핑 객체 생성
    followDocs.forEach((doc) => {
      followMap[doc.following_instaId] = doc.following_name; // 인스타 ID와 이름 매핑
    });
    followMap[myInstaId] = myUser.name; // 자신의 인스타 ID와 이름 추가
    console.log("followMap:", followMap); // followMap 로그 출력

    // 게시물 데이터 강화
    const enrichedPosts = posts.map((post) => { // 게시물 데이터에 추가 정보 삽입
      const user = users.find((u) => u.instaId === post.instaId); // 게시물 작성자 정보 조회
      const followUser = follows.find((f) => f.instaId === post.instaId); // 팔로우 정보 조회
      return {
        ...post, // 기존 게시물 데이터
        name: followMap[post.instaId] || "알 수 없음", // 작성자 이름
        profileImage: user?.image || followUser?.image || "/uploads/default.jpg", // 프로필 이미지 (기본값 제공)
        dateFormatted: post.date ? new Date(post.date).toLocaleString("ko-KR") : "", // 날짜 포맷팅
      };
    });

    // 스토리 데이터 강화
    const enrichedStories = stories.map((story) => { // 스토리 데이터에 추가 정보 삽입
      const user = users.find((u) => u.instaId === story.instaId); // 스토리 작성자 정보 조회
      const followUser = follows.find((f) => f.instaId === story.instaId); // 팔로우 정보 조회
      return {
        ...story, // 기존 스토리 데이터
        profileImage: user?.image || followUser?.image || "/uploads/default.jpg", // 프로필 이미지 (기본값 제공)
      };
    });

    // 렌더링
    res.render("home.ejs", { // 홈 페이지 렌더링
      name: myUser.name, // 사용자 이름
      posts: enrichedPosts, // 강화된 게시물 데이터
      stories: enrichedStories, // 강화된 스토리 데이터
    });
    console.log("home.ejs 렌더링 시도"); // 렌더링 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("home 라우트 에러:", err); // 에러 로그 출력
    res.status(500).send("서버 오류"); // 클라이언트에 에러 응답
  }
});




// 게시물 입력 폼으로 보냄
app.get("/post", function (req, res) { //게시물 업로드 버튼을 누르면
  res.render("post_form.ejs"); //게시물 작성 폼으로 넘어감
});

// 게시물 저장
// 입력 폼에서 입력 후 게시물 업로드 버튼을 누르면 아래 코드 실행
app.post("/post", upload.single("image"), function (req, res) {
  const { title, content } = req.body; // 제목, 내용을 받음
  const file = req.file; // 이미지 파일은 file로 받음, name="file"인 것을 말함

  // 게시물 저장 예시
  //몽고 DB post 컬렉션에 삽입함
  mydb.collection("post").insertOne({
    title, //제목
    content, //내용
    image: file ? "/uploads/" + file.filename : "", //이미지 파일명은 /uploads/를 함께 첨부
    instaId: req.session.user?.instaId, //인스타 아이디는 유저 정보의 인스타 아이디를 넣음
    date: new Date() //게시하는 시간, 날짜도 삽입
  }).then(() => { //삽입 후에는 home.ejs로 돌아감
    res.redirect("/home");
  });
});

// 메모 입력 폼으로 보냄
app.get("/story", function (req, res) {
  res.render("story_form.ejs"); //메모 추가 버튼을 누르면 메모 입력 폼으로 넘어감
});

// 메모 저장
// 입력 폼에서 입력 후 메모 업로드 버튼을 누르면 아래 코드 실행
// upload.single("image") >>
app.post("/story", upload.single("image"), function (req, res) {
  //내용과 장소 입력값을 변수로 받음
  const { content, location } = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : null;
  //이미지가 있다면 /uploads/를 붙여서 첨부함

  // 내용이 없다면? 또는 세션 정보가 없다면!
  if (!content || !req.session.user) {
    return res.send("내용 또는 로그인 정보 누락");
  } //메시지 브라우저에 출력

  const storyData = { //메모 데이터를 storyData에 묶음
    instaId: req.session.user.instaId, //인스타 아이디에 유저 정보에 있는 인스타 아이디를 넣음
    content, //내용
    location, // 장소
    image, //이미지
    date: new Date() //날짜! > 아마 사용하진 않을 것
  };

  // 몽고 DB story 컬렉션에 storyData 값들을 삽입한다.
  mydb.collection("story").insertOne(storyData)
    .then(() => res.redirect("/home")) //되면 home.ejs로 넘어감
    .catch(err => { // 실패하면 오류 메시지 콘솔, 브라우저에 출력
      console.error("[스토리 저장 실패]", err);
      res.status(500).send("스토리 저장 오류");
    });
});


//팔로우 검색 버튼을 클릭하면 팔로우 서칭 폼으로 넘어감
app.get("/follow", function (req, res) {
  //몽고 DB follow 컬렉션 값들을 배열로 만듦
  mydb.collection("follow").find().toArray()
    .then(result => { // 값들을 data의 이름으로 follow_form.ejs에 보냄
      res.render("follow_form.ejs", { data: result });
    })
    .catch(err => { // 에러가 발생하면 메시지 콘솔과 브라우저에 출력
      console.error("follow 컬렉션 조회 실패:", err);
      res.status(500).send("팔로우 목록 오류");
    });
});

// /clickFollow
app.get("/clickFollow", async (req, res) => { // 팔로우 요청 처리
  const { targetName, targetInstaId, targetImage } = req.query; // 쿼리에서 팔로우 대상 정보 추출
  const myUser = req.session.user; // 세션에서 현재 사용자 정보 가져오기
  console.log("clickFollow 요청:", { targetName, targetInstaId, targetImage, myUser }); // 팔로우 요청 로그 출력

  if (!myUser) { // 세션 확인
    console.log("세션 없음"); // 세션 없음 로그 출력
    return res.send(`
      <script>
        alert("로그인 정보가 없습니다. 다시 로그인하세요.");
        window.location.href = "/enter";
      </script>
    `); // 클라이언트에 로그인 요구 알림
  }

  if (!targetInstaId || !targetName) { // 필수 정보 확인
    console.log("필수 쿼리 파라미터 누락"); // 정보 누락 로그 출력
    return res.status(400).send(`
      <script>
        alert("잘못된 요청입니다.");
        window.location.href = "/follow";
      </script>
    `); // 클라이언트에 에러 알림
  }

  if (myUser.instaId === targetInstaId) { // 자기 자신 팔로우 방지
    console.log("자기 자신 팔로우 시도"); // 자기 팔로우 시도 로그 출력
    return res.send(`
      <script>
        alert("자기 자신은 팔로우할 수 없습니다.");
        window.location.href = "/follow";
      </script>
    `); // 클라이언트에 에러 알림
  }

  try {
    const existingFollow = await mydb.collection("matchedFollow").findOne({ // 중복 팔로우 확인
      follower_instaId: myUser.instaId, // 내 인스타 ID
      following_instaId: targetInstaId, // 대상 인스타 ID
    });
    console.log("existingFollow:", existingFollow); // 중복 확인 결과 로그 출력

    if (existingFollow) { // 이미 팔로우한 경우
      console.log("이미 팔로우한 사용자"); // 이미 팔로우 로그 출력
      return res.send(`
        <script>
          alert("이미 팔로우한 사용자입니다.");
          window.location.href = "/follow";
        </script>
      `); // 클라이언트에 알림
    }

    const followData = { // 새 팔로우 데이터 생성
      follower_name: myUser.name, // 내 이름
      follower_instaId: myUser.instaId, // 내 인스타 ID
      following_name: targetName, // 대상 이름
      following_instaId: targetInstaId, // 대상 인스타 ID
      image: targetImage, // 대상 프로필 이미지
      followed_at: new Date(), // 팔로우 시간
    };
    const result = await mydb.collection("matchedFollow").insertOne(followData); // matchedFollow 컬렉션에 팔로우 데이터 삽입
    console.log(`${myUser.instaId} → ${targetInstaId} 팔로우 완료, ID:`, result.insertedId); // 팔로우 성공 로그 출력

    res.send(`
      <script>
        alert("${targetName}님을 팔로우했습니다!");
        window.location.href = "/follow";
      </script>
    `); // 클라이언트에 성공 알림
  } catch (err) { // 에러 발생 시
    console.error("clickFollow 에러:", err); // 에러 로그 출력
    res.status(500).send(`
      <script>
        alert("팔로우 요청 실패!");
        window.location.href = "/follow";
      </script>
    `); // 클라이언트에 에러 알림
  }
});


// /searchFollower
app.post("/searchFollower", async (req, res) => { // 팔로워 검색 요청 처리
  const { findName } = req.body; // 요청 본문에서 검색할 이름 추출
  console.log("searchFollower 요청:", { findName }); // 검색 요청 로그 출력

  try {
    let result = []; // 검색 결과 배열 초기화
    if (findName) { // 검색 이름이 있으면
      const safeFindName = findName.replace(/[.*+?\^${}()|[\]\\]/g, "\\$&"); // 특수문자 이스케이프 처리
      result = await mydb
        .collection("users")
        .find({ name: { $regex: safeFindName, $options: "i" } }) // users 컬렉션에서 이름 검색
        .toArray();
      console.log("검색 결과:", result.length, "명"); // 검색 결과 개수 로그 출력
    } else {
      console.log("findName 없음, 빈 결과 반환"); // 검색 이름 없음 로그 출력
    }

    res.render("follow_form.ejs", { data: result || [] }); // 검색 결과 페이지 렌더링
    console.log("follow_form.ejs 렌더링 시도"); // 렌더링 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("searchFollower 에러:", err); // 에러 로그 출력
    res.status(500).send(`
      <script>
        alert("검색 중 오류 발생!");
        window.location.href = "/follow";
      </script>
    `); // 클라이언트에 에러 알림
  }
});

app.get('/mine', (req, res) => { //내 정보 보기 버튼 클릭 시 이동
  
  const myUser = req.session.user;//로그인한 정보를 myUser에 담음

  const myInstaId = myUser.instaId;//로그인한 계정의 인스타 아이디를 myInstaId로 전달함

  Promise.all([
    mydb.collection("story").find({ instaId: myInstaId }).toArray(),
    mydb.collection("post").find({ instaId: myInstaId }).toArray()
  ])
    .then(([myStories, myPosts]) => {
      res.render("mine.ejs", {
        post: myPosts,
        story: myStories,
        myUser: myUser
      });
    })
    .catch(err => {
      console.error("내 컨텐츠 불러오기 실패");
      return res.status(500).send("서버 오류");
    });
});

// /viewPosts
app.get("/viewPosts", async (req, res) => { // 사용자 프로필 게시물 조회 요청 처리
  const { instaId, name, image } = req.query; // 쿼리에서 사용자 정보 추출
  console.log("viewPosts 요청:", { instaId, name, image }); // 조회 요청 로그 출력

  if (!instaId) { // 인스타 ID 확인
    console.log("instaId 누락"); // ID 누락 로그 출력
    return res.status(400).send(`
      <script>
        alert("잘못된 요청입니다.");
        window.location.href = "/follow";
      </script>
    `); // 클라이언트에 에러 알림
  }

  try {
    const posts = await mydb.collection("post").find({ instaId }).toArray(); // post 컬렉션에서 사용자 게시물 조회
    console.log("조회된 게시물:", posts.length); // 게시물 개수 로그 출력

    const firstPost = posts[0] || { date: "미공개" }; // 첫 번째 게시물 선택 (없으면 기본값)
    res.render("viewPosts.ejs", { // 사용자 프로필 페이지 렌더링
      instaId, // 사용자 인스타 ID
      name: name || "알 수 없음", // 사용자 이름 (기본값 제공)
      image: image || "/uploads/default.jpg", // 프로필 이미지 (기본값 제공)
      date: firstPost.date || "", // 첫 게시물 날짜
      posts: posts || [], // 게시물 데이터
    });
    console.log("viewPosts.ejs 렌더링 시도"); // 렌더링 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("viewPosts 에러:", err); // 에러 로그 출력
    res.status(500).send(`
      <script>
        alert("게시물 조회 실패!");
        window.location.href = "/follow";
      </script>
    `); // 클라이언트에 에러 알림
  }
});

// /myImage
app.post("/myImage", upload.single("image"), async (req, res) => { // 프로필 사진 변경 요청 처리
  const user = req.session.user; // 세션에서 현재 사용자 정보 가져오기
  console.log("myImage 요청:", { user, file: req.file }); // 사진 변경 요청 로그 출력

  if (!user || !req.file) { // 사용자 세션 또는 파일 확인
    console.log("세션 또는 파일 누락"); // 세션 또는 파일 누락 로그 출력
    return res.redirect("/enter"); // 로그인 페이지로 리다이렉트
  }

  const imagePath = "/uploads/" + req.file.filename; // 새 이미지 경로 설정
  console.log("새 이미지 경로:", imagePath); // 이미지 경로 로그 출력

  try {
    const result = await mydb.collection("users").updateOne( // users 컬렉션에서 프로필 사진 업데이트
      { instaId: user.instaId }, // 대상 사용자
      { $set: { image: imagePath } } // 새 이미지 경로 설정
    );
    console.log("프로필 이미지 업데이트 결과:", result.modifiedCount); // 업데이트 결과 로그 출력

    if (result.modifiedCount === 0) { // 업데이트된 사용자가 없으면
      console.log("이미지 업데이트 실패: 사용자 없음"); // 업데이트 실패 로그 출력
      return res.status(500).send("프로필 이미지 업데이트 실패"); // 클라이언트에 에러 응답
    }

    req.session.user.image = imagePath; // 세션에 새 이미지 경로 저장
    await req.session.save(); // 세션 저장 강제
    console.log("세션 업데이트:", req.session.user); // 세션 업데이트 로그 출력

    res.redirect("/home"); // 홈 페이지로 리다이렉트
    console.log("리다이렉트 시도: /home"); // 리다이렉트 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("myImage 에러:", err); // 에러 로그 출력
    res.status(500).send("프로필 이미지 업데이트 실패"); // 클라이언트에 에러 응답
  }
});

app.get("/followers", (req, res) => { // 내 팔로워 목록 요청 처리
  const user = req.session.user; // 세션에서 현재 사용자 정보 가져오기
  if (!user) return res.redirect("/login"); // 세션이 없으면 로그인 페이지로 리다이렉트

  const myName = user.name; // 현재 사용자의 이름 저장

  Promise.all([ // 여러 컬렉션에서 데이터 병렬 조회
    mydb.collection("matchedFollow").find({ following_name: myName }).toArray(), // 나를 팔로우하는 사람들 조회
    mydb.collection("users").find().toArray() // 모든 사용자 데이터 조회
  ]).then(([follows, users]) => { // 조회 결과 처리
    const enriched = follows.map(f => { // 팔로워 데이터에 추가 정보 삽입
      const followerUser = users.find(u => u.instaId === f.follower_instaId); // 팔로워의 사용자 정보 조회
      return {
        ...f, // 기존 팔로우 데이터
        image: followerUser?.image || "/uploads/default.jpg" // 팔로워의 프로필 이미지 (기본값 제공)
      };
    });

    res.render("follower.ejs", { data: enriched }); // 팔로워 목록 페이지 렌더링
  }).catch(err => { // 에러 발생 시
    console.error("팔로워 검색 실패", err); // 에러 로그 출력
    res.status(500).send("서버 오류"); // 클라이언트에 에러 응답
  });
});

app.get("/followings", (req, res) => { // 내 팔로잉 목록 요청 처리
  const user = req.session.user; // 세션에서 현재 사용자 정보 가져오기
  if (!user) return res.redirect("/login"); // 세션이 없으면 로그인 페이지로 리다이렉트

  const myName = user.name; // 현재 사용자의 이름 저장

  Promise.all([ // 여러 컬렉션에서 데이터 병렬 조회
    mydb.collection("matchedFollow").find({ follower_name: myName }).toArray(), // 내가 팔로우하는 사람들 조회
    mydb.collection("users").find().toArray(), // 모든 사용자 데이터 조회
    mydb.collection("follow").find().toArray() // 셀럽 데이터 조회
  ]).then(([follows, users, followsRaw]) => { // 조회 결과 처리
    const enriched = follows.map(f => { // 팔로잉 데이터에 추가 정보 삽입
      // 1. 일반 사용자 확인
      const userMatch = users.find(u => u.instaId === f.following_instaId); // 팔로잉 대상의 사용자 정보 조회
      // 2. 셀럽 확인 (users에 없을 경우 fallback)
      const celebMatch = followsRaw.find(c => c.instaId === f.following_instaId); // 팔로잉 대상의 셀럽 정보 조회

      return {
        ...f, // 기존 팔로우 데이터
        image: userMatch?.image || celebMatch?.image || "/uploads/default.jpg" // 팔로잉 대상의 프로필 이미지 (기본값 제공)
      };
    });

    res.render("following.ejs", { data: enriched }); // 팔로잉 목록 페이지 렌더링
  }).catch(err => { // 에러 발생 시
    console.error("팔로잉 검색 실패", err); // 에러 로그 출력
    res.status(500).send("서버 오류"); // 클라이언트에 에러 응답
  });
});

//deleteS
app.post("/deleteS", async (req, res) => { // 메모 삭제 요청 처리
  const { id } = req.body; // 요청 본문에서 메모 ID 추출
  console.log("deleteS 요청:", { id }); // 삭제 요청 정보 로그 출력

  if (!id || !ObjectId.isValid(id)) { // 메모 ID 유효성 검사
    console.log("id 누락 또는 잘못된 형식"); // ID 누락 또는 형식 오류 로그 출력
    return res.status(400).send("잘못된 요청"); // 클라이언트에 에러 응답
  }

  try {
    const result = await mydb.collection("story").deleteOne({ _id: new ObjectId(id) }); // story 컬렉션에서 스토리 삭제
    console.log("스토리 삭제 결과:", result.deletedCount); // 삭제 결과 로그 출력

    if (result.deletedCount === 0) { // 삭제된 메모가 없으면
      console.log("삭제할 스토리 없음"); // 삭제 실패 로그 출력
      return res.status(404).send("삭제할 스토리가 없습니다."); // 클라이언트에 에러 응답
    }

    res.redirect("/mine"); // 내 프로필 페이지로 리다이렉트
    console.log("리다이렉트 시도: /mine"); // 리다이렉트 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("deleteS 에러:", err); // 에러 로그 출력
    res.status(500).send("삭제 실패"); // 클라이언트에 에러 응답
  }
});

// /deleteP
app.post("/deleteP", async (req, res) => { // 게시물 삭제 요청 처리
  const { id } = req.body; // 요청 본문에서 게시물 ID 추출
  console.log("deleteP 요청:", { id }); // 삭제 요청 정보 로그 출력

  if (!id || !ObjectId.isValid(id)) { // 게시물 ID 유효성 검사
    console.log("id 누락 또는 잘못된 형식"); // ID 누락 또는 형식 오류 로그 출력
    return res.status(400).send("잘못된 요청"); // 클라이언트에 에러 응답
  }

  try {
    const result = await mydb.collection("post").deleteOne({ _id: new ObjectId(id) }); // post 컬렉션에서 게시물 삭제
    console.log("게시물 삭제 결과:", result.deletedCount); // 삭제 결과 로그 출력

    if (result.deletedCount === 0) { // 삭제된 게시물이 없으면
      console.log("삭제할 게시물 없음"); // 삭제 실패 로그 출력
      return res.status(404).send("삭제할 게시물이 없습니다."); // 클라이언트에 에러 응답
    }

    res.redirect("/mine"); // 내 프로필 페이지로 리다이렉트
    console.log("리다이렉트 시도: /mine"); // 리다이렉트 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("deleteP 에러:", err); // 에러 로그 출력
    res.status(500).send("삭제 실패"); // 클라이언트에 에러 응답
  }
});

//게시물 수정
app.get("/edit/:id", async (req, res) => { // 게시물 수정 페이지 요청 처리
  const { id } = req.params; // URL 파라미터에서 게시물 ID 추출
  console.log("edit 요청:", { id }); // 수정 페이지 요청 로그 출력

  if (!ObjectId.isValid(id)) { // 게시물 ID의 ObjectId 형식 유효성 검사
    console.log("잘못된 ObjectId"); // 잘못된 ID 형식 로그 출력
    return res.status(400).send("잘못된 ID 형식"); // 클라이언트에 에러 응답
  }

  try {
    const post = await mydb.collection("post").findOne({ _id: new ObjectId(id) }); // post 컬렉션에서 게시물 조회
    console.log("조회된 게시물:", post); // 조회된 게시물 데이터 로그 출력

    if (!post) { // 게시물이 없으면
      console.log("게시물 없음"); // 게시물 없음 로그 출력
      return res.status(404).send("게시물을 찾을 수 없습니다."); // 클라이언트에 에러 응답
    }

    res.render("postEdit.ejs", { post }); // 게시물 수정 페이지 렌더링
    console.log("postEdit.ejs 렌더링 시도"); // 렌더링 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("edit 에러:", err); // 에러 로그 출력
    res.status(500).send("게시물 조회 실패"); // 클라이언트에 에러 응답
  }
});

// /edit
app.post("/edit", upload.single("newImage"), async (req, res) => { // 게시물 수정 요청 처리
  const { id, title, content } = req.body; // 요청 본문에서 게시물 ID, 제목, 내용 추출
  console.log("edit 요청:", { id, title, content, file: req.file }); // 수정 요청 정보 로그 출력

  if (!id || !ObjectId.isValid(id)) { // 게시물 ID 유효성 검사
    console.log("id 누락 또는 잘못된 형식"); // ID 누락 또는 형식 오류 로그 출력
    return res.status(400).send("잘못된 요청"); // 클라이언트에 에러 응답
  }

  const updateData = { title, content, date: new Date() }; // 업데이트할 데이터 객체 생성
  if (req.file) { // 새 이미지가 업로드된 경우
    updateData.image = "/Uploads/" + req.file.filename; // 이미지 경로 추가
    console.log("새 이미지:", updateData.image); // 새 이미지 경로 로그 출력
  }

  try {
    const result = await mydb.collection("post").updateOne( // post 컬렉션에서 게시물 업데이트
      { _id: new ObjectId(id) }, // 대상 게시물 ID
      { $set: updateData } // 업데이트할 데이터
    );
    console.log("게시물 수정 결과:", result.modifiedCount); // 수정 결과 로그 출력

    if (result.modifiedCount === 0) { // 수정된 게시물이 없으면
      console.log("게시물 수정 실패: ID 없음"); // 수정 실패 로그 출력
      return res.status(404).send("수정할 게시물이 없습니다."); // 클라이언트에 에러 응답
    }

    res.redirect("/mine"); // 내 프로필 페이지로 리다이렉트
    console.log("리다이렉트 시도: /mine"); // 리다이렉트 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("edit 에러:", err); // 에러 로그 출력
    res.status(500).send("수정 실패"); // 클라이언트에 에러 응답
  }
});

// 로그아웃 처리
app.post("/logout", (req, res) => {
  const myUser = req.session.user;
  const myInstaId = myUser.instaId;

  console.log(myInstaId + " 로그아웃");
  req.session.destroy(); // 세션 제거
  res.redirect("/");
});

// /deleteFollow
app.post("/deleteFollow", async (req, res) => { // 팔로워 삭제 요청 처리
  const { followerInstaId, myInstaId } = req.body; // 요청 본문에서 팔로워와 내 인스타 ID 추출
  console.log("deleteFollow 요청:", { followerInstaId, myInstaId }); // 삭제 요청 정보 로그 출력

  if (!followerInstaId || !myInstaId) { // 필수 정보 확인
    console.log("필수 정보 누락"); // 정보 누락 로그 출력
    return res.status(400).send("팔로워 정보가 없습니다."); // 클라이언트에 에러 응답
  }

  try {
    const result = await mydb.collection("matchedFollow").deleteOne({ // matchedFollow 컬렉션에서 팔로우 관계 삭제
      follower_instaId: followerInstaId, // 팔로워 인스타 ID
      following_instaId: myInstaId, // 내 인스타 ID
    });
    console.log("팔로우 삭제 결과:", result.deletedCount); // 삭제 결과 로그 출력

    if (result.deletedCount === 0) { // 삭제된 관계가 없으면
      console.log("삭제할 팔로우 관계 없음"); // 삭제 실패 로그 출력
      return res.status(404).send("삭제할 팔로우 관계가 없습니다."); // 클라이언트에 에러 응답
    }

    const followers = await mydb.collection("matchedFollow").find({ following_instaId: myInstaId }).toArray(); // 최신 팔로워 목록 조회
    console.log("최신 팔로워 목록:", followers.length); // 팔로워 목록 개수 로그 출력

    res.render("follower.ejs", { data: followers || [] }); // 팔로워 목록 페이지 렌더링
    console.log("follower.ejs 렌더링 시도"); // 렌더링 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("deleteFollow 에러:", err); // 에러 로그 출력
    res.status(500).send("삭제 중 오류 발생"); // 클라이언트에 에러 응답
  }
});

// /cancelFollow
app.post("/cancelFollow", async (req, res) => { // 팔로잉 취소 요청 처리
  const { followingInstaId, myInstaId } = req.body; // 요청 본문에서 팔로잉과 내 인스타 ID 추출
  console.log("cancelFollow 요청:", { followingInstaId, myInstaId }); // 취소 요청 정보 로그 출력

  if (!followingInstaId || !myInstaId) { // 필수 정보 확인
    console.log("필수 정보 누락"); // 정보 누락 로그 출력
    return res.status(400).send("팔로잉 정보가 없습니다."); // 클라이언트에 에러 응답
  }

  try {
    const result = await mydb.collection("matchedFollow").deleteOne({ // matchedFollow 컬렉션에서 팔로우 관계 삭제
      follower_instaId: myInstaId, // 내 인스타 ID
      following_instaId: followingInstaId, // 팔로잉 인스타 ID
    });
    console.log("팔로우 삭제 결과:", result.deletedCount); // 삭제 결과 로그 출력

    if (result.deletedCount === 0) { // 삭제된 관계가 없으면
      console.log("삭제할 팔로우 관계 없음"); // 삭제 실패 로그 출력
      return res.status(404).send("삭제할 팔로우 관계가 없습니다."); // 클라이언트에 에러 응답
    }

    const followings = await mydb.collection("matchedFollow").find({ follower_instaId: myInstaId }).toArray(); // 최신 팔로잉 목록 조회
    console.log("최신 팔로잉 목록:", followings.length); // 팔로잉 목록 개수 로그 출력

    res.render("following.ejs", { data: followings || [] }); // 팔로잉 목록 페이지 렌더링
    console.log("following.ejs 렌더링 시도"); // 렌더링 시도 로그 출력
  } catch (err) { // 에러 발생 시
    console.error("cancelFollow 에러:", err); // 에러 로그 출력
    res.status(500).send("삭제 중 오류 발생"); // 클라이언트에 에러 응답
  }
});