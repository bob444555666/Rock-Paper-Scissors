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



/* ================= Computer opponent that works OFFLINE =================
   Same logic as the server. Used only when the server cannot be reached. */

const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' }

function randomFloat() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
}

function pickFrom(list) {
  return list[Math.floor(randomFloat() * list.length)]
}

function mostCommonMove(counts) {
  const best = Math.max(...MOVES.map(m => counts[m]))
  return pickFrom(MOVES.filter(m => counts[m] === best))
}

function predictMove(lvl, h) {
  const fresh = () => ({ rock: 0, paper: 0, scissors: 0 })
  let c, total

  if (lvl === 'insane' && h.length >= 3) {
    c = fresh(); total = 0
    const a = h[h.length - 2], b = h[h.length - 1]
    for (let i = 0; i < h.length - 2; i++) {
      if (h[i] === a && h[i + 1] === b) { c[h[i + 2]]++; total++ }
    }
    if (total) return mostCommonMove(c)
  }

  if ((lvl === 'hard' || lvl === 'insane') && h.length >= 2) {
    c = fresh(); total = 0
    const last = h[h.length - 1]
    for (let i = 0; i < h.length - 1; i++) {
      if (h[i] === last) { c[h[i + 1]]++; total++ }
    }
    if (total) return mostCommonMove(c)
  }

  c = fresh()
  ;(lvl === 'medium' ? h.slice(-10) : h).forEach(m => c[m]++)
  return mostCommonMove(c)
}

function playComputerOffline(lvl, history, move) {
  const smart = LEVELS[lvl] ? LEVELS[lvl].smart : 0
  const computerMove = history.length && randomFloat() < smart
    ? COUNTER[predictMove(lvl, history)]
    : pickFrom(MOVES)
  const result = move === computerMove ? 'tie' : BEATS[move] === computerMove ? 'win' : 'loss'
  return { computerMove, result }
}


async function playComputer(move) {

  if (computerBusy) {
    return
  }

  computerBusy = true
  movesElement.innerHTML = ''
  resultElement.textContent = 'Computer is choosing...'

  // normally the server picks the computer's move; if it can't be reached, play offline
  try {
    let data = null

    if (navigator.onLine !== false) {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 4000)
        const res = await fetch(API + '/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ move, level, token, history: playerHistory.slice(-50) }),
          signal: ctrl.signal
        })
        clearTimeout(timer)

        if (res.status === 401) {
          logout()
          showAuth('Please log in again.')
          return
        }

        if (res.ok) {
          data = await res.json()
        } else if (res.status !== 503) {
          const err = await res.json().catch(() => ({}))
          resultElement.textContent = err.error || 'Something went wrong.'
          return
        }
        // 503 = server switched off, so fall through to offline play
      } catch (error) {
        // could not reach the server, so fall through to offline play
      }
    }

    if (!data) {
      data = playComputerOffline(level, playerHistory.slice(-50), move)
    }

    playerHistory.push(move)

    if (mode === 'computer') {
      applyResult('computer', data.result, move, data.computerMove, 'Computer')
    }
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

  // keep a short log of rounds so the AI coach can see how you are playing
  ;(window.rpsLog = window.rpsLog || []).push({ mode: which, you: yourMove, opp: opponentMove, result, level: which === 'computer' ? level : '' })
  if (window.rpsLog.length > 60) window.rpsLog.shift()


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

const GOOGLE_CLIENT_ID = '673440193252-afoh2lbjqrduu3buqrt6lppnl89q8ogt.apps.googleusercontent.com'
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
  $('#guest-btn').textContent = 'Play the computer instead'
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
  $('#friends-btn').hidden = !u
  setChip()
}

function logout() {
  token = null
  try { localStorage.removeItem('token') } catch (error) {}
  setUser(null)
  clearScores()
  $('#friends-layer').hidden = true
  disconnect()
}

let googleTries = 0

function renderGoogleButton() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    // the Google script loads separately, so wait for it (about 15 seconds at most)
    if (++googleTries > 50) {
      googleBtn.textContent = 'Google sign-in could not load. Use your username and password instead.'
      return
    }
    setTimeout(renderGoogleButton, 300)
    return
  }
  googleTries = 0
  try {
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
  } catch (error) {
    googleBtn.textContent = 'Google sign-in is unavailable right now. Use your username and password instead.'
  }
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
    $('#guest-btn').hidden = false
    $('#guest-btn').textContent = 'Play the computer offline'
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
  setChip()
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

  const pic = user && profile && avatarUrl(user.name, profile.avatarAt)
  $('#pf-avatar').style.backgroundImage = pic ? `url("${pic}")` : ''
  $('#pf-avatar').textContent = pic ? '' : (user ? user.name[0].toUpperCase() : '?')
  $('#pf-email').textContent = profile && profile.email ? profile.email : ''
  $('#pf-online').textContent = 'Online: ' + line(scores.online)
  $('#pf-computer').textContent = 'Computer: ' + line(scores.computer)
}

