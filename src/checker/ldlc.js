const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const CronJob = require('cron').CronJob;
const {JSDOM} = require('jsdom');
const EventType = require('./event_type');

/** Stocks Details
 * 9: Out of Stock
 * 6: +15 days
 * 5: 7/15 days
 * 4: -7 days
 * 2: In Stock
 * 1: In Stock
 **/

class LDLCChecker {
    static __datafile = path.resolve(__dirname, 'data/ldlc-products.json');

    stocks = {};
    callbacks = [];

    constructor() {
        fs.access(LDLCChecker.__datafile, fs.constants.F_OK, (err) => {
            if (err) this.saveData();
            else this.stocks = JSON.parse(fs.readFileSync(LDLCChecker.__datafile, {encoding: 'utf-8'}).toString());
        });

        this.initFetch();
    }

    initFetch() {
        this.job = new CronJob('0 0/15 * * * *', () => {
            this.fetchPages()
        }, null, true, 'Europe/Paris');
        this.fetchPages();
    }

    fetchPages() {
        // 3090 cards
        this.fetchPage('https://www.ldlc.com/informatique/pieces-informatique/carte-graphique-interne/c4684/+fb-C000000806,C000000990,C000000992,C000033842+fv121-19185.html', '3090');
        // 3080 cards
        this.fetchPage('https://www.ldlc.com/informatique/pieces-informatique/carte-graphique-interne/c4684/+fb-C000000806,C000000990,C000000992,C000033842+fv121-19183.html', '3080');
        // AMD zen3 processors
        this.fetchPage('https://www.ldlc.com/informatique/pieces-informatique/processeur/c4300/+fb-C000000805+fv1448-19308+fv160-15394.html', 'zen3');
    }

    fetchPage(url, product_type) {
        axios
            .get(url)
            .then(({data}) => {
                this.parsePage(data, product_type);
            });
    }

    parsePage(data, product_type) {
        const {document} = (new JSDOM(data)).window;

        document.querySelector('header').remove();

        const id_regex = /#pdt-[A-z0-9]*/gm;
        const stocks_regex = /\$\(".*<div class="modal-stock-web.*<\/div>.*\);/gm;
        const price_regex = /\$\(".*<div class="price.*<\/div>.*\);/gm;
        const stock_regex = /data-stock-web="([0-9])"/gm

        const stocks_matchs = document.body.innerHTML.match(stocks_regex);
        const prices_matches = document.body.innerHTML.match(price_regex);

        for (const match of stocks_matchs) {
            const product_id = match.match(id_regex)[0];
            const product_title_element = document.querySelector(product_id).querySelector('.title-3').querySelector('a');
            const product_link = product_title_element.href;
            const product_name = product_title_element.innerHTML.replace(/ +(?= )|\n/g, '');
            const product_price = parseFloat(prices_matches.find(e => e.includes(product_id)).match(/[0-9]*€<sup>[0-9]*<\/sup>/g)[0].replace(/€<sup>|<\/sup>/g, '.'));

            const stock_status = Array.from(match.matchAll(stock_regex))[0][1];
            let stock_raw = `Unknown (${stock_status})`;
            let stock_text = `Unknown (${stock_status})`.black;

            switch (stock_status) {
                case '1':
                case '2':
                    stock_raw = 'In Stock';
                    stock_text = 'In Stock'.green;
                    break;
                case '3':
                case '4':
                    stock_raw = 'Within 7 days';
                    stock_text = 'Within 7 days'.yellow;
                    break;
                case '5':
                    stock_raw = 'From 7 to 15 days';
                    stock_text = 'From 7 to 15 days'.cyan;
                    break;
                case '6':
                    stock_raw = 'More than 15 days';
                    stock_text = 'More than 15 days'.blue;
                    break;
                case '9':
                    stock_raw = 'Out of Stock';
                    stock_text = 'Out of Stock'.red;
                    break;
            }

            const product_object = {
                shop: 'LDLC',
                product_type,
                product_name,
                product_price,
                product_link: `https://www.ldlc.com${product_link}`,
                stock_status,
                stock_raw,
                stock_text,
                in_stock: stock_status !== '9'
            };

            if (this.stocks[product_id]) {
                if (stock_status !== this.stocks[product_id].stock_status) {
                    this.callbacks.forEach(callback => callback(product_object, EventType.STOCK_CHANGE));

                    console.log(product_name.cyan);
                    console.log('stock status:'.gray, stock_text, 'price:'.gray, `${product_price}€`);
                }
            }

            this.stocks[product_id] = product_object;
        }

        this.saveData();
    }

    addEventsCallback(callback) {
        this.callbacks.push(callback);
    }

    getProducts() {
        return Object.values(this.stocks);
    }

    saveData() {
        fs.writeFileSync(LDLCChecker.__datafile, JSON.stringify(this.stocks));
    }
}

module.exports = new LDLCChecker();
