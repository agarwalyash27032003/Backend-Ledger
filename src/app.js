const express = require("express");
const cookieParser = require("cookie-parser")

const authRouter = require("./routes/auth.routes")
const accountRouter = require("./routes/account.routes")

const app = express()


app.use(express.json()) // so that express server can read the data of req.body
app.use(cookieParser());

/**
 * - Routes
 */
app.use("/api/auth", authRouter)
app.use("/api/accounts", accountRouter)

module.exports = app;