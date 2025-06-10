console.log("server.js 시작됨");

const express = require("express");
const app = express();
const multer  = require("multer");
const path = require("path");
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectId;
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo"); //add new
const { promises } = require("dns");
const port = process.env.PORT || 5000;

const url = 'mongodb+srv://plzz:test1234@cluster0.65etpdx.mongodb.net/myboard?retryWrites=true&w=majority';


app.use(session({
  secret: process.env.SESSION_SECRET || "sodlfmadmsckdtjd153159",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    url: 'mongodb+srv://plzz:test1234@cluster0.65etpdx.mongodb.net/myboard?retryWrites=true&w=majority', // 여기를 환경변수로 연결
    dbName: 'myboard',
    ttl: 14 * 24 * 60 * 60
  })
}));

let mydb;

/* 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: '비밀코드',
  resave: false,
  saveUninitialized: true
}));*/

//얘네도 위에 있는 애들들
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); //얘는 새로운 코드
app.set("view engine", "ejs");

// 업로드된 파일을 저장할 경로와 파일 이름 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });


// MongoDB 연결
MongoClient.connect(url)
  .then((client) => {
    mydb = client.db("myboard");
    console.log("MongoDB 연결 성공");

    app.post("/register", upload.single("image"), function (req, res) {
      const { name, instaId, id, pw } = req.body;
      const image = req.file ? "/uploads/" + req.file.filename : null;

      console.log("[register 요청]", req.body, "파일:", req.file);

      if (!name || !instaId || !id || !pw) {
        return res.send("입력값 오류");
      }

      mydb.collection("users").findOne({
        $or: [{ id }, { instaId }]
      }, function (err, exist) {
        if (err) return res.send("에러 발생");

        if (exist) {
          if (exist.id === id) return res.send("이미 존재하는 아이디입니다.");
          if (exist.instaId === instaId) return res.send("이미 존재하는 인스타 ID입니다.");
        }

        // 중복 없음> 저장
        mydb.collection("users").insertOne({ name, instaId, id, pw, image }, function (err, result) {
          if (err) return res.send("회원가입 실패");

          console.log("[회원가입 성공]", result);
          req.session.user = { id };
          res.redirect("/home");
        });
      });
    });


    console.log("🌐 실제 포트:", process.env.PORT);


    app.listen(port, function () {
      console.log(`포트 ${port}에서 서버 대기 중...`);
    });

  })
  .catch((err) => {
    console.log("MongoDB 연결 실패:", err);
  });


app.get("/",(req, res)=>{
  res.redirect("/enter");
})


// 로그인/회원가입 진입 화면
app.get("/enter", function(req, res) {
  res.render("enter.ejs");
});



// 로그인 처리
app.post("/login", function(req, res) {
  const { id, pw } = req.body;

  mydb.collection("users").findOne({ id, pw }, function(err, user) {
  if (!user) {
    return res.send("로그인 실패");
  }

  // 필요한 정보만 session에 저장
  req.session.user = {
    id: user.id,
    name: user.name,
    instaId: user.instaId,
    image: user.image // 프로필 사진도 쓰려면 여기도 포함
  };

  res.redirect("/home");
  });
});


