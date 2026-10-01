let socket = null
let myPlayerId = null
let currentRoom = null
let connected = false
let myMove = null

let mode = 'online'
let computerBusy = false
let level = 'easy'
let playerHistory = []


const BEATS = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper'
}

const COUNTER = {
  rock: 'paper',
  paper: 'scissors',
  scissors: 'rock'
}

const MOVES = ['rock', 'paper', 'scissors']


const LEVELS = {
  easy: {
    smart: 0,
    text: 'Totally random. Good for warming up.'
  },
  medium: {
    smart: 0.5,
    text: 'Notices which move you use the most.'
  },
  hard: {
    smart: 0.75,
    text: 'Learns what you tend to throw after each move.'
  },
  insane: {
    smart: 0.95,
    text: 'Hunts for patterns in your last moves. Good luck.'
  }
}


const SCORE_KEYS = {
  online: 'score',
  computer: 'computerScore'
}


function loadScore(key) {

  try {

    return JSON.parse(
      localStorage.getItem(key)
    ) || {
      wins: 0,
      losses: 0,
      ties: 0
    }

  } catch (error) {

    return {
      wins: 0,
      losses: 0,
      ties: 0
    }

  }

}


// online and computer games each keep their own score
const scores = {
  online: loadScore(SCORE_KEYS.online),
  computer: loadScore(SCORE_KEYS.computer)
}


try {

  const savedLevel =
    localStorage.getItem('level')

  if (LEVELS[savedLevel]) {
    level = savedLevel
  }

} catch (error) {}


const roomInput =
  document.querySelector('#room-code')

const joinButton =
  document.querySelector('#join-button')

const connectionStatus =
  document.querySelector('#connection-status')

const playerCount =
  document.querySelector('#player-count')


const onlineBox =
  document.querySelector('#online-box')

const computerBox =
  document.querySelector('#computer-box')

const modeOnlineButton =
  document.querySelector('#mode-online')

const modeComputerButton =
  document.querySelector('#mode-computer')

const levelButtons =
  document.querySelectorAll('.level-button')

const levelDescription =
  document.querySelector('#level-description')

const scoreLabel =
  document.querySelector('.js-score-label')

const resetButton =
  document.querySelector('#reset-button')


const resultElement =
  document.querySelector('.js-result')

const movesElement =
  document.querySelector('.js-moves')


const rockButton =
  document.querySelector('.js-rock-button')

const paperButton =
  document.querySelector('.js-paper-button')

const scissorsButton =
  document.querySelector('.js-scissors-button')


updateScoreElement()
updateLevelButtons()


rockButton.addEventListener(
  'click',
  () => makeMove('rock')
)


paperButton.addEventListener(
  'click',
  () => makeMove('paper')
)


scissorsButton.addEventListener(
  'click',
  () => makeMove('scissors')
)


joinButton.addEventListener(
  'click',
  joinGame
)


modeOnlineButton.addEventListener(
  'click',
  () => setMode('online')
)


modeComputerButton.addEventListener(
  'click',
  () => setMode('computer')
)


levelButtons.forEach(button => {

  button.addEventListener('click', () => {

    level = button.dataset.level

    // fresh start so the computer forgets your old moves
    playerHistory = []

    try {
      localStorage.setItem('level', level)
    } catch (error) {}

    updateLevelButtons()
    updateScoreElement()

    resultElement.textContent =
      'Pick a move to play the computer.'

    movesElement.innerHTML = ''

  })

})


resetButton.addEventListener('click', () => {

  const score = scores[mode]

  score.wins = 0
  score.losses = 0
  score.ties = 0

  localStorage.removeItem(SCORE_KEYS[mode])

  updateScoreElement()

})


document.body.addEventListener(
  'keydown',
  event => {

    if (event.target.tagName === 'INPUT') {
      return
    }

    if (event.key === 'r') {
      makeMove('rock')
    }

    if (event.key === 'p') {
      makeMove('paper')
    }

    if (event.key === 's') {
      makeMove('scissors')
    }

  }
)


