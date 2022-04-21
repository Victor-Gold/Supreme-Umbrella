//jshint esversion:6


//GLOBAL CONSTANTS//
//===============//

require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
var findOrCreate = require('mongoose-findorcreate');
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passportFacebook = require('passport-facebook');

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: 'Thisisasecret.',
  resave: false,
  saveUninitialized: false,
  // cookie: {
  //   secure: true
  // }
}));

//INITIALIZE PASSPORT AND LET IT USE SESSION
app.use(passport.initialize());
app.use(passport.session());

//Connect to database
mongoose.connect("mongodb://localhost:27017/userDB");
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  vault: String
});


//Plugin user schema to local passportLocalMongoose
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
//From Passport Documentation in NPM
passport.use(User.createStrategy());

//Serialize and Deserialize User
passport.serializeUser(function(user, done) {
  done(null, user.id);
})

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});




passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Authenticate using Facebook App Login 


passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "http://localhost:3000/auth/facebook/callback"
},
  function (accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/vault",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));


//GET ROUTES VARIOUS PAGES AND REDIRECTS//
//-------------------------------------//
//GET ROUTES VARIOUS PAGES AND REDIRECTS//

app.get("/", function(req, res) {
  res.render("home");
});

app.get('/auth/google/vault',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    // If successful authentication, redirect to vault.
    res.redirect('/vault');
  });

app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  }));

app.get("/login", function(req, res) {
  res.render("login")
});
app.get("/register", function(req, res) {
  res.render("register")
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

//Unsure what this get route actually does
app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.get("/vault", function(req, res) {
  //$ne: null means "not equal to null".

  User.find({"vault": {$ne: null}}, function(err, foundUsers) {
    if (err) {
      console.log(err)
    } else {
      if (foundUsers) {
        res.render("vault", { usersWithVaults: foundUsers })
      };
    };
  });
});



app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("vault");
  } else {
    res.redirect("/login");
  }
});


//POST ROUTES
app.post("/submit", function(req, res) {

  const submittedSecret = req.body.vault;
  console.log(req.user.id);
  const userID = req.user.id;

  User.findById(userID, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.vault = submittedSecret;
        foundUser.save(function(){
          res.redirect("/vault");
        });
      };
    };
  });
});

app.post("/register", function(req, res) {

  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {

    if (err) {
      console.log(err)
      res.redirect("/register")
    } else {
      console.log()
      passport.authenticate("local")(req, res, function() {
        res.redirect("/vault");
      });
    }
  });
});

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")
      res.redirect("/vault")
    }
  });
});

//PORT

app.listen(3000, function() {
  console.log("Started server on port 3000");
});
