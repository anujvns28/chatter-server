const User = require("../model/user");
const Chat = require("../model/chat");
const Message = require("../model/message");
const { globalUsers } = require("../service/socketMap");
const admin = require("../config/firebase");

exports.fetchAllChats = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId)
      .populate({
        path: "chats",
        populate: [
          {
            path: "users",
            select: "name profilePic",
          },
          {
            path: "latestMessage",
            select: "content sender createdAt",
            populate: {
              path: "sender",
              select: "name profilePic",
            },
          },
        ],
      })
      .sort({ latestMessage: -1 });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Modify chat data to add dynamic chatName and chatImage
    let chats = await Promise.all(
      user.chats.map(async (chat) => {
        let unReadMessages = [];

        unReadMessages = await Message.find({
          chat: chat._id,
          readBy: { $nin: [req.userId] },
          sender: { $ne: userId },
          isNotification: false,
        });

        if (!chat.isGroupChat) {
          const otherUser = chat.users.find((u) => u._id.toString() !== userId);

          return {
            _id: chat._id,
            chatName: otherUser.name,
            chatImage: otherUser.profilePic,
            userId: otherUser._id,
            latestMessage: chat.latestMessage,
            unReadMessageCount: unReadMessages.length,
          };
        }

        return {
          _id: chat._id,
          chatName: chat.chatName,
          chatImage: chat.chatImg,
          latestMessage: chat.latestMessage,
          unReadMessageCount: unReadMessages.length,
        };
      })
    );

    // Sort chats by latest message's createdAt field in descending order
    chats.sort((a, b) => {
      const dateA = a.latestMessage?.createdAt
        ? new Date(a.latestMessage.createdAt)
        : new Date(0);
      const dateB = b.latestMessage?.createdAt
        ? new Date(b.latestMessage.createdAt)
        : new Date(0);
      return dateB - dateA; // Descending order
    });

    return res.status(200).json({
      success: true,
      chats,
    });
  } catch (err) {
    console.error("Error occurred while fetching chats:", err);
    return res.status(500).json({
      success: false,
      message: "Error occurred while fetching chats.",
    });
  }
};

exports.fetchChatDetails = async (req, res) => {
  try {
    const { chatId } = req.body;

    const chat = await Chat.findById(chatId).exec();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found.",
      });
    }

    let chatDetails;

    if (chat.isGroupChat) {
      chatDetails = await chat.populate([
        { path: "users", select: "name profilePic username " },
        { path: "groupAdmin", select: "name profilePic username" },
      ]);
    } else {
      const otherUserId = chat.users.find(
        (userId) => userId.toString() !== req.userId
      );

      chatDetails = await chat.populate({
        path: "users",
        select: "name profilePic username status lastSeen",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chat details fetched successfully.",
      chatDetails,
    });
  } catch (err) {
    console.error("Error occurred while fetching chat details", err);
    return res.status(500).json({
      success: false,
      message: "Error occurred while fetching chat details.",
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;
    const io = req.app.locals.io;

    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: "all Filds are requred",
      });
    }

    const chat = await Chat.findById(chatId);
    const user = await User.findById(req.userId).select(
      "name profilePic username"
    );

    if (!chat) {
      return res.status(400).json({
        success: false,
        message: "not vallied chat id",
      });
    }

    // message for db
    const message = await Message.create({
      sender: req.userId,
      content: content,
      chat: chatId,
      readBy: [req.userId],
    });

    // find other userid
    const otherUser = chat.users.filter((u) => u.toString() !== req.userId);

    // console.log(chat.users, "this is all users");
    // console.log("otheruser", otherUser);

    // send realtime message

    const rtMessage = {
      sender: user,
      content: content,
      chat: chatId,
      isNotification: false,
      isRead: true,
      mediaUrl: "",
      createdAt: new Date().toISOString(),
    };

    if (otherUser) {
      otherUser.forEach((user) => {
        const socketId = globalUsers.get(user.toString());
        if (socketId) {
          io.to(socketId).emit("sendMessage", rtMessage);
          io.to(socketId).emit("updateChat", "update");
        }
      });
    }

    // Emit event to the sender for their chat update
    const senderSocket = globalUsers.get(req.userId.toString());
    if (senderSocket) {
      io.to(senderSocket).emit("updateChat", "update");
    }

    await Chat.findByIdAndUpdate(
      chatId,
      {
        latestMessage: message._id,
      },
      { new: true }
    );

    // push notification when user is ofline only for one to one chat for testing purpose
    const otherUserDetails = await User.findById(otherUser[0].toString());
    const socId = globalUsers.get(otherUser.toString());
    console.log(socId, "thisi is socete id ");
    if (otherUserDetails && otherUserDetails.FCM_token) {
      console.log("comming at sending notification");
      const message = {
        token: otherUserDetails.FCM_token,
        notification: {
          title: "New Message",
          body: `@${user.username} sent you a message.`,
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
      message: "message send successfull",
      message,
    });
  } catch (err) {
    console.log(err, "error occured in seding messge");
    return res.status(500).json({
      success: false,
      message: "error occured in sending message",
    });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.body;
    const { page = 1 } = req.query;
    console.log(page, "this is page nomber");
    const limit = 20;
    const skip = (page - 1) * limit;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID is required",
      });
    }

    // Fetch the chat by ID
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Fetch all messages related to the chat
    const [messages, totalMessageCount] = await Promise.all([
      Message.find({ chat: chatId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "name profilePic"),
      Message.countDocuments({ chat: chatId }),
    ]);

    return res.status(200).json({
      success: true,
      messages: messages.reverse(),
      totalMessageCount,
    });
  } catch (err) {
    console.log(err, "Error occurred while fetching messages");
    return res.status(500).json({
      success: false,
      message: "Error occurred while fetching messages",
    });
  }
};

exports.updateReadStatusOfMessage = async (req, res) => {
  try {
    const { chatId } = req.body;

    const chat = await Chat.findById(chatId);
    let updatedMessageIds = [];

    if (!chat) {
      return res.status(400).json({
        success: false,
        message: "this is not vallied chat",
      });
    }
    // finding all messages
    const messages = await Message.find({
      chat: chatId,
      readBy: { $nin: [req.userId] },
      sender: { $ne: req.userId },
      isNotification: false,
    });

    await Promise.all(
      messages.map(async (m) => {
        await Message.findByIdAndUpdate(
          m._id,
          {
            $push: {
              readBy: req.userId,
            },
          },
          { new: true }
        );

        updatedMessageIds.push(m._id);
      })
    );

    // send user real time to reciver is read message

    const io = req.app.locals.io;

    const otherUsers = chat.users.filter((u) => u.toString() !== req.userId);
    if (otherUsers) {
      otherUsers.forEach((user) => {
        const socketId = globalUsers.get(user.toString());
        if (socketId) {
          io.to(socketId).emit("messageRead", {
            messageIds: updatedMessageIds,
          });
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "message status updated",
    });
  } catch (err) {
    console.log(err, "error occured in while updating message status");
    return res.status(500).json({
      success: false,
      message: "error occured in while updating message status",
    });
  }
};
