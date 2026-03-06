// src/components/ChatBox.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { fetchGeminiStream } from '../services/gemini';
import VoiceRecorder from './VoiceRecorder';

export default function ChatBox() {
  const [input, setInput] = useState('');
  const { messages, addMessage, appendToLastMessage, isTyping, setIsTyping } = useChat();
  const abortControllerRef = useRef(null);
  
  // 节流与防抖标识，防止重复提交
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 组件卸载时取消未完成的请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isTyping || isSubmitting) return;

    setIsSubmitting(true);
    setInput('');
    
    // 1. 添加用户消息
    addMessage('user', text);
    // 2. 占位助手消息，准备开始流式接收
    addMessage('assistant', '');
    
    setIsTyping(true);

    // 终止前一个未完成的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // 构建传递给 API 的历史上下文（排除刚创建的空助手消息）
    const historyForAPI = [...messages, { role: 'user', content: text }];

    try {
      await fetchGeminiStream(
        historyForAPI,
        (chunk) => {
          // 逐字追加到最后一条助手消息中
          appendToLastMessage(chunk);
        },
        (errorMsg) => {
          appendToLastMessage(`\n\n[发生错误：${errorMsg}]`);
          setIsTyping(false);
        },
        () => {
          // 完成后的回调
          setIsTyping(false);
          setIsSubmitting(false);
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      console.error('发送消息失败', err);
      setIsTyping(false);
      setIsSubmitting(false);
    }
  };

  const handleVoiceInput = (text) => {
    setInput(prev => prev + text);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsTyping(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="chat-box-container">
      {isTyping && (
        <button type="button" className="stop-btn" onClick={stopGeneration}>
          停止生成
        </button>
      )}
      <form onSubmit={handleSubmit} className="input-form">
        <VoiceRecorder onTextRecognized={handleVoiceInput} />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="给 Lin 发送消息..."
          disabled={isSubmitting && !isTyping}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || (isSubmitting && !isTyping)}
          className="send-btn"
        >
          发送
        </button>
      </form>
    </div>
  );
}
