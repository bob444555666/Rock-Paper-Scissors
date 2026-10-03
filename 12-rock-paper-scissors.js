let socket = null
let myPlayerId = null
let currentRoom = null
let connected = false
let myMove = null

let mode = 'online'
let computerBusy = false
let level = 'easy'
let playerHistory = []


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

  if (!token) {
    showAuth('Log in to play online.')
    return
  }

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
    `${server}/room?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`
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

      // never opened: login expired, room full or server off
      if (!connected) {
        handleConnectFail()
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


async function playComputer(move) {

  if (computerBusy) {
    return
  }

  computerBusy = true
  movesElement.innerHTML = ''
  resultElement.textContent = 'Computer is choosing...'

  // the server picks the computer's move and decides who won
  try {
    const res = await fetch(API + '/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move, level, token, history: playerHistory.slice(-50) })
    })
    const data = await res.json()

    if (res.status === 401) {
      logout()
      showAuth('Please log in again.')
      return
    }

    if (!res.ok) {
      resultElement.textContent = data.error || 'Something went wrong.'
      return
    }

    playerHistory.push(move) // only sent for guests; accounts keep their own history

    if (mode === 'computer') {
      applyResult('computer', data.result, move, data.computerMove, 'Computer')
    }
  } catch (error) {
    resultElement.textContent = 'Cannot reach the server.'
  } finally {
    computerBusy = false
  }

}


function showResult(data) {

  myMove = null

  applyResult(
    'online',
    data.result,
    data.yourMove,
    data.opponentMove,
    data.opponentName || 'Opponent'
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



/* ================= Accounts: Google, email + code, username + password ================= */

const GOOGLE_CLIENT_ID = '673440193252-jv6q8cop00g3jkq4dd6953bc24fifb0c.apps.googleusercontent.com'
const API = 'https://rps-server.heyboernathan.workers.dev'

let token = null
let user = null
let setupToken = null
let pendingEmail = ''
let view = 'login'
let googleStarted = false
let kicked = false

const $ = selector => document.querySelector(selector)
const authLayer = $('#auth-layer')
const authTitle = $('#auth-title')
const authSub = $('#auth-sub')
const authMsg = $('#auth-msg')
const googleBtn = $('#google-btn')
const userChip = $('#user-chip')

const views = {
  login: $('#view-login'),
  register: $('#view-register'),
  code: $('#view-code'),
  setup: $('#view-setup'),
  forgot: $('#view-forgot'),
  reset: $('#view-reset')
}

const VIEW_TEXT = {
  login: ['Welcome back', 'Log in with Google, or with your username and password.'],
  register: ['Create your account', 'Register with Google or with your email.'],
  code: ['Check your email', ''],
  setup: ['Almost done', 'Choose a username and password for your account.'],
  forgot: ['Forgot password', 'Enter your account email and we will send you a code.'],
  reset: ['Reset password', '']
}

try { token = localStorage.getItem('token') } catch (error) {}

function setView(v, message) {
  view = v
  for (const name in views) views[name].hidden = name !== v

  const tabbed = v === 'login' || v === 'register'
  $('#auth-tabs').hidden = !tabbed
  $('#google-wrap').hidden = !tabbed
  document.querySelectorAll('.tab[data-tab]').forEach(tab => {
    tab.classList.toggle('on', tab.dataset.tab === v)
  })

  authTitle.textContent = VIEW_TEXT[v][0]
  authSub.textContent = (v === 'code' || v === 'reset')
    ? `We sent a 6-digit code to ${pendingEmail}.`
    : VIEW_TEXT[v][1]
  authMsg.textContent = message || ''

  if (tabbed) renderGoogleButton()
}

function showAuth(message) {
  authLayer.hidden = false
  $('#auth-body').hidden = false
  $('#guest-btn').hidden = false
  setView('login', message)
}

function hideAuth() {
  authLayer.hidden = true
}

async function checkServer() {
  try {
    const res = await fetch(API + '/status', { cache: 'no-store' })
    return (await res.json()).online === true
  } catch (error) {
    return null // could not reach the server at all
  }
}

function setUser(u) {
  user = u
  userChip.hidden = !u
  if (u) userChip.textContent = '👤 ' + u.name
}

function logout() {
  token = null
  try { localStorage.removeItem('token') } catch (error) {}
  setUser(null)
  clearScores()
  disconnect()
}

function renderGoogleButton() {
  if (!window.google || !google.accounts) {
    setTimeout(renderGoogleButton, 300)
    return
  }
  if (!googleStarted) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogle
    })
    googleStarted = true
  }
  googleBtn.innerHTML = ''
  google.accounts.id.renderButton(googleBtn, {
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text: view === 'register' ? 'signup_with' : 'signin_with',
    width: 260
  })
}

