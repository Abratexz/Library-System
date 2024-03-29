let express = require("express");
let router = express.Router();
let conn = require("./connect");
let jwt = require("jsonwebtoken");
let secretCode = "mylibraryprojectkey";
let session = require("express-session");
let formidable = require("formidable");
let fs = require("fs");
let dayjs = require("dayjs");
let numeral = require("numeral");
let dayFormat = "DD/MM/YYYY";
router.use(
  session({
    secret: "sessionformylibraryprojectkey",
    resave: false,
    saveUninitialized: true,
    cookie: {
      MaxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

router.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.numeral = numeral;
  res.locals.dayjs = dayjs;

  next();
});

function isLogin(req, res, next) {
  if (req.session.token != undefined) {
    next();
  } else {
    res.redirect("/login");
  }
}

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index");
});

router.get("/home", isLogin, (req, res) => {
  res.render("home");
});

router.get("/logout", isLogin, (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/login", (req, res) => {
  let sql = "SELECT * FROM tb_user WHERE usr = ? AND pwd = ?";
  let params = [req.body["usr"], req.body["pwd"]];

  conn.query(sql, params, (err, result) => {
    if (err) throw err;

    if (result.length > 0) {
      let id = result[0].id;
      let name = result[0].name;

      let token = jwt.sign({ id: id, name: name }, secretCode);
      req.session.token = token;
      req.session.name = name;
      req.session.usr = result[0].usr;
      req.session.img = result[0].img;
      req.session.level = result[0].level;
      res.redirect("/home");
    } else {
      res.send("Username Or Password Invalid");
    }
  });
});

router.get("/register", (req, res) => {
  res.render("register");
});

router.post("/register", (req, res) => {
  let sql =
    "INSERT INTO tb_user SET name = ?, usr =?, pwd = ?, level = ?, phone = ?";
  let params = [
    req.body["name"],
    req.body["usr"],
    req.body["pwd"],
    req.body["level"],
    req.body["phone"],
  ];

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/login");
  });
});

router.get("/profile/", isLogin, (req, res) => {
  let data = jwt.verify(req.session.token, secretCode);
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = [data.id];

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("profile", { user: result[0] });
  });
});

router.get("/editProfile/:id", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("editProfile", { user: result[0] });
  });
});

router.post("/editProfile/:id", isLogin, (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (error, fields, file) => {
    let filePath = file.img[0].filepath;
    let newPath = "C://Users/nemo_/Desktop/Library-System/app/public/images/";
    let pathUpload = newPath + file.img[0].originalFilename;

    fs.copyFile(filePath, pathUpload, () => {
      let sqlSelect = "SELECT img FROM tb_user WHERE id = ?";
      let paramSelect = req.params.id;

      conn.query(sqlSelect, paramSelect, (err, oldImg) => {
        if (err) throw err;
        let newImg = oldImg[0];
        fs.unlink(newPath + newImg.img, (err) => {
          if (err) {
            console.log(err);
          }
          // insert to database
          let sql =
            "UPDATE tb_user SET name = ? , usr = ?, pwd = ? , img = ? WHERE id = ?";
          let params = [
            fields["name"],
            fields["usr"],
            fields["pwd"],
            file.img[0].originalFilename,
            req.params.id,
          ];
          conn.query(sql, params, (err, result) => {
            if (err) throw err;
            res.redirect("/profile");
          });
        });
      });
    });
  });
});

router.get("/user", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_user ORDER BY id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("user", { users: result });
  });
});

router.get("/addUser", isLogin, (req, res) => {
  res.render("addUser", { user: {} });
});

router.post("/addUser", isLogin, (req, res) => {
  let sql = "INSERT INTO tb_user SET ?";
  let params = req.body;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/user");
  });
});

router.get("/editUser/:id", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("addUser", { user: result[0] });
  });
});

router.post("/editUser/:id", isLogin, (req, res) => {
  let sql =
    "UPDATE tb_user SET name = ?, usr = ?, pwd = ?, phone = ?, level = ? WHERE id = ? ";
  let params = [
    req.body["name"],
    req.body["usr"],
    req.body["pwd"],
    req.body["phone"],
    req.body["level"],
    req.params.id,
  ];

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/user");
  });
});

router.get("/deleteUser/:id", isLogin, (req, res) => {
  let sql = "DELETE FROM tb_user WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/user");
  });
});

router.get("/groupBook", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_group_book ORDER BY id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("groupBook", { groupBooks: result });
  });
});

