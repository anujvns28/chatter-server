const Request = require("../model/request");
const Chat = require("../model/chat");
const User = require("../model/user");
const Message = require("../model/message");
const { getSocketIdByUserId, globalUsers } = require("../service/socketMap");
const admin = require("../config/firebase");

exports.sendFriendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;

    // Check if receiverId is provided
    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver ID is required.",
      });
    }

    // Prevent users from sending requests to themselves
    if (req.userId === receiverId) {
      return res.status(400).json({
        success: false,
        message: "You cannot send a friend request to yourself.",
      });
    }

    // Check for duplicate requests
    const existingRequest = await Request.findOne({
      $or: [
        { sender: req.userId, receiver: receiverId },
        { sender: receiverId, receiver: req.userId },
      ],
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Friend request already sent.",
      });
    }

    // returning socket message

    const io = req.app.locals.io;
    const socketId = globalUsers.get(receiverId);

    if (socketId) {
      io.to(socketId).emit("fraindRequest", "New fraind Request");
    }

    // Create a new friend request
    await Request.create({
      sender: req.userId,
      receiver: receiverId,
    });

    //sending push notification
    const sender = await User.findById(req.userId);
    const receiver = await User.findById(receiverId);

    if (receiver && receiver.FCM_token) {
      const message = {
        token: receiver.FCM_token,
        notification: {
          title: "Friend Request",
          body: `@${sender.username} sent you a friend request.`,
        },
      };

      try {
        await admin.messaging().send(message);
        console.log("Push notification sent successfully.");
      } catch (error) {
        console.error("Error sending push notification:", error);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Friend request sent successfully.",
    });
  } catch (err) {
    console.error("Error occurred while sending friend request:", err);
    return res.status(500).json({
      success: false,
      message: "Error occurred while sending friend request.",
    });
  }
};

exports.respondToFriendRequest = async (req, res) => {
  try {
    const { requestId, action } = req.body;

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

    if (action === "accept") {
      friendRequest.status = "accepted";

      const existingChat = await Chat.findOne({
        isGroupChat: false,
        users: { $all: [friendRequest.sender, friendRequest.receiver] },
      });

      if (!existingChat) {
        const newChat = new Chat({
          chatName: "Chat",
          isGroupChat: false,
          users: [friendRequest.sender, friendRequest.receiver],
        });

        await newChat.save();

        // Update both users' chat lists
        await Promise.all([
          User.findByIdAndUpdate(req.userId, { $push: { chats: newChat._id } }),
          User.findByIdAndUpdate(friendRequest.sender, {
            $push: { chats: newChat._id },
          }),
        ]);

        // create admin message for all user
        const message = await Message.create({
          content: "Say Hii ..",
          isNotification: true,
          chat: newChat._id,
        });

        //update last messsage
        await Chat.findByIdAndUpdate(
          newChat._id,
          {
            latestMessage: message._id,
          },
          { new: true }
        );

        // send user accepted message in real time
        const io = req.app.locals.io;
        const socketId = globalUsers.get(friendRequest.sender.toString());
        if (socketId) {
          io.to(socketId).emit("acceptRequest", "frind Request accetpted");
        }
      }
    } else if (action === "reject") {
      friendRequest.status = "rejected";
    }

    await friendRequest.save();

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

exports.fetchAllRequest = async (req, res) => {
  try {
    const userId = req.userId;
    const isRead = req.body.isRead;

    let requests = await Request.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $ne: "rejected" },
      isRead: false,
    })
      .populate("sender", "name username email profilePic")
      .populate("receiver", "name username email profilePic")
      .sort({ createdAt: -1 });

    if (isRead) {
      await Promise.all(
        requests.map(async (request) => {
          console.log(request.status, request.isRead);
          if (request.status == "accepted" && request.isRead == false) {
            await Request.findByIdAndUpdate(
              request._id,
              {
                isRead: true,
              },
              { new: true }
            );
          }
        })
      );
    }

    // Refetch updated requests
    requests = await Request.find({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $ne: "rejected" },
      isRead: false,
    })
      .populate("sender", "name username email profilePic")
      .populate("receiver", "name username email profilePic")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Requests fetched successfully",
      requests,
    });
  } catch (err) {
    console.error("Error while fetching requests:", err);
    return res.status(500).json({
      success: false,
      message: "Error while fetching requests",
    });
  }
};