async function send(path, body, onOk) {
  authMsg.textContent = 'Please wait...'
  try {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) {
      authMsg.textContent = data.error || 'Something went wrong.'
      return
    }
    authMsg.textContent = ''
    onOk(data)
  } catch (error) {
    authMsg.textContent = 'Could not reach the server. Try again.'
  }
}

function finishLogin(data) {
  token = data.token
  try { localStorage.setItem('token', token) } catch (error) {}
  setUser(data.user)
  hideAuth()
  loadProfile()
  resultElement.textContent = `Welcome, ${data.user.name}!`
}

function handleGoogle(response) {
  send('/auth/google', { credential: response.credential }, data => {
    if (data.needsSetup) {
      setupToken = data.setupToken
      setView('setup')
    } else {
      finishLogin(data)
    }
  })
}

$('#login-go').addEventListener('click', () => {
  send('/auth/login', { id: $('#login-id').value, password: $('#login-pw').value }, finishLogin)
})

$('#reg-go').addEventListener('click', () => {
  pendingEmail = $('#reg-email').value.trim().toLowerCase()
  send('/auth/register', {
    email: pendingEmail,
    username: $('#reg-user').value.trim(),
    password: $('#reg-pw').value
  }, () => setView('code', 'Code sent. It expires in 10 minutes.'))
})

$('#code-go').addEventListener('click', () => {
  send('/auth/verify', { email: pendingEmail, code: $('#code-in').value }, finishLogin)
})

$('#setup-go').addEventListener('click', () => {
  send('/auth/setup', {
    token: setupToken,
    username: $('#setup-user').value.trim(),
    password: $('#setup-pw').value
  }, finishLogin)
})

document.querySelectorAll('.tab[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => setView(tab.dataset.tab))
})

$('#guest-btn').addEventListener('click', () => {
  hideAuth()
  setMode('computer')
})

userChip.addEventListener('click', openProfile)

async function handleConnectFail() {
  connectionStatus.textContent = 'Could not connect'
  playerCount.textContent = 'Players: 0/2'

  const status = await checkServer()
  if (status !== true) {
    resultElement.textContent = status === null
      ? '⚠️ Cannot reach the server.'
      : '🔴 The server is offline right now.'
    return
  }

  try {
    const res = await fetch(API + '/me?token=' + encodeURIComponent(token))
    if (res.status === 401) {
      logout()
      showAuth('Your login expired. Log in again.')
      return
    }
  } catch (error) {}

  resultElement.textContent = 'Could not join. That room may be full.'
}

async function startAuth() {
  const online = await checkServer()

  if (token && online) {
    try {
      const res = await fetch(API + '/me?token=' + encodeURIComponent(token))
      if (res.ok) {
        setUser((await res.json()).user)
        loadProfile()
        return
      }
    } catch (error) {}
    token = null
    try { localStorage.removeItem('token') } catch (error) {}
  }

  showAuth(
    online === true ? '' :
    online === false ? '🔴 The server is switched off right now. Come back soon!' :
    '⚠️ Cannot reach the server. Check the worker is deployed.'
  )
  if (online !== true) {
    kicked = true
    $('#auth-body').hidden = true
    $('#guest-btn').hidden = true
  }
}

startAuth()



/* ================= Profile, scores kept in the account, leaderboard ================= */

let profile = null

async function account(action, body) {
  try {
    const res = await fetch(API + '/account/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token })
    })
    const data = await res.json()
    if (res.status === 401) {
      $('#profile-layer').hidden = true
      logout()
      showAuth('Please log in again.')
    }
    return { ok: res.ok, data }
  } catch (error) {
    return { ok: false, data: { error: 'Could not reach the server.' } }
  }
}

function clearScores() {
  profile = null
  for (const key of ['online', 'computer']) {
    scores[key].wins = 0
    scores[key].losses = 0
    scores[key].ties = 0
    try { localStorage.removeItem(SCORE_KEYS[key]) } catch (error) {}
  }
  updateScoreElement()
}

async function loadProfile() {
  const r = await account('profile', {})
  if (!r.ok) return
  profile = r.data.user
  Object.assign(scores.online, profile.stats.online)
  Object.assign(scores.computer, profile.stats.computer)
  updateScoreElement()
}

function pfMsg(text) {
  $('#pf-msg').textContent = text
}

