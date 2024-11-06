let mysql = require("mysql");
let conn = mysql.createConnection({
  host: "mysql-library-system-kmutnb.alwaysdata.net",
  user: "384028",
  password: "library@1234",
  database: "library-system-kmutnb_1",

  /*
  host: "localhost",
  user: "root",
  password: "",
  database: "db_library",
  */
});

conn.connect((err) => {
  if (err) throw err;
  console.log("connected to database");
});

module.exports = conn;
