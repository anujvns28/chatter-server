const globalUsers = new Map();

// Method to add a user to the global map
function addUserToMap(userId, socketId) {
  globalUsers.set(userId, socketId);
}

// Method to remove a user from the global map
function removeUserFromMap(userId) {
  globalUsers.delete(userId);
}

// Method to get the socketId of a user by userId
function getSocketIdByUserId(userId) {
  return globalUsers.get(userId);
}

// Retrieve userId by socketId (needed when user disconnects)
function getUserIdBySocketId(socketId) {
  for (let [userId, storedSocketId] of globalUsers) {
    if (storedSocketId === socketId) {
      return userId;
    }
  }
  return null;
}

// Method to get all connected users
function getAllUsers() {
  return globalUsers;
}

module.exports = {
  globalUsers,
  addUserToMap,
  removeUserFromMap,
  getSocketIdByUserId,
  getUserIdBySocketId,
  getAllUsers,
};
