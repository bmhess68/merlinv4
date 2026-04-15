require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const slackToken = process.env.SLACK_BOT_TOKEN;
const slackClient = new WebClient(slackToken);

// Function to send the report via Slack DM to multiple users
const sendReportViaSlack = async (userIds, reportBlocks) => {
    try {
        for (const userId of userIds) {
            console.log(`Attempting to send DM to user with ID: ${userId}`);
            // Open a direct message channel with the user
            const imResponse = await slackClient.conversations.open({ users: userId });

            if (!imResponse.ok || !imResponse.channel || !imResponse.channel.id) {
                throw new Error(`Failed to open DM channel with user ID ${userId}`);
            }

            const channel = imResponse.channel.id;

            const messageResponse = await slackClient.chat.postMessage({
                channel,
                blocks: reportBlocks,
                text: 'Incident Report'
            });

            if (!messageResponse.ok) {
                throw new Error(`Failed to send Slack DM to user with ID ${userId}`);
            }

            console.log(`Report successfully sent to user with ID ${userId} via Slack DM.`);
        }
    } catch (error) {
        console.error('Error sending report via Slack DM:', error.message);
    }
};

module.exports = { sendReportViaSlack };
