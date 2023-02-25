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

const design = `
<head>
<style>
    body {
        font-family: Arial, Helvetica, sans-serif;
        background-color: #aaaaaa;
        padding: 80px ;

    }
    form {
        margin-top: 0%;
        border: 3px solid #f1f1f1;
        align-items: center;
        text-align: center;
        margin: 0px;
    }
    input[type=text] {

        margin: auto;
        width: 70%;
        padding: 12px 20px;
        margin: 8px 0;
        display: inline-block;
        border: 1px solid #ccc;
        box-sizing: border-box;
    }
    input[type=text]:focus, input[type=password]:focus {
        background-color: #ddd;
        outline: none;
    }
    button {
        background-color: #4CAF50;
        color: white;
        padding: 14px 20px;
        margin: 8px 0;
        border: none;
        cursor: pointer;
        width: 40%;
        border-radius: 10px;
    }
    button:hover {
        opacity: 0.8;
    }
    h1 {
        text-align: center;

    }
    p {
        text-align: center;
    }
    .head-c {
        text-align: center;
    }
    .head-b {
        text-align: center;
    }
    table {
        border-collapse: collapse;
        width: 100%;
        color: #2a3280;
        font-family: monospace;
        font-size: 20px;
        text-align: left;
    }
    th {
        background-color: #588c7e;
        color: white;
    }
    tr:nth-child(even) {
        background-color: #bdbdbd
    }
    td {
        /* after some text turn .. */
        overflow: hidden;
        /* set a max-height */
        max-height: 1.5em;
        /* set a max-width */
        max-width: 10em;
    }
    .head-b {
        text-align: center;
        align-items: center;
        background-color: rgb(180, 226, 226);
        border-radius: 10px;
        margin: 30px;
        padding: 20px;
        box-shadow: #2a3280 10px 10px 10px 1px;

    }

    .head-b:hover {
        background-color: rgb(180, 226, 226);
        border-radius: 10px;
        box-shadow: #31802a 10px 10px 10px 1px;
    }

    .head-a {
        text-align: center;
        background-color: rgb(180, 226, 226);
        border-radius: 10px;
        margin: 10px;
        padding: 10px;
        box-shadow: #2a3280 10px 10px 10px 1px;

    }
    /* add on hover function head-a */
    .head-a:hover {
        background-color: rgb(180, 226, 226);
        border-radius: 10px;
        box-shadow: #31802a 10px 10px 10px 1px;
    }
    img {
        top: 10;
        right: 10;
        display: flex;
        position: absolute;


    }


</style>
</head>
<body>
    <img id = "tb" src="https://img.icons8.com/doodle/96/null/light-on--v1.png" alt="Google" height="90px" width="90px" onclick="changetb()">
    <div class="head-c">

    <h1>Add your longurl to the database</h1>
    <form method="POST" action="/submit">
    <input type="text" id="longurl" name="longurl" placeholder="Enter Long URL here">
    <button type="submit">Submit</button>
  </form>
</div>
<script>
    function changetb(){
        var element = document.getElementById("tb");
        if (element.src.match("light")) {
            element.src = "data:image/png;base64,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";
            // make the background color black
            document.body.style.backgroundColor = "#0b1724";
            // make the text color white
            document.body.style.color = "white";

        } else {
            element.src ="https://img.icons8.com/doodle/96/null/light-on--v1.png";
            // make the background color white
            document.body.style.backgroundColor = "#aaaaaa";
            // make the text color black
            document.body.style.color = "black";

        }
    }
</script>
</body>
`;


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
      shortenUrl(longurl, res, lmao,design , headurl);
    });
  } else if (req.url !== '/' && req.url !== '/submit') {
    const shorturl = req.url.slice(1);
    redirectingurl(res, shorturl);
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(design);
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
function shortenUrl(longURL, res, lmao,design, headurl) {
  const query = db.collection("urls").where("longURL", "==", longURL);
  // Check if longURL already exists in the database
  query.get().then(function(querySnapshot) {
    if (!querySnapshot.empty) {
      // If the longURL already exists, get its corresponding shorturl and display it
      const shorturl = querySnapshot.docs[0].data().short;
      console.log(shorturl);
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write(design +`
      <div class="head-b" style="color: black;">
      <h1>Hello, Your Short URL :</h1>
      <p>Your shorturl is: <a href="${shorturl}" target="_blank">${headurl}/${shorturl}</a></p>
       </div>
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
          shortenUrl(longURL, res, lmao,design, headurl);
        } else {
          // If the shorturl doesn't exist, add the new entry to the database
          db.collection("urls").add({
            longURL: longURL,
            short: shorturl
          }).then(function(docRef) {
            console.log("Document written with ID: ", docRef.id);
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.write(design +`
            <div class="head-b" style="color: black;">
            <h1>Hello, Your Short URL :</h1>
            <p>Your shorturl is: <a href="${shorturl}" target="_blank">${headurl}/${shorturl}</a></p>
             </div>
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
