require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const bannedWords = require('./banword');

// Express server setup for Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const bot = new Telegraf(process.env.BOT_TOKEN);

// Function to check if a user is an admin
async function isAdmin(ctx) {
    if (ctx.chat.type === 'private') return true;
    const member = await ctx.getChatMember(ctx.from.id);
    return ['creator', 'administrator'].includes(member.status);
}

// Middleware to detect and delete links or banned words
bot.on('message', async (ctx, next) => {
    if (!ctx.message) return next();

    const text = (ctx.message.text || ctx.message.caption || '').toLowerCase();
    const entities = ctx.message.entities || ctx.message.caption_entities || [];
    const replyMarkup = ctx.message.reply_markup;

    // 1. Check for link entities in text/caption
    let shouldDelete = entities.some(entity => 
        entity.type === 'url' || entity.type === 'text_link'
    );

    // 2. Check for links in inline buttons (inline_keyboard)
    if (!shouldDelete && replyMarkup && replyMarkup.inline_keyboard) {
        shouldDelete = replyMarkup.inline_keyboard.some(row => 
            row.some(button => button.url)
        );
    }

    // 3. Check for banned keywords
    if (!shouldDelete) {
        shouldDelete = bannedWords.some(word => text.includes(word.toLowerCase()));
    }

    // If link or banned word found and sender is NOT an admin
    if (shouldDelete) {
        const userIsAdmin = await isAdmin(ctx);
        
        if (!userIsAdmin) {
            try {
                // Delete the message
                await ctx.deleteMessage();
                
                // Send a warning in Bengali
                const warning = await ctx.reply(`দুঃখিত @${ctx.from.username || ctx.from.first_name}, আপনার মেসেজে নিষিদ্ধ শব্দ বা লিংক পাওয়া গেছে!`);
                
                // Auto-delete the warning after 5 seconds
                setTimeout(() => {
                    ctx.telegram.deleteMessage(ctx.chat.id, warning.message_id).catch(() => {});
                }, 5000);
                
                console.log(`Deleted a message (link or keyword) from ${ctx.from.first_name} (${ctx.from.id})`);
            } catch (error) {
                console.error('Error deleting message:', error.description || error.message);
            }
            return;
        }
    }

    return next();
});

bot.start((ctx) => ctx.reply('আমি আপনার গ্রুপের এন্টি-লিংক বট। আমি গ্রুপে লিংক শেয়ার করা বন্ধ করতে সাহায্য করব।'));

bot.launch().then(() => {
    console.log('Bot is running...');
}).catch((err) => {
    console.error('Failed to launch bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