app.get("/home", function (req, res) {
  const myUser = req.session.user;
  
  if (!myUser || !myUser.instaId) {
    console.log("로그인된 사용자 정보 없음");
    return res.redirect("/login");
  }

  const myInstaId = myUser.instaId;
  console.log("현재 로그인 instaId:", myInstaId);

  mydb.collection("matchedFollow").find({ follower_instaId: myInstaId }).toArray(function (err, followDocs) {
  if (err) return res.status(500).send("서버 오류");

  const followingIds = followDocs.map(doc => doc.following_instaId);
  followingIds.push(myInstaId); // 내 게시물도 포함

  Promise.all([
    mydb.collection("story")
    .find({ instaId: { $in: followingIds } })
    .sort({ _id: -1 }) // 최신 스토리 먼저!
    .toArray(),
    mydb.collection("users").find().toArray(),
    mydb.collection("post")
    .find({ instaId: { $in: followingIds } })
    .sort({ _id: -1 }) // 최신 게시물 먼저!
    .toArray(),
    mydb.collection("follow").find().toArray()
  ])
  .then(([stories, users, posts, follows]) => {

    // instaId → name 매핑 테이블 만들기
    const followMap = {};
    followDocs.forEach(doc => {
      followMap[doc.following_instaId] = doc.following_name;
    });
    followMap[myInstaId] = myUser.name;

    // 게시물에 name, image, date 붙이기
    const enrichedPosts = posts.map(post => {
      const user = users.find(u => u.instaId === post.instaId);
      const followUser = follows.find(f => f.instaId === post.instaId);
      return {
        ...post,
        name: followMap[post.instaId] || "알 수 없음",
        profileImage: (user?.image || followUser?.image || "/uploads/default.jpg"),
        dateFormatted: post.date ? new Date(post.date).toLocaleString("ko-KR") : ""
      };
    });

    // 스토리도 동일하게
    const enrichedStories = stories.map(story => {
      const user = users.find(u => u.instaId === story.instaId);
      const followUser = follows.find(f => f.instaId === story.instaId);
      return {
        ...story,
        profileImage: (user?.image || followUser?.image || "/uploads/default.jpg")
      };
    });

    res.render("home.ejs", {
      name: myUser.name, // 로그인한 유저 이름
      posts: enrichedPosts,
      stories: enrichedStories
    });
  });
});
});





// 게시물 입력 폼으로 보냄
app.get("/post", function(req, res) {
  res.render("post_form.ejs");
});

// 게시물 저장
app.post("/post", upload.single("image"), function (req, res) {
  const { title, content } = req.body; // req.body 이제 정상 작동
  const file = req.file;

  // 게시물 저장 예시
  mydb.collection("post").insertOne({
    title,
    content,
    image: file ? "/uploads/" + file.filename : "",
    instaId: req.session.user?.instaId,
    date: new Date()
  }).then(() => {
    res.redirect("/home");
  });
});

// 스토리 입력 폼으로 보냄
app.get("/story", function(req, res) {
  res.render("story_form.ejs");
});

// 스토리 저장
app.post("/story", upload.single("image"), function (req, res) {
  const { content, location } = req.body;
  const image = req.file ? "/uploads/" + req.file.filename : null;

  if (!content || !req.session.user) {
    return res.send("내용 또는 로그인 정보 누락");
  }

  const storyData = {
    instaId: req.session.user.instaId,
    content,
    location,
    image,
    date: new Date()
  };

  mydb.collection("story").insertOne(storyData)
    .then(() => res.redirect("/home"))
    .catch(err => {
      console.error("[스토리 저장 실패]", err);
      res.status(500).send("스토리 저장 오류");
    });
});



app.get("/follow", function (req, res) {
  mydb.collection("follow").find().toArray()
    .then(result => {
      res.render("follow_form.ejs", { data: result });
    })
    .catch(err => {
      console.error("follow 컬렉션 조회 실패:", err);
      res.status(500).send("팔로우 목록 오류");
    });
});

app.get("/clickFollow", function (req, res) {
  const { targetName, targetInstaId, targetImage } = req.query;
  const myUser = req.session.user;

  if (!myUser) {
    return res.send(`
      <script>
        alert("로그인 정보가 없습니다. 다시 로그인해주세요.");
        window.location.href = "/login";
      </script>
    `);
  }

  // 자기 자신 팔로우 방지
  if (myUser.instaId === targetInstaId) {
    return res.send(`
      <script>
        alert("자기 자신은 팔로우할 수 없습니다.");
        window.location.href = "/follow";
      </script>
    `);
  }

  // 중복 팔로우 여부 확인
  mydb.collection("matchedFollow").findOne({
    follower_instaId: myUser.instaId,
    following_instaId: targetInstaId
  }, function (err, existingFollow) {
    if (err) {
      console.error("중복 확인 오류:", err);
      return res.status(500).send("서버 오류");
    }

    if (existingFollow) {
      // 이미 팔로우한 경우
      return res.send(`
        <script>
          alert("이미 팔로우한 사용자입니다.");
          window.location.href = "/follow";
        </script>
      `);
    }

    //새 팔로우 관계 추가
    const followData = {
      follower_name: myUser.name,
      follower_instaId: myUser.instaId,
      following_name: targetName,
      following_instaId: targetInstaId,
      image: targetImage,
      followed_at: new Date()
    };

    mydb.collection("matchedFollow").insertOne(followData, function (err, result) {
      if (err) {
        console.error("팔로우 요청 실패", err);
        return res.status(500).send(`
          <script>
            alert("팔로우 요청 실패!");
            window.location.href = "/follow";
          </script>
        `);
      }

      console.log(`${myUser.instaId} → ${targetInstaId} 팔로우 완료`);

      res.send(`
        <script>
          alert("${targetName} 팔로우가 완료되었습니다!");
          window.location.href = "/follow";
        </script>
      `);
    });
  });
});



