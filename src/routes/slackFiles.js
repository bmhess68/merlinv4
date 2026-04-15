const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Get Slack token from environment variables
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;

// Check if Slack token is properly configured
if (!SLACK_TOKEN) {
  console.error('[SLACK-FILES] SLACK_BOT_TOKEN environment variable is not set!');
} else if (!SLACK_TOKEN.startsWith('xoxb-')) {
  console.error('[SLACK-FILES] SLACK_BOT_TOKEN appears to be invalid (should start with xoxb-)');
} else {
  console.log('[SLACK-FILES] Slack bot token is configured');
}

// Cache for file URLs to avoid repeated requests
const fileCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Middleware to check if request has a valid file ID
const validateFileId = (req, res, next) => {
  const fileId = req.params.fileId;
  if (!fileId || !fileId.match(/^[A-Z0-9]+$/)) {
    console.error(`[SLACK-FILES] Invalid file ID received: ${fileId}`);
    return res.status(400).send('Invalid file ID');
  }
  next();
};

// Get file info from Slack
const getFileInfo = async (fileId) => {
  try {
    console.log(`[SLACK-FILES] Attempting to fetch file info for: ${fileId}`);
    console.log(`[SLACK-FILES] Using token: ${SLACK_TOKEN ? 'Token present' : 'Token missing'}`);
    
    const response = await axios({
      method: 'GET',
      url: `https://slack.com/api/files.info?file=${fileId}`,
      headers: {
        'Authorization': `Bearer ${SLACK_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[SLACK-FILES] Slack API response status: ${response.status}`);
    console.log(`[SLACK-FILES] Slack API response data:`, {
      ok: response.data.ok,
      error: response.data.error,
      hasFile: !!response.data.file
    });

    if (!response.data.ok) {
      const errorMsg = `Slack API error: ${response.data.error}`;
      console.error(`[SLACK-FILES] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`[SLACK-FILES] Successfully fetched file info for: ${fileId}`);
    return response.data.file;
  } catch (error) {
    console.error(`[SLACK-FILES] Error fetching file info from Slack for fileId ${fileId}:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });
    throw error;
  }
};

// Proxy for file content
router.get('/content/:fileId', validateFileId, async (req, res) => {
  const fileId = req.params.fileId;
  
  try {
    console.log(`[SLACK-FILES] Content request for file: ${fileId}`);
    
    // Check if we have a valid token first
    if (!SLACK_TOKEN) {
      console.error('[SLACK-FILES] Cannot fetch file - no Slack token configured');
      return res.status(500).send('Server configuration error - no Slack token');
    }
    
    // Check cache first
    if (fileCache.has(fileId)) {
      const cachedFile = fileCache.get(fileId);
      // If cache is still valid
      if (Date.now() - cachedFile.timestamp < CACHE_DURATION) {
        console.log(`[SLACK-FILES] Using cached URL for file: ${fileId}`);
        return res.redirect(cachedFile.url);
      }
      // Otherwise remove from cache
      fileCache.delete(fileId);
      console.log(`[SLACK-FILES] Cache expired for file: ${fileId}`);
    }
    
    // Get file info from Slack
    const fileInfo = await getFileInfo(fileId);
    
    if (!fileInfo || !fileInfo.url_private) {
      console.error(`[SLACK-FILES] File info missing or no private URL for file: ${fileId}`);
      return res.status(404).send('File not found or not accessible');
    }
    
    // Store in cache
    fileCache.set(fileId, {
      url: fileInfo.url_private,
      timestamp: Date.now()
    });
    
    console.log(`[SLACK-FILES] Fetching file content from Slack for: ${fileId}`);
    
    // Fetch the file from Slack and pipe it to the response
    const response = await axios({
      method: 'GET',
      url: fileInfo.url_private,
      headers: {
        'Authorization': `Bearer ${SLACK_TOKEN}`
      },
      responseType: 'stream'
    });
    
    // Set appropriate content type
    res.set('Content-Type', fileInfo.mimetype || 'application/octet-stream');
    
    console.log(`[SLACK-FILES] Successfully serving file content for: ${fileId}`);
    
    // Pipe the file stream to the response
    response.data.pipe(res);
  } catch (error) {
    console.error(`[SLACK-FILES] Error proxying file content for ${fileId}:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    
    if (error.response?.status === 403) {
      res.status(403).send('Access denied - check bot permissions');
    } else if (error.response?.status === 404) {
      res.status(404).send('File not found');
    } else {
      res.status(500).send('Error fetching file');
    }
  }
});

// Get thumbnail for a file using Slack's built-in thumbnails
router.get('/thumbnail/:fileId', validateFileId, async (req, res) => {
  const fileId = req.params.fileId;
  const requestedSize = req.query.size || '480'; // Default to 480px thumbnail
  
  try {
    console.log(`[SLACK-FILES] Thumbnail request for file: ${fileId}, size: ${requestedSize}`);
    
    // Check if we have a valid token first
    if (!SLACK_TOKEN) {
      console.error('[SLACK-FILES] Cannot fetch thumbnail - no Slack token configured');
      return res.status(500).send('Server configuration error - no Slack token');
    }
    
    // Get file info from Slack
    const fileInfo = await getFileInfo(fileId);
    
    if (!fileInfo) {
      console.error(`[SLACK-FILES] No file info returned for thumbnail: ${fileId}`);
      return res.status(404).send('File not found');
    }
    
    // Determine which thumbnail to use based on requested size
    // Slack provides thumbnails at various sizes (80, 160, 360, 480, 800, etc.)
    // We'll select the most appropriate one based on the requested size
    let thumbUrl = null;
    
    // Available thumbnail sizes in Slack (from smallest to largest)
    const availableSizes = [80, 160, 360, 480, 800, 1024];
    
    // Find the smallest thumbnail that is at least as large as the requested size
    const requestedSizeNum = parseInt(requestedSize, 10);
    for (const size of availableSizes) {
      const thumbKey = `thumb_${size}`;
      if (fileInfo[thumbKey] && size >= requestedSizeNum) {
        thumbUrl = fileInfo[thumbKey];
        console.log(`[SLACK-FILES] Using thumbnail size ${size} for file: ${fileId}`);
        break;
      }
    }
    
    // If no suitable thumbnail found, use the largest available or fall back to the original
    if (!thumbUrl) {
      for (let i = availableSizes.length - 1; i >= 0; i--) {
        const thumbKey = `thumb_${availableSizes[i]}`;
        if (fileInfo[thumbKey]) {
          thumbUrl = fileInfo[thumbKey];
          console.log(`[SLACK-FILES] Using largest available thumbnail size ${availableSizes[i]} for file: ${fileId}`);
          break;
        }
      }
    }
    
    // If still no thumbnail, use the original file
    if (!thumbUrl) {
      thumbUrl = fileInfo.url_private;
      console.log(`[SLACK-FILES] No thumbnails available, using original file for: ${fileId}`);
    }
    
    if (!thumbUrl) {
      console.error(`[SLACK-FILES] No URL available for thumbnail: ${fileId}`);
      return res.status(404).send('Thumbnail not available');
    }
    
    console.log(`[SLACK-FILES] Fetching thumbnail from Slack for: ${fileId}`);
    
    // Fetch the thumbnail from Slack and pipe it to the response
    const response = await axios({
      method: 'GET',
      url: thumbUrl,
      headers: {
        'Authorization': `Bearer ${SLACK_TOKEN}`
      },
      responseType: 'stream'
    });
    
    // Set appropriate content type
    res.set('Content-Type', fileInfo.mimetype || 'image/jpeg');
    
    // Add cache control headers
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    console.log(`[SLACK-FILES] Successfully serving thumbnail for: ${fileId}`);
    
    // Pipe the thumbnail stream to the response
    response.data.pipe(res);
  } catch (error) {
    console.error(`[SLACK-FILES] Error proxying thumbnail for ${fileId}:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    
    if (error.response?.status === 403) {
      res.status(403).send('Access denied - check bot permissions');
    } else if (error.response?.status === 404) {
      res.status(404).send('Thumbnail not found');
    } else {
      res.status(500).send('Error fetching thumbnail');
    }
  }
});

module.exports = router; 