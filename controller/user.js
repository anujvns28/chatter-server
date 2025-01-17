const Chat = require("../model/chat");
const User = require("../model/user");
const Request = require("../model/request");
const { globalUsers, getSocketIdByUserId } = require("../service/socketMap");
const Crypto = require("crypto");
const mailSender = require("../config/sendMail");
const bcrypt = require("bcrypt");
const admin = require("../config/firebase"); // Import Firebase Admin SDK

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

exports.resetPasswordLink = async (req, res) => {
  try {
    const { mail } = req.body;

    if (!mail) {
      return res.status(500).json({
        success: false,
        message: "mail is required",
      });
    }

    // fetch user
    const user = await User.findOne({ email: mail });

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "email is not registerd with us",
      });
    }

    // creating token
    const token = Crypto.randomBytes(20).toString("hex");
    // update user

    await User.findByIdAndUpdate(
      user._id,
      {
        token: token,
      },
      { new: true }
    );

    // send mail
    const url = `https://chattkaro.vercel.app/forgot-password/${token}`;

    await mailSender(
      mail,
      "Password Reset",
      `Your Link for email verification is ${url}. Please click this url to reset your password.`
    );

    return res.status(200).json({
      success: false,
      message: "pasword rest linke send successfullly",
    });
  } catch (err) {
    console.log("error occured in sending rest link", err);
    return res.status(500).json({
      success: false,
      message: "eroro occured in sending rest password email",
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(500).json({
        success: false,
        message: "token is required",
      });
    }
    console.log("token", token);
    const user = await User.findOne({ token: token });

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "token is expire",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.findByIdAndUpdate(
      user._id,
      {
        password: hashedPassword,
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "password updated",
    });
  } catch (err) {
    console.log("err occured in updating password", err);
    return res.status(500).json({
      success: false,
      message: "error occured in updating password",
    });
  }
};

exports.TypingStatus = async (req, res) => {
  try {
    const { chatId, typingStatus } = req.body;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "chatid is required",
      });
    }

    if (!typingStatus) {
      return res.status(400).json({
        success: false,
        message: "typingStatus is required",
      });
    }

    const chat = await Chat.findById(chatId);
    const userDetails = await User.findById(req.userId);

    if (chat.users.length > 1) {
      const otherUser = chat.users.filter((u) => req.userId !== u.toString());
      console.log("this is other users", otherUser);

      const io = req.app.locals.io;
      if (typingStatus === "Typing") {
        otherUser.map((user) => {
          const socketId = getSocketIdByUserId(user.toString());
          if (socketId) {
            const data = {
              typerId: req.userId,
              chatId: chatId,
              img: userDetails.profilePic,
            };
            io.to(socketId).emit("typing", data);
          }
        });
      } else {
        otherUser.map((user) => {
          const socketId = getSocketIdByUserId(user.toString());
          if (socketId) {
            const data = {
              typerId: req.userId,
              chatId: chatId,
            };
            io.to(socketId).emit("stopTyping", data);
          }
        });
      }
    }

    return res.status(200).json({
      success: false,
      message: "typing status successfull",
    });
  } catch (err) {
    console.log("erroro occured in typing statts", err);
    return res.status(500).json({
      success: false,
      message: "error occured in typing status",
    });
  }
};

// save FCM token
exports.saveFCMToken = async (req, res) => {
  try {
    const { fcm_tokne } = req.body;

    if (!fcm_tokne) {
      return res.status(500).json({
        success: false,
        message: "Fcm fcm_tokne is reqreid",
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "you are not vallied user",
      });
    }

    const updateUser = await User.findByIdAndUpdate(
      req.userId,
      {
        FCM_token: fcm_tokne,
      },
      { new: true }
    );

    return res.status(200).json({
      success: false,
      message: "fcm fcm_tokne updated success",
      data: updateUser,
    });
  } catch (err) {
    console.log("error occured in updating fcm fcm_tokne");
    return res.status(500).json({
      success: false,
      message: "error occured in updating fcm fcm_tokne",
    });
  }
};

// Controller function to send push notification

// Send Notification to a specific user
exports.sendNotificationToUser = async (req, res) => {
  const { title, body } = req.body;

  try {
    // Fetch user's FCM token from the database
    const user = await User.findById(req.userId);
    if (!user || !user.FCM_token) {
      return res.status(404).json({ message: "User or FCM Token not found" });
    }

    // Notification payload
    const message = {
      token: user.FCM_token,
      notification: {
        title,
        body,
      },
    };

    // Send notification
    const response = await admin.messaging().send(message);

    res
      .status(200)
      .json({ message: "Notification sent successfully!", response });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ message: "Failed to send notification", error });
  }
};