function openProfile() {
  $('#profile-layer').hidden = false
  pfMsg('')
  picMsg('')
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

$('#lb-btn').addEventListener('click', () => {
  location.href = 'leaderboard.html'
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
  $('#friends-layer').hidden = true
  showAuth('🔴 The server was switched off.')
  $('#auth-body').hidden = true
  $('#guest-btn').hidden = false
  $('#guest-btn').textContent = 'Play the computer offline'
}

// check every 3 seconds: off means leave the game, back on means start fresh
setInterval(async () => {
  const online = await checkServer()
  if (online === false && !kicked && mode !== 'computer') kickOut()
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



/* ================= Profile picture (camera or library) ================= */

function avatarUrl(name, version) {
  return version ? `${API}/avatar/${encodeURIComponent(name)}?v=${version}` : ''
}

function setChip() {
  userChip.textContent = ''
  if (!user) return
  if (profile && profile.avatarAt) {
    const img = document.createElement('img')
    img.className = 'chip-avatar'
    img.src = avatarUrl(user.name, profile.avatarAt)
    userChip.append(img)
  } else {
    userChip.append('👤')
  }
  userChip.append(' ' + user.name)
}

// crop to a square and shrink to 128x128, so uploads are tiny
function pictureToJpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 128
      const side = Math.min(img.width, img.height)
      canvas.getContext('2d').drawImage(
        img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128
      )
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => reject(new Error('bad image'))
    img.src = url
  })
}

function picMsg(text) {
  $('#pf-pic-msg').textContent = text
}

async function savePicture(image) {
  if (image) {
    // show it straight away while it saves
    $('#pf-avatar').style.backgroundImage = `url("${image}")`
    $('#pf-avatar').textContent = ''
  }

  picMsg('Saving picture...')
  const r = await account('avatar', { image })

  if (!r.ok) {
    renderProfile()
    picMsg(r.data.error === 'Unknown request'
      ? 'The server is out of date. Deploy the newest index.js.'
      : (r.data.error || 'Could not save the picture.'))
    return
  }

  profile = profile || {}
  profile.avatarAt = r.data.avatarAt
  renderProfile()
  setChip()
  picMsg(image ? 'Picture saved!' : 'Picture removed.')
}

async function pickPicture(input) {
  const file = input.files[0]
  input.value = ''
  if (!file) return

  picMsg('Reading picture...')
  try {
    await savePicture(await pictureToJpeg(file))
  } catch (error) {
    picMsg('Could not read that picture. Try a different one.')
  }
}

$('#pf-cam-btn').addEventListener('click', () => $('#pf-cam').click())
$('#pf-lib-btn').addEventListener('click', () => $('#pf-lib').click())
$('#pf-cam').addEventListener('change', event => pickPicture(event.target))
$('#pf-lib').addEventListener('change', event => pickPicture(event.target))
$('#pf-remove-pic').addEventListener('click', () => savePicture(''))



/* ================= Friends ================= */

const friendsLayer = $('#friends-layer')

function frMsg(text) {
  $('#fr-msg').textContent = text
}

function miniAvatar(name, version) {
  const box = document.createElement('span')
  box.className = 'mini'
  box.textContent = name[0].toUpperCase()
  if (version) {
    const img = new Image()
    img.alt = ''
    img.onload = () => { box.textContent = ''; box.append(img) }
    img.src = avatarUrl(name, version)
  }
  return box
}

function miniButton(label, color, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'mini-btn ' + color
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function friendRow(f, buttons) {
  const row = document.createElement('div')
  row.className = 'row'
  const name = document.createElement('span')
  name.textContent = f.name + (f.waiting ? ' 🟢 waiting' : '')
  row.append(miniAvatar(f.name, f.avatarAt), name, ...buttons)
  return row
}

async function loadFriends() {
  if (!token) return
  const r = await account('friends', {})
  if (!r.ok) return

  const { friends, requests } = r.data
  $('#fr-badge').hidden = !requests.length
  $('#fr-badge').textContent = requests.length
  $('#fr-req-title').hidden = !requests.length

  const requestBox = $('#fr-requests')
  const list = $('#fr-list')
  requestBox.textContent = ''
  list.textContent = friends.length ? '' : 'No friends yet. Add one by username!'

  requests.forEach(q => requestBox.append(friendRow(q, [
    miniButton('Accept', 'green', () => friendAction('friend-accept', q.name)),
    miniButton('Decline', 'red', () => friendAction('friend-decline', q.name))
  ])))

  friends.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).forEach(f => list.append(friendRow(f, [
    miniButton(f.waiting ? 'Join' : 'Play', 'green', () => playFriend(f.name)),
    miniButton('✕', 'red', () => {
      if (confirm('Remove ' + f.name + ' from your friends?')) friendAction('friend-remove', f.name)
    })
  ])))
}

async function friendAction(action, name) {
  await account(action, { username: name })
  loadFriends()
}

async function playFriend(name) {
  frMsg('Opening your private room...')
  const r = await account('friend-room', { username: name })
  if (!r.ok) return frMsg(r.data.error || 'Could not open the room.')
  friendsLayer.hidden = true
  setMode('online')
  roomInput.value = r.data.room
  joinGame()
}

$('#friends-btn').addEventListener('click', () => {
  friendsLayer.hidden = false
  frMsg('')
  loadFriends()
})

$('#fr-add').addEventListener('click', async () => {
  frMsg('Please wait...')
  const r = await account('friend-add', { username: $('#fr-name').value.trim() })
  frMsg(r.ok ? r.data.message : (r.data.error || 'Something went wrong.'))
  if (r.ok) $('#fr-name').value = ''
  loadFriends()
})

// refresh quickly while the friends screen is open, slowly otherwise (for the request badge)
let friendTick = 0
setInterval(() => {
  friendTick++
  if (!token || kicked) return
  if (!friendsLayer.hidden || friendTick % 4 === 0) loadFriends()
}, 5000)
