<h1>A Url shortener Made Using Node.js and Firebase realtime database</h1>


![1_6PFKsraB8kUoDUCFG7f9vA](https://user-images.githubusercontent.com/79451850/221284716-f9dcf1b9-0dcd-4956-9b7b-fdfd2ee5dbbe.png)
<pre>
npm init
npm install firebase-admin
</pre>
<b>
create a project in firebase. 
goto firestore database and create a database.
Now goto project settings, then goto service accounts.
Select Node.js, then generate new private key.
Save the private key. it will automatically download in JSON format.
</b>
<h2>
Create a file : main.js(Node server)
</h2>
<pre>
const http = require('http');
const admin = require('firebase-admin');
const querystring = require('querystring');

const serviceAccount = require('./firebase-private-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "Yout database url"
});
const db = admin.firestore();// Initializing the firebase database

const PORT = process.env.PORT || 3000;

// this is the request and response created for the server. Basically all the changes that is going to happen in the DOM is controller in by this single const server.

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

server.listen(PORT, () => {
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
<pre>
