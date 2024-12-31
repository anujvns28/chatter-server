// Import the required modules
const express = require("express");
const router = express.Router();
const { createGroup, accpetGroupInvite } = require("../controller/group");
const { auth } = require("../middleware/auth");

// creating group
router.post("/createGroup", auth, createGroup);
router.post("/acceptInvite", auth, accpetGroupInvite);

module.exports = router;
