// src/routes/slackEvents.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// List of channels to monitor with their proper names
const MONITORED_CHANNELS = {
  'C8TAH7Q8M': 'Stolen Vehicles', // stolen-vehicles
  'C8SLAJK25': 'BOLO',            // bolo
  'C8U8A205D': 'Hotline',         // hotline
  'C08HJ8J5PRM': 'testwebhook'    // testwebhook
};

// Users to monitor with their display names
const MONITORED_USERS = {
  'U8TATF7LM': 'Real Time Crime (RTC)',
  'U8T9E5U7P': 'Real Time Crime (RTC)'  // Added new user with same display name
};

// Function to log webhook activity in a consistent format
const logWebhookActivity = (type, details) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    ...details
  };
  
  console.log(`[SLACK-WEBHOOK] ${type.toUpperCase()} - ${timestamp}:`, logEntry);
  
  // Optionally, you could also write to a dedicated log file or database
};

// Middleware to verify Slack requests
const verifySlackRequest = (req, res, next) => {
  try {
    // Check if we should skip verification for development or testing
    if (process.env.SKIP_SLACK_VERIFICATION === 'true') {
      logWebhookActivity('verification', {
        status: 'skipped',
        reason: 'SKIP_SLACK_VERIFICATION environment variable set to true'
      });
      return next();
    }
    
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    if (!slackSigningSecret) {
      logWebhookActivity('error', {
        error: 'configuration',
        message: 'SLACK_SIGNING_SECRET is not defined in environment variables' 
      });
      return res.status(500).send('Server configuration error');
    }
    
    const slackSignature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    
    if (!slackSignature || !timestamp) {
      logWebhookActivity('verification', {
        status: 'failed',
        reason: 'Missing required headers',
        headers: {
          signature: slackSignature ? 'present' : 'missing',
          timestamp: timestamp ? 'present' : 'missing'
        }
      });
      return res.status(400).send('Missing required headers');
    }
    
    // Guard against replay attacks (requests older than 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > 300) {
      logWebhookActivity('verification', {
        status: 'failed',
        reason: 'Timestamp too old',
        timestamp,
        currentTime
      });
      return res.status(400).send('Timestamp too old');
    }
    
    // Create the signature base string
    const sigBasestring = `v0:${timestamp}:${JSON.stringify(req.body)}`;
    
    // Create our own signature
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', slackSigningSecret)
      .update(sigBasestring)
      .digest('hex');
    
    // Safe comparison to avoid timing attacks
    try {
      // Ensure the buffers are the same length for timingSafeEqual
      if (mySignature.length !== slackSignature.length) {
        logWebhookActivity('verification', {
          status: 'failed',
          reason: 'Signature length mismatch',
          expected: mySignature.length,
          received: slackSignature.length
        });
        return res.status(401).send('Invalid signature');
      }
      
      if (crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature))) {
        logWebhookActivity('verification', { status: 'success' });
        next();
      } else {
        logWebhookActivity('verification', {
          status: 'failed',
          reason: 'Signature mismatch'
        });
        return res.status(401).send('Invalid signature');
      }
    } catch (error) {
      logWebhookActivity('error', {
        error: 'verification',
        message: error.message,
        stack: error.stack
      });
      return res.status(500).send('Error verifying request');
    }
  } catch (error) {
    logWebhookActivity('error', {
      error: 'verification',
      message: error.message,
      stack: error.stack
    });
    return res.status(500).send('Internal server error');
  }
};

// Helper function to check if message only contains file/image
const isOnlyFileOrImage = (event) => {
  // Check if message has files and no meaningful text
  return (
    event.files && 
    (!event.text || event.text.trim() === '' || event.text.includes('uploaded a file:'))
  );
};

// Helper function to extract image information from files
const extractImageInfo = (files) => {
  if (!files || !Array.isArray(files)) return [];
  
  return files
    .filter(file => {
      // Filter for image types
      return file.mimetype && file.mimetype.startsWith('image/');
    })
    .map(file => {
      // Extract relevant image information
      return {
        id: file.id,
        // Include both our proxy URL and direct Slack URLs
        url: `/slack/files/content/${file.id}`,
        thumbUrl: `/slack/files/thumbnail/${file.id}?size=480`,
        // Add direct Slack URLs as fallbacks
        directUrl: file.url_private,
        directThumbUrl: file.thumb_480 || file.thumb_360 || file.thumb_160 || file.url_private,
        name: file.name,
        mimetype: file.mimetype,
        size: file.size,
        dimensions: file.original_w && file.original_h ? {
          width: file.original_w,
          height: file.original_h
        } : null
      };
    });
};

