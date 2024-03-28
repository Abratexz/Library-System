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

module.exports = router;