app.post("/searchFollower", (req, res) => {
  const findName = req.body.findName;
  
  mydb.collection("users").find({
    name:{ $regex: findName, $options: "i" } // 이름 포함, 대소문자 구분 안 함
    //바로 위 name은 collection users의 필드 이름
  }).toArray(function(err, result) {
    if (err) {
      console.error("DB 검색 오류:", err);
      return res.status(500).send("검색 중 오류 발생");
    }

    res.render("follow_form.ejs", { data: result });
  });
});

app.get('/mine', (req, res)=>{
  const myUser = req.session.user;//로그인한 정보 가져오기

  const myInstaId = myUser.instaId;//로그인 한 계정의 인스타 아이디를 myInstaId로 전달함

  Promise.all([
    mydb.collection("story").find({  instaId: myInstaId}).toArray(),
    mydb.collection("post").find({ instaId: myInstaId}).toArray()
  ])
  .then(([myStories, myPosts]) =>{
    res.render("mine.ejs",{
      post:myPosts,
      story:myStories,
      myUser:myUser
    });
  })
  .catch(err =>{
    console.error("내 컨텐츠 불러오기 실패");
    return res.status(500).send("서버 오류");
  });
});

app.get("/viewPosts", (req, res) => {
  const targetInstaId = req.query.instaId;
  const targetName = req.query.name;
  const targetImage = req.query.image;

  mydb.collection("post").find({ instaId: targetInstaId }).toArray((err, posts) => {
    if (err) return res.status(500).send("게시물 조회 실패");

    const firstPost = posts[0] || {date:"미공개"}; // 대표 게시물 하나 선택

    res.render("viewPosts.ejs", {
      instaId: targetInstaId,
      name: targetName,
      image: targetImage,
      date: firstPost.date || "", // 여기서만 date 가능
      posts: posts
    });
  });
});

app.post("/myImage", upload.single("image"), function (req, res) {
  const user = req.session.user;
  if (!user || !req.file) return res.redirect("/login");

  const imagePath = "/uploads/" + req.file.filename;

  mydb.collection("users").updateOne(
    { instaId: user.instaId },
    { $set: { image: imagePath } },
    function (err, result) {
      if (err) return res.send("프로필 이미지 업데이트 실패");

      // 세션도 즉시 반영
      req.session.user.image = imagePath;

      res.redirect("/home");
    }
  );
});

app.get("/followers", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  const myName = user.name;

  Promise.all([
    mydb.collection("matchedFollow").find({ following_name: myName }).toArray(),
    mydb.collection("users").find().toArray()
  ]).then(([follows, users]) => {
    const enriched = follows.map(f => {
      const followerUser = users.find(u => u.instaId === f.follower_instaId);
      return {
        ...f,
        image: followerUser?.image || "/uploads/default.jpg"
      };
    });

    res.render("follower.ejs", { data: enriched });
  }).catch(err => {
    console.error("팔로워 검색 실패", err);
    res.status(500).send("서버 오류");
  });
});

