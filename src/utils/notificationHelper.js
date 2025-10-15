// server/src/utils/notificationHelper.js
const { createNotification } = require('../controllers/notificationController');
const { getIO } = require('../socket');

/**
 * Create and emit property notification
 * @param {Object} options - Notification options
 * @param {String} options.type - Notification type (House, Villa, Rental, etc.)
 * @param {String} options.propertyId - Property MongoDB ID
 * @param {String} options.propertyName - Property name
 * @param {String} options.propertyImage - Property image URL
 * @param {String} options.action - Action type ('created' or 'deleted')
 * @param {String} options.userId - Optional user ID for user-specific notifications
 */
const createPropertyNotification = async (options) => {
  try {
    const { type, propertyId, propertyName, propertyImage, action, userId } = options;
    
    let notificationType = type || 'property_created';
    let message = '';
    
    if (action === 'deleted') {
      notificationType = 'property_deleted';
      message = `Property "${propertyName}" has been removed from listings.`;
    } else {
      // For admin notification
      const adminMessage = `New ${type} property "${propertyName}" has been added to the system.`;
      
      // Create admin notification
      const adminNotif = await createNotification({
        type: 'property',
        target: 'admin',
        message: adminMessage,
        propertyId,
        propertyName,
        time: new Date()
      });
      
      // Emit to admin socket
      const io = getIO();
      if (io && adminNotif) {
        io.emit('new-notification', adminNotif);
      }
    }
    
    // Create mobile notification (for all users or specific user)
    const mobileNotif = await createNotification({
      type: notificationType,
      target: 'mobile',
      propertyId,
      propertyName,
      message: message || `New ${type} property available!`,
      userId: userId || undefined, // If userId provided, notification is user-specific
      time: new Date(),
      metadata: {
        propertyImage: propertyImage || null
      }
    });
    
    // Emit to mobile clients via socket
    const io = getIO();
    if (io && mobileNotif) {
      if (userId) {
        // Emit to specific user
        io.to(`user_${userId}`).emit('new-notification', mobileNotif);
      } else {
        // Emit to all mobile users
        io.emit('new-mobile-notification', mobileNotif);
      }
    }
    
    console.log(`✅ Property notification created: ${notificationType} - ${propertyName}`);
    return { admin: adminNotif || null, mobile: mobileNotif };
    
  } catch (error) {
    console.error('❌ Error creating property notification:', error);
    return null;
  }
};

/**
 * Create and emit owner notification
 * @param {Object} options - Notification options
 * @param {String} options.ownerId - Owner MongoDB ID
 * @param {String} options.ownerName - Owner name
 * @param {String} options.ownerImage - Owner image URL
 * @param {String} options.action - Action type ('created' or 'deleted')
 * @param {String} options.userId - Optional user ID for user-specific notifications
 */
const createOwnerNotification = async (options) => {
  try {
    const { ownerId, ownerName, ownerImage, action, userId } = options;
    
    let notificationType = action === 'deleted' ? 'owner_deleted' : 'owner';
    let adminMessage = '';
    
    if (action === 'deleted') {
      adminMessage = `Property owner "${ownerName}" has been removed from the system.`;
    } else {
      adminMessage = `New property owner "${ownerName}" has been registered.`;
    }
    
    // Create admin notification
    const adminNotif = await createNotification({
      type: action === 'deleted' ? 'user_deleted' : 'signup',
      target: 'admin',
      message: adminMessage,
      userName: ownerName,
      relatedId: ownerId,
      time: new Date()
    });
    
    // Create mobile notification
    const mobileNotif = await createNotification({
      type: notificationType,
      target: 'mobile',
      userName: ownerName,
      userId: userId || undefined,
      relatedId: ownerId,
      time: new Date(),
      metadata: {
        userImage: ownerImage || null
      }
    });
    
    // Emit to sockets
    const io = getIO();
    if (io) {
      if (adminNotif) {
        io.emit('new-notification', adminNotif);
      }
      
      if (mobileNotif) {
        if (userId) {
          io.to(`user_${userId}`).emit('new-notification', mobileNotif);
        } else {
          io.emit('new-mobile-notification', mobileNotif);
        }
      }
    }
    
    console.log(`✅ Owner notification created: ${notificationType} - ${ownerName}`);
    return { admin: adminNotif, mobile: mobileNotif };
    
  } catch (error) {
    console.error('❌ Error creating owner notification:', error);
    return null;
  }
};

/**
 * Create admin-only notification
 * @param {Object} options - Notification options
 */
const createAdminNotification = async (options) => {
  try {
    const notification = await createNotification({
      ...options,
      target: 'admin',
      time: new Date()
    });
    
    // Emit to admin socket
    const io = getIO();
    if (io && notification) {
      io.emit('new-notification', notification);
    }
    
    return notification;
  } catch (error) {
    console.error('❌ Error creating admin notification:', error);
    return null;
  }
};

module.exports = {
  createPropertyNotification,
  createOwnerNotification,
  createAdminNotification
};