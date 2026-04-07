const adminAuth = (req, res, next) => {
  const pin = req.headers['x-admin-pin'] || req.query.pin;
  if (!pin || pin !== process.env.ADMIN_PIN) {
    return res.status(401).json({ error: 'Unauthorized. Valid PIN required.' });
  }
  next();
};

module.exports = { adminAuth };
