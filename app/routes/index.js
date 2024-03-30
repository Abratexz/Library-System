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
let dayFormat = "DD/MM/YYYY HH:mm:ss";
let path = require("path");

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
const fetchGroupBooks = async (req, res, next) => {
  try {
    let conn = require("./connect2");
    let sqlGroupBooks = "SELECT * FROM tb_group_book ORDER BY name_tag ASC";
    let [groupBooksResult] = await conn.query(sqlGroupBooks);
    req.groupBooks = groupBooksResult; // Attach groupBooks data to the request object
    next(); // Call next to proceed to the next middleware/route handler
  } catch (error) {
    // Handle errors
    res.status(500).send("Error fetching groupBooks data: " + error);
  }
};
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

router.get("/home", isLogin, async (req, res) => {
  try {
    let conn = require("./connect2");
    let page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
    let BooksPerPage = parseInt(req.query.BooksPerPage) || 10; // Default to 10 Books per page if not provided
    let offset = (page - 1) * BooksPerPage;
    let params = [];
    let sql = "SELECT COUNT(*) AS total FROM tb_book"; // Count total number of books

    // Now fetch the books for the current page
    let whereClause = "";
    if (req.query.search) {
      whereClause += "book_name LIKE(?)";
      params.push("%" + req.query.search + "%");
    }
    if (req.query.groupBookId) {
      if (whereClause) whereClause += " AND ";
      if (req.query.groupBookId === "All") {
        // If groupBookId is 'All', include all group book names
        whereClause += "1"; // True condition to include all group book names
      } else {
        whereClause += "group_book_id = ?";
        params.push(req.query.groupBookId);
      }
    }
    if (whereClause) {
      sql += " WHERE " + whereClause;
    }

    let [countResult] = await conn.query(sql, params);
    let totalBooks = countResult[0].total;
    let totalPages = Math.ceil(totalBooks / BooksPerPage);
    sql = "SELECT * FROM tb_book";
    if (whereClause) {
      sql += " WHERE " + whereClause;
    }
    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(BooksPerPage, offset);

    let [books, fields] = await conn.query(sql, params);
    sql = "SELECT * FROM tb_group_book ORDER BY name_tag ASC";
    let [groupBooks, fieldsGroupProduct] = await conn.query(sql);
    res.render("home", {
      books: books,
      currentPage: page,
      BooksPerPage: BooksPerPage,
      totalPages: totalPages,
      groupBooks: groupBooks,
    });
  } catch (error) {
    res.send("Error: " + error);
  }
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

router.get("/profile", isLogin, fetchGroupBooks, (req, res) => {
  let data = jwt.verify(req.session.token, secretCode);
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = [data.id];
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("profile", { user: result[0], groupBooks: req.groupBooks });
  });
});

router.get("/editProfile/:id", isLogin, fetchGroupBooks, (req, res) => {
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("editProfile", { user: result[0], groupBooks: req.groupBooks });
  });
});

router.post("/editProfile/:id", isLogin, fetchGroupBooks, (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (error, fields, file) => {
    let sqlSelect = "SELECT img FROM tb_user WHERE id = ?";
    let paramSelect = req.params.id;
    conn.query(sqlSelect, paramSelect, (err, oldUser) => {
      if (err) throw err;
      let oldUserImg = oldUser[0];
      let imgFileName = oldUserImg.img; // ค่าปกติของ Img ทื่มีอยู่ใน Data aka  รูปเก่า
      if (file.img && file.img.length > 0) {
        // ถ้ามีรูปใหม่อัปโหลดเข้ามา
        let filePath = file.img[0].filepath;
        let newPath =
          "C://Users/nemo_/Desktop/Library-System/app/public/images/users/";
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
      let sql =
        "UPDATE tb_user SET name = ? , usr = ?, pwd = ? , img = ? WHERE id = ?";
      let params = [
        fields["name"],
        fields["usr"],
        fields["pwd"],
        imgFileName,
        req.params.id,
      ];
      conn.query(sql, params, (err, result) => {
        if (err) throw err;

        let sqlFetchUser = "SELECT * FROM tb_user WHERE id = ?";
        conn.query(sqlFetchUser, paramSelect, (err, updatedUser) => {
          req.session.img = updatedUser[0].img;
          res.redirect("/profile");
        });
      });
    });
  });
});

router.get("/user", isLogin, fetchGroupBooks, (req, res) => {
  let sql = "SELECT * FROM tb_user ORDER BY id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("user", { users: result, groupBooks: req.groupBooks });
  });
});

router.get("/addUser", isLogin, fetchGroupBooks, (req, res) => {
  res.render("addUser", { user: {}, groupBooks: req.groupBooks });
});

router.post("/addUser", isLogin, (req, res) => {
  let sql = "INSERT INTO tb_user SET ?";
  let params = req.body;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/user");
  });
});

