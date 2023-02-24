const http = require('http');
require('dotenv').config();
const obj = {
  "type": "service_account",
  "project_id": "ichiropractic",
  "private_key_id": process.env.PRIVATE_KEY_ID,
  "private_key": process.env.PRIVATE_KEY,
  "client_email": process.env.CLIENT_EMAIL,
  "client_id": process.env.CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-6j77x%40ichiropractic.iam.gserviceaccount.com"
}
const admin = require('firebase-admin');
const serviceAccount = require('./ichiropractic-firebase-adminsdk-6j77x-b2cdbdbf62.json');
const querystring = require('querystring');

let headurl;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ichiropractic-default-rtdb.asia-southeast1.firebasedatabase.app"
});
//generate a random string
const db = admin.firestore();
const server = http.createServer((req, res) => {
  console.log(req.headers); // Log the headers object to check if it contains the host property
  headurl = `http://${req.headers.host}`;
  console.log(headurl); // Log the constructed URL for debugging purposes
  if (req.url === '/submit') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const data = querystring.parse(body);
      const longurl = data.longurl;
      let lmao = generateKey();
      shortenUrl(longurl, res, lmao);
    });
  } else if (req.url !== '/' && req.url !== '/submit') {
    const shorturl = req.url.slice(1);
    redirectingurl(res, shorturl);
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(`
      <h1>Add your longurl to the database</h1>
      <form method="POST" action="/submit">
        <label for="longurl">longurl:</label>
        <input type="text" id="longurl" name="longurl">
        <button type="submit">Submit</button>
      </form>
    `);
    res.end();
  }
});
server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
function generateKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    key += chars[randomIndex];
  }
  return key;
}
function shortenUrl(longURL, res, lmao) {
  const query = db.collection("urls").where("longURL", "==", longURL);
  // Check if longURL already exists in the database
  query.get().then(function(querySnapshot) {
    if (!querySnapshot.empty) {
      // If the longURL already exists, get its corresponding shorturl and display it
      const shorturl = querySnapshot.docs[0].data().short;
      console.log(shorturl);
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write(`
        <h1>Hello ${longURL}!${lmao}</h1>
        <p>Your shorturl is: <a href="${shorturl}">${shorturl}</a></p>
      `);
      res.end();
    } else {
      // If the longURL doesn't exist, generate a new shorturl and add it to the database
      const shorturl = generateKey();
      const query = db.collection("urls").where("shorturl", "==", shorturl);

      // Check if the generated shorturl already exists in the database
      query.get().then(function(querySnapshot) {
        if (!querySnapshot.empty) {
          // If the shorturl already exists, generate a new one and try again
          shortenUrl(longURL, res, lmao);
        } else {
          // If the shorturl doesn't exist, add the new entry to the database
          db.collection("urls").add({
            longURL: longURL,
            short: shorturl
          }).then(function(docRef) {
            console.log("Document written with ID: ", docRef.id);
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(`
              <h1>Hello ${longURL}!${lmao}</h1>
              <p>Your shorturl is: <a href="${shorturl}">${shorturl}</a></p>
            `);
            res.end();
          })
          .catch(function(error) {
            console.error("Error adding document: ", error);
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.write('Error adding document to database');
            res.end();
          });
        }
        });
      }
  });
}
function redirectingurl(res, shorturl){
  //show all data in the coolection urls
  // db.collection("urls").get().then((querySnapshot) => {
  //   querySnapshot.forEach((doc) => {
  //     console.log(`${doc.id} => ${doc.data().longURL}`);
  //       console.log(`${doc.id} => ${doc.data().longURL}`);
  //   });
  // });

  //check if shorturl exists in database
  const query = db.collection("urls").where("short", "==", shorturl);
  query.get().then(function(querySnapshot) {
    if (!querySnapshot.empty) {
      // If the shorturl already exists, get its corresponding longurl and redirect
      const longurl = querySnapshot.docs[0].data().longURL;
      console.log(longurl);
      res.writeHead(302, { 'Location': longurl});
      res.end();
    } else {
      // If the shorturl doesn't exist, redirect to homepage
      res.writeHead(302, { 'Location': '/'});
      console.log(shorturl + " doesn't exist")
      res.end();
    }

  });
}
