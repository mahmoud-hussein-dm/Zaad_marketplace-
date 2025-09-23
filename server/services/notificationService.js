const { updateDatabase, readDatabase } = require('../utils/dataStore');
const { generateId } = require('../utils/id');

function pushNotification(userId, type, payload) {
  return updateDatabase((db) => {
    const notification = {
      id: generateId('notif'),
      userId,
      type,
      payload,
      read: false,
      createdAt: new Date().toISOString()
    };
    db.notifications.push(notification);
    return notification;
  });
}

function getNotifications(userId) {
  const { notifications } = readDatabase();
  return notifications.filter((n) => n.userId === userId);
}

module.exports = {
  pushNotification,
  getNotifications
};
