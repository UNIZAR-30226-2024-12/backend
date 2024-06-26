require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const { sessionMiddleware, onlyForHandshake } = require('./middleware/serveMiddleware');
const bodyParser = require('body-parser');
const passport = require('passport');

//Enable cors comunication
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3010',
  'https://wealthwars.games:3010',
  'https://accounts.google.com',
  'https://wealthwars.games',
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        console.log('CORS not allowed');
        var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
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
app.use('/users', friendsRoutes);

const friendsRequestRoutes = require('./routes/friend_requestRoutes');
app.use('/users', friendsRequestRoutes);

// General error management
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: '¡Algo salió mal!' });
});

//Where using socket io, for game states
const { Server } = require('socket.io');

//Io definition
let io;
let server;
if (process.env.MODE_ENV === 'development') {
  //Create an http server
  const { createServer } = require('node:http');
  server = createServer(app);
} else {
  //Create an https server
  const https = require('https');
  const fs = require('fs');

  const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/wealthwars.games/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/wealthwars.games/fullchain.pem'),
  };
  server = https.createServer(options, app);
}

//Use same session context as express and passport
//Use same session context as express and passport
io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  },
});
io.engine.use(onlyForHandshake(sessionMiddleware));
io.engine.use(onlyForHandshake(passport.session()));

//IO error management
io.engine.use(
  onlyForHandshake((req, res, next) => {
    if (req.user) {
      next();
    } else {
      res.writeHead(401);
      res.end();
    }
  })
);

//Listening
if (process.env.MODE_ENV === 'development') {
  const host = 'localhost';
  server.listen(3010, host, () => {
    console.log(`Server is listening on ${host}:${3010}`);
  });
} else {
  const host = process.env.CLIENT_URL;
  server.listen(3010, host, () => {
    console.log(`Server is listening on https://${host}:3010`);
  });
}

const {
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  rooms,
  sids,
  next,
  nextPhaseHandler,
  nextTurnHandler,
  moveTroopsHandler,
  attackTerritoriesHandler,
  buyActivesHandler,
  surrenderHandler,
  getMap,
  chat,
  invite,
  reconectionHandler,
} = require('./middleware/game');
const data = require('./territories/territories.json');

// As socket ids are volatile through pages, we keep track of pairs email-socket
const emailToSocket = new Map();

//All the actve users
let activeUsers = {};
// Conexion de un socket
io.on('connection', (socket) => {
  try {
    //The user
    const user = socket.request.user;
    //User is now active
    activeUsers[user.email] = true;

    //Create a new pair, the user is associated with that socket
    emailToSocket.set(user.email, socket);
    //reconectionHandler(socket, user);
    // Create lobby
    socket.on('createRoom', () => {
      try {
        createRoom(socket, user);
      } catch (error) {
        socket.emit('error', 'Error creating room: ' + error.message);
      }
    });

    // Join lobby
    socket.on('joinRoom', (code) => {
      try {
        joinRoom(emailToSocket, socket, user, code);
      } catch (error) {
        socket.emit('error', 'Error joining room: ' + error.message);
      }
    });

    //Start a game
    socket.on('startGame', (code) => {
      try {
        startGame(emailToSocket, code, user, socket);
      } catch (error) {
        socket.emit('error', 'Error starting game: ' + error.message);
      }
    });

    // Leave a lobby
    socket.on('leaveRoom', () => {
      try {
        leaveRoom(emailToSocket, user);
      } catch (error) {
        socket.emit('error', 'Error leaving room: ' + error.message);
      }
    });

    // Socket disconnection
    socket.on('disconnect', () => {
      emailToSocket.delete(user.email);

      //This user is not active, we let him a time to reconnect
      activeUsers[user.email] = false;
      setTimeout(() => {
        if (!activeUsers[user.email]) {
          surrenderHandler(socket, emailToSocket, user);
          leaveRoom(emailToSocket, user);
          console.log('Este usuario se ha ido ' + user.email);
        }
      }, 90000); // 90 seconds
    });

    // Next phase
    socket.on('nextPhase', () => {
      try {
        nextPhaseHandler(socket, emailToSocket, user);
      } catch (error) {
        socket.emit('error', 'Error in next phase: ' + error.message);
      }
    });

    // Move troops in a territory
    socket.on('moveTroops', (from, to, troops) => {
      try {
        moveTroopsHandler(socket, emailToSocket, user, from, to, troops);
      } catch (error) {
        socket.emit('error', 'Error moving troops: ' + error.message);
      }
    });

    // Attack a territory
    socket.on('attackTerritories', (from, to, troops) => {
      try {
        attackTerritoriesHandler(socket, emailToSocket, user, from, to, troops);
      } catch (error) {
        socket.emit('error', 'Error attacking territories: ' + error.message);
      }
    });

    // Surrender
    socket.on('surrender', () => {
      try {
        surrenderHandler(socket, emailToSocket, user);
      } catch (error) {
        socket.emit('error', 'Error in surrender: ' + error.message);
      }
    });

    // Next turn
    socket.on('nextTurn', () => {
      try {
        nextTurnHandler(socket, emailToSocket, user);
      } catch (error) {
        socket.emit('error', 'Error in next turn: ' + error.message);
      }
    });

    // Buy actives
    socket.on('buyActives', (type, territory, numActives) => {
      try {
        buyActivesHandler(socket, emailToSocket, user, type, territory, numActives);
      } catch (error) {
        socket.emit('error', 'Error buying actives: ' + error.message);
      }
    });

    // Victory
    socket.on('victory', () => {
      try {
        victoryHandler(emailToSocket, user);
      } catch (error) {
        socket.emit('error', 'Error in victory: ' + error.message);
      }
    });

    //Send the map
    socket.on('sendMap', () => {
      try {
        getMap(socket, user);
      } catch (error) {
        socket.emit('error', 'Error sending map: ' + error.message);
      }
    });

    // Distributed chat
    socket.on('sendMessage', (msg) => {
      try {
        chat(socket, emailToSocket, user, msg);
      } catch (error) {
        socket.emit('error', 'Error in chat: ' + error.message);
      }
    });

    //Invite someone to lobby
    socket.on('invite', (email) => {
      try {
        invite(socket, emailToSocket, user, email);
      } catch (error) {
        socket.emit('error', 'Error sending map: ' + error.message);
      }
    });
  } catch (error) {
    console.log('Error: ' + error.message);
  }
});
