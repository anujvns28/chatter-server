const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const { dbConnection } = require("./config/dbconnect");
const { cloudinaryConnect } = require("./config/cloudinary");
require("dotenv").config();
const cookieParser = require("cookie-parser");

const authRoutes = require("./routers/auth");
const userRoutes = require("./routers/user");
const chatRoutes = require("./routers/chat");
const { createfakeUser } = require("./seeders/user");

//import for socket
const { Server } = require("socket.io");
const { createServer } = require("http");
const {
  addUserToMap,
  removeUserFromMap,
  getUserIdBySocketId,
} = require("./service/socketMap");
const { updateUserStatus } = require("./controller/user");

const app = express();
const server = createServer(app);
const port = process.env.PORT || 4000;

//dbconnection
dbConnection();

// createfakeUser();

// Initialize socket.io with CORS configuration
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Store io in app.locals to use in the controllers
app.locals.io = io;

//cloudnary connect
cloudinaryConnect();

//middleware
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

// mountinh
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/chat", chatRoutes);

//socekt code here

io.on("connection", (socket) => {
  console.log(`New user connected ${socket.id}`);

  //sotore user socket id with key userId
  socket.on("userConnected", (userId) => {
    addUserToMap(userId, socket.id);
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    removeUserFromMap(socket.id);
    const userId = getUserIdBySocketId(socket.id);

    // Update the user's status to "offline" using the controller or service
    if (userId) {
      try {
        const req = {
          body: { userId, status: "offline" },
          app: { locals: { io } },
        };
        const res = {
          status: (code) => ({
            json: (data) => console.log(`Response: ${code}`, data),
          }),
        };

        // Call the controller
        await updateUserStatus(req, res);
      } catch (err) {
        console.error("Error updating user status:", err.message);
      }
    }
  });
});
//socket io code here

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});