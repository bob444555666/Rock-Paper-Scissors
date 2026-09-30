let socket = null
let myPlayerId = null
let currentRoom = null
let connected = false
let myMove = null


let score = JSON.parse(
  localStorage.getItem('score')
) || {
  wins: 0,
  losses: 0,
  ties: 0
}


updateScoreElement()


const roomInput =
  document.querySelector('#room-code')

const joinButton =
  document.querySelector('#join-button')

const connectionStatus =
  document.querySelector('#connection-status')

const playerCount =
  document.querySelector('#player-count')


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


document.querySelector('#reset-button')
  .addEventListener('click', () => {

    score.wins = 0
    score.losses = 0
    score.ties = 0

    localStorage.removeItem('score')

    updateScoreElement()
  })


document.body.addEventListener(
  'keydown',
  event => {

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
    socket.close()
  }


  currentRoom = room


  /*
    CHANGE THIS TO YOUR
    CLOUDFLARE WORKER ADDRESS
  */

  const server =
    'wss://YOUR-WORKER.YOUR-NAME.workers.dev'


  socket = new WebSocket(
    `${server}/room?room=${encodeURIComponent(room)}`
  )


  connectionStatus.textContent =
    'Connecting...'


  socket.addEventListener(
    'open',
    () => {

      connected = true

      connectionStatus.textContent =
        `Connected to room ${room}`

      resultElement.textContent =
        'Waiting for another player...'

    }
  )


  socket.addEventListener(
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


  socket.addEventListener(
    'close',
    () => {

      connected = false

      connectionStatus.textContent =
        'Disconnected'

      playerCount.textContent =
        'Players: 0/2'

    }
  )

}


function makeMove(move) {

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


function showResult(data) {

  myMove = null


  const yourMove =
    data.yourMove

  const opponentMove =
    data.opponentMove


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
     Opponent`


  if (data.result === 'win') {

    score.wins++

    resultElement.textContent =
      'You win!'

  }


  else if (data.result === 'loss') {

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
    'score',
    JSON.stringify(score)
  )


  updateScoreElement()
}


function updateScoreElement() {

  document.querySelector('.js-score')
    .textContent =
      `Wins: ${score.wins}, ` +
      `Losses: ${score.losses}, ` +
      `Ties: ${score.ties}`

}
