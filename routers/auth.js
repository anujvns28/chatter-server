// Import the required modules
const express = require("express");
const router = express.Router();
const {
  signUp,
  login,
  logout,
  suggestUserName,
  isUsernameExist,
} = require("../controller/auth");
const { auth } = require("../middleware/auth");

//signup routes
router.post("/signup", signUp);
// login routes
router.post("/login", login);
// logout routes
router.get("/logout", logout);

router.post("/suggestUsername", suggestUserName);
router.post("/checkUsernameExist", isUsernameExist);

module.exports = router;
