const { readDatabase, updateDatabase } = require('../utils/dataStore');

function getUsers() {
  const { users, stores } = readDatabase();
  return users.map((user) => ({
    ...user,
    store: stores.find((store) => store.userId === user.id) || null
  }));
}

function getUser(userId) {
  return getUsers().find((user) => user.id === userId) || null;
}

function ensureRole(userId, role) {
  const user = getUser(userId);
  if (!user) {
    return false;
  }
  return user.roles && user.roles.includes(role);
}

function updateUser(userId, patch) {
  return updateDatabase((db) => {
    const index = db.users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error('user-not-found');
    }
    db.users[index] = {
      ...db.users[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    return db.users[index];
  });
}

module.exports = {
  getUsers,
  getUser,
  ensureRole,
  updateUser
};
