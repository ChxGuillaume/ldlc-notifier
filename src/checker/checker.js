const CronJob = require('cron').CronJob;

class Checker {
    static STOCK_CHANGE = 'stock_change_event';
    static PRICE_CHANGE = 'price_change_event';

    LDLCChecker = require('./ldlc');
    CaseKingChecker = require('./caseking')

    constructor() {
        this.job = new CronJob('0 0/5 * * * *', () => {
            this.updateCheckers()
        }, null, true, 'Europe/Paris');

        this.updateCheckers()
    }

    updateCheckers() {
        this.LDLCChecker.fetchPages()
        this.CaseKingChecker.fetchPages()
    }

    getProducts() {
        return [].concat(this.LDLCChecker.getProducts(), this.CaseKingChecker.getProducts());
    }

    addEventsCallback(callback) {
        this.LDLCChecker.addEventsCallback(callback);
        this.CaseKingChecker.addEventsCallback(callback);
    }

}

module.exports = new Checker();