router.get("/editUser/:id", isLogin, fetchGroupBooks, (req, res) => {
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("addUser", { user: result[0], groupBooks: req.groupBooks });
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
    res.render("groupBook", {
      groupBooks: result,
    });
  });
});

router.get("/addGroupBook", isLogin, fetchGroupBooks, (req, res) => {
  res.render("addGroupBook", { groupBook: {}, groupBooks: req.groupBooks });
});

router.post("/addGroupBook", isLogin, (req, res) => {
  let sql = "INSERT INTO tb_group_book SET ?";
  let params = req.body;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupBook");
  });
});

router.get("/editGroupBook/:id", isLogin, fetchGroupBooks, (req, res) => {
  let sql = "SELECT * FROM tb_group_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("addGroupBook", {
      groupBook: result[0],
      groupBooks: req.groupBooks,
    });
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

router.get("/book", isLogin, fetchGroupBooks, (req, res) => {
  let sql =
    "SELECT tb_book.* , tb_group_book.name_tag AS group_book_name_tag FROM tb_book " +
    "LEFT JOIN tb_group_book ON tb_group_book.id = tb_book.group_book_id " +
    "ORDER BY tb_book.id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("book", { books: result, groupBooks: req.groupBooks });
  });
});

router.get("/addBook", isLogin, fetchGroupBooks, (req, res) => {
  let sql = "SELECT * FROM tb_group_book ORDER BY name_tag";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("addBook", {
      book: {},
      groupBooks: result,
      groupBooks: req.groupBooks,
    });
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
      let newPath =
        "C://Users/nemo_/Desktop/Library-System/app/public/images/books/";
      newPath += file.img[0].originalFilename;
      fs.copyFile(filePath, newPath, () => {
        let sql =
          "INSERT INTO tb_book(group_book_id, isbn, author, book_name, detail,status, img) VALUES(?, ?, ?, ?, ?, ?, ?)";
        let params = [
          fields["group_book_id"],
          fields["isbn"],
          fields["author"],
          fields["book_name"],
          fields["detail"],
          fields["status"],
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
      res.render("addBook", { book: book[0], groupBooks: groupBooks });
    });
  });
});

router.post("/editBook/:id", isLogin, (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (err, fields, file) => {
    let sqlSelect = "SELECT img FROM tb_book WHERE id = ?";
    let paramSelect = req.params.id;
    conn.query(sqlSelect, paramSelect, (err, oldBook) => {
      if (err) throw err;
      let Book = oldBook[0];

      let imgFileName = Book.img; // ค่าปกติของ Img ทื่มีอยู่ใน Data aka  รูปเก่า
      if (file.img && file.img.length > 0) {
        // ถ้ามีรูปใหม่อัปโหลดเข้ามา
        let filePath = file.img[0].filepath;
        let newPath =
          "C://Users/nemo_/Desktop/Library-System/app/public/images/books/";
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
        "UPDATE tb_book SET group_book_id = ?, isbn = ?, author = ?, book_name = ?, detail = ?,status = ?, img = ? WHERE id = ?";
      let params = [
        fields["group_book_id"],
        fields["isbn"],
        fields["author"],
        fields["book_name"],
        fields["detail"],
        fields["status"],
        imgFileName, // ใช้รูปใหม่ หรือรูปเก่าที่มี
        req.params.id,
      ];
      conn.query(sql, params, (err, result) => {
        if (err) throw err;
        res.redirect("/book");
      });
    });
  });
});

router.get("/deleteBook/:id/:img", isLogin, (req, res) => {
  let newPath =
    "C://Users/nemo_/Desktop/Library-System/app/public/images/books";

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

router.get("/deleteAllBook", isLogin, (req, res) => {
  let newPath =
    "C://Users/nemo_/Desktop/Library-System/app/public/images/books";

  fs.readdir(newPath, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      const filePath = path.join(newPath, file);
      fs.stat(filePath, (err, stats) => {
        if (err) throw err;

        if (stats.isFile()) {
          fs.unlink(filePath, (err) => {
            if (err) throw err;
          });
        }
      });
    }
  });
  let sql = "DELETE FROM tb_book";

  conn.query(sql, (err, results) => {
    if (err) throw err;
    res.redirect("/book");
  });
});

router.get("/setAllBookAvailable", isLogin, (req, res) => {
  let sql = "UPDATE tb_book SET status = 'Available'";
  conn.query(sql, (err, results) => {
    if (err) throw err;
    res.redirect("/book");
  });
});

router.get("/borrow/:id", isLogin, fetchGroupBooks, (req, res) => {
  let sql = "SELECT * FROM tb_book WHERE id = ?";
  let params = req.params.id;

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    sql = "SELECT * FROM tb_group_book ORDER BY name_tag";
    conn.query(sql, (err, groupBooks) => {
      if (err) throw err;
      res.render("borrow", {
        book: result[0],
        groupBooks: groupBooks,
      });
    });
  });
});

