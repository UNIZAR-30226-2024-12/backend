/**
 * @description This function assigns territories to players at the start of the game.
 * @param {Array} players The array of players in the game.
 * @param {Object} data The data of the territories.
 * @returns {Object} The initial state of the game.
 */
function assignTerritories(players, data) {
  const initialFactories = 0;
  const initialTroops = 3;
  const initialCoins = 0;
  const initialPoints = 0;
  const state = {
    turn: 0,
    phase: 0,
    players: players.map((player, index) => ({
      name: player.username,
      email: player.email,
      picture: player.picture,
      coins: initialCoins,
      points: initialPoints,
    })),
    //Players that had surrendered
    surrendered: [],
    map: {},
  };

  const shuffledTerritories = Object.keys(data).sort(() => Math.random() - 0.5); // Random
  const numPlayers = players.length;

  shuffledTerritories.forEach((i, j) => {
    const playerIndex = j % numPlayers; // module numPlayers
    state.map[i] = {
      name: data[i].name,
      player: playerIndex,
      troops: initialTroops,
      factories: initialFactories,
    };
  });

  for (let playerNumber = 0; playerNumber < state.players.length; playerNumber++) {
    let coins = countPlayerCoins(state, playerNumber);
    if (playerNumber === 0) {
      state.players[playerNumber].coins += coins;
    }
    state.players[playerNumber].points += coins;
  }

  return state;
}

/**
 * @description This function handles a player's action to move troops from one territory to another.
 * @param {Object} state The current state of the game.
 * @param {string} from The territory from which the troops are moved.
 * @param {string} to The territory to which the troops are moved.
 * @param {number} t The number of troops to move.
 * @param {string} player The player who is moving the troops.
 * @returns {Object} The updated state of the game.
 */
function moveTroops(state, from, to, t, player) {
  let playerIndex = state.players.findIndex((p) => p.email.trim() === player.trim());
  let map = state.map;
  troops = parseInt(t, 10);
  if (state.turn === playerIndex) {
    if (map[from].troops - troops >= 1) {
      if (map[from].player === playerIndex && map[to].player === playerIndex) {
        map[to].troops += troops;
        map[from].troops -= troops;
      }
    }
  }
  return state;
}

/**
 * @description This function handles a player's action to attack a territory.
 * @param {Object} state The current state of the game.
 * @param {string} from The territory from which the attack is launched.
 * @param {string} to The territory which is being attacked.
 * @param {number} troops The number of troops used in the attack.
 * @param {string} player The player who is launching the attack.
 * @param {Object} emailToSocket The mapping of emails to sockets.
 * @returns {Object} The updated state of the game and the result of the attack.
 */
function attackTerritories(state, from, to, troops, player) {
  let playerIndex = state.players.findIndex((p) => p.email.trim() === player.trim());
  const map = state.map;
  conquered = false;
  let winner = false;
  if (state.turn === playerIndex) {
    if (map[from].troops - troops >= 1) {
      if (map[from].player === playerIndex && map[to].player !== playerIndex) {
        if (troops > map[to].troops) {
          map[to].troops = troops - map[to].troops;
          map[to].player = playerIndex;
          conquered = true;
          state.map = map;
          // Check if the player conquered all territories and win the game
          if (checkVictory(state, player)) {
            winner = true;
          }
        } else {
          map[to].troops -= troops;
        }
        map[from].troops -= troops;
      }
    }
  }
  return { state, conquered, winner, player };
}

/**
 * @description This function checks if a player has conquered all territories.
 * @param {Object} state The current state of the game.
 * @param {string} player The player to check.
 * @returns {boolean} True if the player has conquered all territories, false otherwise.
 */
function checkVictory(state, player) {
  let playerIndex = state.players.findIndex((p) => p.email.trim() === player.trim());
  let samePlayer = true;
  const map = state.map;
  for (const i in map) {
    if (state.map[i].player !== playerIndex) {
      samePlayer = false;
      break;
    }
  }
  if (samePlayer) {
    return true;
  } else {
    return false;
  }
}

/**
 * @description This function checks if any player has conquered all territories.
 * @param {Object} gameState The current state of the game.
 * @returns {number} The index of the player who has conquered all territories, or -1 if no player has conquered all territories.
 */
function checkWinner(gameState) {
  let players = new Set();
  for (let territory in gameState.map) {
    players.add(gameState.map[territory].player);
  }
  if (players.size === 1) {
    return Array.from(players)[0]; // Return the player number if there is a winner
  } else {
    return -1; // Return -1 if there is no winner
  }
}

