const fs = require('fs');
const path = require('path');

const root = __dirname;
console.log('Root:', root);
console.log('Files in root:');
fs.readdirSync(root).forEach(file => {
    console.log(file);
});

const dbPath = path.join(root, 'database.json');
if (fs.existsSync(dbPath)) {
    console.log('database.json exists!');
    console.log('Size:', fs.statSync(dbPath).size);
} else {
    console.log('database.json DOES NOT exist!');
}

const dbPath2 = path.join(root, 'db.json');
if (fs.existsSync(dbPath2)) {
    console.log('db.json exists!');
}

const dataPath = path.join(root, 'data');
if (fs.existsSync(dataPath)) {
    console.log('data dir exists!');
    fs.readdirSync(dataPath).forEach(file => {
        console.log('data/' + file);
    });
}
