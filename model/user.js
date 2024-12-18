const mongoose = require("mongoose");


// Create the user schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },
    profilePic: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "offline",
    },
    lastSeen: {
      type: Date,
      default: null,
    },

    bio: {
      type: String,
      default: null,
    },
    chats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat", // Reference to the Chat model
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Export the User model
const User = mongoose.model("User", userSchema);
module.exports = User;
