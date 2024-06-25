// Create a button element
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

// Append the button to the body
document.body.appendChild(micButton);

// Web Speech API setup
let recognition;

if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
} else if ('SpeechRecognition' in window) {
  recognition = new SpeechRecognition();
} else {
  alert("Ваш браузер не поддерживает Web Speech API");
}

if (recognition) {
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'ru-RU'; // Устанавливаем язык на русский

  recognition.onstart = () => {
    console.log('Recognition started');
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';

    for (let i = 0; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      }
    }

    const inputField = document.querySelector('#prompt-textarea');
    if (inputField) {
      inputField.value = finalTranscript;
      inputField.dispatchEvent(new Event('input'));
    }
  };

  recognition.onerror = (event) => {
    console.error('Recognition error!!', event);
  };

  recognition.onend = () => {
    console.log('Recognition ended');
  };

  micButton.addEventListener('click', () => {
    recognition.start();
  });
}