/**
 * @description This function handles a player's action to surrender.
 * @param {Object} state The current state of the game.
 * @param {string} player The player who is surrendering.
 * @returns {Object} The updated state of the game and the result of the surrender.
 */
function surrender(state, player) {
  let playerIndex = state.players.findIndex((p) => p.email.trim() === player.trim());
  let winner = false;
  const map = state.map;
  state.surrendered.push(playerIndex);
  for (const i in map) {
    if (map[i].player === playerIndex) {
      // asign territory to another player
      let j = Math.floor(Math.random() * state.players.length);
      while (j === playerIndex || state.surrendered.includes(j)) {
        j = Math.floor(Math.random() * state.players.length);
      }
      map[i].player = j;
    }
  }
  state.map = map;
  const indexWinner = checkWinner(state);
  //There is a winner
  let playerWinner;
  if (indexWinner !== -1) {
    winner = true;
    playerWinner = state.players[indexWinner];
  }
  return { state, winner, playerWinner };
}

/**
 * @description This function handles the shift of turns in the game.
 * It only shift turns if the user surrendered or is his last phase.
 * @param {Object} state The current state of the game.
 * @param {boolean} surrnedered If the player has surrendered or not
 * @returns {Object} The updated state of the game.
 */
function nextTurn(state, surrnedered) {
  //Check if the phase is the last one
  if (state.phase === 2 || surrnedered) {
    //Cacluate the number of coins for every player
    // Next turn, we have to look for the next turn of the player
    //that didn't surrendered
    do {
      state.turn = (state.turn + 1) % state.players.length;
    } while (state.surrendered.includes(state.turn));
    let coins = countPlayerCoins(state, state.turn);
    state.players[state.turn].coins += coins;
    state.players[state.turn].points += coins;
    state.phase = 0;
  }
  return state;
}

/**
 *
 * @param {Object} state
 * @param {Object} player
 * @returns {true} if is the player turn, false in any other case
 */
function isPlayerTurn(state, player) {
  let playerIndex = state.players.findIndex((p) => p.email.trim() === player.trim());
  if (state.turn === playerIndex) {
    return true;
  } else {
    return false;
  }
}
/**
 * @description This function handles the shift of phases in the game.
 * @param {Object} state The current state of the game.
 * @returns {Object} The updated state of the game.
 */
function nextPhase(state) {
  if (state.phase === 0 || state.phase === 1) {
    state.phase += 1;
  }
  return state;
}

/**
 * @description This function handles a player's action to buy actives.
 * @param {Object} state The current state of the game.
 * @param {string} player The player who is buying the actives.
 * @param {string} type The type of active to buy.
 * @param {string} territory The territory where the actives are bought.
 * @param {number} numActives The number of actives to buy.
 * @returns {Object} The updated state of the game.
 */
function buyActives(state, player, type, territory, numActives) {
  //Obtain the index in the state object
  let playerIndex = state.players.findIndex((p) => p.email.trim() === player.trim());
  const map = state.map;
  if (type === 'factory') {
    var cost = 15;
  } else if (type === 'troop') {
    var cost = 2 * numActives;
  }
  if (state.players[playerIndex].coins >= cost && map[territory].player === playerIndex) {
    if (type === 'factory' && map[territory].factories === 0) {
      map[territory].factories += numActives;
    } else if (type === 'troop' && map[territory].troops < 99 && map[territory].troops + numActives <= 99) {
      map[territory].troops += numActives;
    }
    state.players[playerIndex].coins -= cost;
  }
  state.map = map;
  return state;
}

/**
 * @description This function calculates the number of coins that a player has.
 * @param {Object} state The current state of the game.
 * @param {number} playerNumber The index of the player.
 * @returns {number} The number of coins that the player has.
 */
function countPlayerCoins(state, playerNumber) {
  let count = 0;
  if (state.turn === playerNumber) {
    for (let territory in state.map) {
      if (state.map[territory].player === playerNumber) {
        count++;
        if (state.map[territory].factories === 1) {
          count = count + 4;
        }
      }
    }
  }
  return count;
}

/**
 * @description This function updates the ranking of the players based on their points.
 * @param {Object} gameState The current state of the game.
 * @returns {Array} The updated ranking of the players.
 */
function updateRanking(gameState) {
  // Copy the players array from the gameState
  const ranking = [...gameState.players];

  // Sort players array based on points in descending order
  ranking.sort((a, b) => b.points - a.points);

  return ranking;
}

module.exports = {
  assignTerritories,
  moveTroops,
  nextTurn,
  surrender,
  buyActives,
  attackTerritories,
  nextPhase,
  updateRanking,
  isPlayerTurn,
};
