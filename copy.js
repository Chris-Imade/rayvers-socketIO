const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const { generateRandomNumber } = require("./utils");
const ChatRooms = require("./schema/chatRooms");
const Message = require("./schema/Message");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;

const dbConnection = require("./config/database").connection;

const PORT = 4000;
const app = express();
const server = createServer(app);

const socketIO = new Server(server, {
  connectionStateRecovery: {},
  cors: {
    origin: "*",
  },
});

let chatgroups = [];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

socketIO.on("connection", async (socket) => {
  console.log(`⚡: ${socket.id} user just connected!`);

  socket.on("typing", ({ roomId, userId }) => {
    console.log("typing...");
    socket.emit("userTyping", { userId });
  });
  
  //  Create Chat Room handler
  socket.on("createRoom", async (room) => {
    try {
      const existingRoom = await ChatRooms.findOne({ name: room.name });

      if (existingRoom) {
        // Room already exists, emit an error or handle it accordingly
        socket.emit("roomExistsError", "Room already exists");
      } else {
        // Room doesn't exist, create it
        const newChatRoom = new ChatRooms(room);
        await newChatRoom.save({ new: true });
        console.log("roomId: ", room._id);
        socket.join(newChatRoom._id);
        const allRooms = await ChatRooms.find();
        socket.emit("roomList", allRooms);
      }
    } catch (error) {
      console.log(`Error ${error.message}`);
    }
  });

  socket.on("findRoom", async (id) => {
    try {
      const foundRoom = await ChatRooms.findById(id);

      socket.emit("foundRoom", foundRoom.messages);
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  });

  socket.on("newMessage", async (msg, clientOffset) => {
    console.log("clientOffset: ", clientOffset);
    try {
      const message = new Message({ clientOffset, ...msg });
      const savedMessage = await message.save({ new: true });
      socket.handshake.auth.serverOffset = clientOffset;

      const chatRoom = await ChatRooms.findById(msg.room);
      chatRoom.messages.push({ clientOffset, ...message });
      await chatRoom.save();

      console.log("roomId: ", msg.room);

      const roomList = await ChatRooms.find();
      if (!socket.recovered) {
        try {
          const messages = await Message.find({
            _id: { $gt: socket.handshake.auth.serverOffset || 0 },
          });
          messages.forEach((message) => {
            socket.emit("roomMessage", message, socket.handshake.auth.serverOffset);
          });
        } catch (error) {
          console.error("Error fetching messages:", error);
        }
      }
      socket.emit("roomMessage", savedMessage);
      socket.emit("foundRoom", chatRoom);
      socket.emit("roomList", roomList);
    } catch (error) {
      console.error("Error saving message:", error);
      // Handle the error accordingly
    }
  });

  socket.on("disconnect", () => {
    socket.disconnect();
    console.log(`🔥: A user disconnected`);
  });
});

app.get("/api/chat-rooms", async (req, res) => {
  try {
    const chatRooms = await ChatRooms.find();
    res.json(chatRooms);
  } catch (error) {
    console.log(error.message);
  }
});

app.use("/", (req, res) => res.send("All works well."));

server.listen(PORT, () => {
  dbConnection();
  console.log(`Server listening on port ${PORT}`);
});
