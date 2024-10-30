require("dotenv").config();
let express = require("express");
let bodyParser = require("body-parser");
let router = express.Router();
let conn = require("./connect");
let jwt = require("jsonwebtoken");
let session = require("express-session");
let formidable = require("formidable");
let fs = require("fs");
let dayjs = require("dayjs");
let numeral = require("numeral");
let path = require("path");
const flash = require("connect-flash");
const { error } = require("console");
let secretCode = process.env.SECRET_CODE;
let dayFormat = process.env.DAY_FORMAT;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/*router.use() ใช้จัดการ session โดยใช้ library ที่ถูกนำเข้ามาก่อนหน้านี้ เมื่อมีการเรียกใช้งานเซิร์ฟเวอร์ทุกครั้ง การใช้ session()
จะเป็นการจัดเก็บข้อมูลของ session และการรักษาสถานะความเป็น user ในระบบ
*/

router.use(
  session({
    secret: process.env.SECRET_CODE,
    resave: false,
    saveUninitialized: true,
    cookie: {
      MaxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

router.use(flash());

router.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.numeral = numeral;
  res.locals.dayjs = dayjs;
  res.locals.messages = req.flash();
  next();
});

router.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  next();
});

const cartMiddleware = (req, res, next) => {
  const cartItems = req.session.cart || [];
  res.locals.cartCount = cartItems.length;
  res.locals.cart = cartItems; // Optional: Store the cart itself if needed
  next();
};
router.use(cartMiddleware);

/*Function fetchGroupBooks ทำหน้าที่ดึงข้อมูลกลุ่มหนังสือจาก database เพื่อส่งข้อมูลให้ router อื่นใช้ 
เพราะว่า ทุก page ที่มี Navbar มี Function Search และ Function Search ต้องการใช้ข้อมูลของกลุ่มหนังสือจึงต้องทำการสร้าง method นี้ไว้เพื่อให้ใช้งานใน Route อื่นๆ
*/
const fetchGroupBooks = async (req, res, next) => {
  try {
    if (!req.session.groupBooks) {
      const conn = require("./connect2");
      const [groupBooks] = await conn.query(
        "SELECT * FROM tb_group_book ORDER BY name_tag ASC"
      );
      req.session.groupBooks = groupBooks; // Store in session
    }
    res.locals.groupBooks = req.session.groupBooks; // Make available for all views
    next();
  } catch (error) {
    res.status(500).send("Error fetching groupBooks: " + error);
  }
};
router.use(fetchGroupBooks);

/*Function isLogin เพื่อตรวจสอบว่าผู้ใช้ได้ Log-in เข้าหรือไม่ โดยตรวจสอบว่ามี session token หรือไม่ ถ้ามีก็ให้ผ่านไป ถ้าไม่มีก็ให้กลับไปหน้า login
 */

// Apply `isLogin` to all routes (except explicitly public ones)
router.use((req, res, next) => {
  if (
    [
      "/login",
      "/register",
      "/forgotPassword",
      "/passwordReset",
      "/passwordResetLink",
    ].some((route) => req.path.startsWith(route))
  ) {
    return next(); // Skip authentication for these routes
  }
  if (!req.session.token) {
    return res.redirect("/login"); // Redirect if not logged in
  }

  // Store user data and login status in res.locals for easy access in views
  res.locals.user = {
    id: req.session.userid,
    name: req.session.name,
    usr: req.session.usr,
    img: req.session.img,
    level: req.session.level,
  };

  next();
});

/* GET home page. 
  ไปหน้า index
*/
router.get("/", function (req, res, next) {
  res.render("index");
});

/*router นีหลักๆคือการ ดึงข้อมูลของหนังสือจาก database มาแสดงที่หน้า home 
มีการกำหนด logic การเเสดงผล Page หลายๆหน้า เช่น 1 2 3 ,
กำหนดการเเสดงหนังสือของเเต่ละหน้า 
การค้นหา การคัดข้อมูลหนังสือเพื่อนำมาเเสดงที่หน้า home

*/

router.get("/home", async (req, res) => {
  try {
    let conn = require("./connect2");
    let page = parseInt(req.query.page) || 1; // ใช้ในการกำหนดหน้าปัจจุบันและจำนวนหนังสือต่อหน้า เช่น ถ้า url page=2 ค่า page ก็ = 2
    let BooksPerPage = parseInt(req.query.BooksPerPage) || 10; // ใช้ในการกำหนดหน้าปัจจุบันและจำนวนหนังสือต่อหน้าโดย ให้ Default = 10
    let offset = (page - 1) * BooksPerPage; // ใช้ในการคำนวณข้อมูลที่ต้องการแสดงในแต่ละหน้า มี 2 หน้าก็อาจจะมีถึง 11 ข้อมูล เป็นต้น
    let sql = "SELECT COUNT(*) AS total FROM tb_book";

    //เงื่อนไขสำหรับการใช้หาหนังสือ
    let params = [];
    let whereClause = "";
    if (req.query.search) {
      whereClause += "book_name LIKE(?)";
      params.push("%" + req.query.search + "%");
    }
    if (req.query.groupBookId) {
      if (whereClause) whereClause += " AND ";
      if (req.query.groupBookId === "All") {
        whereClause += "1";
      } else {
        whereClause += "group_book_id = ?";
        params.push(req.query.groupBookId);
      }
    }
    if (whereClause) {
      sql += " WHERE " + whereClause;
    }

    let [countResult] = await conn.query(sql, params); // นับจำนวนทั้งหมดของหนังสือ
    let totalBooks = countResult[0].total;
    let totalPages = Math.ceil(totalBooks / BooksPerPage);
    sql = "SELECT * FROM tb_book";
    if (whereClause) {
      sql += " WHERE " + whereClause;
    }
    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(BooksPerPage, offset);

    let [books] = await conn.query(sql, params); //ดึงข้อมูลจำนวนหนังสือทั้งหมดที่ตรงกับเงื่อนไขและจำนวนหนังสือที่ต้องการแสดง
    sql = "SELECT * FROM tb_group_book ORDER BY name_tag ASC";

    res.render("home", {
      //ส่งข้อมูลหนังสือที่ดึงมาและข้อมูลการจัดหน้าไปยังหน้า "home"
      books: books,
      currentPage: page,
      BooksPerPage: BooksPerPage,
      totalPages: totalPages,
    });
  } catch (error) {
    res.send("Error: " + error);
  }
});

//เมื่อออกจากระบบให้ลบ session ของผู้ใช้ออกจาก server แล้วไปหน้า login
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

//แสดงผลหน้า login
router.get("/login", (req, res) => {
  res.render("login");
});

