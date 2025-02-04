// Global variable to store questions loaded from the local JSON file
let questions = [];

// Load questions from questions.json when the page loads
fetch('questions.json')
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok.');
    }
    return response.json(); // Works fine whether the JSON is minified or pretty-printed
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
let countdown = 5; // Fixed timer of 5 seconds
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
    
    // Filter questions by selected subjects
    const selectedSubjects = Array.from(document.querySelectorAll('#subject-select input[type="checkbox"]:checked'))
                              .map(el => el.value);
    let filteredQuestions = questions.filter(q => selectedSubjects.includes(q.category));
    
    // Further filter by selected question set (source)
    const selectedSet = document.getElementById("set-select").value;
    if (selectedSet !== "All") {
      filteredQuestions = filteredQuestions.filter(q => q.source.startsWith(selectedSet));
    }
    
    if (filteredQuestions.length === 0) {
      document.getElementById("status").textContent = "No questions available for the selected subjects and set.";
      return;
    }
    
    // Select a random question from the filtered list
    let rawQuestion = filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)];
    currentQuestion = mapQuestion(rawQuestion);
    isBonusQuestion = false;
    countdown = 5; // Timer fixed at 5 seconds
    presentQuestion();
  }
}

// Mapping function: Converts a raw JSON question into our expected format.
// It differentiates multiple choice from short answer questions.
function mapQuestion(raw) {
  // Check if the question is multiple choice based on the tossup_format field
  if (raw.tossup_format && raw.tossup_format.toLowerCase().includes("multiple")) {
    // Multiple Choice Question: assume the question text includes a prompt
    // followed by newline-delimited options in the format "LETTER) Option text"
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
    // Extract the answer letter from the tossup_answer (e.g., "W) BASIC" → "W")
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
    // Toss-up / Short Answer Question
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
    // Display the multiple choice container and hide the toss-up input
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
    // Display the toss-up container and hide the multiple choice buttons
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
  document.querySelectorAll(".option").forEach((btn) => btn.disabled = true);
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