app.get("/followings", (req, res) => { 
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  const myName = user.name;

  Promise.all([
    mydb.collection("matchedFollow").find({ follower_name: myName }).toArray(),
    mydb.collection("users").find().toArray(),  // 회원가입 사용자
    mydb.collection("follow").find().toArray()  // 셀럽 목록
  ]).then(([follows, users, followsRaw]) => {
    const enriched = follows.map(f => {
      // 1. 일반 사용자 확인
      const userMatch = users.find(u => u.instaId === f.following_instaId);

      // 2. 셀럽 확인 (users에 없을 경우 fallback)
      const celebMatch = followsRaw.find(c => c.instaId === f.following_instaId);

      return {
        ...f,
        image: userMatch?.image || celebMatch?.image || "/uploads/default.jpg"
      };
    });

    res.render("following.ejs", { data: enriched });
  }).catch(err => {
    console.error("팔로잉 검색 실패", err);
    res.status(500).send("서버 오류");
  });
});
//스토리 삭제
app.post("/deleteS", function (req, res) {
  const { id } = req.body;
  mydb.collection("story").deleteOne({ _id: new ObjectId(id) }, function (err, result) {
    if (err) return res.send("삭제 실패");
    res.redirect("/mine"); // 다시 프로필 페이지로 이동
  });
});

//게시물 삭제
app.post("/deleteP", function (req, res) {
  const { id } = req.body;
  mydb.collection("post").deleteOne({ _id: new ObjectId(id) }, function (err, result) {
    if (err) return res.send("삭제 실패");
    res.redirect("/mine"); // 다시 프로필 페이지로 이동
  });
});

app.get("/edit/:id", function (req, res) {
  const id = req.params.id;
  mydb.collection("post").findOne({ _id: new ObjectId(id) }, function (err, post) {
    if (err || !post) return res.send("게시물 조회 실패");
    res.render("postEdit.ejs", { post });
  });
});

app.post("/edit", upload.single("newImage"), function (req, res) {
  const { id, title, content } = req.body;

  const updateData = { title, content };
  if (req.file) {
    updateData.image = "/uploads/" + req.file.filename;
  }

  mydb.collection("post").updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData },
    function (err, result) {
      if (err) return res.send("수정 실패");
      res.redirect("/mine");
    }
  );
});

// 로그아웃 처리
app.post("/logout", (req, res)=> {
  const myUser = req.session.user;
  const myInstaId = myUser.instaId;

  console.log(myInstaId+" 로그아웃");
  req.session.destroy(); // 세션 제거
  res.redirect("/");
});


//나를 팔로우하는 사람을 삭제하는 기능(팔로우를 끊는 것)
app.post("/deleteFollow", (req, res)=>{
  const { followerInstaId, myInstaId } = req.body; //내 인스타 아이디와 나를 팔로우하는 사람의 정보를 받음

  if(!followerInstaId || !myInstaId){
    return res.status(400).send("팔로워 정보가 없습니다.");
  }

  mydb.collection("matchedFollow").deleteOne({
    follower_instaId: followerInstaId,
    following_instaId: myInstaId
  },function (err,result){
    if(err){
      console.error("팔로우 삭제 실패")
      return res.status(500).send("삭제 중 오류 발생");
    }
    console.log(`${followerInstaId} → ${myInstaId} 팔로우 삭제 완료`);

    // 삭제 후 최신 팔로워 목록 다시 불러오기
    mydb.collection("matchedFollow").find({ following_instaId: myInstaId }).toArray((err, followers) => {
      if (err) {
        return res.status(500).send("팔로워 불러오기 오류");
      }

      res.render("follower.ejs", { data: followers });
    });
  });
});

//내가 팔로우하는 사람을 삭제하는 기능(팔로우를 끊는 것)
app.post("/cancelFollow", (req, res)=>{
  const { followingInstaId, myInstaId } = req.body; //내 인스타 아이디와 내가 팔로우하는 사람의 정보를 받음

  if(!followingInstaId || !myInstaId){
    return res.status(400).send("팔로잉 정보가 없습니다.");
  }

  mydb.collection("matchedFollow").deleteOne({
    follower_instaId: myInstaId,
    following_instaId: followingInstaId
  },function (err,result){
    if(err){
      console.error("팔로우 삭제 실패")
      return res.status(500).send("삭제 중 오류 발생");
    }
    console.log(`${myInstaId} → ${followingInstaId} 팔로우 삭제 완료`);

    // 삭제 후 최신 팔로잉 목록 다시 불러오기
    mydb.collection("matchedFollow").find({ follower_instaId: myInstaId }).toArray((err, followings) => {
      if (err) {
        return res.status(500).send("팔로잉 불러오기 오류");
      }

      res.render("following.ejs", { data: followings });
    });
  });
});