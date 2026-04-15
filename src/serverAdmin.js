const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  // Implement your admin check logic here
  // For example:
  // if (req.user && req.user.isAdmin) {
  //   next();
  // } else {
  //   res.status(403).json({ error: 'Unauthorized' });
  // }
  next(); // Remove this line when you implement proper admin check
};

router.post('/restart/:service', isAdmin, (req, res) => {
  const { service } = req.params;
  
  if (service !== 'merlin' && service !== 'zello') {
    return res.status(400).json({ error: 'Invalid service name' });
  }

  exec(`sudo systemctl restart ${service}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error restarting ${service}: ${error}`);
      return res.status(500).json({ error: `Failed to restart ${service}` });
    }
    console.log(`${service} restarted successfully`);
    res.json({ message: `${service} restarted successfully` });
  });
});

router.get('/status/:service', isAdmin, (req, res) => {
  const { service } = req.params;
  
  if (service !== 'merlin' && service !== 'zello') {
    return res.status(400).json({ error: 'Invalid service name' });
  }

  exec(`systemctl is-active ${service}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error checking ${service} status: ${error}`);
      return res.status(500).json({ error: `Failed to check ${service} status` });
    }
    const status = stdout.trim();
    res.json({ status });
  });
});

module.exports = router;