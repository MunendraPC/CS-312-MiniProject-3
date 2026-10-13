require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const session = require("express-session");

const app = express();
const PORT = 3000;


// PostgreSQL connection
const db = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});


app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));


// SIGN IN

app.get("/signin", (req, res) => {
    res.render("signin", {
        message: ""
    });
});


app.post("/signin", async (req, res) => {

    const userId = req.body.user_id;
    const password = req.body.password;

    try {

        const result = await db.query(
            "SELECT * FROM users WHERE user_id = $1 AND password = $2",
            [userId, password]
        );

        if (result.rows.length === 0) {

            return res.render("signin", {
                message: "Incorrect user ID or password."
            });

        }

        req.session.user = result.rows[0];

        res.redirect("/");

    } catch (error) {

        console.log(error);
        res.send("Error signing in.");

    }
});


// SIGN UP

app.get("/signup", (req, res) => {

    res.render("signup", {
        message: ""
    });

});


app.post("/signup", async (req, res) => {

    const userId = req.body.user_id;
    const password = req.body.password;
    const name = req.body.name;

    try {

        const existingUser = await db.query(
            "SELECT * FROM users WHERE user_id = $1",
            [userId]
        );

        if (existingUser.rows.length > 0) {

            return res.render("signup", {
                message: "That user ID is already taken."
            });

        }

        await db.query(
            "INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)",
            [userId, password, name]
        );

        res.redirect("/signin");

    } catch (error) {

        console.log(error);
        res.send("Error creating account.");

    }
});


// LOGOUT

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/signin");
    });

});


// HOME / VIEW POSTS

app.get("/", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const selectedCategory = req.query.category || "All";

    try {

        const result = await db.query(
            `SELECT
                blog_id,
                creator_name AS creator,
                creator_user_id,
                title,
                body AS content,
                category,
                date_created AS "createdAt"
             FROM blogs
             ORDER BY date_created DESC`
        );

        res.render("index", {
            posts: result.rows,
            selectedCategory: selectedCategory,
            user: req.session.user
        });

    } catch (error) {

        console.log(error);
        res.send("Error loading posts.");

    }
});


// CREATE POST

app.post("/posts", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const title = req.body.title;
    const category = req.body.category;
    const content = req.body.content;

    const creatorName = req.session.user.name;
    const creatorUserId = req.session.user.user_id;

    try {

        await db.query(
            `INSERT INTO blogs
            (creator_name, creator_user_id, title, body, date_created, category)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
            [
                creatorName,
                creatorUserId,
                title,
                content,
                category
            ]
        );

        res.redirect("/");

    } catch (error) {

        console.log(error);
        res.send("Error creating post.");

    }
});

// EDIT PAGE

app.get("/edit/:id", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const blogId = req.params.id;

    try {

        const result = await db.query(
            `SELECT *
             FROM blogs
             WHERE blog_id = $1
             AND creator_user_id = $2`,
            [
                blogId,
                req.session.user.user_id
            ]
        );

        if (result.rows.length === 0) {
            return res.send("You can only edit your own posts.");
        }

        res.render("edit", {
            post: result.rows[0]
        });

    } catch (error) {

        console.log(error);
        res.send("Error loading post.");

    }
});


// UPDATE POST

app.post("/edit/:id", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const blogId = req.params.id;

    const title = req.body.title;
    const category = req.body.category;
    const content = req.body.content;

    try {

        await db.query(
            `UPDATE blogs
             SET title = $1,
                 body = $2,
                 category = $3
             WHERE blog_id = $4
             AND creator_user_id = $5`,
            [
                title,
                content,
                category,
                blogId,
                req.session.user.user_id
            ]
        );

        res.redirect("/");

    } catch (error) {

        console.log(error);
        res.send("Error updating post.");

    }
});


// DELETE POST

app.post("/delete/:id", async (req, res) => {

    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const blogId = req.params.id;

    try {

        await db.query(
            `DELETE FROM blogs
             WHERE blog_id = $1
             AND creator_user_id = $2`,
            [
                blogId,
                req.session.user.user_id
            ]
        );

        res.redirect("/");

    } catch (error) {

        console.log(error);
        res.send("Error deleting post.");

    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});