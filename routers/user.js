const express = require("express");
const router = express.Router();

const { searchUser, updateUserStatus } = require("../controller/user");
const { auth } = require("../middleware/auth");
const {
  sendFriendRequest,
  respondToFriendRequest,
  fetchAllRequest,
} = require("../controller/request");

//searching user route
router.post("/searchUser", auth, searchUser);
router.post("/sendFriendRequest", auth, sendFriendRequest);
router.post("/respondToFraindRequest", auth, respondToFriendRequest);
router.post("/fetchAllFraindRequests", auth, fetchAllRequest);
router.post("/updateUserStatus", auth, updateUserStatus);

module.exports = router;