const questions = [
  {
    type: "multiple",
    subject: "Biology",
    question: "What is the primary structural component of plant cell walls?",
    options: { W: "Chitin", X: "Cellulose", Y: "Lignin", Z: "Hemicellulose" },
    answer: "X",
    bonus: {
      type: "toss-up",
      subject: "Biology",
      question: "What is the main function of mitochondria in cells?",
      answer: "Energy production",
    },
  },
  {
    type: "toss-up",
    subject: "Physics",
    question: "What is the term for the quantum mechanical property of electrons that leads to the Pauli exclusion principle?",
    answer: "Spin",
    bonus: {
      type: "multiple",
      subject: "Physics",
      question: "Which fundamental force is responsible for the structure of atoms?",
      options: { W: "Gravity", X: "Electromagnetic", Y: "Weak Nuclear", Z: "Strong Nuclear" },
      answer: "X",
    },
  },
  {
    type: "multiple",
    subject: "Chemistry",
    question: "Which of the following elements has the highest electronegativity?",
    options: { W: "Oxygen", X: "Fluorine", Y: "Chlorine", Z: "Nitrogen" },
    answer: "X",
    bonus: {
      type: "toss-up",
      subject: "Chemistry",
      question: "What is the atomic number of fluorine?",
      answer: "9",
    },
  },
];

let currentQuestion = null;
let timer = null;
let countdown = 10;
let speechActive = false;
let lockoutPeriod = false;
let userScore = 0;
let opponentScore = 0;
let isBonusQuestion = false;

document.getElementById("start-button").addEventListener("click", startGame);
document.getElementById("buzz-button").addEventListener("click", buzzIn);
document.getElementById("submit-answer").addEventListener("click", submitTossUp);

function startGame() {
  stopSpeech();
  resetUI();
  if (isBonusQuestion && currentQuestion.bonus) {
    currentQuestion = currentQuestion.bonus;
  } else {
    currentQuestion = questions[Math.floor(Math.random() * questions.length)];
    isBonusQuestion = false;
  }
  countdown = parseInt(document.getElementById("set-timer").value, 10) || 10;
  presentQuestion();
}

function presentQuestion() {
  const { type, subject, question, options } = currentQuestion;
  const prefix = isBonusQuestion ? "Bonus, " : "";

  if (type === "multiple") {
    document.getElementById("multiple-choice-container").style.display = "flex";
    document.getElementById("toss-up-container").style.display = "none";
    const utterance = new SpeechSynthesisUtterance(
      `${prefix}Multiple choice, ${subject}, ${question}. W (${options.W}), X (${options.X}), Y (${options.Y}), Z (${options.Z}).`
    );
    utterance.onend = () => {
      speechActive = false;
      enableOptionButtons();
      startTimer();
    };
    playSpeech(utterance);
  } else if (type === "toss-up") {
    document.getElementById("multiple-choice-container").style.display = "none";
    document.getElementById("toss-up-container").style.display = "block";
    const utterance = new SpeechSynthesisUtterance(`${prefix}Short answer, ${subject}, ${question}.`);
    utterance.onend = () => {
      speechActive = false;
      startTimer();
    };
    playSpeech(utterance);
  }
}

function resetUI() {
  resetButtonColors();
  const inputBox = document.getElementById("toss-up-answer");
  inputBox.value = "";
  inputBox.classList.remove("correct", "incorrect");
  inputBox.style.backgroundColor = "";
  inputBox.style.borderColor = "";
  document.getElementById("status").textContent = "Listen carefully...";
  document.getElementById("timer").textContent = `Timer: ${countdown}`;
}

function playSpeech(utterance) {
  stopSpeech();
  speechActive = true;
  window.speechSynthesis.speak(utterance);
}

function resetButtonColors() {
  document.querySelectorAll(".option").forEach((btn) => {
    btn.classList.remove("correct", "incorrect");
    btn.style.backgroundColor = "";
    btn.disabled = false;
  });
}

function enableOptionButtons() {
  if (!lockoutPeriod) {
    document.querySelectorAll(".option").forEach((btn) => {
      btn.disabled = false;
    });
  }
}

function disableOptionButtons() {
  document.querySelectorAll(".option").forEach((btn) => (btn.disabled = true));
}

function startTimer() {
  document.getElementById("timer").textContent = `Timer: ${countdown}`;
  clearInterval(timer);
  timer = setInterval(() => {
    countdown--;
    document.getElementById("timer").textContent = `Timer: ${countdown}`;
    if (countdown <= 0) {
      clearInterval(timer);
      document.getElementById("timer").textContent = "Opponent scores!";
      disableOptionButtons();
      opponentScore++;
      updateScores();
    }
  }, 1000);
}

function buzzIn() {
  clearInterval(timer);
  document.getElementById("timer").textContent = "Buzzed in!";
  disableOptionButtons();
  lockoutPeriod = true;
  if (speechActive) {
    stopSpeech();
    speechActive = false;
  }
  const utterance = new SpeechSynthesisUtterance("Bee one");
  playSpeech(utterance);
  setTimeout(() => {
    lockoutPeriod = false;
    enableOptionButtons();
    document.getElementById("status").textContent = "Select an answer!";
  }, 1000);
}

function submitTossUp() {
  const inputBox = document.getElementById("toss-up-answer");
  const userAnswer = inputBox.value.trim();
  inputBox.classList.remove("correct", "incorrect");
  if (userAnswer === currentQuestion.answer) {
    document.getElementById("status").textContent = "Correct!";
    inputBox.classList.add("correct");
    userScore += isBonusQuestion ? 10 : 1;
    isBonusQuestion = !isBonusQuestion;
    const utterance = new SpeechSynthesisUtterance("Correct");
    playSpeech(utterance);
  } else {
    document.getElementById("status").textContent = `Incorrect! The answer was ${currentQuestion.answer}.`;
    inputBox.classList.add("incorrect");
    opponentScore++;
    isBonusQuestion = false;
    const utterance = new SpeechSynthesisUtterance("Incorrect");
    playSpeech(utterance);
  }
  updateScores();
}

document.querySelectorAll(".option").forEach((btn) =>
  btn.addEventListener("click", (e) => {
    if (lockoutPeriod) return;
    const selectedOption = e.target.id.split("-")[1].toUpperCase();
    const correct = selectedOption === currentQuestion.answer;
    if (correct) {
      e.target.classList.add("correct");
      document.getElementById("status").textContent = "Correct!";
      userScore += isBonusQuestion ? 10 : 1;
      isBonusQuestion = !isBonusQuestion;
      const utterance = new SpeechSynthesisUtterance("Correct");
      playSpeech(utterance);
    } else {
      e.target.classList.add("incorrect");
      document.getElementById("status").textContent = `Incorrect! The correct answer was ${currentQuestion.answer}.`;
      opponentScore++;
      isBonusQuestion = false;
      const utterance = new SpeechSynthesisUtterance("Incorrect");
      playSpeech(utterance);
    }
    disableOptionButtons();
    updateScores();
  })
);

function updateScores() {
  document.getElementById("user-score").textContent = userScore;
  document.getElementById("opponent-score").textContent = opponentScore;
}

function stopSpeech() {
  window.speechSynthesis.cancel();
}
