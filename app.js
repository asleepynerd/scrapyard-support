require('dotenv').config();
const { App } = require('@slack/bolt');
const fs = require('fs');
const path = require('path');


const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});


const STORAGE_PATH = path.join(__dirname, 'data', 'user_interactions.json');


if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}


let userInteractions = new Set();
try {
  const data = fs.readFileSync(STORAGE_PATH, 'utf8');
  userInteractions = new Set(JSON.parse(data));
  console.log(`Loaded ${userInteractions.size} user interactions from storage`);
} catch (error) {
  console.log('No existing user interactions found, starting fresh');
  fs.writeFileSync(STORAGE_PATH, '[]');
}


function saveUserInteractions() {
  const data = JSON.stringify(Array.from(userInteractions));
  fs.writeFileSync(STORAGE_PATH, data);
  console.log(`Saved ${userInteractions.size} user interactions to storage`);
}

const WELCOME_MESSAGE = `Hello! 👋 Welcome to Scrapyard Support! 

I'm here to help you with any questions about Scrapyard!

Need help? The team usually responds within a few minutes to a few hours.

Want some extra simple guides? Check out our <https://scrapyard-deployment-guide.super.site/|Hackathon Guides>

_React with ✅ to mark your question as solved when you're done!_`;


app.event('reaction_added', async ({ event, client }) => {
  try {

    if (event.reaction !== 'white_check_mark' && event.reaction !== 'heavy_check_mark') return;


    const threadResult = await client.conversations.history({
      channel: event.item.channel,
      latest: event.item.thread_ts || event.item.ts,
      inclusive: true,
      limit: 1
    });

    const originalMessage = threadResult.messages[0];
    

    const result = await client.conversations.history({
      channel: event.item.channel,
      latest: event.item.ts,
      inclusive: true,
      limit: 1
    });

    const botMessage = result.messages[0];
    

    if (!botMessage || botMessage.bot_id !== client.botId) return;


    if (botMessage.text.includes('✅ *Marked as solved*')) return;


    if (event.user !== originalMessage.user) {

      try {
        await client.reactions.remove({
          channel: event.item.channel,
          timestamp: event.item.ts,
          name: event.reaction
        });
      } catch (removeError) {
        console.log('Could not remove reaction:', removeError);
      }
      return;
    }

    await client.chat.update({
      channel: event.item.channel,
      ts: event.item.ts,
      text: WELCOME_MESSAGE + "\n\n✅ *Marked as solved by <@" + event.user + ">*",
      as_user: true
    });

  } catch (error) {
    console.error('Error handling reaction:', error);
  }
});

app.event('message', async ({ event, client }) => {
  try {
      if (event.channel !== process.env.SLACK_CHANNEL_ID) return;
      

    

    if (!event.user || !event.text || event.type !== 'message') return;

    
    if (event.thread_ts) return;

    if (!userInteractions.has(event.user)) {
      userInteractions.add(event.user);
      saveUserInteractions();
      
      await client.chat.postMessage({
        channel: event.channel,
        text: WELCOME_MESSAGE,
        thread_ts: event.ts
      });
    }
  } catch (error) {
    console.error('Error processing message:', error);
    if (!event.thread_ts) {
      await client.chat.postMessage({
        channel: event.channel,
        text: "I'm having trouble processing your request. A human will help you soon!",
        thread_ts: event.ts
      });
    }
  }
});


app.error(async (error) => {
  console.error('An error occurred:', error);
});


process.on('SIGINT', () => {
  console.log('Saving user interactions before exit...');
  saveUserInteractions();
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('Saving user interactions before exit...');
  saveUserInteractions();
  process.exit();
});


(async () => {
  try {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Scrapyard Support Bot is running!');
  } catch (error) {
    console.error('Failed to start app:', error);
  }
})(); 