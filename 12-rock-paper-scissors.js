// ================================
// LOGIN / SIGN UP
// ================================

const authPage = document.querySelector('.auth-page');
const signupPage = document.querySelector('.signup-page');
const gameContainer = document.querySelector('.game-container');


// CREATE ACCOUNT PAGE

document.querySelector('#show-signup')
  .addEventListener('click', () => {

    authPage.style.display = 'none';
    signupPage.style.display = 'flex';

  });


// LOGIN PAGE

document.querySelector('#show-login')
  .addEventListener('click', () => {

    signupPage.style.display = 'none';
    authPage.style.display = 'flex';

  });


// SIGN UP

document.querySelector('#signup-button')
  .addEventListener('click', () => {

    const username =
      document.querySelector('#signup-username').value;

    const password =
      document.querySelector('#signup-password').value;


    if (username === '' || password === '') {

      document.querySelector('#signup-message').innerHTML =
        'Enter a username and password.';

      return;
    }


    const existingUser =
      localStorage.getItem(`user_${username}`);


    if (existingUser) {

      document.querySelector('#signup-message').innerHTML =
        'That account already exists.';

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


    document.querySelector('#signup-message').style.color =
      '#188038';

    document.querySelector('#signup-message').innerHTML =
      'Account created! Now sign in.';


    document.querySelector('#signup-username').value = '';
    document.querySelector('#signup-password').value = '';

  });


// LOGIN

document.querySelector('#login-button')
  .addEventListener('click', () => {

    const username =
      document.querySelector('#login-username').value;

    const password =
      document.querySelector('#login-password').value;


    const savedUser =
      localStorage.getItem(`user_${username}`);


    if (!savedUser) {

      document.querySelector('#login-message').innerHTML =
        'Incorrect username or password.';

      return;
    }


    const user = JSON.parse(savedUser);


    if (user.password !== password) {

      document.querySelector('#login-message').innerHTML =
        'Incorrect username or password.';

      return;
    }


    // LOGIN SUCCESSFUL

    authPage.style.display = 'none';

    signupPage.style.display = 'none';

    gameContainer.style.display = 'block';

  });





let score = JSON.parse(localStorage.getItem('score')) || {
  wins: 0,
  losses: 0,
  ties: 0
};

updateScoreElement();

/*
if (!score) {
  score = {
    wins: 0,
    losses: 0,
    ties: 0
  };
}
*/

let isAutoPlaying = false;
let intervalId;

//const autoPlay = () => {

//};
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

document.body.addEventListener('keydown', (event) => {
  if (event.key === 'r') {
    playGame('rock');
  } else if (event.key === 'p') {
    playGame('paper');
  } else if (event.key === 's') {
    playGame('scissors');
  }
});

function playGame(playerMove) {
  const computerMove = pickComputerMove();

  let result = '';

  if (playerMove === 'scissors') {
    if (computerMove === 'rock') {
      result = 'You lose.';
    } else if (computerMove === 'paper') {
      result = 'You win.';
    } else if (computerMove === 'scissors') {
      result = 'Tie.';
    }

  } else if (playerMove === 'paper') {
    if (computerMove === 'rock') {
      result = 'You win.';
    } else if (computerMove === 'paper') {
      result = 'Tie.';
    } else if (computerMove === 'scissors') {
      result = 'You lose.';
    }
    
  } else if (playerMove === 'rock') {
    if (computerMove === 'rock') {
      result = 'Tie.';
    } else if (computerMove === 'paper') {
      result = 'You lose.';
    } else if (computerMove === 'scissors') {
      result = 'You win.';
    }
  }

  if (result === 'You win.') {
    score.wins += 1;
  } else if (result === 'You lose.') {
    score.losses += 1;
  } else if (result === 'Tie.') {
    score.ties += 1;
  }

  localStorage.setItem('score', JSON.stringify(score));

  updateScoreElement();

  document.querySelector('.js-result').innerHTML = result;

  document.querySelector('.js-moves').innerHTML = `You
<img src="images/${playerMove}-emoji.png" class="move-icon">
<img src="images/${computerMove}-emoji.png" class="move-icon">
Computer`;
}

function updateScoreElement() {
  document.querySelector('.js-score')
    .innerHTML = `Wins: ${score.wins}, Losses: ${score.losses}, Ties: ${score.ties}`;
}

function pickComputerMove() {
  const randomNumber = Math.random();

  let computerMove = '';

  if (randomNumber >= 0 && randomNumber < 1 / 3) {
    computerMove = 'rock';
  } else if (randomNumber >= 1 / 3 && randomNumber < 2 / 3) {
    computerMove = 'paper';
  } else if (randomNumber >= 2 / 3 && randomNumber < 1) {
    computerMove = 'scissors';
  }

  return computerMove;
}
