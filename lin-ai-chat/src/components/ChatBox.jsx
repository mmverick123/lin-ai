// src/components/ChatBox.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../context/ChatContext';
import { fetchGeminiStream } from '../services/gemini';
import VoiceRecorder from './VoiceRecorder';

export default function ChatBox() {
  const [input, setInput] = useState('');
  const { messages, addMessage, appendToLastMessage, updateLastMessage, isTyping, setIsTyping } = useChat();
  const abortControllerRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 重试状态提示文字，null 表示无正在重试
  const [retryStatus, setRetryStatus] = useState(null);

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
    setRetryStatus(null);
    setInput('');

    addMessage('user', text);
    addMessage('assistant', '');
    setIsTyping(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const historyForAPI = [...messages, { role: 'user', content: text }];

    const resetState = () => {
      setIsTyping(false);
      setIsSubmitting(false);
      setRetryStatus(null);
    };

    try {
      await fetchGeminiStream(
        historyForAPI,
        (chunk) => appendToLastMessage(chunk),
        (errorMsg) => {
          // 修复：原来此处遗漏了 setIsSubmitting(false)
          appendToLastMessage(`\n\n[发生错误：${errorMsg}]`);
          resetState();
        },
        () => resetState(),
        abortControllerRef.current.signal,
        {
          maxRetries: 3,
          timeoutMs: 30000,
          // 每次重试前：清空气泡内容 + 在顶部展示重试提示
          onRetry: (attempt, maxRetries, reason) => {
            const hint = reason === 'timeout'
              ? `网络超时，正在重试 (${attempt}/${maxRetries})...`
              : `请求失败，正在重试 (${attempt}/${maxRetries})...`;
            setRetryStatus(hint);
            updateLastMessage(''); // 清空上次失败的残留内容
          },
          // 新一轮流式内容开始时，清除重试提示
          onStreamStart: () => setRetryStatus(null),
        }
      );
    } catch (err) {
      console.error('发送消息失败', err);
      resetState();
    }
  };

  const handleVoiceInput = useCallback((text) => {
    setInput(prev => prev + text);
  }, []);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsTyping(false);
      setIsSubmitting(false);
      setRetryStatus(null);
    }
  };

  return (
    <div className="chat-box-container">
      {retryStatus && (
        <div className="retry-status">
          <span className="retry-spinner" />
          {retryStatus}
        </div>
      )}
      {isTyping && !retryStatus && (
        <button type="button" className="stop-btn" onClick={stopGeneration}>
          停止生成
        </button>
      )}
      {retryStatus && (
        <button type="button" className="stop-btn stop-btn--retry" onClick={stopGeneration}>
          取消重试
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
