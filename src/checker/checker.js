const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const CronJob = require('cron').CronJob;
const {JSDOM} = require("jsdom");

/** Stocks Details
 * 9: Out of Stock
 * 6: +15 days
 * 5: 7/15 days
 * 4: -7 days
 * 2: In Stock
 * 1: In Stock
 * **/

class Checker {
    stocks = {};
    callbacks = [];

    constructor() {
        this.stocks = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'data.json'), { encoding: 'utf-8' }));

        this.initFetch();
    }

    initFetch() {
        this.job = new CronJob('0 0/15 * * * *', () => { this.fetchPages() }, null, true, 'Europe/Paris');
        this.fetchPages();
    }

    fetchPages() {
        this.fetchPage('https://www.ldlc.com/informatique/pieces-informatique/carte-graphique-interne/c4684/+fb-C000000806,C000000990,C000000992,C000033842+fv121-19183.html');
        this.fetchPage('https://www.ldlc.com/informatique/pieces-informatique/carte-graphique-interne/c4684/+fb-C000000806,C000000990,C000000992,C000033842+fv121-19185.html');
        this.fetchPage('https://www.ldlc.com/informatique/pieces-informatique/processeur/c4300/+fb-C000000805+fv1448-19308+fv160-15394.html');
    }

    fetchPage(url) {
        axios
            .get(url)
            .then(({data}) => {
                this.parsePage(data);
            });
    }

    parsePage(data) {
        const {document} = (new JSDOM(data)).window;

        document.querySelector('header').remove();

        const regex = /\$\(".*<div class="modal-stock-web.*<\/div>.*\);/gm;
        const id_regex = /#pdt-[A-z0-9]*/gm;
        const stock_regex = /data-stock-web="([0-9])"/gm

        const matches = document.body.innerHTML.match(regex);

        for (const match of matches) {
            const product_id = match.match(id_regex)[0];
            const product_title_element = document.querySelector(product_id).querySelector('.title-3').querySelector('a');
            const product_link = product_title_element.href;
            const product_name = product_title_element.innerHTML.replace(/ +(?= )|\n/g, '');

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
                product_name,
                product_link: `https://www.ldlc.com${product_link}`,
                stock_status,
                stock_raw,
                stock_text
            };

            if (!this.stocks[product_id] || stock_status !== this.stocks[product_id].stock_status) {
                this.callbacks.forEach(callback => callback(product_object));

                console.log(product_name.yellow, 'stock status:'.gray, stock_text);
                console.log(`https://www.ldlc.com${product_link}`);
            }

            this.stocks[product_id] = product_object;
        }

        fs.writeFileSync(path.resolve(__dirname, 'data.json'), JSON.stringify(this.stocks));
    }

    addEventsCallback(callback) {
        this.callbacks.push(callback);
    }
}

module.exports = new Checker();
