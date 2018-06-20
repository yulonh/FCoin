/**
 * Created by yulonh on 2018/6/13.
 */
const FCoin = require('../lib/fcoin');
const fcoin = new FCoin('<your API key>', '<your API screct>');
const args = process.argv.splice(2);

(async () => {
    const startDate = new Date(args[0]), endDate = args[1] ? new Date(args[1]) : new Date();
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    console.log(`统计时间段： ${startDate.toLocaleString()} ~ ${endDate.toLocaleString()}`);

    const data = {};
    const symbols = await fcoin.symbols();

    for ({name: symbol} of symbols) {
        data[symbol] = {
            sell: {
                amount: 0,
                money: 0,
                fees: 0,
                avgPrice: 0
            },
            buy: {
                amount: 0,
                money: 0,
                fees: 0,
                avgPrice: 0
            }
        };
        let start = startTime;

        while (true) {
            const orders = await fcoin.orders({
                states: ['filled', 'partial_filled', 'partial_canceled'],
                symbol: symbol,
                limit: 100,
                after: start
            });

            if (orders) {
                if (orders.length === 0) {
                    break;
                } else {
                    orders.forEach(({symbol, filled_amount, executed_value, fill_fees, side}) => {
                        const symbolData = data[symbol][side];
                        symbolData.amount += +filled_amount;
                        symbolData.money += +executed_value;
                        symbolData.fees += +fill_fees;
                        symbolData.avgPrice = symbolData.money / symbolData.amount;
                    });
                    start = orders[0].created_at + 1;
                    if (endTime && start >= endTime) {
                        break;
                    }
                    console.log(new Date(start).toLocaleString());
                }
            }
        }
    }
    console.log(data);
})();