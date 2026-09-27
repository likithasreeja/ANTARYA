import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';
import api from '../api';

// Check if browser supports Web Speech API
const hasSpeechRecognition = typeof window !== 'undefined' && (
  window.SpeechRecognition || window.webkitSpeechRecognition
);

export default function VoiceButton({ onResult, size = 'large', label, language = 'en-IN' }) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // ============================================
  // Method 1: Web Speech API (browser-native)
  // ============================================
  const startBrowserSpeech = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (text && onResult) onResult(text);
      setListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      // If browser speech fails, try Bhashini
      if (event.error === 'not-allowed' || event.error === 'service-not-available') {
        startBhashiniSpeech();
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    return true;
  }, [onResult, language]);

  // ============================================
  // Method 2: Bhashini API (record audio → send base64)
  // ============================================
  const startBhashiniSpeech = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 }
      });

      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setListening(false);
        setProcessing(true);

        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const base64 = await blobToBase64(blob);

          // Send to Bhashini ASR
          const result = await api.speechToText(base64, language.split('-')[0]);
          if (result.text && onResult) {
            onResult(result.text);
          } else if (result.fallback) {
            // Bhashini not configured — show info
            console.log('Bhashini not configured, using browser speech');
          }
        } catch (err) {
          console.error('Bhashini ASR error:', err);
        }
        setProcessing(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setListening(true);

      // Auto-stop after 8 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 8000);
    } catch (err) {
      console.error('Mic access error:', err);
      setListening(false);
    }
  }, [onResult, language]);

  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  };

  // ============================================
  // Start / Stop
  // ============================================
  const handleClick = () => {
    if (listening) {
      // Stop
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setListening(false);
      return;
    }

    if (processing) return;

    // Try browser speech first, then Bhashini
    if (hasSpeechRecognition) {
      startBrowserSpeech();
    } else {
      startBhashiniSpeech();
    }
  };

  // ============================================
  // Render
  // ============================================
  if (size === 'small') {
    return (
      <button
        className={`btn ${listening ? 'btn-danger' : 'btn-secondary'}`}
        onClick={handleClick}
        disabled={processing}
        style={{ padding: '10px 14px', position: 'relative' }}
        title={listening ? 'Stop listening' : 'Start voice input'}
      >
        {processing ? (
          <Loader size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
        ) : listening ? (
          <MicOff size={16} />
        ) : (
          <>{label || <Mic size={16} />}</>
        )}
      </button>
    );
  }

  // Large voice button (for QuickSale)
  return (
    <div className="voice-btn-container">
      <button
        className={`voice-btn ${listening ? 'listening' : ''}`}
        onClick={handleClick}
        disabled={processing}
      >
        <div className="voice-ripple"></div>
        <div className="voice-ripple"></div>
        <div className="voice-ripple"></div>
        {processing ? (
          <Loader size={38} style={{ animation: 'spin 0.7s linear infinite' }} />
        ) : listening ? (
          <MicOff size={38} />
        ) : (
          <Mic size={38} />
        )}
        <span>{processing ? 'Processing...' : listening ? 'Listening...' : 'Tap to Speak'}</span>
      </button>
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '0.78rem',
        marginTop: 12,
        textAlign: 'center'
      }}>
        {listening ? '🎤 Speak now — I\'m listening' : 'Hindi / English supported'}
      </p>
    </div>
  );
}