//ตรวจสอบข้อมูลที่ผู้ใช้ป้อนเพื่อทำการเข้าระบบและทำการตรวจสอบใน database ว่ามีข้อมูลผู้ใช้งานตรงกับที่ผู้ใช้ป้อนหรือไม่
router.post("/login", (req, res) => {
  let sql = "SELECT * FROM tb_user WHERE usr = ? AND pwd = ?";
  let username = req.body["usr"];
  let password = req.body["pwd"];

  if (!username || !password) {
    //ตรวจสอบว่าผู้ใช้ป้อนรหัสผ่านหรือไม่
    req.flash("loginrequire", "Please provide both username and password");
    return res.redirect("/login");
  }

  let params = [username, password];

  conn.query(sql, params, (err, result) => {
    //ค้นหาข้อมูลผู้ใช้จาก database โดยใช้ชื่อผู้ใช้ (username) และรหัสผ่าน (password) ที่ผู้ใช้ป้อน
    if (err) throw err;

    if (result.length > 0) {
      //ถ้าพบข้อมูลแสดงว่า log in ผ่าน และสร้าง token ใช้ในการยืนยันการเข้าสู่ระบบ โดย Function isLogin()
      let id = result[0].id;
      let name = result[0].name;
      // Set ข้อมูลsession ของผู้ใช้ที่เข้าสู่ระบบเพื่อให้ระบบจำความเป็นผู้ใช้
      let token = jwt.sign({ id: id, name: name }, secretCode);
      req.session.token = token;
      req.session.name = name;
      req.session.usr = result[0].usr;
      req.session.img = result[0].img;
      req.session.level = result[0].level;
      req.session.userid = result[0].id;
      res.redirect("/home"); //ไปหน้า home
    } else {
      //ถ้าไม่มีข้อมูล แสดงว่า รหัสผ่านผิดหรือไม่มีข้อมูลในระบบ
      req.flash(
        "loginfail",
        "Username or password invalid. If you are not registered, please sign up"
      );
      res.redirect("/login"); //ไปหน้า login
    }
  });
});
//แสดงผลหน้า register
router.get("/register", (req, res) => {
  res.render("register");
});

router.post("/register", (req, res) => {
  //ตรวจสอบว่าผู้ใช้ได้กรอกข้อมูลที่จำเป็นทั้งหมดหรือไม่
  if (
    !req.body["name"] ||
    !req.body["usr"] ||
    !req.body["pwd"] ||
    !req.body["level"] ||
    !req.body["phone"] ||
    !req.body["citizencard"]
  ) {
    // ถ้าไม่ได้กรอกทั้งหมดให้สร้างข้อความแจ้งเตือน และแสดงผลหน้า Register

    req.flash("registerrequire", "Please provide all information");
    return res.redirect("/register");
  }

  let checkUsrSql =
    "SELECT * FROM tb_user WHERE usr = ? OR phone = ? OR citizencard = ?";
  let checkParam = [
    req.body["usr"],
    req.body["phone"],
    req.body["citizencard"],
  ];
  //ตรวจสอบว่ามีชื่อผู้ใช้งานหรือหมายเลขโทรศัพท์ หรือหมายเลขบัตรประชาชนที่ผู้ใช้ป้อนมาว่า มีอยู่ใน database อยู่เเล้วหรือไม่
  conn.query(checkUsrSql, checkParam, (err, ExistResult) => {
    if (err) throw err;
    //ถ้ามีข้อมูลแสดงว่าซ้ำ
    if (ExistResult.length > 0) {
      //จะสร้างข้อความแจ้งเตือนและ แสดงผลหน้า register

      req.flash(
        "registerfail",
        "Username Phone number or Citizen ID  already exists. Please try a different one."
      );
      return res.redirect("/register");
    }

    let sql =
      "INSERT INTO tb_user SET name = ?, usr =?, pwd = ?, level = ?, phone = ? ,citizencard = ?";

    let params = [
      req.body["name"],
      req.body["usr"],
      req.body["pwd"],
      req.body["level"],
      req.body["phone"],
      req.body["citizencard"],
    ];
    //ถ้ากไม่มีข้อมูลซ้ำก็เพิ่มข้อมูลผู้ใช้ใหม่เข้าใน database
    conn.query(sql, params);
    //สร้างข้อความแจ้งเตือน และแสดงผลหน้า Login
    req.flash("registerpass", "Register Successfully!!");
    res.redirect("/login");
  });
});

//แสดงผลหน้า forgotpassword
router.get("/forgotPassword", (req, res) => {
  res.render("forgotPassword");
});

router.post("/forgotPassword", (req, res) => {
  let checkUsrSql = "SELECT * FROM tb_user WHERE usr = ?";
  let username = req.body["usr"];
  let checkParam = [username];

  //ตรวจสอบว่ามีชื่อผู้ใช้งานที่ผู้ใช้ป้อนมาอยู่ในฐ database หรือไม่
  conn.query(checkUsrSql, checkParam, (err, ExistResult) => {
    if (err) throw err;
    // ถ้าไม่มีข่อมูลเเสดงว่า ไม่มีข้อมูลผู้ใช้งาน
    if (ExistResult.length === 0) {
      //สร้างข้อความแจ้งเตือน และแสดงผลหน้า forgotpassword

      req.flash("usernotexist", "Username does not exist. Please try again");
      return res.redirect("/forgotPassword");
    }
    //ถ้ามีข้อมูล  สร้างและส่ง token ใหม่ (token จะมีอายุ 1 ชั่วโมง) และแสดงผลหน้า passwordResetLink เพื่อให้ผู้ใช้ตั้งค่ารหัสผ่านใหม่
    let token = jwt.sign({ username }, secretCode, { expiresIn: "1h" });
    res.render("passwordResetLink", { token });
  });
});

//รับค่า token จากพารามิเตอร์ของ URL และแสดงผลหน้า passwordReset
router.get("/passwordReset/:token", (req, res) => {
  let { token } = req.params;

  res.render("passwordReset", { token });
});

