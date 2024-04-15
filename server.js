const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const PORT = 4000;
const app = express();
const server = createServer(app);

const socketIO = new Server(server, {
  connectionStateRecovery: {},
  cors: {
    origin: "*",
  },
});

let chatGroups = [];
let driversUpdate = [];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

socketIO.on("connection", async (socket) => {
  console.log(`⚡: ${socket.id} user just connected!`);

  socket.on("getAllRooms", () => {
    socket.emit("roomList", chatGroups);
  });
  //  Create Chat Room handler
  socket.on("createRoom", (room) => {
    const existingRoom = chatGroups.filter(
      (chatGroup) =>
        chatGroup.id === room.id ||
        chatGroup.driverName === room.driverName ||
        chatGroup.userName === room.userName
    );
    if (existingRoom.length !== 0) {
      socket.emit("roomExistsError", "Room already exists");
      console.log("Room exists");
    } else {
      chatGroups.unshift({
        messages: [],
        ...room,
      });
    }

    socket.emit("roomList", chatGroups);
    console.log("CreateRoom: ", room);
  });

  socket.on("findRoom", (id) => {
    const foundRoom = chatGroups.filter((room) => room.id === id);
    socket.emit("foundRoom", foundRoom[0].messages);
  });

  socket.on("newMessage", (msg) => {
    const filteredGroup = chatGroups.filter((item) => item.id === msg.room);
    const newMessage = {
      ...msg,
    };

    socket.to(filteredGroup[0].id).emit("roomMessage", newMessage);
    console.log("filteredGroup: ", filteredGroup);
    console.log("chatGroups: ", chatGroups);
    filteredGroup[0].messages.push(newMessage);
    console.log("filteredGroup: ", filteredGroup);
    socket.emit("roomList", chatGroups);
    socket.emit("foundRoom", filteredGroup[0].messages);
  });

  socket.on("channelId", (id) => {
    console.log("channelId: ", id);
    socket.emit("channelId", id);
  });

  socket.on("newLocation", (coords, driverId) => {
    console.log("coords: ", coords, "driver: ", driverId);

    let driverExits = driversUpdate.filter(
      (driver) => driver?.driverId === driverId
    );
    if (driverExits.length === 0) {
      driversUpdate.push({
        latitude: coords.latitude,
        longitude: coords.longitude,
        driverId,
      });
    }
  });

  socket.on('getDriverLoc', (driverId) => {
    let driver = driversUpdate.filter((driver) => driver.driverId === driverId);
    socket.emit("locationUpdate", {
      latitude: driver.latitude,
      longitude: driver.longitude,
      driverId: driver.driverId,
    });
  });


  socket.on("disconnect", () => {
    socket.disconnect();
    console.log(`🔥: A user disconnected`);
  });
});

app.get("/api/chats", async (req, res) => {
  res.json(chatGroups);
});

app.use("/", (req, res) => res.send("All works well."));

server.listen(PORT, () => {
  // dbConnection();
  console.log(`Server listening on port ${PORT}`);
});
