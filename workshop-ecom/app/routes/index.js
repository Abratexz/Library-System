let express = require("express");
let router = express.Router();
let conn = require("./connect");
let jwt = require("jsonwebtoken");
let secretCode = "myecom2024key";
let session = require("express-session");
let formidable = require("formidable");
let fs = require("fs");

router.use(
  session({
    secret: "sessionforprojectecommerce",
    resave: false,
    saveUninitialized: true,
    cookie: {
      MaxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

router.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

/* GET home page. */
router.get("/", function (req, res, next) {
  let sql = "SELECT * FROM tb_product ORDER BY id DESC";
  conn.query(sql, (err, results) => {
    if (err) throw err;
    res.render("index", { products: results });
  });
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
      //login pass
      let id = result[0].id;
      let name = result[0].name;

      let token = jwt.sign({ id: id, name: name }, secretCode);
      req.session.token = token;
      req.session.name = name;

      res.redirect("/home");
    } else {
      res.send("Username or Password Invalid");
    }
  });
});

function isLogin(req, res, next) {
  if (req.session.token != undefined) {
    next();
  } else {
    res.redirect("/login");
  }
}

router.get("/home", isLogin, (req, res) => {
  res.render("home");
});

router.get("/logout", isLogin, (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

router.get("/changeProfile", isLogin, (req, res) => {
  let data = jwt.verify(req.session.token, secretCode);
  let sql = "SELECT * FROM tb_user WHERE id = ?";
  let params = [data.id];

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("changeProfile", { user: result[0] });
    console.log(data);
  });
});

router.post("/changeProfile", isLogin, (req, res) => {
  let sql = "UPDATE tb_user SET name = ?, usr = ?";
  let params = [req.body["name"], req.body["usr"]];

  if (req.body["pwd"].length) {
    sql += ", pwd = ?";
    params.push(req.body["pwd"]);
  } else {
    return res.status(500).json({ error: "Error updating password" });
  }

  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    req.session.message = "Save Success";
    res.redirect("/changeProfile");
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
    "UPDATE tb_user SET name = ? , usr = ?, pwd = ? , level = ? WHERE id = ?";
  let params = [
    req.body["name"],
    req.body["usr"],
    req.body["pwd"],
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

router.get("/groupProduct", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_group_product ORDER BY id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("groupProduct", { groupProducts: result });
  });
});

router.get("/addGroupProduct", isLogin, (req, res) => {
  res.render("addGroupProduct", { groupProduct: {} });
});

router.post("/addGroupProduct", isLogin, (req, res) => {
  let sql = "INSERT INTO tb_group_product SET ?";
  let params = req.body;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("groupProduct");
  });
});

router.get("/editgroupProduct/:id", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_group_product WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.render("addGroupProduct", { groupProduct: result[0] });
  });
});

router.post("/editgroupProduct/:id", isLogin, (req, res) => {
  let sql = "UPDATE tb_group_product SET name = ? WHERE id = ?";
  let params = [req.body["name"], req.params.id];
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupProduct");
  });
});

router.get("/deletegroupProduct/:id", isLogin, (req, res) => {
  let sql = "DELETE FROM tb_group_product WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, result) => {
    if (err) throw err;
    res.redirect("/groupProduct");
  });
});

router.get("/product", isLogin, (req, res) => {
  let sql =
    "SELECT tb_product.* , tb_group_product.name AS group_product_name FROM tb_product " +
    "LEFT JOIN tb_group_product ON tb_group_product.id = tb_product.group_product_id " +
    "ORDER BY tb_product.id DESC";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("product", { products: result });
  });
});

router.get("/addProduct", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_group_product ORDER BY name";
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.render("addProduct", { product: {}, groupProducts: result });
  });
});

router.post("/addProduct", isLogin, (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (err, fields, file) => {
    let filePath = file.img[0].filepath;
    let newPath =
      "C://Users/nemo_/Desktop/Fullstack Learn By PNW/workshop-ecom/app/public/images/";
    newPath += file.img[0].originalFilename;

    fs.copyFile(filePath, newPath, () => {
      // insert to database
      let sql =
        "INSERT INTO tb_product(group_product_id, barcode, name, cost, price, img) VALUES(?, ?, ?, ?, ?, ?)";
      let params = [
        fields["group_product_id"],
        fields["barcode"],
        fields["name"],
        fields["cost"],
        fields["price"],
        file.img[0].originalFilename,
      ];

      conn.query(sql, params, (err, result) => {
        if (err) throw err;
        res.redirect("/product");
      });
    });
  });
});

