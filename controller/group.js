const Chat = require("../model/chat");
const User = require("../model/user");
const Request = require("../model/request");
const Message = require("../model/message");
const { globalUsers } = require("../service/socketMap");
const { uploadImageToCloudinary } = require("../utils/imageUploader");

exports.createGroup = async (req, res) => {
  try {
    // Fetching data
    const groupName = req.body.groupName;
    const groupImg = req.files.groupImg;
    const members = req.body["members[]"];
    const userId = req.userId;

    console.log(members, "this is body");

    if (!groupName || !members || !groupImg) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // upload group image to cloudenary
    const imageUrl = await uploadImageToCloudinary(groupImg);

    // Creating a new group and saving it to the database
    const chat = await Chat.create({
      users: [userId],
      chatName: groupName,
      chatImg: imageUrl.secure_url,
      groupAdmin: userId,
      isGroupChat: true,
    });

    // push chat id in user chat list
    await User.findByIdAndUpdate(
      req.userId,
      {
        $push: {
          chats: chat._id,
        },
      },
      { new: true }
    );

    // creating welcome messagess
    const message = await Message.create({
      content: "Say Hii ..",
      isNotification: true,
      chat: chat._id,
    });

    // update lastmessage in chat
    await Chat.findByIdAndUpdate(
      chat._id,
      {
        latestMessage: message._id,
      },
      { new: true }
    );

    // Sending friend requests to all members and notifying in real-time
    const io = req.app.locals.io;

    const requestsPromise = members.map(async (member) => {
      await Request.create({
        sender: userId,
        receiver: member,
        isRead: false,
        isGroup: true,
        groupId: chat._id,
      });

      const socketId = globalUsers.get(member);
      // Sending request in real-time
      if (socketId) {
        io.to(socketId).emit("fraindRequest", "New fraind Request");
      }
    });

    await Promise.all(requestsPromise);

    // Returning response
    return res.status(200).json({
      success: true,
      message: "Group created successfully.",
      data: chat,
    });
  } catch (err) {
    console.error(err, "Error occurred in creating group");
    return res.status(500).json({
      success: false,
      message: "Error occurred in creating group.",
    });
  }
};

exports.accpetGroupInvite = async (req, res) => {
  try {
    const { requestId, action } = req.body;
    console.log("group invite respose");

    if (!requestId || !action) {
      return res.status(400).json({
        success: false,
        message: "Request ID and action are required.",
      });
    }

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Use 'accept' or 'reject'.",
      });
    }

    const friendRequest = await Request.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: "Friend request not found.",
      });
    }

    if (friendRequest.receiver.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to respond to this request.",
      });
    }

    console.log(friendRequest, "thi is request");

    const groupId = friendRequest.groupId;
    const user = await User.findById(req.userId);

    if (action === "accept") {
      const message = await Message.create({
        content: `@${user.username} accept invite`,
        isNotification: true,
        chat: groupId,
      });

      await Chat.findByIdAndUpdate(
        groupId,
        {
          $push: {
            users: req.userId,
          },
          latestMessage: message._id,
        },
        { new: true }
      );

      // push chat id in user chat list
      await User.findByIdAndUpdate(
        req.userId,
        {
          $push: {
            chats: groupId,
          },
        },
        { new: true }
      );

      // send user accepted message in real time
      const io = req.app.locals.io;
      const socketId = globalUsers.get(friendRequest.sender.toString());
      console.log("socketid.......", socketId);
      if (socketId) {
        io.to(socketId).emit("acceptRequest", "frind Request accetpted");
      }

      // update request
      await Request.findByIdAndUpdate(
        requestId,
        {
          status: "Accepted",
        },
        { new: true }
      );
    } else if (action === "reject") {
      await Request.findByIdAndUpdate(
        requestId,
        {
          status: "rejected",
        },
        { new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Friend request ${action}ed successfully.`,
    });
  } catch (err) {
    console.error("Error while responding to friend request:", err);
    return res.status(500).json({
      success: false,
      message: "Error occurred while responding to the friend request.",
    });
  }
};
