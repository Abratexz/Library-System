const mysql = require("mysql2");

const pool = mysql.createPool({
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


module.exports = pool.promise();
