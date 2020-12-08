const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const CronJob = require('cron').CronJob;
const {JSDOM} = require("jsdom");

/** Stocks Details
 * 0: On Order
 * 2: In Stock
 * 4: Out of Stock
 **/

const html_test = fs.readFileSync(path.resolve(__dirname, 'test/caseking.html'), { encoding: 'utf-8' })

class CaseKingChecker {
    static __datafile = path.resolve(__dirname, 'data/caseking-products.json');

    stocks = {};
    callbacks = [];

    constructor() {
        fs.access(CaseKingChecker.__datafile, fs.constants.F_OK, (err) => {
            if (err) this.saveData();
            else this.stocks = JSON.parse(fs.readFileSync(CaseKingChecker.__datafile, { encoding: 'utf-8' }).toString());

            this.initFetch();
        });
    }

    initFetch() {
        this.job = new CronJob('0 0/15 * * * *', () => { this.fetchPages() }, null, true, 'Europe/Paris');
        this.fetchPages();
    }

    fetchPages() {
        // 3090 cards
        this.fetchPage('https://www.caseking.de/en/pc-components/graphics-cards/nvidia?ckSuppliers=39-123-64&ckFilters=13916&ckTab=0&sPage=1&sPerPage=48', '3090');
        // 3080 cards
        this.fetchPage('https://www.caseking.de/en/pc-components/graphics-cards/nvidia?ckSuppliers=39-12-64-123&ckFilters=13915&ckTab=0&sSort=103', '3080');
        // AMD zen3 processors
        this.fetchPage('https://www.caseking.de/en/pc-components/cpus-processors/amd-processors?ckFilters=14150&ckTab=0&sSort=103', 'zen3');
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

        const products = document.querySelectorAll('.artbox')
        for (const product of products) {
            const product_id = product.querySelector('.producttitles').dataset.id;
            const product_link = product.querySelector('.producttitles').href;
            const product_name = product.querySelector('.ProductTitle').innerHTML.trim();
            const product_price = parseFloat(product.querySelector('span.price').innerHTML.trim().replace(/[*€,]*/g, ''));

            const stock_status = [...product.querySelector('[class*=status]').classList].find(e => e.match(/status/g)).replace('status', '');
            let stock_raw = `Unknown (${stock_status})`;
            let stock_text = `Unknown (${stock_status})`.black;

            switch (stock_status) {
                case '0':
                    stock_raw = 'On Order';
                    stock_text = 'On Order'.blue;
                    break;
                case '2':
                    stock_raw = 'In Stock';
                    stock_text = 'In Stock'.green;
                    break;
                case '4':
                    stock_raw = 'Out of Stock';
                    stock_text = 'Out of Stock'.red;
                    break;
            }

            const product_object = {
                shop: 'CaseKing',
                product_type,
                product_name,
                product_price,
                product_link: `${product_link}`,
                stock_status,
                stock_raw,
                stock_text,
                in_stock: stock_status !== '4'
            };

            if (this.stocks[product_id]) {
                if (stock_status !== this.stocks[product_id].stock_status) {
                    this.callbacks.forEach(callback => callback(product_object));

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

    getProducts () {
        return Object.values(this.stocks);
    }

    saveData() {
        fs.writeFileSync(CaseKingChecker.__datafile, JSON.stringify(this.stocks));
    }
}

module.exports = new CaseKingChecker();