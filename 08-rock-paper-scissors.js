const score = {
  wins: 0,
  losses: 0,
  ties: 0
};





console.log(localStorage.getItem('message'));








const rock = document.getElementById ("stone");
const paper = document.getElementById ("paper");
const scissors = document.getElementById ("scissors");
const resetScore = document.getElementById ("resetScore");


rock.addEventListener("click", function () {
  playGame('stone');


});

 


paper.addEventListener("click", function () {
  playGame('paper');
});



scissors.addEventListener("click", function () {
  
playGame('scissors');

});



resetScore.addEventListener("click", function () {
  score.wins = 0;
  score.losses = 0;
  score.ties = 0;
});




function pickComputerMove() {
    const randomNumber = Math.random();

    let computerMove = '';

    
    if (randomNumber >= 0 && randomNumber < 1 / 3) {
      computerMove = 'stone';
    } else if (randomNumber >= 1 / 3 && randomNumber < 2 / 3) {
      computerMove = 'paper';
    } else if (randomNumber >= 2 / 3 && randomNumber < 1) {
      computerMove = 'scissors';
    }

  return computerMove;

}


function playGame(playerMove) {
const computerMove = pickComputerMove();

  let result = '';


if (playerMove === 'scissors') {
    if (computerMove === 'stone') {
    result = 'You lose.';
    } else if (computerMove === 'paper') {
      result = 'You win.';
    } else if (computerMove === 'scissors') {
      result = 'Tie.';
    } 
} 

else if (playerMove === 'paper') {
  const computerMove = pickComputerMove();


 
  if (computerMove === 'stone') {
   result = 'You win.';
  } else if (computerMove === 'paper') {
    result = 'Tie.';
  } else if (computerMove === 'scissors') {
    result = 'You lose.';
  }
} 

else if (playerMove === 'stone') {
const computerMove = pickComputerMove();

  

  if (computerMove === 'rock') {
   result = 'Tie.';
  } else if (computerMove === 'paper') {
    result = 'You lose.';
  } else if (computerMove === 'scissors') {
    result = 'You win.';
  }
}


if (result === 'You win.') {
  score.wins = score.wins + 1;
} 
else if (result === 'You lose.') {
  score.losses = score.losses + 1;
} 
else if (result === 'Tie.') {
  score.ties = score.ties + 1;
}


localStorage.setItem('message', 'hello');





alert(`You picked ${playerMove}. Computer picked ${computerMove}. ${result}
Wins: ${score.wins}, Losses: ${score.losses}, Ties: ${score.ties}`);
}
