// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const Notification = require('../models/Notification'); // ✅ Import Notification model

// Helper to emit and save notification after successful response
function emitAfterSuccess(req, res, payloadBuilder) {
  const io = req.app.get('io');
  res.once('finish', async () => {
    // 2xx only
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const payload = payloadBuilder();
        if (payload) {
          // ✅ Emit real-time notification
          io.emit('new-notification', payload);

          // ✅ Save to DB
          await Notification.create({
            userId: req.user ? req.user.id : null, // optional: depends if you attach user
            type: payload.type,
            message: payload.message,
            time: new Date(),
            isRead: false,
          });
        }
      } catch (e) {
        console.error('Notification emit/save error:', e.message);
      }
    }
  });
}

router.post('/signup', (req, res, next) => {
  emitAfterSuccess(req, res, () => ({
    type: 'signup',
    message: `New user signed up: ${req.body?.email || 'Unknown email'}`,
    time: new Date().toISOString(),
  }));
  return authController.signup(req, res, next);
});

router.post('/verify-code', authController.verifyCode);

router.post('/login', (req, res, next) => {
  emitAfterSuccess(req, res, () => ({
    type: 'login',
    message: `User logged in: ${req.body?.email || 'Unknown email'}`,
    time: new Date().toISOString(),
  }));
  return authController.login(req, res, next);
});

router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