router.get("/editProduct/:id", isLogin, (req, res) => {
  let sql = "SELECT * FROM tb_product WHERE id = ?";
  let params = req.params.id;
  conn.query(sql, params, (err, products) => {
    if (err) throw err;

    sql = "SELECT * FROM tb_group_product ORDER BY name";
    conn.query(sql, (err, groupProducts) => {
      if (err) throw err;
      res.render("addProduct", {
        product: products[0],
        groupProducts: groupProducts,
      });
    });
  });
});

router.post("/editProduct/:id", isLogin, (req, res) => {
  let form = new formidable.IncomingForm();
  form.parse(req, (err, fields, file) => {
    let filePath = file.img[0].filepath;
    let newPath =
      "C://Users/nemo_/Desktop/Fullstack Learn By PNW/workshop-ecom/app/public/images/";
    let pathUpload = newPath + file.img[0].originalFilename;

    fs.copyFile(filePath, pathUpload, () => {
      let sqlSelect = "SELECT img FROM tb_product WHERE id = ?";
      let paramSelect = req.params.id;

      conn.query(sqlSelect, paramSelect, (err, oldProducts) => {
        if (err) throw err;
        let product = oldProducts[0];
        fs.unlink(newPath + product.img, (err) => {
          if (err) {
            console.log(err);
          }

          let sql =
            "UPDATE tb_product SET group_product_id=?, barcode=?, name=?, cost=?, price=?, img=? WHERE id=?";
          let params = [
            fields["group_product_id"],
            fields["barcode"],
            fields["name"],
            fields["cost"],
            fields["price"],
            file.img[0].originalFilename,
            req.params.id,
          ];

          conn.query(sql, params, (err, result) => {
            if (err) throw err;
            res.redirect("/product");
          });
        });
      });
    });
  });
});

router.get("/deleteProduct/:id/:img", isLogin, (req, res) => {
  let newPath =
    "C://Users/nemo_/Desktop/Fullstack Learn By PNW/workshop-ecom/app/public/images/";

  newPath += req.params.img;

  fs.unlink(newPath, (err) => {
    if (err) throw err;

    let sql = "DELETE FROM tb_product WHERE id = ?";
    let params = req.params.id;

    conn.query(sql, params, (err, results) => {
      if (err) throw err;
      res.redirect("/product");
    });
  });
});

router.get("/addToCart/:id", (req, res) => {
  let cart = [];
  let order = {
    product_id: req.params.id,
    qty: 1,
  };
  if (req.session.cart == null) {
    //first item
    cart.push(order);
  } else {
    // second item
    cart = req.session.cart;
    let newItem = true;

    for (let i = 0; i < cart.length; i++) {
      if (cart[i].product_id == req.params.id) {
        cart[i].qty = cart[i].qty + 1;
        newItem = false;
      }
    }
    if (newItem) {
      cart.push(order);
    }
  }
  req.session.cart = cart;
  console.log(req.session.cart);
  res.redirect("/");
});

router.get("/mycart", async (req, res) => {
  let conn = require("./connect2");
  let cart = req.session.cart;
  let products = [];

  if (cart != undefined) {
    for (let i = 0; i < cart.length; i++) {
      let c = cart[i];
      let sql = "SELECT * FROM tb_product WHERE id = ?";
      let params = [c.product_id];

      let [rows, fields] = await conn.query(sql, params);
      let product = rows[0];

      let p = {
        qty: c.qty,
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        price: product.price,
        img: product.img,
      };
      products.push(p);
    }
  }
  res.render("mycart", { products: products });
});

router.get("/deleteItemInCart/:id", (req, res) => {
  let cart = req.session.cart;

  for (let i = 0; i < cart.length; i++) {
    if (cart[i].product_id == req.params.id) {
      cart.splice(i, 1);
    }
  }

  req.session.cart = cart;
  res.redirect("/mycart");
});
module.exports = router;