function renderProfile() {
  const line = s => `W ${s.wins}, L ${s.losses}, T ${s.ties}`
  $('#pf-name').textContent = user ? user.name : 'Profile'
  $('#pf-email').textContent = profile && profile.email ? profile.email : ''
  $('#pf-online').textContent = 'Online: ' + line(scores.online)
  $('#pf-computer').textContent = 'Computer: ' + line(scores.computer)
}

function openProfile() {
  $('#profile-layer').hidden = false
  pfMsg('')
  renderProfile()
}

// every score (online and computer) is recorded by the server

resetButton.addEventListener('click', () => {
  if (token) account('reset-score', { mode })
})

$('#pf-user-go').addEventListener('click', async () => {
  pfMsg('Please wait...')
  const r = await account('username', { username: $('#pf-user').value.trim(), password: $('#pf-cur').value })
  if (!r.ok) return pfMsg(r.data.error || 'Something went wrong.')
  token = r.data.token
  try { localStorage.setItem('token', token) } catch (error) {}
  setUser({ name: r.data.user.name })
  renderProfile()
  $('#pf-user').value = ''
  pfMsg('Username changed.')
})

$('#pf-pw-go').addEventListener('click', async () => {
  pfMsg('Please wait...')
  const r = await account('password', { password: $('#pf-cur').value, newPassword: $('#pf-new').value })
  if (!r.ok) return pfMsg(r.data.error || 'Something went wrong.')
  $('#pf-new').value = ''
  pfMsg('Password changed.')
})

$('#pf-logout').addEventListener('click', () => {
  $('#profile-layer').hidden = true
  logout()
  showAuth('')
})

$('#pf-delete').addEventListener('click', async () => {
  if (!confirm('Delete your account and all your scores? This cannot be undone.')) return
  pfMsg('Please wait...')
  const r = await account('delete', { password: $('#pf-cur').value })
  if (!r.ok) return pfMsg(r.data.error || 'Something went wrong.')
  $('#profile-layer').hidden = true
  logout()
  showAuth('Your account was deleted.')
})

async function openLeaderboard(which) {
  $('#lb-layer').hidden = false
  document.querySelectorAll('.tab[data-lb]').forEach(tab => {
    tab.classList.toggle('on', tab.dataset.lb === which)
  })

  const list = $('#lb-list')
  list.textContent = 'Loading...'

  try {
    const res = await fetch(API + '/leaderboard?mode=' + which, { cache: 'no-store' })
    const rows = (await res.json()).rows || []
    list.textContent = rows.length ? '' : 'No scores yet. Be the first!'

    rows.forEach((r, i) => {
      const row = document.createElement('div')
      row.className = 'row' + (user && r.name === user.name ? ' me' : '')
      const name = document.createElement('span')
      name.textContent = `${i + 1}. ${r.name}`
      const record = document.createElement('em')
      record.textContent = `${r.wins}W ${r.losses}L`
      row.append(name, record)
      list.append(row)
    })
  } catch (error) {
    list.textContent = 'Could not load the leaderboard.'
  }
}

$('#lb-btn').addEventListener('click', () => openLeaderboard('online'))

document.querySelectorAll('.tab[data-lb]').forEach(tab => {
  tab.addEventListener('click', () => openLeaderboard(tab.dataset.lb))
})

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => {
    button.closest('.ui-layer').hidden = true
  })
})



/* ================= Server turned off: send everyone back out ================= */

function kickOut() {
  kicked = true
  disconnect()
  computerBusy = false
  movesElement.innerHTML = ''
  resultElement.textContent = 'Join a room to play'
  $('#profile-layer').hidden = true
  $('#lb-layer').hidden = true
  showAuth('🔴 The server was switched off.')
  $('#auth-body').hidden = true
  $('#guest-btn').hidden = true
}

// check every 3 seconds: off means leave the game, back on means start fresh
setInterval(async () => {
  const online = await checkServer()
  if (online === false && !kicked) kickOut()
  if (online === true && kicked) location.reload()
}, 3000)



/* ================= Forgot password ================= */

$('#forgot-link').addEventListener('click', () => setView('forgot'))

document.querySelectorAll('[data-back]').forEach(button => {
  button.addEventListener('click', () => setView('login'))
})

$('#fg-go').addEventListener('click', () => {
  pendingEmail = $('#fg-email').value.trim().toLowerCase()
  send('/auth/forgot', { email: pendingEmail }, () => {
    setView('reset', 'If that email has an account, a code is on its way.')
  })
})

$('#rs-go').addEventListener('click', () => {
  send('/auth/reset', {
    email: pendingEmail,
    code: $('#rs-code').value,
    newPassword: $('#rs-pw').value
  }, finishLogin)
})