//รับค่า token และรหัสผ่านใหม่จากข้อมูลที่ผู้ใช้ส่งมา
router.post("/passwordReset/:token", (req, res) => {
  let { token } = req.params;
  let newPassword = req.body["pwd"];

  //ตรวจสอบ token ว่าถูกต้องหรือไม่
  jwt.verify(token, secretCode, (err, decoded) => {
    if (err) {
      //ถ้าไม่ถูก แสดงผลหน้า login
      return res.redirect("/login");
    } else {
      //ถ้าถูกจะนำรหัสผ่านใหม่ที่ผู้ใช้ป้อนมาใช้ในการอัปเดตรหัสผ่านใน database
      let { username } = decoded;

      let pwdUpdateSql = "UPDATE tb_user SET pwd = ? WHERE usr = ?";
      let updatePwdParams = [newPassword, username];

      conn.query(pwdUpdateSql, updatePwdParams, (err, result) => {
        if (err) throw err;
      });
    }
  });
  //สร้างข้อความแจ้งเตือนและแสดงผลหน้า login
  req.flash("resetsuccess", "Reset Password Success!!");
  res.redirect("/login");
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database

router.get("/profile", (req, res) => {
  res.render("profile", { user: res.locals.user });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ดึงข้อมูลผู้ใช้จาก dabase โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL

router.get("/editProfile/:id", (req, res) => {
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    //ส่งข้อมูลผู้ใช้ที่ดึงมาและข้อมูลกลุ่มหนังสือ และแสดงหน้า editprofile
    res.render("editProfile", { user: result[0] });
  });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database

router.post("/editProfile/:id", (req, res) => {
  let form = new formidable.IncomingForm(); //แปลงข้อมูลที่รับเข้ามาจากฟอร์ม
  form.parse(req, (error, fields, file) => {
    //แปลงข้อมูลที่รับเข้ามาจาก request เป็น fields และ files
    let sqlSelect = "SELECT img FROM tb_user WHERE id = ?";
    let paramSelect = req.params.id;
    conn.query(sqlSelect, paramSelect, (err, oldUser) => {
      //ดึงข้อมูลผู้ใช้เดิมจาก database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL
      if (err) throw err;
      let oldUserImg = oldUser[0];
      let imgFileName = oldUserImg.img; // ค่าปกติของ Img ทื่มีอยู่ใน Data aka  รูปเก่า

      if (file.img && file.img.length > 0) {
        // เช็คว่ามีการอัปโหลดรูปภาพใหม่มาหรือไม่ ถ้ามีทำการบันทึกไฟล์รูปภาพใหม่ลงในเซิร์ฟเวอร์ และลบไฟล์รูปภาพเดิมออกจากเซิร์ฟเวอร์
        let filePath = file.img[0].filepath;
        let newPath = path.join(__dirname, "../public/images/users/");
        imgFileName = file.img[0].originalFilename; // ใช้รูปใหม่

        fs.copyFile(filePath, newPath + imgFileName, () => {
          if (err) throw err;
          if (oldUserImg.img !== imgFileName) {
            // ถ้ารูปใหม่ต่างจากรูปเก่า
            fs.unlink(newPath + oldUserImg.img, (err) => {
              if (err) {
                console.log(err);
              }
            });
          }
        });
      }
      //อัพเดตข้อมูลผู้ใช้ใน database ตามที่ได้ป้อน
      let sql =
        "UPDATE tb_user SET name = ? , pwd = ? ,phone = ?,citizencard = ?, img = ? WHERE id = ?";
      let params = [
        fields["name"],
        fields["pwd"],
        fields["phone"],
        fields["citizencard"],
        imgFileName,
        req.params.id,
      ];
      conn.query(sql, params, (err, result) => {
        if (err) throw err;
        //ดึงข้อมูลผู้ใช้ที่อัพเดตแล้วจาก database เพื่ออัพเดต session ด้วยข้อมูลผู้ใช้ที่อัพเดตแล้ว
        //ส่งข้อความยืนยันการแก้ไขโปรไฟล์และ แสดงผลหน้า Profile
        let sqlFetchUser = "SELECT * FROM tb_user WHERE id = ?";
        conn.query(sqlFetchUser, paramSelect, (err, updatedUser) => {
          req.session.img = updatedUser[0].img;
          req.session.name = updatedUser[0].name;
          req.flash("profilepass", "Edit Profile Successfully!!");
          res.redirect("/profile");
        });
      });
    });
  });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ดึงข้อมูลผู้ใช้ทั้งหมดจาก database
router.get("/user", (req, res) => {
  let sql = "SELECT * FROM tb_user ORDER BY id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    //ส่งข้อมูลผู้ใช้ที่ดึงมาและข้อมูลกลุ่มหนังสือ และแสดงหน้า user
    res.render("user", { users: result });
  });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database

router.get("/addUser", (req, res) => {
  //แสดงผลและส่งข้อมูลผู้ใช้เปล่า ไปที่หน้า "addUser" เพื่อให้ผู้ใช้กรอกข้อมูลผู้ใช้ในฟอร์ม
  res.render("addUser", { user: {} });
});

router.post("/addUser", (req, res) => {
  //เพิ่มข้อมูลผู้ใช้ใหม่ลงใน Datbase
  //แสดงผลหน้า user
  let sql = "INSERT INTO tb_user SET ?";
  let params = req.body;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/user");
  });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ดึงข้อมูลผู้ใช้จาก dabase โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL

router.get("/editUser/:id", (req, res) => {
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;

    //ส่งข้อมูลผู้ใช้ที่ดึงมาและข้อมูลกลุ่มหนังสือไปที่ "addUser" เพื่อให้ผู้ใช้ทำการแก้ไขข้อมูล
    res.render("addUser", { user: result[0] });
  });
});

//อัพเดตข้อมูลผู้ใช้ใน database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL และแสดงผลหน้า user

router.post("/editUser/:id", (req, res) => {
  let sql =
    "UPDATE tb_user SET name = ?, usr = ?, pwd = ?, phone = ?, level = ? ,citizencard = ? WHERE id = ? ";
  let params = [
    req.body["name"],
    req.body["usr"],
    req.body["pwd"],
    req.body["phone"],
    req.body["level"],
    req.body["citizencard"],
    req.params.id,
  ];

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/user");
  });
});

//ลบข้อมูลผู้ใช้ใน database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL และแสดงผลหน้า user
router.get("/deleteUser/:id", (req, res) => {
  let sql = "DELETE FROM tb_user WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/user");
  });
});

//ดึงข้อมูลกลุ่มหนังสือทั้งหมดจาก dabase
//ส่งข้อมูลลุ่มหนังสือทั้งหมด  และแสดงหน้า groupbook
router.get("/groupBook", (req, res) => {
  let sql = "SELECT * FROM tb_group_book ORDER BY id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("groupBook", {
      groupBooks: result,
    });
  });
});

//ส่งข้อมูลกลุ่มหนังสือเปล่าไปที่หน้า "addGroupBook" เพื่อให้ผู้ใช้กรอกข้อมูลกลุ่มหนังสือในฟอร์ม
router.get("/addGroupBook", (req, res) => {
  res.render("addGroupBook", { groupBook: {} });
});

router.post("/addGroupBook", (req, res) => {
  let sql = "INSERT INTO tb_group_book SET ?";
  let params = req.body;
  //เพิ่มข้อมูลกลุ่มหนังสือใหม่ลงใน Datbase
  //แสดงผลหน้า user
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupBook");
  });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ดึงข้อมูลกลุ่มหนังสือจาก dabase โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL

router.get("/editGroupBook/:id", (req, res) => {
  let sql = "SELECT * FROM tb_group_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;

    //ส่งข้อมูลกลุ่มหนังสือที่ดึงมาและข้อมูลกลุ่มหนังสือทั้งหมดไปที่ "addGroupBook" เพื่อให้ผู้ใช้ทำการแก้ไขข้อมูล
    res.render("addGroupBook", {
      groupBook: result[0],
    });
  });
});

//อัพเดตข้อมูลกลุ่มหนังสือใน database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL และแสดงผลหน้า groupbook

router.post("/editGroupBook/:id", (req, res) => {
  let sql = "UPDATE tb_group_book SET name_tag = ? WHERE id = ? ";
  let params = [req.body["name_tag"], req.params.id];

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupBook");
  });
});

//ลบข้อมูลกลุ่มหนังสือใน database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL และแสดงผลหน้า groupBook
router.get("/deleteGroupBook/:id", (req, res) => {
  let sql = "DELETE FROM tb_group_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupBook");
  });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ดึงข้อมูลหนังสือทั้งหมดจาก database โดยรวมกับกลุ่มหนังสือ
