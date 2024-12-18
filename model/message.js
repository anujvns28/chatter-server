const mongoose = require("mongoose");

// Create the message schema
const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    content: {
      type: String,
      trim: true,
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
    },

    isNotification: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Export the Message model
const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
