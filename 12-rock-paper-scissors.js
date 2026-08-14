// ==========================================
// ROCK PAPER SCISSORS
// ==========================================

let score = JSON.parse(localStorage.getItem('score')) || {
  wins: 0,
  losses: 0,
  ties: 0
};

updateScoreElement();

let isAutoPlaying = false;
let intervalId;


// ==========================================
// AUTO PLAY
// ==========================================

function autoPlay() {

  if (!isAutoPlaying) {

    intervalId = setInterval(() => {

      const playerMove = pickComputerMove();

      playGame(playerMove);

    }, 1000);

    isAutoPlaying = true;

  } else {

    clearInterval(intervalId);

    isAutoPlaying = false;
  }
}


// ==========================================
// GAME BUTTONS
// ==========================================

document.querySelector('.js-rock-button')
  .addEventListener('click', () => {

    playGame('rock');

  });


document.querySelector('.js-paper-button')
  .addEventListener('click', () => {

    playGame('paper');

  });


document.querySelector('.js-scissors-button')
  .addEventListener('click', () => {

    playGame('scissors');

  });


// ==========================================
// KEYBOARD CONTROLS
// ==========================================

document.body.addEventListener('keydown', (event) => {

  if (event.key === 'r') {

    playGame('rock');

  } else if (event.key === 'p') {

    playGame('paper');

  } else if (event.key === 's') {

    playGame('scissors');

  }

});


// ==========================================
// PLAY GAME
// ==========================================

function playGame(playerMove) {

  const computerMove = pickComputerMove();

  let result = '';


  if (playerMove === 'scissors') {

    if (computerMove === 'rock') {

      result = 'You lose.';

    } else if (computerMove === 'paper') {

      result = 'You win.';

    } else {

      result = 'Tie.';

    }


  } else if (playerMove === 'paper') {

    if (computerMove === 'rock') {

      result = 'You win.';

    } else if (computerMove === 'paper') {

      result = 'Tie.';

    } else {

      result = 'You lose.';

    }


  } else if (playerMove === 'rock') {

    if (computerMove === 'rock') {

      result = 'Tie.';

    } else if (computerMove === 'paper') {

      result = 'You lose.';

    } else {

      result = 'You win.';

    }
  }


  if (result === 'You win.') {

    score.wins += 1;

  } else if (result === 'You lose.') {

    score.losses += 1;

  } else {

    score.ties += 1;
  }


  localStorage.setItem(
    'score',
    JSON.stringify(score)
  );


  updateScoreElement();


  document.querySelector('.js-result')
    .innerHTML = result;


  document.querySelector('.js-moves')
    .innerHTML = `You

      <img
        src="images/${playerMove}-emoji.png"
        class="move-icon">

      <img
        src="images/${computerMove}-emoji.png"
        class="move-icon">

      Computer`;
}


// ==========================================
// UPDATE SCORE
// ==========================================

function updateScoreElement() {

  document.querySelector('.js-score')
    .innerHTML =
      `Wins: ${score.wins}, Losses: ${score.losses}, Ties: ${score.ties}`;
}


// ==========================================
// COMPUTER MOVE
// ==========================================

function pickComputerMove() {

  const randomNumber = Math.random();

  let computerMove = '';


  if (randomNumber < 1 / 3) {

    computerMove = 'rock';

  } else if (randomNumber < 2 / 3) {

    computerMove = 'paper';

  } else {

    computerMove = 'scissors';
  }


  return computerMove;
}


// ==========================================
// RESET SCORE
// ==========================================

document.querySelector('#reset-score-button')
  .addEventListener('click', () => {

    score.wins = 0;
    score.losses = 0;
    score.ties = 0;

    localStorage.removeItem('score');

    updateScoreElement();

  });


// ==========================================
// AUTO PLAY BUTTON
// ==========================================

document.querySelector('#auto-play-button')
  .addEventListener('click', () => {

    autoPlay();

  });


// ==========================================
// ACCOUNT SYSTEM
// ==========================================

const loginPage =
  document.querySelector('.login-page');

const signupPage =
  document.querySelector('.signup-page');

const game =
  document.querySelector('.game');


// ==========================================
// CREATE ACCOUNT
// ==========================================

document.querySelector('#create-account-button')
  .addEventListener('click', () => {

    loginPage.style.display = 'none';

    signupPage.style.display = 'flex';

  });


// ==========================================
// BACK TO LOGIN
// ==========================================

document.querySelector('#back-to-login')
  .addEventListener('click', () => {

    signupPage.style.display = 'none';

    loginPage.style.display = 'flex';

  });


// ==========================================
// SIGN UP
// ==========================================

document.querySelector('#signup-button')
  .addEventListener('click', () => {

    const username =
      document.querySelector('#signup-username').value.trim();

    const password =
      document.querySelector('#signup-password').value;


    if (username === '' || password === '') {

      document.querySelector('#signup-message')
        .innerHTML =
        'Enter a username and password.';

      return;
    }


    const existingUser =
      localStorage.getItem(`user_${username}`);


    if (existingUser) {

      document.querySelector('#signup-message')
        .innerHTML =
        'That username is already being used.';

      return;
    }


    const user = {

      username: username,

      password: password

    };


    localStorage.setItem(
      `user_${username}`,
      JSON.stringify(user)
    );


    document.querySelector('#signup-message')
      .style.color = '#188038';


    document.querySelector('#signup-message')
      .innerHTML =
      'Account created! You can now sign in.';


    document.querySelector('#signup-username')
      .value = '';

    document.querySelector('#signup-password')
      .value = '';

  });


// ==========================================
// SIGN IN
// ==========================================

document.querySelector('#login-button')
  .addEventListener('click', () => {

    const username =
      document.querySelector('#login-username').value.trim();

    const password =
      document.querySelector('#login-password').value;


    const savedUser =
      localStorage.getItem(`user_${username}`);


    if (!savedUser) {

      document.querySelector('#login-message')
        .innerHTML =
        'Couldn’t find your account.';

      return;
    }


    const user =
      JSON.parse(savedUser);


    if (password !== user.password) {

      document.querySelector('#login-message')
        .innerHTML =
        'Wrong password.';

      return;
    }


    // LOGIN SUCCESSFUL

    loginPage.style.display = 'none';

    signupPage.style.display = 'none';

    game.style.display = 'block';

  });