router.post("/borrow/:id", isLogin, async (req, res) => {
  let data = jwt.verify(req.session.token, secretCode);
  let conn = require("./connect2");
  let bookId = req.params.id;
  let id = data.id;
  let bookStatusQuery = "SELECT status FROM tb_book WHERE id = ?";
  let [bookStatusRow] = await conn.query(bookStatusQuery, [bookId]);
  let bookStatus = bookStatusRow[0].status;

  if (bookStatus === "Borrowed" || bookStatus === "Lost") {
    req.session.message = "FAILED TO BORROW";
    res.redirect("/home");
  } else {
    let duration = req.body["duration"];
    let currentTime = dayjs().format(dayFormat);
    let returnDate = dayjs().add(duration, "day").format(dayFormat);

    let borrowSql = "INSERT INTO tb_borrow SET ?";
    let borrowParams = {
      user_id: data.id,
      book_id: bookId,
      borrow_date: currentTime,
      return_date: returnDate,
      duration: req.body["duration"],
      borrow_status: "Borrowed",
    };

    // Insert into tb_borrow
    let [borrowResult] = await conn.query(borrowSql, borrowParams);
    let borrowId = borrowResult.insertId; // Get the auto-generated borrow_id

    let updateBookSql = "UPDATE tb_book SET status = 'Borrowed' WHERE id = ? ";
    await conn.query(updateBookSql, bookId);
    // Insert into tb_history with borrow_id
    let historySql = "INSERT INTO tb_history SET ?";
    let historyParams = {
      user_id: data.id,
      book_id: bookId,
      borrow_id: borrowId, // Use the borrow_id obtained from tb_borrow
      borrow_history_date: currentTime,
      return_history_date: returnDate,
    };
    await conn.query(historySql, historyParams);

    req.session.message = "Book Borrowed Successfully !!";
    res.redirect("/home");
  }
});

router.get("/history", isLogin, fetchGroupBooks, async (req, res) => {
  let conn = require("./connect2");
  let data = jwt.verify(req.session.token, secretCode);

  // Query to retrieve history data including book details
  let sql =
    "SELECT tb_book.*, tb_borrow.borrow_date, tb_history.return_history_date " +
    "FROM tb_book " +
    "JOIN tb_borrow ON tb_book.id = tb_borrow.book_id " +
    "JOIN tb_history ON tb_borrow.id = tb_history.borrow_id " +
    "WHERE tb_borrow.user_id = ?";

  let params = [data.id];

  try {
    let [results] = await conn.query(sql, params);
    res.render("history", { books: results, groupBooks: req.groupBooks });
    console.log(results);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/deleteHistory", isLogin, fetchGroupBooks, (req, res) => {
  let deleteHistorySql = "DELETE FROM tb_history WHERE user_id = ?";
  let data = jwt.verify(req.session.token, secretCode);
  let params = [data.id];
  conn.query(deleteHistorySql, params, (err, result) => {
    if (err) throw err;
    let fetchSql = "SELECT * FROM tb_history WHERE user_id = ?";
    conn.query(fetchSql, params, (err, history) => {
      if (err) throw err;
      res.redirect("/history");
    });
  });
});

router.get("/deleteHistory/:id", isLogin, fetchGroupBooks, (req, res) => {
  let sql = "DELETE FROM tb_history WHERE user_id = ? AND book_id = ?";
  let data = jwt.verify(req.session.token, secretCode);
  let params = [data.id, req.params.id];
  console.log(params);

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/history");
  });
});

router.get("/borrowHistory", isLogin, fetchGroupBooks, (req, res) => {
  let sql =
    "SELECT tb_book.*, tb_borrow.id, tb_borrow.borrow_date, tb_borrow.return_date, tb_user.usr, tb_user.phone, tb_user.id AS tb_user_account_id " +
    "FROM tb_borrow " +
    "JOIN tb_book ON tb_borrow.book_id = tb_book.id " +
    "JOIN tb_user ON tb_borrow.user_id = tb_user.id " +
    "ORDER BY tb_borrow.id DESC";

  conn.query(sql, (err, result) => {
    if (err) throw err;
    console.log(result);
    res.render("borrowHistory", {
      borrowHistory: result,
      groupBooks: req.groupBooks,
    });
  });
});

router.get("/deleteborrowHistory", isLogin, (req, res) => {
  let sql = "DELETE FROM tb_borrow";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.redirect("/borrowHistory");
  });
});

router.get("/deleteborrowHistory/:id", isLogin, fetchGroupBooks, (req, res) => {
  let sql = "DELETE FROM tb_borrow WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/borrowHistory");
  });
});
module.exports = router;
