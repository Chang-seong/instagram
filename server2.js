/*const { MongoClient } = require("mongodb");

const url = "mongodb+srv://plzz:test1234@cluster0.65etpdx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // ← 너의 MongoDB URI
const dbName = "myboard"; // ← 사용 중인 DB 이름

MongoClient.connect(url)
  .then(client => {
    console.log("✅ MongoDB 연결 성공");
    const db = client.db(dbName);
    const testCollection = db.collection("test");

    const testDoc = {
      message: "테스트 데이터입니다",
      createdAt: new Date()
    };

    return testCollection.insertOne(testDoc)
      .then(result => {
        console.log("✅ 문서 삽입 성공:", result.insertedId);
        client.close();
      })
      .catch(err => {
        console.error("❌ 문서 삽입 실패:", err);
        client.close();
      });
  })
  .catch(err => {
    console.error("❌ MongoDB 연결 실패:", err);
  });
*/

const { MongoClient } = require("mongodb");

const url = "mongodb+srv://plzz:test1234@cluster0.65etpdx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "myboard";

async function checkUserExists(id, instaId) {
  let client;

  try {
    // MongoDB 연결
    client = await MongoClient.connect(url);
    console.log("✅ MongoDB 연결 성공");

    const db = client.db(dbName);
    const usersCollection = db.collection("users");

    // id 또는 instaId가 존재하는지 확인
    const user = await usersCollection.findOne({
      $or: [{ id }, { instaId }],
    });

    // 결과 출력
    if (user) {
      console.log(`✅ 사용자 존재: id=${id}, instaId=${instaId}`);
      return true;
    } else {
      console.log(`❌ 사용자 없음: id=${id}, instaId=${instaId}`);
      return false;
    }
  } catch (err) {
    console.error("❌ 에러 발생:", err);
    return false;
  } finally {
    if (client) {
      await client.close();
      console.log("✅ MongoDB 연결 종료");
    }
  }
}

// 테스트 실행
(async () => {
  // 테스트할 값 (원하는 id와 instaId로 변경 가능)
  const testId = "qwer";
  const testInstaId = "@iressq";

  const exists = await checkUserExists(testId, testInstaId);
  console.log("결과:", exists);
})();