//มีการค้นหาหนังสือโดยใช้เลข ISBN
router.get("/book", (req, res) => {
  let sql =
    "SELECT tb_book.* , tb_group_book.name_tag AS group_book_name_tag FROM tb_book " +
    "LEFT JOIN tb_group_book ON tb_group_book.id = tb_book.group_book_id ";

  const searchISBN = req.query.search;
  const sqlParams = [];

  if (searchISBN) {
    sql += "WHERE tb_book.isbn LIKE ? ";
    sqlParams.push("%" + searchISBN + "%");
  }

  sql += "ORDER BY tb_book.id DESC";

  conn.query(sql, sqlParams, (err, result) => {
    if (err) throw err;

    //ส่งผลลัพธ์ไปที่หน้า "book" พร้อมกับข้อมูลกลุ่มหนังสือทั้งหมด
    res.render("book", { books: result });
  });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ดึงข้อมูลกลุ่มหนังสือทั้งหมดเพื่อใช้ในการเลือกกลุ่มหนังสือขณะเพิ่มหนังสือใหม่
router.get("/addBook", (req, res) => {
  let sql = "SELECT * FROM tb_group_book ORDER BY name_tag";
  conn.query(sql, (err, result) => {
    if (err) throw err;

    res.render("addBook", {
      book: {},
      groupBooks: result,
    });
  });
});

router.post("/addBook", (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (err, fields, file) => {
    //ตรวจสอบว่ามีการอัปโหลดภาพหรือไม่ ถ้าไม่มีจะสร้างข้อความแจ้งเตือนและแสดงผลหน้า"book"
    if (!file || !file.img) {
      req.flash("errorimg", "You must upload images!!!");
      res.redirect("/book");
    } else {
      //นำภาพที่อัปโหลดมาบันทึกในไดเรกทอรีของเซิร์ฟเวอร์

      let filePath = file.img[0].filepath;
      let newPath = path.join(__dirname, "../public/images/books/");
      newPath += file.img[0].originalFilename;
      //เพิ่มข้อมูลหนังสือใหม่ลงใน database และแสดงผลหน้า book
      fs.copyFile(filePath, newPath, () => {
        let sql =
          "INSERT INTO tb_book(group_book_id, isbn, author, book_name, detail,status, img,price,stock) VALUES(?, ?, ?, ?, ?, ?, ?,?,?)";
        let params = [
          fields["group_book_id"],
          fields["isbn"],
          fields["author"],
          fields["book_name"],
          fields["detail"],
          fields["status"],
          file.img[0].originalFilename,
          fields["price"],
          fields["stock"],
        ];
        conn.query(sql, params, (err, result) => {
          if (err) throw err;
          res.redirect("/book");
        });
      });
    }
  });
});

router.get("/editBook/:id", (req, res) => {
  //ดึงข้อมูลหนังสือที่ต้องการแก้ไขจาก database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL
  let sql = "SELECT * FROM tb_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, book) => {
    if (err) throw err;
    //ดึงข้อมูลกลุ่มหนังสือทั้งหมดจาก database
    sql = "SELECT * FROM tb_group_book ORDER BY name_tag";
    conn.query(sql, (err, groupBooks) => {
      if (err) throw err;
      //ส่งข้อมูลหนังสือที่ได้และข้อมูลกลุ่มหนังสือทั้งหมด แสดงผลหน้า "addBook" เพื่อให้ผู้ใช้สามารถแก้ไขข้อมูลหนังสือได้
      res.render("addBook", { book: book[0] });
    });
  });
});

//แก้ไข้ขอมูลหนังสือ โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL
router.post("/editBook/:id", (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (err, fields, file) => {
    let sqlSelect = "SELECT img FROM tb_book WHERE id = ?";
    let paramSelect = req.params.id;
    conn.query(sqlSelect, paramSelect, (err, oldBook) => {
      if (err) throw err;
      let Book = oldBook[0];

      let imgFileName = Book.img; // ค่าปกติของ Img ทื่มีอยู่ใน Data aka  รูปเก่า
      if (file.img && file.img.length > 0) {
        //ตรวจสอบว่ามีการอัปโหลดภาพหรือไม่ ถ้ามีการอัปโหลดภาพใหม่ เปลี่ยนเป็นรูปภาพใหม่และลบรูปภาพเก่าออกจากเซิร์ฟเวอร์
        let filePath = file.img[0].filepath;
        let newPath = path.join(__dirname, "../public/images/books/");
        imgFileName = file.img[0].originalFilename; // ใช้รูปใหม่

        fs.copyFile(filePath, newPath + imgFileName, () => {
          if (err) throw err;
          if (Book.img !== imgFileName) {
            // ถ้ารูปใหม่ต่างจากรูปเก่า
            fs.unlink(newPath + Book.img, (err) => {
              if (err) {
                console.log(err);
              }
            });
          }
        });
      }
      let sql =
        "UPDATE tb_book SET group_book_id = ?, isbn = ?, author = ?, book_name = ?, detail = ?,status = ?, img = ? ,price = ? , stock = ?WHERE id = ?";
      let params = [
        fields["group_book_id"],
        fields["isbn"],
        fields["author"],
        fields["book_name"],
        fields["detail"],
        fields["status"],
        imgFileName, // ใช้รูปใหม่ หรือรูปเก่าที่มี
        fields["price"],
        fields["stock"],
        req.params.id,
      ];
      //อัปเดตข้อมูลหนังสือใน database ด้วยข้อมูลที่ผู้ใช้ป้อน และแสดงผลหน้า book
      conn.query(sql, params, (err, result) => {
        if (err) throw err;
        res.redirect("/book");
      });
    });
  });
});

//ลบหนังสือที่ต้องการลบโดยใช้ id ที่ระบุในพารามิเตอร์ของ URL
router.get("/deleteBook/:id/:img", (req, res) => {
    let newPath = path.join(__dirname, "../public/images/books/");

  newPath += req.params.img;
  //Path ไปยังไฟล์รูปภาพของหนังสือที่ต้องการลบ

  fs.unlink(newPath, (err) => {
    if (err) throw err;
    //ลบไฟล์รูปภาพของหนังสือออกจากเซิร์ฟเวอร์และลบข้อมูลหนังสือออกจาก database และแสดงผลหน้า book

    let sql = "DELETE FROM tb_book WHERE id = ?";
    let params = req.params.id;

    conn.query(sql, params, (err, results) => {
      if (err) throw err;
      res.redirect("/book");
    });
  });
});
//ลบหนังสือทั้งหมดที่มีอยู่ในระบบ
router.get("/deleteAllBook", (req, res) => {
  let newPath = path.join(__dirname, "../public/images/books/");
  //ชี้ไปยังไดเรกทอรีของภาพหนังสือ
  //ดึงรายชื่อของไฟล์ทั้งหมดในไดเรกทอรี
  fs.readdir(newPath, (err, files) => {
    if (err) throw err;
    //วนลูป ไฟล์ที่ได้และตรวจสอบว่าไฟล์ที่วนลูปเป็นไฟล์ที่ต้องการลบหรือไม่
    for (const file of files) {
      const filePath = path.join(newPath, file);
      fs.stat(filePath, (err, stats) => {
        if (err) throw err;
        //ถ้่าไฟล์เป็นไฟล์ที่ต้องการลบ ให้ลบไฟล์ออกจากเซิร์ฟเวอร์
        if (stats.isFile()) {
          fs.unlink(filePath, (err) => {
            if (err) throw err;
          });
        }
      });
    }
  });
  //ลบข้อมูลหนังสือทั้งหมด
  let sql = "DELETE FROM tb_book";

  conn.query(sql, (err, results) => {
    if (err) throw err;
    res.redirect("/book");
  });
});
//เปลี่ยนข้อมูล status ของหนังสือทั้งหมดเป็น 'Available'
router.get("/setAllBookAvailable", (req, res) => {
  let sql = "UPDATE tb_book SET status = 'Available'";
  conn.query(sql, (err, results) => {
    if (err) throw err;
    res.redirect("/book");
  });
});
//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ดึงข้อมูลหนังสือที่ต้องการยืม database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL
router.get("/borrow/:id", (req, res) => {
  let sql = "SELECT * FROM tb_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    sql = "SELECT * FROM tb_group_book ORDER BY name_tag";
    conn.query(sql, (err, groupBooks) => {
      if (err) throw err;
      //นำข้อมูลหนังสือที่ได้และข้อมูลกลุ่มหนังสือทั้งหมดที่ได้ แสดงผลหน้า "borrow" เพื่อให้ผู้ใช้สามารถยืมหนังสือได้
      res.render("borrow", {
        book: result[0],
      });
    });
  });
});

