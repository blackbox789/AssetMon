const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("data/app.db");
const rows = db.prepare("SELECT COUNT(*) AS cnt FROM devices WHERE type = 'storage'").all();
const cnt = rows[0].cnt;
console.log("Jumlah storage di DB: " + cnt);
db.close();