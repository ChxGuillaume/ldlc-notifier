class Checker {
    static STOCK_CHANGE = 'stock_change_event';
    static PRICE_CHANGE = 'price_change_event';

    LDLCChecker = require('./ldlc');
    CaseKingChecker = require('./caseking')

    getProducts() {
        return [].concat(this.LDLCChecker.getProducts(), this.CaseKingChecker.getProducts());
    }

    addEventsCallback(callback) {
        this.LDLCChecker.addEventsCallback(callback);
        this.CaseKingChecker.addEventsCallback(callback);
    }

}

module.exports = new Checker();