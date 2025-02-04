// Global variable to store questions loaded from the local JSON file
let questions = [];

// Load questions from questions.json when the page loads
fetch('questions.json')
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok.');
    }
    return response.json(); // Works with minified (one-line) JSON
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
  // If a bonus question is pending, use it.
  if (isBonusQuestion && currentQuestion && currentQuestion.bonus) {
    currentQuestion = currentQuestion.bonus;
    presentQuestion();
  } else {
    if (!questions || questions.length === 0) {
      document.getElementById("status").textContent = "No questions loaded.";
      return;
    }
    // Filter questions based on selected subjects from the UI.
    const selectedSubjects = Array.from(document.querySelectorAll('#subject-select input[type="checkbox"]:checked'))
                              .map(el => el.value);
    const filteredQuestions = questions.filter(q => selectedSubjects.includes(q.category));
    if (filteredQuestions.length === 0) {
      document.getElementById("status").textContent = "No questions available for the selected subjects.";
      return;
    }
    let rawQuestion = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    // Map the raw JSON question into our expected format.
    currentQuestion = mapQuestion(rawQuestion);
    isBonusQuestion = false;
    countdown = parseInt(document.getElementById("set-timer").value, 10) || 10;
    presentQuestion();
  }
}

// Mapping function: Determines whether the question is multiple choice or toss-up.
function mapQuestion(raw) {
  if (raw.tossup_format && raw.tossup_format.toLowerCase().includes("multiple")) {
    // Multiple Choice Question: Split the tossup_question into a prompt and options.
    const parts = raw.tossup_question.split("\n");
    const prompt = parts[0];
    let options = {};
    for (let i = 1; i < parts.length; i++) {
      const match = parts[i].match(/^([A-Z])\)\s*(.*)/);
      if (match) {
        const letter = match[1];
        const text = match[2];
        options[letter] = text;
      }
    }
    // Extract just the letter from the tossup_answer (e.g., "W) BASIC" → "W")
    const answerLetter = raw.tossup_answer.trim()[0];
    return {
      type: "multiple",
      subject: raw.category,
      question: prompt,
      answer: answerLetter,
      options: options,
      bonus: {
        type: "toss-up",
        subject: raw.category,
        question: raw.bonus_question,
        answer: raw.bonus_answer,
      }
    };
  } else {
    // Short Answer / Toss-up Question
    return {
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
}

function presentQuestion() {
  const { type, subject, question, options } = currentQuestion;
  const prefix = isBonusQuestion ? "Bonus, " : "";
  if (type === "multiple") {
    // Display multiple choice UI.
    document.getElementById("multiple-choice-container").style.display = "flex";
    document.getElementById("toss-up-container").style.display = "none";
    const utterance = new SpeechSynthesisUtterance(
      `${prefix}Multiple choice, ${subject}, ${question}. ` +
      `W (${options.W}), X (${options.X}), Y (${options.Y}), Z (${options.Z}).`
    );
    utterance.onend = () => {
      speechActive = false;
      enableOptionButtons();
      startTimer();
    };
    playSpeech(utterance);
  } else if (type === "toss-up") {
    // Display toss-up UI.
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