router.get("/addGroupBook", isLogin, (req, res) => {
  res.render("addGroupBook", { groupBook: {} });
});

router.post("/addGroupBook", isLogin, (req, res) => {
  let sql = "INSERT INTO tb_group_book SET ?";
  let params = req.body;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupBook");
  });
});

router.get("/editGroupBook/:id", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_group_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("addGroupBook", { groupBook: result[0] });
  });
});

router.post("/editGroupBook/:id", isLogin, (req, res) => {
  let sql = "UPDATE tb_group_book SET name_tag = ? WHERE id = ? ";
  let params = [req.body["name_tag"], req.params.id];

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupBook");
  });
});

router.get("/deleteGroupBook/:id", isLogin, (req, res) => {
  let sql = "DELETE FROM tb_group_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupBook");
  });
});

router.get("/book", isLogin, (req, res) => {
  let sql =
    "SELECT tb_book.* , tb_group_book.name_tag AS group_book_name_tag FROM tb_book " +
    "LEFT JOIN tb_group_book ON tb_group_book.id = tb_book.group_book_id " +
    "ORDER BY tb_book.id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("book", { books: result });
  });
});

router.get("/addBook", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_group_book ORDER BY name_tag";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("addBook", { book: {}, groupBooks: result });
  });
});

router.post("/addBook", isLogin, (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (err, fields, file) => {
    if (!file || !file.img) {
      req.session.message = "You must upload images!!!";
      res.redirect("/book");
    } else {
      let filePath = file.img[0].filepath;
      let newPath = "C://Users/nemo_/Desktop/Library-System/app/public/images/";
      newPath += file.img[0].originalFilename;
      fs.copyFile(filePath, newPath, () => {
        let sql =
          "INSERT INTO tb_book(group_book_id, isbn, name, detail, img) VALUES(?, ?, ?, ?, ?)";
        let params = [
          fields["group_book_id"],
          fields["isbn"],
          fields["name"],
          fields["detail"],
          file.img[0].originalFilename,
        ];
        conn.query(sql, params, (err, result) => {
          if (err) throw err;
          res.redirect("/book");
        });
      });
    }
  });
});

router.get("/editBook/:id", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, book) => {
    if (err) throw err;

    sql = "SELECT * FROM tb_group_book ORDER BY name_tag";
    conn.query(sql, (err, groupBooks) => {
      if (err) throw err;
      console.log(book[0]);
      console.log(groupBooks);
      res.render("addBook", { book: book[0], groupBooks: groupBooks });
    });
  });
});

router.post("/editBook/:id", isLogin, (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (err, fields, file) => {
    let filePath = file.img[0].filepath;
    let newPath = "C://Users/nemo_/Desktop/Library-System/app/public/images/";
    let pathUpload = newPath + file.img[0].originalFilename;

    fs.copyFile(filePath, pathUpload, () => {
      let sqlSelect = "SELECT img FROM tb_book WHERE id = ?";
      let paramSelect = req.params.id;

      conn.query(sqlSelect, paramSelect, (err, oldBook) => {
        if (err) throw err;
        let Book = oldBook[0];
        let oldImages = newPath + Book.img;
        if (oldImages != pathUpload) {
          fs.unlink(newPath + Book.img, (err) => {
            if (err) {
              console.log(err);
            }

            let sql =
              "UPDATE tb_book SET group_book_id = ?, isbn = ?, name = ?, detail = ?, img = ? WHERE id = ?";
            let params = [
              fields["group_book_id"],
              fields["isbn"],
              fields["name"],
              fields["detail"],
              file.img[0].originalFilename,
              req.params.id,
            ];
            console.log(params);

            conn.query(sql, params, (err, result) => {
              if (err) throw err;
              res.redirect("/book");
            });
          });
        } else {
          req.session.message = "You can't upload same images!!!";
          res.redirect("/book");
        }
      });
    });
  });
});

router.get("/deleteBook/:id/:img", isLogin, (req, res) => {
  let newPath = "C://Users/nemo_/Desktop/Library-System/app/public/images/";

  newPath += req.params.img;

  fs.unlink(newPath, (err) => {
    if (err) throw err;

    let sql = "DELETE FROM tb_book WHERE id = ?";
    let params = req.params.id;

    conn.query(sql, params, (err, results) => {
      if (err) throw err;
      res.redirect("/book");
    });
  });
});
module.exports = router;
