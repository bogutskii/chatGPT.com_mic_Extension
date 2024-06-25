// Создание кнопки микрофона
const micButton = document.createElement('button');
micButton.innerHTML = '🎤';
micButton.style.position = 'absolute';
micButton.style.right = '10px';
micButton.style.bottom = '10px';
micButton.style.zIndex = '1000';
micButton.style.backgroundColor = '#fff';
micButton.style.border = '1px solid #ccc';
micButton.style.borderRadius = '50%';
micButton.style.width = '40px';
micButton.style.height = '40px';
micButton.style.cursor = 'pointer';

// Добавление кнопки на страницу
document.body.appendChild(micButton);

// Переменные для состояния записи и распознавания речи
let isListening = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

// Настройка распознавания речи
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'ru-RU'; // Устанавливаем язык на русский

let finalTranscript = '';
let interimTranscript = '';

recognition.onresult = (event) => {
  interimTranscript = '';
  let finalTranscriptFragment = '';

  for (let i = event.resultIndex; i < event.results.length; ++i) {
    const transcript = event.results[i][0].transcript;

    if (event.results[i].isFinal) {
      finalTranscriptFragment += transcript + ' ';
    } else {
      interimTranscript += transcript;
    }
  }

  finalTranscript += finalTranscriptFragment;

  const inputField = document.querySelector('#prompt-textarea');
  if (inputField) {
    inputField.value = finalTranscript + interimTranscript;
    inputField.dispatchEvent(new Event('input'));
  }
};

recognition.onerror = (event) => {
  console.error('Recognition error', event);
  isListening = false;
  micButton.style.backgroundColor = '#fff'; // Возвращаем цвет кнопки к исходному
};

recognition.onend = () => {
  if (isListening) {
    recognition.start(); // Перезапуск записи, если она должна продолжаться
  } else {
    micButton.style.backgroundColor = '#fff'; // Возвращаем цвет кнопки к исходному
  }
};

micButton.addEventListener('click', () => {
  const inputField = document.querySelector('#prompt-textarea');
  if (isListening) {
    recognition.stop();
    isListening = false;
  } else {
    finalTranscript = inputField.value; // Сохраняем текущий текст при начале новой записи
    interimTranscript = '';
    recognition.start();
    isListening = true;
  }
  micButton.style.backgroundColor = isListening ? 'red' : '#fff';
});
