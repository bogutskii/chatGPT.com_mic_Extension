export const initializeSpeechRecognition = (language) => {
  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Speech recognition is not supported in this browser');
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