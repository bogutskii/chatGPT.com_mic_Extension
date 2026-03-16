export const initializeSpeechRecognition = (language) => {
  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition is not supported in this browser');
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    return recognition;
  } catch (error) {
    console.error('Failed to initialize speech recognition:', error);
    return null;
  }
};