//ยืมโดยเอาข้อมูลหนังสือ โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL ส่วนข้อมูล id ผู้ใช้ ใช้การยืนยันโดยถอดรหัสจาก token
router.post("/borrow/:id", async (req, res) => {
  //ยืนยันการยืนยันตัวตนid ของผู้ใช้ จากการถอดรหัส ใช้ token
  let data = jwt.verify(req.session.token, secretCode);
  let conn = require("./connect2");
  let bookId = req.params.id;
  let id = data.id;
  let bookStatusQuery = "SELECT status FROM tb_book WHERE id = ?";
  let [bookStatusRow] = await conn.query(bookStatusQuery, [bookId]);
  let bookStatus = bookStatusRow[0].status;
  //ตรวจสอบสถานะของหนังสือที่ต้องการยืม
  if (
    bookStatus === "Borrowed" ||
    bookStatus === "Lost" ||
    bookStatus === "Reserved"
  ) {
    //แสดงข้อความและ แสดงผลหน้า home
    req.flash(
      "error",
      "FAILED TO BORROW !! Book Status could be Borrowed Reserved or Lost !!"
    );
    res.redirect("/home");
  } else {
    //ดึงข้อมูลที่ต้องการใช้ ระยะเวลาที่ต้องการยืมหนังสือ
    let duration = req.body["duration"];
    let currentTime = dayjs().format(dayFormat);
    let returnDate = dayjs().add(duration, "day").format(dayFormat);
    //บันทึกข้อมูลการยืมหนังสือ
    let borrowSql = "INSERT INTO tb_borrow SET ?";
    let borrowParams = {
      user_id: data.id,
      book_id: bookId,
      borrow_date: currentTime,
      return_date: returnDate,
      borrow_history_status: "Borrowed",
      duration: req.body["duration"],
    };

    let [borrowResult] = await conn.query(borrowSql, borrowParams);
    let borrowId = borrowResult.insertId; // Get the auto-increment of borrow_id
    //อัพเดทสถานะของหนังสือ
    let updateBookSql = "UPDATE tb_book SET status = 'Borrowed' WHERE id = ? ";
    await conn.query(updateBookSql, bookId);
    //บันทึกประวัติการยืมหนังสือ
    let historySql = "INSERT INTO tb_history SET ?";
    let historyParams = {
      user_id: data.id,
      book_id: bookId,
      borrow_id: borrowId,
      borrow_history_date: currentTime,
      return_history_date: returnDate,
    };
    await conn.query(historySql, historyParams);
    //สร้างข้อความแจ้งเตือนและแสดงผลหน้า home
    req.flash("success", "Book Borrowed Successfully !!");
    res.redirect("/home");
  }
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ดึงข้อมูลหนังสือที่ต้องการจองจาก database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL
router.get("/reserve/:id", (req, res) => {
  let sql = "SELECT * FROM tb_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    sql = "SELECT * FROM tb_group_book ORDER BY name_tag";
    ////นำข้อมูลหนังสือที่ได้และข้อมูลกลุ่มหนังสือทั้งหมดที่ได้ แสดงผลหน้า "reserve" เพื่อให้ผู้ใช้สามารถจองหนังสือได้
    conn.query(sql, (err, groupBooks) => {
      if (err) throw err;
      res.render("reserve", {
        book: result[0],
      });
    });
  });
});

//ยืมโดยเอาข้อมูลหนังสือ โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL ส่วนข้อมูล id ผู้ใช้ ใช้การยืนยันโดยถอดรหัสจาก token
router.post("/reserve/:id", async (req, res) => {
  //ยืนยันการยืนยันตัวตน id ของผู้ใช้ จากการถอดรหัส ใช้ token
  let data = jwt.verify(req.session.token, secretCode);
  let conn = require("./connect2");
  let bookId = req.params.id;
  let id = data.id;
  let bookStatusQuery = "SELECT status FROM tb_book WHERE id = ?";
  let [bookStatusRow] = await conn.query(bookStatusQuery, [bookId]);
  let bookStatus = bookStatusRow[0].status;
  //ตรวจสอบสถานะของหนังสือที่ต้องการยืม
  if (
    bookStatus === "Borrowed" ||
    bookStatus === "Lost" ||
    bookStatus === "Reserved"
  ) {
    //แสดงข้อความและ แสดงผลหน้า home
    req.flash(
      "error",
      "FAILED TO RESERVE !! Book Status could be Borrowed Reserved or Lost !!"
    );
    res.redirect("/home");
  } else {
    //ดึงข้อมูลที่ต้องการใช้ ระยะเวลาที่ต้องการจองหนังสือ
    let duration = req.body["duration"];
    let currentTime = dayjs().format(dayFormat);
    let pickupDate = dayjs().add(duration, "day").format(dayFormat);
    //บันทึกข้อมูลการจองหนังสือ
    let reserveSql = "INSERT INTO tb_reserve SET ?";
    let reserveParams = {
      user_id: data.id,
      book_id: bookId,
      reserve_date: currentTime,
      pickup_date: pickupDate,
      reserve_history_status: "Reserved",
      duration: req.body["duration"],
    };

    let [reserveResult] = await conn.query(reserveSql, reserveParams);
    let reserveId = reserveResult.insertId;
    ////อัพเดทสถานะของหนังสือ
    let updateBookSql = "UPDATE tb_book SET status = 'Reserved' WHERE id = ? ";
    await conn.query(updateBookSql, bookId);
    //บันทึกประวัติการจองหนังสือ
    let historySql = "INSERT INTO tb_history SET ?";
    let historyParams = {
      user_id: data.id,
      book_id: bookId,
      reserve_id: reserveId,
      reserve_history_date: currentTime,
      pickup_history_date: pickupDate,
    };
    await conn.query(historySql, historyParams);
    //สร้างข้อความแจ้งเตือนและแสดงผลหน้า home
    req.flash("error", "Book Borrowed Successfully !!");
    res.redirect("/home");
  }
});