// Helper function to format and limit text
const formatNotificationText = (text) => {
  // Limit text length to 150 characters for the preview
  const MAX_LENGTH = 150;
  
  // Keep the original text for the "See Full Message" option
  const originalText = text;
  
  // For the preview, just truncate if it's too long
  let formattedText = text;
  if (formattedText.length > MAX_LENGTH) {
    formattedText = formattedText.substring(0, MAX_LENGTH) + '...';
  }
  
  return {
    preview: formattedText,
    full: originalText
  };
};

// Handle Slack events
router.post('/events', verifySlackRequest, (req, res) => {
  // BEGIN: Extra logging for debugging
  console.log('[SLACK-WEBHOOK] RAW REQUEST:', {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body
  });
  // END: Extra logging for debugging

  const body = req.body;
  
  logWebhookActivity('received', {
    type: body.type,
    event_type: body.event?.type,
    user: body.event?.user,
    channel: body.event?.channel
  });
  
  // URL verification - this is critical for Slack to verify your endpoint
  if (body.type === 'url_verification') {
    logWebhookActivity('challenge', {
      challenge: body.challenge
    });
    return res.status(200).send(body.challenge);
  }
  
  // Handle event callbacks
  if (body.event && body.event.type === 'message') {
    const event = body.event;
    const channelId = event.channel;
    const text = event.text || '';
    
    // Process message even if it only contains images
    // Instead of skipping, we'll extract image information
    const hasOnlyImages = isOnlyFileOrImage(event);
    const images = event.files ? extractImageInfo(event.files) : [];
    
    logWebhookActivity('message', {
      channel_id: channelId,
      channel_name: MONITORED_CHANNELS[channelId] || 'Unknown Channel',
      user_id: event.user,
      is_monitored_user: !!MONITORED_USERS[event.user],
      is_monitored_channel: Object.keys(MONITORED_CHANNELS).includes(channelId),
      has_only_images: hasOnlyImages,
      image_count: images.length,
      text_length: text.length
    });
    
    // Check if it's from any of the users we want to monitor
    if (MONITORED_USERS[event.user]) {
      logWebhookActivity('processing', {
        user: MONITORED_USERS[event.user],
        action: 'monitored user detected'
      });
      
      // Check if it's from any monitored channel
      if (Object.keys(MONITORED_CHANNELS).includes(channelId)) {
        // Get the proper channel name
        const channelName = MONITORED_CHANNELS[channelId];
        
        // Get the display name for this user
        const displayName = MONITORED_USERS[event.user];
        
        // Format the text to be more readable and limited in length
        const { preview, full } = formatNotificationText(text);
        
        // Standard notification settings
        const notificationType = 'standard';
        const duration = 300000; // 5 minutes (300,000ms)
        
        // Create notification message with enhanced styling
        const notification = {
          text: preview,
          fullText: full,
          user: displayName,
          channelName: channelName,
          timestamp: new Date().toISOString(),
          type: notificationType,
          duration: duration,
          channelId: channelId,
          hasOnlyImages: hasOnlyImages,
          images: images,
          style: {
            backgroundColor: 'rgba(27, 27, 27, 0.9)', // Dark background matching modal
            color: '#FFFFFF',           // White text
            fontSize: '16px',           // Reduced font size
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            border: '1px solid #333'    // Subtle border matching modal
          }
        };
        
        logWebhookActivity('notification', {
          user: displayName,
          channel: channelName,
          text_preview: preview.substring(0, 50) + (preview.length > 50 ? '...' : ''),
          has_images: images.length > 0,
          actions: ['broadcast', 'store']
        });
        
        // Broadcast to all connected clients via Socket.io
        if (global.io) {
          global.io.emit('notification', notification);
          
          // Store in database for users who connect later
          try {
            const pool = require('../db').pool;
            pool.query(
              `INSERT INTO notifications (
                  type, sender, message, timestamp, expires_at
              ) VALUES ($1, $2, $3, $4, $5)`,
              [
                notificationType,
                displayName,
                text,
                new Date(),
                new Date(Date.now() + duration)
              ]
            );
            logWebhookActivity('database', {
              action: 'stored notification',
              status: 'success'
            });
          } catch (dbError) {
            logWebhookActivity('error', {
              error: 'database',
              message: dbError.message,
              stack: dbError.stack
            });
          }
        } else {
          logWebhookActivity('error', {
            error: 'socket',
            message: 'Socket.io instance not available'
          });
        }
      } else {
        logWebhookActivity('skipped', {
          reason: 'non-monitored channel',
          user_id: event.user,
          user: MONITORED_USERS[event.user],
          channel_id: channelId
        });
      }
    } else {
      logWebhookActivity('skipped', {
        reason: 'non-monitored user',
        user_id: event.user
      });
    }
  }

  // Slack requires a quick 200 response
  return res.status(200).send('OK');
});

module.exports = router;