require('dotenv').load();

var http = require("http");
var express = require("express");
var twilio = require("twilio");
var AccessToken = twilio.jwt.AccessToken;
var VideoGrant = AccessToken.VideoGrant;

var app = express();

app.set("view options", { layout: false });
app.use(express.static(__dirname + '/public'));

app.get("/", function(req, res) {
  res.render("index.html");
});

app.get("/token", function(req, res) {
  // Create an access token which we will sign and return to the client,
  // containing the grant we just created.
  var token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET
  );
  if (req.query.identity) {
    var identity = token.identity = req.query.identity;

    // Grant the access token Twilio Video capabilities.
    var grant = new VideoGrant();
    token.addGrant(grant);

    // Serialize the token to a JWT string and include it in a JSON response.
    res.send({
      identity: identity,
      token: token.toJwt()
    });
  } else {
    res.status(400).send(JSON.stringify({ error: "You must supply an identity." }));
  }
});

var server = http.createServer(app);
var port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log("Your app is listening on localhost:" + port);
});