router.get("/history", async (req, res) => {
  let conn = require("./connect2");
  let data = jwt.verify(req.session.token, secretCode);
  //ยืนยันการยืนยันตัวตน id ของผู้ใช้ จากการถอดรหัส ใช้ token
  let sql =
    "SELECT tb_book.*,tb_borrow.borrow_history_status, tb_borrow.borrow_date, tb_borrow.return_date,tb_borrow.id AS borrow_id,tb_history.id AS history_id " +
    "FROM tb_borrow " +
    "JOIN tb_book ON tb_borrow.book_id = tb_book.id " +
    "JOIN tb_history ON tb_borrow.id = tb_history.borrow_id " +
    "WHERE tb_borrow.user_id = ? ORDER BY id ASC";

  let params = [data.id];

  let [borrowUserHistory] = await conn.query(sql, params);
  //ดึงข้อมูลการยืม
  sql =
    "SELECT tb_book.*,tb_reserve.reserve_history_status, tb_reserve.reserve_date, tb_reserve.pickup_date,tb_reserve.id AS reserve_id,tb_history.id AS history_id " +
    "FROM tb_reserve " +
    "JOIN tb_book ON tb_reserve.book_id = tb_book.id " +
    "JOIN tb_history ON tb_reserve.id = tb_history.reserve_id " +
    "WHERE tb_reserve.user_id = ? ORDER BY id ASC";

  let [reserveUserHistory] = await conn.query(sql, params);
  //ดึงข้อมูลการจอง
  sql =
    "SELECT tb_book.*,tb_borrow.borrow_history_status,tb_history.borrow_history_date, tb_history.return_history_date, tb_history.reserve_history_date,tb_history.pickup_history_date, tb_history.id AS history_id " +
    "FROM tb_history " +
    "JOIN tb_book ON tb_history.book_id = tb_book.id " +
    "JOIN tb_borrow ON tb_history.borrow_id = tb_borrow.id " +
    "WHERE tb_history.user_id = ? ORDER BY id ASC";

  let [BHUserHistory] = await conn.query(sql, params);

  sql =
    "SELECT tb_book.*,tb_reserve.reserve_history_status,tb_history.borrow_history_date, tb_history.return_history_date, tb_history.reserve_history_date,tb_history.pickup_history_date, tb_history.id AS history_id " +
    "FROM tb_history " +
    "JOIN tb_book ON tb_history.book_id = tb_book.id " +
    "JOIN tb_reserve ON tb_history.reserve_id = tb_reserve.id " +
    "WHERE tb_history.user_id = ? ORDER BY id ASC";

  let [RHUserHistory] = await conn.query(sql, params);
  //ดึงขอมูลที่เป็นประวัติของ user BH= BorrowHistory RH = ReserveHistory , BHUserHistory RHUserHistorya เพื่อจะนำมารวมกันทีหลัง
 // console.log(BHUserHistory);
  //console.log(RHUserHistory);
  //รวมข้อมูลประวัติการยืมและการจองหนังสือทั้งหมดและแสดงผลหน้า"history" เพื่อให้ผู้ใช้ดูประวัติการยืมและการจองของตัวเองได้
  res.render("history", {
    BHUserHistory: BHUserHistory,
    RHUserHistory: RHUserHistory,
    reserveUserHistory: reserveUserHistory,
    borrowUserHistory: borrowUserHistory,
  });
});
//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ลบประวัติการยืมและการจองหนังสือของผู้ใช้
router.get("/deleteHistory", (req, res) => {
  let deleteHistorySql = "DELETE FROM tb_history WHERE user_id = ?";
  let data = jwt.verify(req.session.token, secretCode);
  //ยืนยันการยืนยันตัวตน id ของผู้ใช้ จากการถอดรหัส ใช้ token
  let params = [data.id];
  conn.query(deleteHistorySql, params, (err, result) => {
    if (err) throw err;
    //หลังจากลบประวัติการยืมและการจองหนังสือ ให้ดึงข้อมูลประวัติการยืมและการจองหนังสือใหม่แม้จะว่างเปล่าเพื่อให้มีค่า ว่างไปเข้าเงื่อนไขต่างๆ เช่นว่าหากไม่มีค่า ให้เเสดงว่าข้อความว่า ไม่มีประวัติการทำรายการ
    let fetchSql = "SELECT * FROM tb_history WHERE user_id = ?";
    conn.query(fetchSql, params, (err, history) => {
      if (err) throw err;
      res.redirect("/history");
    });
  });
});
//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ลบประวัติการยืมและการจองหนังสือของผู้ใช้โดยระบุข้อมูลประวัติ จาก id ที่ส่งมาจากพารามเตอร์ url
router.get("/deleteHistory/:id", (req, res) => {
  let sql = "DELETE FROM tb_history WHERE user_id = ? AND id = ?";
  let data = jwt.verify(req.session.token, secretCode);
  //ยืนยันการยืนยันตัวตน id ของผู้ใช้ จากการถอดรหัส ใช้ token
  let params = [data.id, req.params.id];
  //ลบและแสดงผลหน้า history
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/history");
  });
});

//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database

router.get("/borrowHistory", (req, res) => {
  let sql =
    "SELECT tb_book.*, tb_borrow.* ,tb_user.id AS user_id ,tb_user.name AS user_name,tb_user.phone AS user_phone,tb_user.usr AS user_usr " +
    "FROM tb_borrow " +
    "JOIN tb_book ON tb_borrow.book_id = tb_book.id " +
    "JOIN tb_user ON tb_borrow.user_id = tb_user.id " +
    "ORDER BY tb_borrow.id DESC";
  //เลือกข้อมูลประวัติการยืมหนังสือทั้งหมดของผู้ใช้ทั้งหมดในระบบ
  conn.query(sql, (err, result) => {
    if (err) throw err;
    //ส่งข้อมูลที่ได้รับไปแสดงผลหน้า "borrowHistory"
    res.render("borrowHistory", {
      borrowHistory: result,
    });
  });
});

//ลบข้อมูลการยืมทั้งหมดในระบบและแสดงผลหน้า "borrowHistory"
router.get("/deleteborrowHistory", (req, res) => {
  let sql = "DELETE FROM tb_borrow";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.redirect("/borrowHistory");
  });
});
//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ลบข้อมูลรายการจองหนังสือที่มี id ที่ระบุจากพารามิเตอร์ url และแสดงผลหน้า "borrowHistory"
router.get("/deleteborrowHistory/:id", (req, res) => {
  let sql = "DELETE FROM tb_borrow WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/borrowHistory");
  });
});
//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database

router.get("/reserveHistory", (req, res) => {
  let sql =
    "SELECT tb_book.*, tb_reserve.* ,tb_user.id AS user_id ,tb_user.name AS user_name,tb_user.phone AS user_phone,tb_user.usr AS user_usr " +
    "FROM tb_reserve " +
    "JOIN tb_book ON tb_reserve.book_id = tb_book.id " +
    "JOIN tb_user ON tb_reserve.user_id = tb_user.id " +
    "ORDER BY tb_reserve.id DESC";
  ////เลือกข้อมูลประวัติการจองหนังสือทั้งหมดของผู้ใช้ทั้งหมดในระบบ
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("reserveHistory", {
      //ส่งข้อมูลที่ได้รับไปแสดงผลหน้า "reserveHistory"
      reserveHistory: result,
    });
  });
});
//ลบข้อมูลการจองทั้งหมดในระบบและแสดงผลหน้า "reserveHistory"
router.get("/deleteReserveHistory", (req, res) => {
  let sql = "DELETE FROM tb_reserve";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.redirect("/reserveHistory");
  });
});
//isLogin เพื่อตรวจสอบว่าผู้ใช้เข้าสู่ระบบอยู่หรือไม่ และ fetchGroupBooks เพื่อดึงข้อมูลกลุ่มหนังสือจาก database
//ลบข้อมูลรายการจองหนังสือที่มี id ที่ระบุจากพารามิเตอร์ url และแสดงผลหน้า "reserveHistory"
router.get("/deleteReserveHistory/:id", (req, res) => {
  let sql = "DELETE FROM tb_reserve WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/reserveHistory");
  });
});

router.post("/add-to-cart", (req, res) => {
  const bookId = parseInt(req.body.bookId);
  const cart = req.session.cart || [];

  // Check if the book already exists in the cart
  const existingItem = cart.find((item) => item.bookId === bookId);

  if (existingItem) {
    // If book is already in the cart, increase its quantity
    existingItem.quantity += 1;
  } else {
    // If book is not in the cart, add it with a default quantity of 1
    cart.push({ bookId: bookId, quantity: 1 });
  }
  let totalQuantity = 0;
  cart.forEach((item) => {
    totalQuantity += item.quantity;
  });
  req.session.totalQuantity = totalQuantity;
  // Update the session cart
  req.session.cart = cart;

  res.redirect("/home");
});

router.get("/cart", async (req, res) => {
  try {
    let conn = require("./connect2");
    let carts = req.session.cart || [];
    let books = [];
    let totalPrice = 0;

    if (carts.length > 0) {
      // Extract only bookId values for the SQL query
      let bookIds = carts.map((item) => item.bookId);
      let sql = "SELECT * FROM tb_book WHERE id IN (?)";
      let [results] = await conn.query(sql, [bookIds]);
      books = results;

      // Map quantity from cartItems to books and calculate total price
      books.forEach((book) => {
        const cartItem = carts.find((item) => item.bookId === book.id);
        if (cartItem) {
          book.quantity = cartItem.quantity;
          book.totalPrice = book.price * book.quantity;
          totalPrice += parseFloat(book.totalPrice);
        }
      });
    }

    res.render("cart", {
      cart: books,
      cartCount: carts.length,
      totalQuantity: req.session.totalQuantity,
      totalPrice: totalPrice,
    });

  } catch (error) {
    res.send("Error: " + error);
  }
});

