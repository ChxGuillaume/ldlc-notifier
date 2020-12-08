require('dotenv').config()

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {Telegraf, Telegram} = require('telegraf');

const checker = require('./checker/checker');

class TelegramBot {
    static __chat_ids_file = path.resolve(__dirname, 'data/chat_ids.json');
    static __notification_filters_file = path.resolve(__dirname, 'data/chat_filters.json');

    bot_listener = new Telegraf(process.env.TELEGRAM_TOKEN);
    bot = new Telegram(process.env.TELEGRAM_TOKEN);
    chats = [];
    chats_unsubscribe = {};

    constructor() {
        fs.access(TelegramBot.__chat_ids_file, fs.constants.F_OK, (err) => {
            if (err) this.saveData();
            else this.chats = JSON.parse(fs.readFileSync(TelegramBot.__chat_ids_file, {encoding: 'utf-8'}));
        });

        fs.access(TelegramBot.__notification_filters_file, fs.constants.F_OK, (err) => {
            if (err) this.saveData();
            else this.chats_unsubscribe = JSON.parse(fs.readFileSync(TelegramBot.__notification_filters_file, {encoding: 'utf-8'}));
        });

        this.initBot();

        checker.addEventsCallback((product) => {
            console.log('notification sent!')
            this.broadcastProductUpdate(product);
        });
    }

