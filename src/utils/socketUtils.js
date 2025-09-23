// Utility function to handle socket.io emissions
const emitNotification = (req, notification) => {
  try {
    const io = req.app.get("io");
    if (io) {
      io.emit("new-notification", notification);
    } else {
      console.warn("Socket.io instance not found on app");
    }
  } catch (error) {
    console.error("Error emitting socket notification:", error);
  }
};

// Utility function to emit custom events
const emitCustomEvent = (req, eventName, data) => {
  try {
    const io = req.app.get("io");
    if (io) {
      io.emit(eventName, data);
    } else {
      console.warn("Socket.io instance not found on app");
    }
  } catch (error) {
    console.error(`Error emitting custom event ${eventName}:`, error);
  }
};

// Utility function to emit to specific room
const emitToRoom = (req, roomName, eventName, data) => {
  try {
    const io = req.app.get("io");
    if (io) {
      io.to(roomName).emit(eventName, data);
    } else {
      console.warn("Socket.io instance not found on app");
    }
  } catch (error) {
    console.error(`Error emitting to room ${roomName}:`, error);
  }
};

module.exports = {
  emitNotification,
  emitCustomEvent,
  emitToRoom
};