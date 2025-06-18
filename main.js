const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = 3000;

let markets = [
    "netherite_ingot",
    "ancient_debris",
    "diamond_block",
    "diamond"
];

let price_history = {};
let buy_history = {};

for (const item of markets) {
    price_history[item] = [];
    buy_history[item] = [];
}

app.use(express.static('public'));

async function fetchAuctionList(item) {
    const url = 'https://api.donutsmp.net/v1/auction/list/1';
    const headers = {
        'accept': 'application/json',
        'Authorization': '56233abbc11a4404b4ab2967299bba6a',
        'Content-Type': 'application/json'
    };

    const body = JSON.stringify({
        search: item,
        sort: 'lowest_price'
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

async function getCurrentBestOffer(item) {
    const response = await fetchAuctionList(item);
    if (!response || !response.result) return null;

    const match = response.result.find(entry =>
        entry.item?.id === 'minecraft:' + item && entry.item?.count === 1
    );

    return match?.price ?? null;
}

async function fetchRecentAuctionData(page) {
    const url = `https://api.donutsmp.net/v1/auction/transactions/${page}`;
    const headers = {
        'accept': 'application/json',
        'Authorization': '56233abbc11a4404b4ab2967299bba6a'
    };

    try {
        const response = await fetch(url, { method: 'GET', headers });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

async function updateRecentBuys(item) {
    const response = await fetchRecentAuctionData(1);
    if (!response || !response.result) return;

    for (const entry of response.result) {
        if (
            entry.item?.id === 'minecraft:' + item &&
            entry.item?.count === 1 &&
            entry.unixMillisDateSold &&
            entry.price
        ) {
            const exists = buy_history[item].some(b => b.time === entry.unixMillisDateSold);
            if (!exists) {
                buy_history[item].push({
                    price: entry.price,
                    time: entry.unixMillisDateSold
                });
            }
        }
    }
}

setInterval(async () => {
    try {
        for (const market of markets) {
            const price = await getCurrentBestOffer(market);
            if (price !== null) {
                price_history[market].push({ price, time: Date.now() });
                console.log(`Logged best price for ${market}: $${price}`);
            }
        }
    } catch (e) {
        console.error('Error updating best offer:', e);
    }
}, 2000);

setInterval(async () => {
    try {
        for (const market of markets) {
            await updateRecentBuys(market);
            console.log(`Updated buy_history with recent ${market} purchases`);
        }
    } catch (e) {
        console.error('Error updating recent buys:', e);
    }
}, 2000);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/data/:item', (req, res) => {
    const item = req.params.item;
    if (!price_history[item]) return res.status(404).json({ error: 'Invalid item' });
    res.json(price_history[item]);
});

app.get('/recent/:item', (req, res) => {
    const item = req.params.item;
    if (!buy_history[item]) return res.status(404).json({ error: 'Invalid item' });
    res.json(buy_history[item]);
});

app.get('/markets', (req, res) => {
    res.json(markets);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