    initBot() {
        this.bot.setMyCommands([
            {
                command: 'get_stocks',
                description: 'Get Stocks of All Products'
            },
            {
                command: 'unsubscribe',
                description: 'Unsubscribe to Products List'
            },
            {
                command: 'subscribe',
                description: 'Subscribe to Products List'
            },
        ]).then();

        this.bot_listener.start((ctx) => {
            this.addChatID(ctx.from.id);

            const sender_name = ctx.from.first_name;
            ctx.reply(`Hello ${sender_name},\n\nWelcome to our Tech Products Notifier.\nWe are currently checking for stocks of products on \n- http://www.ldlc.com\n- https://www.caseking.de/`).then();
        });

        this.bot_listener.help((ctx) => ctx.reply('Send me a sticker'));

        this.bot_listener.on('callback_query', (context) => {
            const {reply, answerCbQuery, from: {id: chatId}, update: {callback_query}} = context;

            this.bot.deleteMessage(chatId, callback_query.message.message_id).then();
            answerCbQuery().then();

            if (callback_query.data.includes('product_')) this.sendProductsStocks(callback_query.data, chatId);
            else if (callback_query.data.includes('unsubscribe_')) this.unsubscribeProductsList(chatId, callback_query.data, reply);
            else if (callback_query.data.includes('subscribe_')) this.subscribeProductsList(chatId, callback_query.data, reply);
        });

        this.bot_listener.command('get_stocks', ({reply}) => {
            reply('What Product are you interested in ?', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '3090',
                                callback_data: 'product_3090'
                            },
                            {
                                text: '3080',
                                callback_data: 'product_3080'
                            },
                            {
                                text: 'zen3',
                                callback_data: 'product_zen3'
                            },
                        ]
                    ]
                }
            }).then()
        });

        this.bot_listener.command('unsubscribe', ({from: {id: chatID}, reply}) => {
            const keyboard_options = [
                {
                    text: '3090',
                    callback_data: 'unsubscribe_3090'
                },
                {
                    text: '3080',
                    callback_data: 'unsubscribe_3080'
                },
                {
                    text: 'zen3',
                    callback_data: 'unsubscribe_zen3'
                },
            ].filter(e => !this.chats_unsubscribe[chatID] || !this.chats_unsubscribe[chatID].includes(e.callback_data));

            if (keyboard_options.length) {
                reply('From what Products List would you like to Unsubscribe ?', {
                    reply_markup: {
                        inline_keyboard: [keyboard_options]
                    }
                }).then()
            } else {
                reply(`You're unsubscribed from all Lists.`);
            }
        });

        this.bot_listener.command('subscribe', ({from: {id: chatID}, reply}) => {
            const keyboard_options = [
                {
                    text: '3090',
                    callback_data: 'subscribe_3090',
                    unsubscribe_data: 'unsubscribe_3090'
                },
                {
                    text: '3080',
                    callback_data: 'subscribe_3080',
                    unsubscribe_data: 'unsubscribe_3080'
                },
                {
                    text: 'zen3',
                    callback_data: 'subscribe_zen3',
                    unsubscribe_data: 'unsubscribe_zen3'
                },
            ].filter(e => !this.chats_unsubscribe[chatID] || this.chats_unsubscribe[chatID].includes(e.unsubscribe_data));

            if (keyboard_options.length) {
                reply('From what Products List would you like to Subscribe ?', {
                    reply_markup: {
                        inline_keyboard: [keyboard_options]
                    }
                }).then()
            } else {
                reply(`You're subscribed to all Lists.`);
            }
        });

        this.bot_listener.launch().then();
    }

    sendProductsStocks(products_value, chat_id) {
        const products = checker.getProducts().filter(e => {
            switch (products_value) {
                case 'product_3090':
                    return e.product_type === '3090';
                case 'product_3080':
                    return e.product_type === '3080';
                case 'product_zen3':
                    return e.product_type === 'zen3';
                default:
                    return true;
            }
        });

        for (const product of products) {
            this.sendProductUpdate(chat_id, product, true);
        }
    }

    unsubscribeProductsList(chat_id, callback_data, reply) {
        if (!this.chats_unsubscribe[chat_id]) this.chats_unsubscribe[chat_id] = [];
        if (!this.chats_unsubscribe[chat_id].includes(callback_data)) this.chats_unsubscribe[chat_id].push(callback_data);

        this.saveData();
        reply(`You've successfully been unsubscribed form the list: ${callback_data.replace('unsubscribe_', '')}`);
    }

    subscribeProductsList(chat_id, callback_data, reply) {
        if (!this.chats_unsubscribe[chat_id]) this.chats_unsubscribe[chat_id] = [];
        if (this.chats_unsubscribe[chat_id].includes(`un${callback_data}`))
            this.chats_unsubscribe[chat_id].splice(this.chats_unsubscribe[chat_id].indexOf(`un${callback_data}`), 1);

        this.saveData();
        reply(`You've successfully been subscribed to the list: ${callback_data.replace('subscribe_', '')}`);
    }

    sendProductUpdate(chat_id, product, no_filter = false) {
        let unsubscribe_check = '';
        if (!no_filter) {
            if (product.product_name.includes('3090')) unsubscribe_check = 'unsubscribe_3090';
            else if (product.product_name.includes('3080')) unsubscribe_check = 'unsubscribe_3080';
            else if (product.product_name.includes('AMD')) unsubscribe_check = 'unsubscribe_zen3';
        }

        if ((!this.chats_unsubscribe[chat_id] || !this.chats_unsubscribe[chat_id].includes(unsubscribe_check)) && product.in_stock) {
            this.bot.sendMessage(
                chat_id,
                `[${product.product_name} (${product.shop})](${product.product_link})`
                + `\nStatus: ${product.stock_raw}    -    Price: ${product.product_price}€`, {
                    disable_web_page_preview: true,
                    parse_mode: 'markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Product Page',
                                    url: product.product_link
                                },
                            ]
                        ]
                    }
                }).then();
        }
    }

    broadcastProductUpdate(product) {
        for (const id of this.chats) {
            this.sendProductUpdate(id, product);
        }
    }

    saveData() {
        fs.writeFileSync(TelegramBot.__chat_ids_file, JSON.stringify(this.chats));
        fs.writeFileSync(TelegramBot.__notification_filters_file, JSON.stringify(this.chats_unsubscribe));
    }

    addChatID(id) {
        if (!this.chats.includes(id)) {
            this.chats.push(id);
            this.saveData();
        }
    }
}

module.exports = new TelegramBot();