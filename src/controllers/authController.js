// controllers/authController.js
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Utility: create JWT
const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || "secretKey",
    { expiresIn: "1h" }
  );
};

exports.signup = async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser = new User({
      email,
      password: hashedPassword,
      otp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000)
    });
    await newUser.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Urban Signup OTP Verification',
      html: `<h3>Your OTP is:</h3><h1>${otp}</h1><p>This code will expire in 10 minutes.</p>`
    });

    res.status(200).json({ ok: true, message: "Signup successful, verify OTP sent to email" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
};

exports.verifyCode = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isOtpValid = user.otp === otp && user.otpExpires > Date.now();
    if (!isOtpValid) return res.status(400).json({ error: 'Invalid or expired OTP' });

    user.otp = null;
    user.otpExpires = null;
    await user.save();

    // auto-login after OTP verification
    const token = createToken(user);

    res.status(200).json({
      ok: true,
      user: { id: user._id, email: user.email },
      token
    });
  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).json({ error: 'OTP verification failed' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid password' });

    const token = createToken(user);

    res.status(200).json({
      ok: true,
      user: { id: user._id, email: user.email },
      token
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Your Password - OTP Verification',
      html: `<h3>Your password reset OTP is:</h3><h1>${otp}</h1><p>This code will expire in 10 minutes.</p>`
    });

    res.status(200).json({ ok: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error("Forgot Password error:", err);
    res.status(500).json({ error: 'Error sending OTP' });
  }
};

exports.verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isOtpValid = user.otp === otp && user.otpExpires > Date.now();
    if (!isOtpValid) return res.status(400).json({ error: 'Invalid or expired OTP' });

    user.otp = null;
    user.otpExpires = null;
    await user.save();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Reset OTP verification error:", err);
    res.status(500).json({ error: 'OTP verification failed' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({ ok: true, message: 'Password reset successful' });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: 'Password reset failed' });
  }
};
