const mongoose = require("mongoose");

// Create the chat schema
const chatSchema = new mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
      default: "Chat",
    },
    chatImg: {
      type: String,
    },
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    groupAdmin: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: function () {
          return this.isGroupChat;
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Export the Chat model
const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;
