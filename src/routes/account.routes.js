const express = require("express")
const authMiddleware = require("../middleware/auth.middleware")
const accountContoller = require("../controllers/account.controller")

const router = express.Router()

/**
 * - POST /api/accounts
 * - Create a new account
 * - Protected Route
 */

router.post("/", authMiddleware.authMiddleware, accountContoller.createAccountContoller)

module.exports = router