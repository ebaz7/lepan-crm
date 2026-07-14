const transactions = [
    { Deb: 441540000, Cred: 0, Desc: 'Doc 113154' },
    { Deb: 54934500, Cred: 0, Desc: 'Doc 113149' },
    { Deb: 200000000, Cred: 0, Desc: 'Doc 113136' },
    { Deb: 256716000, Cred: 0, Desc: 'Doc 113143' },
    { Deb: 96415000, Cred: 0, Desc: 'Doc 113145' },
    { Deb: 0, Cred: 1049605500, Desc: 'Doc 113579' },
    { Deb: 14543840000, Cred: 0, Desc: 'Doc 12058' },
    { Deb: 0, Cred: 7562796800, Desc: 'Doc 4978' },
    { Deb: 0, Cred: 6981043200, Desc: 'Doc 4979' },
    { Deb: 0, Cred: 70000000000, Desc: 'Doc 6155' },
    { Deb: 0, Cred: 700000000, Desc: 'Doc 6572' },
    { Deb: 0, Cred: 1000000000, Desc: 'Doc 6573' },
    { Deb: 0, Cred: 1300000000, Desc: 'Doc 6573_2' },
    { Deb: 1700000000, Cred: 0, Desc: 'Doc 6571' },
    { Deb: 10000000000, Cred: 0, Desc: 'Doc 6916' },
    { Deb: 9000000000, Cred: 0, Desc: 'Doc 8789' },
    { Deb: 12500000000, Cred: 0, Desc: 'Doc 8849' },
    { Deb: 22000000000, Cred: 0, Desc: 'Doc 8850' },
    { Deb: 3000000000, Cred: 0, Desc: 'Doc 8858' },
    { Deb: 1000000000, Cred: 0, Desc: 'Doc 8898' },
    { Deb: 500000000, Cred: 0, Desc: 'Doc 7647' },
    { Deb: 541980000, Cred: 0, Desc: 'Doc 7619' },
    { Deb: 10000000000, Cred: 0, Desc: 'Doc 12059' },
    { Deb: 2500000000, Cred: 0, Desc: 'Doc 8449' },
    { Deb: 258020000, Cred: 0, Desc: 'Doc 7916' },
    { Deb: 0, Cred: 75000000000, Desc: 'Doc 1215' },
    { Deb: 0, Cred: 35000000000, Desc: 'Doc 1370' },
    { Deb: 0, Cred: 21564370766, Desc: 'Doc 1438' },
    { Deb: 0, Cred: 8913180000, Desc: 'Doc 1631' },
    { Deb: 0, Cred: 10000000000, Desc: 'Doc 1609' },
    { Deb: 0, Cred: 8000000000, Desc: 'Doc 1814' },
    { Deb: 0, Cred: 17000000000, Desc: 'Doc 2211' },
    { Deb: 10000000000, Cred: 0, Desc: 'Doc 2210' },
    { Deb: 7000000000, Cred: 0, Desc: 'Doc 2217' },
    { Deb: 0, Cred: 22500000000, Desc: 'Doc 2604' },
    { Deb: 22500000000, Cred: 0, Desc: 'Doc 2601' },
    { Deb: 0, Cred: 22500000000, Desc: 'Doc 2601_2' },
    { Deb: 23000000000, Cred: 0, Desc: 'Doc 2602' }
];

let target = 57977550766;
let current = 0;
// We know that total balance is -157977550766 (i.e. Cred = 157977550766).
// We want exactly 57977550766. The difference is 100000000000.
// So we need to remove EXACTLY 100000000000 of Credit, or ADD exactly 100000000000 of Debit.
// Wait! Removing exactly 100,000,000,000 of Credit!
// Which Credit items add up to exactly 100,000,000,000?
let credits = transactions.filter(t => t.Cred > 0).map(t => ({ val: t.Cred, desc: t.Desc }));
console.log("Credits:");
credits.forEach(c => console.log(c.val, c.desc));

// Could it be Doc 6155 (70,000,000,000) + Doc 6916(Debit 10B) ? No, we need to REMOVE 100B of net credit.
// Is there a 100B credit?
// Doc 1215 = 75,000,000,000.
// Doc 2604 = 22,500,000,000.
// 75B + 22.5B = 97.5B. Not 100B.

// Wait. The first 6 transactions sum to 0. (Doc 113154 to 113579)
// The next 19 transactions sum to 0. (Doc 12058 to 7916)
// ONLY the last 13 transactions (Doc 1215 to 2602) sum to -157,977,550,766.
// Let's sum JUST the last 13 transactions:
let sumDoc4 = 0;
transactions.slice(25).forEach(t => sumDoc4 += t.Cred - t.Deb);
console.log("Sum of Doc 4:", sumDoc4);

// Within the last 13 transactions, how to remove 100,000,000,000?
// Wait, is it possible that Doc 1215 (75B) and Doc 2601_2 (22.5B) and ... 