function setMode(newMode) {

  if (newMode === mode) {
    return
  }

  mode = newMode

  movesElement.innerHTML = ''

  modeOnlineButton.classList
    .toggle('active', mode === 'online')

  modeComputerButton.classList
    .toggle('active', mode === 'computer')

  onlineBox.hidden = mode !== 'online'
  computerBox.hidden = mode !== 'computer'


  if (mode === 'computer') {

    disconnect()

    resultElement.textContent =
      'Pick a move to play the computer.'

  }

  else {

    resultElement.textContent =
      'Join a room to play'

  }


  updateScoreElement()

}


function disconnect() {

  if (socket) {

    const oldSocket = socket

    socket = null

    oldSocket.close()

  }

  connected = false
  myMove = null

  connectionStatus.textContent =
    'Not connected'

  playerCount.textContent =
    'Players: 0/2'

}


function joinGame() {

  const room =
    roomInput.value
      .trim()
      .toUpperCase()


  if (!room) {

    resultElement.textContent =
      'Enter a room code.'

    return
  }


  if (socket) {

    const oldSocket = socket

    socket = null

    oldSocket.close()

  }


  myMove = null
  connected = false


  currentRoom = room


  /*
    CHANGE THIS TO YOUR
    CLOUDFLARE WORKER ADDRESS
  */

  const server =
    'wss://rps-server.heyboernathan.workers.dev'


  const ws = new WebSocket(
    `${server}/room?room=${encodeURIComponent(room)}`
  )

  socket = ws


  connectionStatus.textContent =
    'Connecting...'


  ws.addEventListener(
    'open',
    () => {

      connected = true

      connectionStatus.textContent =
        `Connected to room ${room}`

      resultElement.textContent =
        'Waiting for another player...'

    }
  )


  ws.addEventListener(
    'message',
    event => {

      const data =
        JSON.parse(event.data)


      if (data.type === 'welcome') {

        myPlayerId =
          data.playerId

      }


      if (data.type === 'players') {

        playerCount.textContent =
          `Players: ${data.count}/2`


        if (data.count === 1) {

          resultElement.textContent =
            'Waiting for another player...'

        }


        if (data.count === 2) {

          resultElement.textContent =
            'Both players connected. Choose your move.'

        }

      }


      if (data.type === 'opponent-move') {

        movesElement.innerHTML =
          'Your opponent has chosen a move.'

      }


      if (data.type === 'result') {

        showResult(data)

      }


      if (data.type === 'error') {

        resultElement.textContent =
          data.message

      }

    }
  )


  ws.addEventListener(
    'close',
    () => {

      // ignore sockets we already replaced or closed on purpose
      if (socket !== ws) {
        return
      }

      connected = false
      myMove = null

      connectionStatus.textContent =
        'Disconnected'

      playerCount.textContent =
        'Players: 0/2'

    }
  )

}


function makeMove(move) {

  if (mode === 'computer') {

    playComputer(move)

    return

  }


  if (!connected) {

    resultElement.textContent =
      'Join a room first.'

    return

  }


  if (myMove !== null) {

    resultElement.textContent =
      'You already chose a move.'

    return

  }


  myMove = move


  resultElement.textContent =
    `You chose ${move}. Waiting for opponent...`


  socket.send(
    JSON.stringify({
      type: 'move',
      move: move
    })
  )

}


function playComputer(move) {

  if (computerBusy) {
    return
  }

  computerBusy = true

  movesElement.innerHTML = ''

  resultElement.textContent =
    'Computer is choosing...'


  setTimeout(() => {

    computerBusy = false

    // player left computer mode while waiting
    if (mode !== 'computer') {
      return
    }


    // the computer picks BEFORE it sees your move
    const computerMove =
      computerChoose()

    playerHistory.push(move)


    let result = 'loss'

    if (move === computerMove) {
      result = 'tie'
    }

    else if (BEATS[move] === computerMove) {
      result = 'win'
    }


    applyResult(
      'computer',
      result,
      move,
      computerMove,
      'Computer'
    )

  }, 400)

}


