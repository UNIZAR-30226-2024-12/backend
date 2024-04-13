require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const {sessionMiddleware, onlyForHandshake} = require('./middleware/serveMiddleware');
const bodyParser = require('body-parser');
const passport = require('passport');




const allowedOrigins = ['http://localhost:3010', 'http://localhost:3000', 'https://wealthwars.games:3010', 'https://accounts.google.com'];

app.use(cors({
  origin: function(origin, callback){
    console.log("Origen  " + origin);
    // allow requests with no origin (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      console.log("CORS not allowed");
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    console.log("Allowed");
    return callback(null, true);
  },
  credentials: true,
}));

//Body parser for post and update petitions
app.use(bodyParser.json());
app.use(sessionMiddleware);

//Passport for authentication
app.use(passport.initialize());
app.use(passport.session());


// Main page route
app.get('/', (req, res) => {
  // Only greets
  res.send('Bienvenido a la página de inicio');
});

//Used routes
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

const userRoutes = require('./routes/userRoutes');
app.use('/users', userRoutes);

const friendsRoutes = require('./routes/friendRoutes');
app.use('/friends', friendsRoutes);


// General error management
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('¡Algo salió mal!');
});



//To remove only tries for the socket io !!!!
app.set('view engine', 'ejs');

app.get('/create', (req, res) =>{
  res.render('createRoom');
});

app.get('/join', (req, res) => {
  res.render('joinRoom');
});


app.get('/start', (req,res) => {
  res.render('startGame');
});

app.get('/leave', (req,res) => {
  res.render('leaveRoom');
});

app.get('/move', (req,res) => {
  res.render('moveTroops');
});

app.get('/attack', (req,res) => {
  res.render('attackTerritories');
});

app.get('/surrender', (req,res) => {
  res.render('surrender');
});

app.get('/next', (req,res) => {
  res.render('nextTurn');
});

app.get('/buy', (req,res) => {
  res.render('buyActives');
});

//Where using socket io, for game states
const { Server } = require("socket.io");

//Io definition
let io;
let server;
if(process.env.MODE_ENV === 'development'){
   //Create an http server
   const { createServer } = require("node:http");
   server = createServer(app);
   
 
}
else{
  //Create an https server
  const https = require('https');
  const fs = require('fs');
  
  const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/wealthwars.games/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/wealthwars.games/fullchain.pem')
  };
  server = https.createServer(options, app);


}

//Use same session context as express and passport
io = new Server(server, { cors: { origin: '*'}});
io.engine.use(onlyForHandshake(sessionMiddleware));
io.engine.use(onlyForHandshake(passport.session()));

//IO error management
io.engine.use(
  onlyForHandshake((req, res, next) => {
    if (req.user) {
      next();
    } else {
      console.log("Unauthorized user")
      res.writeHead(401);
      res.end();
    }
  }),
);


//Listening
if(process.env.MODE_ENV === 'development'){
  const host = 'localhost';
  server.listen(3010, host,() => {
    console.log(`Server is listening on ${host}:${3010}`);
  });
}
else{
  const host = process.env.CLIENT_URL;
  server.listen(3010, host, () => {
    console.log(`Server is listening on https://${host}:3010`);
  });
}


const {createRoom, joinRoom, leaveRoom, startGame, rooms, sids, nextPhaseHandler} = require('./middleware/game');
const data = require('./territories/territories.json');

// As socket ids are volatile through pages, we keep track of pairs email-socket
const emailToSocket = new Map();
// Conexion de un socket
io.on('connection', (socket) => {
  //The session
  const session = socket.request.session;
  //The user
  const user = socket.request.user;


  //Create a new pair, the user is associated with that socket
  emailToSocket.set(user.email, socket);
  console.log("Socket ID: " + socket.id);
  console.log("User authenticated: " + JSON.stringify(user));
    
  // Create lobby
  socket.on('createRoom' ,() => createRoom(socket, user));

  // Join lobby
  socket.on('joinRoom', (code) => joinRoom(emailToSocket, socket, user, code));

  //Start a game
  socket.on('startGame', (code) => startGame(emailToSocket, code, user, socket));

  // Leave a lobby
  socket.on('leaveRoom', () => leaveRoom(emailToSocket,user));

  // Socket disconnection
  socket.on('disconnect', () => {
      console.log(`Jugador ${user.email} desconectado`);
      emailToSocket.delete(user.email);
      // leaveRoom(socket,user);
  });

  //Next phase on a game
  socket.on('nextPhase', (code) => nextPhaseHandler(socket, emailToSocket, user));


  const fs = require('fs');
  // Move troops in a territory
  socket.on('moveTroops', (from, to, troops) => {
    if (user && user.email && sids.has(user.email)) { 
      const room = sids.get(user.email);
      const state = getTerritories(data, room.code);
      moveTroops(state, from, to, troops, user.email);
      io.to(room).emit('update', JSON.stringify(state, null, 4));
    } else {
      console.log("User not found");
    }
  });

  // Attack a territory
  socket.on('attack', (from, to, troops) => {
    const room = sids.get(user.email);
    const state = getTerritories(data, room.code);
    attackTerritories(state, from, to, troops, user.email);
    io.to(room).emit('update', JSON.stringify(state, null, 4));
  });

  // Surrender
  socket.on('surrender', () => {
    const room = sids.get(user.email);
    const state = getTerritories(data, room.code);
    surrender(state, user.email);
    io.to(room).emit('update', JSON.stringify(state, null, 4));
  });

  // Next turn
  socket.on('nextTurn', () => {
    const room = sids.get(user.email);
    const state = getTerritories(data, room.code);
    nextTurn(state);
    io.to(room).emit('update', JSON.stringify(state, null, 4));
  });

  // Buy actives
  socket.on('buyActives', (type, territory, numActives) => {
    const room = sids.get(user.email);
    const state = getTerritories(data, room.code);
    buyActives(state, user.email, type, territory, numActives);
    io.to(room).emit('update', JSON.stringify(state, null, 4));
  });
});