router.post("/update-cart", (req, res) => {
  const bookId = parseInt(req.body.bookId);
  const newQuantity = parseInt(req.body.quantity);
  const cart = req.session.cart || [];

  // Find the item in the cart and update its quantity
  const cartItem = cart.find((item) => item.bookId === bookId);
  if (cartItem) {
    cartItem.quantity = newQuantity;
  }
  let totalQuantity = 0;
  cart.forEach((item) => {
    totalQuantity += item.quantity;
  });
  req.session.totalQuantity = totalQuantity;
  // Update the session cart and redirect back to the cart page
  req.session.cart = cart;
  res.redirect("/cart"); //
});



router.post("/remove-cart", (req, res) => {
  const bookId = parseInt(req.body.bookId);
  const cart = req.session.cart || [];
  let totalQuantity = 0;

  // Loop through the cart and filter out the item to be removed
  req.session.cart = cart.filter((item) => {
    if (item.bookId === bookId) {
      // Skip this item to remove it from the cart
      return false;
    }
    // Add the quantity of remaining items to the total quantity
    totalQuantity += item.quantity;
    return true;
  });

  // Update total quantity in session
  req.session.totalQuantity = totalQuantity;

  // Redirect back to the cart page
  res.redirect("/cart");
});



router.post("/create-checkout-session", async (req, res) => {
  try {
    const conn = require("./connect2");
    const cart = req.session.cart || [];
    const { couponCode } = req.body;

    if (cart.length === 0) return res.status(400).send("Cart is empty");

    const bookIds = cart.map((item) => item.bookId);
    const [books] = await conn.query("SELECT * FROM tb_book WHERE id IN (?)", [
      bookIds,
    ]);

    const stockErrors = [];
    cart.forEach((carts) => {
      const book = books.find((b) => b.id === carts.bookId);
      if (!book || book.stock < carts.quantity) {
        stockErrors.push(
          `Insufficient stock for "${book.book_name}". Only ${
            book ? book.stock : 0
          } left.`
        );
      }
    });

    if (stockErrors.length > 0) {
      req.flash("error", stockErrors);
      return res.redirect("/cart");
    }

    let totalDiscount = 0;
    let promotions = [];

    if (couponCode) {
      // Fetch all promotions that match the coupon code
      const [promotionResults] = await conn.query(
        "SELECT * FROM tb_promotion WHERE coupon_code = ? AND startdate <= NOW() AND enddate >= NOW() AND quantity > 0",
        [couponCode]
      );

      if (promotionResults.length > 0) {
        req.session.couponCode = couponCode;
        promotions = promotionResults; // Store promotions as an array
      } else {
        req.flash("error", "Invalid or expired coupon code");
        return res.redirect("/cart");
      }
    }

    const lineItems = books.map((book) => {
      const cartItem = cart.find((item) => item.bookId === book.id);
      let unitAmount = Math.round(parseFloat(book.price) * 100);

      // Check for discount promotions and apply the highest discount if multiple discounts are allowed
      const discountPromo = promotions.find(
        (promo) => promo.type === "discount"
      );
      if (discountPromo) {
        unitAmount = Math.round(
          unitAmount - unitAmount * (discountPromo.discount / 100)
        );
        totalDiscount +=
          (parseFloat(book.price) - unitAmount / 100) * cartItem.quantity;
      }

      return {
        price_data: {
          currency: "thb",
          product_data: { name: book.book_name },
          unit_amount: unitAmount,
        },
        quantity: cartItem.quantity,
      };
    });

    // Process each free book promotion
    for (const promo of promotions) {
      if (promo.book_id && promo.type === "free_book") {
        const [freeBookResults] = await conn.query(
          "SELECT * FROM tb_book WHERE id = ? AND stock > 0",
          [promo.book_id]
        );

        if (freeBookResults.length > 0) {
          const freeBook = freeBookResults[0];
          // Add the free book as a line item with unit_amount of 0
          lineItems.push({
            price_data: {
              currency: "thb",
              product_data: { name: freeBook.book_name },
              unit_amount: 0, // Free book
            },
            quantity: 1,
          });
        } else {
          req.flash(
            "error",
            `Free book with ID ${promo.book_id} is not available`
          );
          return res.redirect("/cart");
        }
      }
    }

    // Create the checkout session with Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "promptpay"], // Enable both Card and PromptPay
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.protocol}://${req.get(
        "host"
      )}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get(
        "host"
      )}/cancel?session_id={CHECKOUT_SESSION_ID}`,
    });

    // Redirect to the checkout page
    res.redirect(303, session.url);
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).send("An error occurred while creating a session.");
  }
});



router.post("/webhook", bodyParser.raw({ type: "application/json" }),async (req, res) => {
    const endpointSecret ="whsec_5b9383c1baabb5923e55a9740dc4949ab44b14f5a25da5f5038c5fe63fbb9e09"; // You get this from the Stripe Dashboard when setting up the webhook
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      // Verify the event came from Stripe
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the different event types
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // Handle successful checkout session completion
      console.log("Payment successful:", session);
      // You might want to update your database or send a confirmation email here
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      console.log("Payment failed:", paymentIntent);
      // Handle failed payment (e.g., notify the user, revert inventory, etc.)
    }

    // Return a 200 status to acknowledge receipt of the event
    res.sendStatus(200);
  }
);


router.get("/success", async (req, res) => {
  try {
    const conn = require("./connect2");
    const sessionId = req.query.session_id;
    const cart = req.session.cart || [];

    const bookIds = cart.map((item) => item.bookId);
    const [books] = await conn.query("SELECT * FROM tb_book WHERE id IN (?)", [bookIds,]);

    const bookPriceMap = books.reduce((acc, book) => {
        acc[book.id] = parseFloat(book.price);
        return acc;
      }, {});

    if (!sessionId) {
        return res.redirect("/cancel");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    

    if (session.payment_status === "paid") {
      const couponCode = req.session.couponCode;

      // Insert order into `tb_order`
      const [orderResult] = await conn.query(
        "INSERT INTO tb_order (user_id, order_date, total_amount, status) VALUES (?, NOW(), ?, ?)",
        [res.locals.user.id, session.amount_total / 100, "Completed"]
      );

      const orderId = orderResult.insertId;

      for (const { bookId, quantity } of cart) {
        const unitPrice = bookPriceMap[bookId];
        await conn.query(
          "INSERT INTO tb_order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
          [orderId, bookId, quantity, unitPrice]
        );
      }

      for (const { bookId, quantity } of cart) {
        await conn.query(
          "UPDATE tb_book SET stock = stock - ? WHERE id = ? AND stock >= ?",
          [quantity, bookId, quantity]
        );
      }

      if (couponCode) {
        const [promotionResults] = await conn.query(
          "SELECT * FROM tb_promotion WHERE coupon_code = ?",
          [couponCode]
        );

        if (promotionResults.length > 0) {
          for (const promotion of promotionResults) {
            if (promotion.type === "free_book" && promotion.book_id) {
              const [freeBookResults] = await conn.query(
                "SELECT * FROM tb_book WHERE id = ? AND stock > 0",
                [promotion.book_id]
              );

              if (freeBookResults.length > 0) {
                const freeBook = freeBookResults[0];

                await conn.query(
                  "INSERT INTO tb_order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
                  [orderId, freeBook.id, 1, 0]
                );

                await conn.query(
                  "UPDATE tb_book SET stock = stock - 1 WHERE id = ?",
                  [freeBook.id]
                );
                await conn.query(
                  "UPDATE tb_promotion SET quantity = quantity - 1 WHERE id = ?",
                  [promotion.id]
                );
              } else {
                req.flash("error", "Free book is not available");
                return res.redirect("/cart");
              }
            } else if (promotion.type === "discount") {
              // Decrease promotion quantity for discount type if applicable
              await conn.query(
                "UPDATE tb_promotion SET quantity = quantity - 1 WHERE id = ?",
                [promotion.id]
              );
            }
          }
        }
      }
      req.session.cart = [];
      req.session.totalQuantity = 0;
      req.session.couponCode = null;
      res.render("success");
    } else {
      res.redirect("/cancel");
    }
  } catch (error) {
    console.error("Error finalizing order:", error);
    res.status(500).send("An error occurred while finalizing the order.");
  }
});

router.get("/cancel", async (req, res) => {

   try {
     const conn = require("./connect2");
     const sessionId = req.query.session_id;
     const cart = req.session.cart || [];
     
    const bookIds = cart.map((item) => item.bookId);
    const [books] = await conn.query("SELECT * FROM tb_book WHERE id IN (?)", [
      bookIds,
    ]);

    const bookPriceMap = books.reduce((acc, book) => {
      acc[book.id] = parseFloat(book.price);
      return acc;
    }, {});

     if (!sessionId) {
           return res.redirect("/cancel");
     }
     const session = await stripe.checkout.sessions.retrieve(sessionId);

     if (session.payment_status === "unpaid") {
      const [orderResult] = await conn.query(
        "INSERT INTO tb_order (user_id, order_date, total_amount, status) VALUES (?, NOW(), ?, ?)",
        [res.locals.user.id, session.amount_total / 100, "Failed"]
      );
       
       const orderId = orderResult.insertId;
       
       for (const { bookId, quantity } of cart) {
         const unitPrice = bookPriceMap[bookId];
         
         await conn.query(
           "INSERT INTO tb_order_items (order_id, book_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
           [orderId, bookId, quantity, unitPrice]
         );
       }
     }
     req.session.cart = [];
     req.session.totalQuantity = 0;
     res.render("cancel");
   } catch (error) {
     console.error("Error finalizing order:", error);
     res.status(500).send("An error occurred while finalizing the order.");
   }
});

router.get("/orderhistory", async (req, res) => {
  try {
    const conn = require("./connect2");

    const { day, month, year } = req.query;
    
    let query = `
      SELECT o.*, u.id AS user_id, u.name AS user_name 
      FROM tb_order AS o
      LEFT JOIN tb_user AS u ON o.user_id = u.id
    `;

    const conditions = [];
    const values = [];

    if (day) {
      conditions.push("DAY(o.order_date) = ?");
      values.push(day);
    }
    if (month) {
      conditions.push("MONTH(o.order_date) = ?");
      values.push(month);
    }
    if (year) {
      conditions.push("YEAR(o.order_date) = ?");
      values.push(year);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY o.order_date DESC";

    // Query to get all orders for the user
    const [orders] = await conn.query(query, values);

        if (orders.length === 0) {
          return res.render("orderhistory", {
            orders: [],
            query: req.query,
            message: "No orders found for the selected date range.",
          });
        }

    // Query to get all order items for the user's orders
    const orderIds = orders.map((order) => order.id);
    const [orderItems] = await conn.query(
      "SELECT oi.order_id, oi.book_id, oi.quantity, oi.unit_price, b.book_name, b.img \
       FROM tb_order_items AS oi \
       LEFT JOIN tb_book AS b ON oi.book_id = b.id \
       WHERE oi.order_id IN (?)",
      [orderIds]
    );

    // Organize order items under their respective orders
    const orderMap = orders.map((order) => {
      return {
        ...order,
        items: orderItems.filter((item) => item.order_id === order.id),
      };
    });
   // console.log(JSON.stringify(orderMap, null, 2));
    // Render the order history page with organized data
    res.render("orderhistory", { orders: orderMap, query: req.query });
  } catch (error) {
    console.error("Error fetching order history:", error);
    res.status(500).send("An error occurred while fetching order history.");
  }
});

router.get("/orderhistoryadmin", async (req, res) => {
  try {
    const conn = require("./connect2");

    // Get date filters from query parameters
    const { day, month, year, user_id } = req.query;

    // Construct the base query for orders
    let query = `
      SELECT o.*, u.id AS user_id, u.name AS user_name 
      FROM tb_order AS o
      LEFT JOIN tb_user AS u ON o.user_id = u.id
    `;

    const conditions = [];
    const values = [];

    if (day) {
      conditions.push("DAY(o.order_date) = ?");
      values.push(day);
    }
    if (month) {
      conditions.push("MONTH(o.order_date) = ?");
      values.push(month);
    }
    if (year) {
      conditions.push("YEAR(o.order_date) = ?");
      values.push(year);
    }
    if (user_id) {
      conditions.push("u.id = ?");
      values.push(user_id);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY o.order_date DESC";

    const [orders] = await conn.query(query, values);

    if (orders.length === 0) {
      return res.render("orderhistoryadmin", {
        orders: [],
        query: req.query,
        message: "No orders found for the selected date range.",
      });
    }

    // Fetch items for all orders at once using the `order_id`
    const orderIds = orders.map((order) => order.id);
    const [orderItems] = await conn.query(
      `SELECT oi.order_id, oi.book_id, oi.quantity, oi.unit_price, b.book_name, b.img 
       FROM tb_order_items AS oi
       LEFT JOIN tb_book AS b ON oi.book_id = b.id
       WHERE oi.order_id IN (?)`,
      [orderIds]
    );

    // Organize order items under their respective orders
    const orderMap = orders.map((order) => {
      return {
        ...order,
        items: orderItems.filter((item) => item.order_id === order.id),
      };
    });

   // console.log(JSON.stringify(orderMap, null, 2));
    res.render("orderhistoryadmin", {
      orders: orderMap,
      query: req.query,
      message: null,
    });
  } catch (error) {
    console.error("Error fetching all orders for admin:", error);
    res.status(500).send("An error occurred while fetching all orders.");
  }
});


router.get("/promotion", (req, res) => {
  let sql =
    "SELECT tb_promotion.* FROM tb_promotion " +
    "LEFT JOIN tb_book ON tb_book.id = tb_promotion.book_id " +
    "ORDER BY tb_promotion.id DESC"; 


  conn.query(sql, (err, result) => {
    if (err) throw err;

    //ส่งผลลัพธ์ไปที่หน้า "book" พร้อมกับข้อมูลกลุ่มหนังสือทั้งหมด
    res.render("promotion", { promotions: result });
  });
});


router.get("/addPromotion", (req, res) => {
  res.render("addPromotion", { promotions: {} });
});

router.post("/addPromotion", (req, res) => {
  let sql = "INSERT INTO tb_promotion SET ?";
  let params = req.body;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/promotion");
  });
});



router.get("/editPromotion/:id", (req, res) => {
  let sql = "SELECT * FROM tb_promotion WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    
    //ส่งข้อมูลผู้ใช้ที่ดึงมาและข้อมูลกลุ่มหนังสือไปที่ "addUser" เพื่อให้ผู้ใช้ทำการแก้ไขข้อมูล
    res.render("addPromotion", { promotions: result[0] });
  });
});



router.post("/editPromotion/:id", (req, res) => {
  let sql =
    "UPDATE tb_promotion SET ? WHERE id = ?";
    
 let params = [req.body, req.params.id];
  conn.query(sql, params, (err, result) => {
    console.log(result);
    if (err) throw err;
    res.redirect("/promotion");
  });
});

//ลบข้อมูลผู้ใช้ใน database โดยใช้ id ที่ระบุในพารามิเตอร์ของ URL และแสดงผลหน้า user
router.get("/deletePromotion/:id", (req, res) => {
  let sql = "DELETE FROM tb_promotion WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/promotion");
  });
});



module.exports = router;
