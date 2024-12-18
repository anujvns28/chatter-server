const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth");
const {
  fetchAllChats,
  fetchChatDetails,
  sendMessage,
  getMessages,
  updateReadStatusOfMessage,
} = require("../controller/chat");

//searching user route
router.get("/fetchAllChats", auth, fetchAllChats);
router.post("/fetchChatDetails", auth, fetchChatDetails);
router.post("/sendMessage", auth, sendMessage);
router.post("/getMessages", auth, getMessages);
router.post("/updateMessageStatus", auth, updateReadStatusOfMessage);

module.exports = router;
