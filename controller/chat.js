const User = require("../model/user");
const Chat = require("../model/chat");
const Message = require("../model/message");
const { globalUsers } = require("../service/socketMap");

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
        if (!chat.isGroupChat) {
          const otherUser = chat.users.find((u) => u._id.toString() !== userId);
          let unReadMessages = [];

          unReadMessages = await Message.find({
            chat: chat._id,
            isRead: false,
            sender: { $ne: userId },
            isNotification: false,
          });

          return {
            _id: chat._id,
            chatName: otherUser.name,
            chatImage: otherUser.profilePic,
            latestMessage: chat.latestMessage,
            unReadMessageCount: unReadMessages.length,
          };
        }

        return {
          _id: chat._id,
          chatName: chat.chatName,
          chatImage: "group-default-image-url",
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

    console.log(chatId, "this is cha id");

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
        match: { _id: otherUserId },
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

    // find other userid
    const otherUser = chat.users
      .find((u) => u.toString() !== req.userId)
      .toString();

    const socket = globalUsers.get(otherUser);

    if (!chat) {
      return res.status(400).json({
        success: false,
        message: "not vallied chat id",
      });
    }

    const message = await Message.create({
      sender: req.userId,
      content: content,
      chat: chatId,
    });

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

    if (!chat.isGroup && socket) {
      io.to(socket).emit("sendMessage", rtMessage);
      io.to(socket).emit("updateChat", "update");
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
    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name profilePic")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      messages,
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
    console.log(chatId, "from message read ");

    const chat = await Chat.findById(chatId);
    let updatedMessageIds = [];

    if (!chat) {
      return res.status(400).json({
        success: false,
        message: "this is not vallied chat",
      });
    }

    const messages = await Message.find({ chat: chatId, isRead: false });

    if (!chat.isGroupChat) {
      const promises = messages.map(async (message) => {
        if (message.sender && message.sender.toString() !== req.userId) {
          await Message.findByIdAndUpdate(
            message._id,
            { isRead: true },
            { new: true }
          );
          updatedMessageIds.push(message._id);
        }
      });
      await Promise.all(promises);
    } else {
      messages.map(async (message) => {
        if (message.sender._id !== req.userId) {
          await Message.findByIdAndUpdate(
            message._id,
            {
              $push: {
                readBy: req.userId,
              },
            },
            { new: true }
          );
        }
        const messageUpdated = await Message.findById(message._id);
        if (messageUpdated.readBy.length === chat.users.length - 1) {
          await Message.findByIdAndUpdate(
            message._id,
            { isRead: true },
            { new: true }
          );
        }
      });
    }

    // send user real time to reciver is read message
    const io = req.app.locals.io;
    const otheruser = chat.users
      .find((u) => u.toString() != req.userId)
      .toString();
    const socket = globalUsers.get(otheruser);
    console.log(updatedMessageIds, "this is unreqd messges id");

    if (socket) {
      io.to(socket).emit("messageRead", { messageIds: updatedMessageIds });
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