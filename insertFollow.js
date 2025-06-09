// 파일명: insertCelebPosts.js
const { MongoClient } = require("mongodb");

const url = 'mongodb+srv://plzz:test1234@cluster0.65etpdx.mongodb.net/myboard?retryWrites=true&w=majority';

const celebPosts = [
  {
    title: "Treble!",
    content: "Thank you for my big fans!",
    instaId: "@Lionel Messi",
    image: "/uploads/messi1.jpg",
    date: new Date()
  },
  {
    title: "금메달!",
    content: "감사합니다",
    instaId: "@yeon_a",
    image: "/uploads/yeona1.jpg",
    date: new Date()
  },
  {
    title: "with Prada",
    content: "",
    instaId: "@jennie",
    image: "/uploads/jennie1.jpg",
    date: new Date()
  },
  {
    title: "손흥민 데뷔 15년 만에 우승",
    content: "토트넘 팬 여러분 진심으로 감사드립니다. Thank you for your cheering!",
    instaId: "@son_hm",
    image: "/uploads/son1.jpg",
    date: new Date()
  },
  {
    title: "Last Dance",
    content: "Peace!",
    instaId: "@x_dragon",
    image: "/uploads/gd1.jpg",
    date: new Date()
  },
  {
    title: "건대 축제!",
    content: "건대 이모저모",
    instaId: "@katarinablue",
    image: "/uploads/karina1.jpg",
    date: new Date()
  },
  {
    title: "한강 러닝!",
    content: "20km 질주",
    instaId: "@cha_eun_woo",
    image: "/uploads/cha1.jpg",
    date: new Date()
  },
  {
    title: "마지막 런닝맨 촬영",
    content: "그동안 런닝맨 배신의 아이콘 기린 이광수를 사랑해주신 시청자 여러분 진심으로 감사드립니다.",
    instaId: "@lee_gwang_soo",
    image: "/uploads/leegs1.jpg",
    date: new Date()
  },
  {
    title: "저 입대합니다..",
    content: "안녕하세요 NCT재현입니다. 내일 논산 육군 훈련소 2시에 입대합니다 조심히 다녀오겠습니다!",
    instaId: "@jaehyun_nct",
    image: "/uploads/jaehyun1.jpg",
    date: new Date()
  },
  {
    title: "come back!!",
    content: "our new song - !",
    instaId: "@itzy_yezi",
    image: "/uploads/yezi1.jpg",
    date: new Date()
  },
  {
    title: "Thank you for comming!!",
    content: "in Gochuck-Dom Stadium",
    instaId: "@day_6",
    image: "/uploads/daysix1.jpg",
    date: new Date()
  },
  {
    title: "Welcome to instagram!!",
    content: "You can interaction with any people.",
    instaId: "@mark_zuck",
    image: "/uploads/mark1.jpg",
    date: new Date()
  }

];

MongoClient.connect(url)
  .then(client => {
    const db = client.db("myboard");
    return db.collection("post").insertMany(celebPosts);
  })
  .then(() => {
    console.log("셀럽 게시물 삽입 완료 ✅");
    process.exit();
  })
  .catch(err => {
    console.error("삽입 중 오류 ❌", err);
    process.exit();
  });
