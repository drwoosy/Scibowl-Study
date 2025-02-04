// Global variable to store questions loaded from the local JSON file
let questions = [];

// Load questions from questions.json when the page loads.
// It doesn't matter if the JSON is minified (one line) or pretty printed.
fetch('questions.json')
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok.');
    }
    return response.json(); // This parses the JSON text into a JavaScript object
  })
  .then(data => {
    questions = data.questions;
    document.getElementById("status").textContent = "Questions loaded. Click 'Start' to begin!";
  })
  .catch(error => {
    console.error('Error loading questions:', error);
    document.getElementById("status").textContent = "Error loading questions.";
  });

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
  // If a bonus question is pending from the previous question, use it.
  if (isBonusQuestion && currentQuestion && currentQuestion.bonus) {
    currentQuestion = currentQuestion.bonus;
    presentQuestion();
  } else {
    if (!questions || questions.length === 0) {
      document.getElementById("status").textContent = "No questions loaded.";
      return;
    }
    // Choose a random question from the loaded questions.
    let rawQuestion = questions[Math.floor(Math.random() * questions.length)];
    // Map the raw question from the JSON to our game’s expected format.
    currentQuestion = mapQuestion(rawQuestion);
    isBonusQuestion = false;
    countdown = parseInt(document.getElementById("set-timer").value, 10) || 10;
    presentQuestion();
  }
}

// Mapping function to convert a raw JSON question from SciBowlDB into our format.
function mapQuestion(raw) {
  return {
    // For simplicity, we assume all questions are toss-ups.
    type: "toss-up",
    subject: raw.category,
    question: raw.tossup_question,
    answer: raw.tossup_answer,
    bonus: {
      type: "toss-up",
      subject: raw.category,
      question: raw.bonus_question,
      answer: raw.bonus_answer,
    }
  };
}

function presentQuestion() {
  const { type, subject, question, options } = currentQuestion;
  const prefix = isBonusQuestion ? "Bonus, " : "";

  if (type === "multiple") {
    // If you have multiple-choice questions with options, show the options container.
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
    // For toss-up questions, show the input container.
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