function randomMove() {

  return MOVES[
    Math.floor(Math.random() * MOVES.length)
  ]

}


function computerChoose() {

  const smart = LEVELS[level].smart

  if (
    playerHistory.length > 0 &&
    Math.random() < smart
  ) {

    const predicted = predictPlayerMove()

    if (predicted) {
      return COUNTER[predicted]
    }

  }

  return randomMove()

}


function mostCommon(counts) {

  const best =
    Math.max(...MOVES.map(m => counts[m]))

  const tied =
    MOVES.filter(m => counts[m] === best)

  return tied[
    Math.floor(Math.random() * tied.length)
  ]

}


function predictPlayerMove() {

  const h = playerHistory

  const counts = {
    rock: 0,
    paper: 0,
    scissors: 0
  }

  let total = 0


  // insane: look at your last 2 moves
  if (level === 'insane' && h.length >= 3) {

    const a = h[h.length - 2]
    const b = h[h.length - 1]

    for (let i = 0; i < h.length - 2; i++) {

      if (h[i] === a && h[i + 1] === b) {

        counts[h[i + 2]]++
        total++

      }

    }

    if (total > 0) {
      return mostCommon(counts)
    }

  }


  // hard + insane: look at your last move
  if (
    (level === 'hard' || level === 'insane') &&
    h.length >= 2
  ) {

    const last = h[h.length - 1]

    counts.rock = 0
    counts.paper = 0
    counts.scissors = 0
    total = 0

    for (let i = 0; i < h.length - 1; i++) {

      if (h[i] === last) {

        counts[h[i + 1]]++
        total++

      }

    }

    if (total > 0) {
      return mostCommon(counts)
    }

  }


  // everyone: your most used move
  counts.rock = 0
  counts.paper = 0
  counts.scissors = 0

  const recent =
    level === 'medium' ? h.slice(-10) : h

  recent.forEach(m => counts[m]++)

  return mostCommon(counts)

}


function showResult(data) {

  myMove = null

  applyResult(
    'online',
    data.result,
    data.yourMove,
    data.opponentMove,
    'Opponent'
  )

}


function applyResult(
  which,
  result,
  yourMove,
  opponentMove,
  opponentName
) {

  const score = scores[which]


  movesElement.innerHTML =
    `You
     <img
       src="images/${yourMove}-emoji.png"
       class="move-icon"
     >
     <img
       src="images/${opponentMove}-emoji.png"
       class="move-icon"
     >
     ${opponentName}`


  if (result === 'win') {

    score.wins++

    resultElement.textContent =
      'You win!'

  }


  else if (result === 'loss') {

    score.losses++

    resultElement.textContent =
      'You lose.'

  }


  else {

    score.ties++

    resultElement.textContent =
      'Tie.'

  }


  localStorage.setItem(
    SCORE_KEYS[which],
    JSON.stringify(score)
  )


  window.dispatchEvent(new CustomEvent('rps-result', {
    detail: { which, result, level }
  }))

  updateScoreElement()
}


function updateLevelButtons() {

  levelButtons.forEach(button => {

    button.classList.toggle(
      'active',
      button.dataset.level === level
    )

  })

  levelDescription.textContent =
    LEVELS[level].text

}


function updateScoreElement() {

  const score = scores[mode]

  if (mode === 'computer') {

    const name =
      level.charAt(0).toUpperCase() +
      level.slice(1)

    scoreLabel.textContent =
      'Computer score'

    resetButton.textContent =
      'Reset Computer Score'

  }

  else {

    scoreLabel.textContent =
      'Online score'

    resetButton.textContent =
      'Reset Online Score'

  }

  document.querySelector('.js-score')
    .textContent =
      `Wins: ${score.wins}, ` +
      `Losses: ${score.losses}, ` +
      `Ties: ${score.ties}`

}
