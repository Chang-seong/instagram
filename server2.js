const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://plzz:test1234@cluster0.65etpdx.mongodb.net/myboard?retryWrites=true&w=majority";

MongoClient.connect(uri)
  .then(client => {
    console.log("✅ 연결 성공!");
    return client.db("myboard").collection("test").insertOne({ ok: true });
  })
  .then(result => {
    console.log("✅ 데이터 삽입 성공:", result.insertedId);
    process.exit();
  })
  .catch(err => {
    console.error("❌ 최종 에러:", err);
    process.exit();
  });
