const Chat = require("../model/chat");
const User = require("../model/user");
const Request = require("../model/request");
const { globalUsers } = require("../service/socketMap");

exports.searchUser = async (req, res) => {
  try {
    const { name = "" } = req.query;

    const user = await User.findById(req.userId).populate("chats").exec();

    const searchUsers = await User.find({
      _id: { $nin: [req.userId] },
      $or: [
        { name: { $regex: name, $options: "i" } },
        { username: { $regex: name, $options: "i" } },
        { email: { $regex: name, $options: "i" } },
      ],
    }).select("name username email profilePic");

    const users = await Promise.all(
      searchUsers.map(async (user) => {
        const request = await Request.findOne({
          sender: req.userId,
          receiver: user._id,
          status: "pending",
        });

        user = user.toObject();
        if (request) user.request = true;
        else user.request = false;

        return user;
      })
    );

    return res.status(200).json({
      success: true,
      message: "user serched successfully",
      users: users,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "error occured in searching user",
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const userId = req.body.userId;
    const status = req.body.status;

    if (!userId) {
      return res.status(404).json({
        success: false,
        message: "you are not vallid user",
      });
    }

    if (typeof status === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    // Update user status and last seen
    await User.findByIdAndUpdate(userId, {
      status: status,
      lastSeen: status === "offline" ? Date.now() : null,
    });

    //notfy frainds in rt
    const io = req.app.locals.io;
    const user = await User.findById(userId)
      .populate({
        path: "chats",
        select: "users",
      })
      .exec();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const friends = user.chats.map((chat) => {
      const fraind = chat.users.filter((u) => u.toString() !== userId);
      return fraind.toString();
    });

    // send status update to the all online frainds

    friends.forEach((userId) => {
      const socketId = globalUsers.get(userId);
      if (socketId) {
        io.to(socketId).emit("status-update", "user status is updated");
      }
    });

    return res.status(200).json({
      success: true,
      message: "last seen updateds",
    });
  } catch (err) {
    console.log(err, "err occured in updateUser Status api");
    return res.status(500).json({
      success: false,
      message: "err occured in updateUser Status api",
    });
  }
};


