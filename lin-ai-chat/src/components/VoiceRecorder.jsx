// src/components/VoiceRecorder.jsx
import React, { useState, useEffect, useRef } from 'react';

export default function VoiceRecorder({ onTextRecognized }) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // 检查浏览器是否支持 Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false; // 是否返回临时结果
      recognition.lang = 'zh-CN';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onTextRecognized(transcript);
        setIsRecording(false);
      };

      recognition.onerror = (event) => {
        console.error('语音识别错误: ', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('当前浏览器不支持 Web Speech API');
    }
  }, [onTextRecognized]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('您的浏览器不支持语音识别功能，请尝试使用 Chrome。');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('启动语音识别失败: ', error);
      }
    }
  };

  return (
    <button 
      type="button"
      className={`voice-btn ${isRecording ? 'recording' : ''}`}
      onClick={toggleRecording}
      title="点击使用语音输入"
    >
      {isRecording ? '录音中...' : '🎤 语音'}
    </button>
  );
}
