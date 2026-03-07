// src/context/ChatContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  // 从 localStorage 恢复历史会话
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : [
      { id: '1', role: 'assistant', content: '你好！我是 Lin 智能对话助手。有什么我可以帮你的吗？' }
    ];
  });
  
  const [isTyping, setIsTyping] = useState(false);
  const [theme, setTheme] = useState('light'); // 'light' | 'dark'

  // 每当 messages 更新时，持久化到 localStorage
  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(messages));
  }, [messages]);

  // 添加新消息的助手函数
  const addMessage = useCallback((role, content) => {
    const newMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      role,
      content
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  // 更新最后一条助手消息的内容（用于流式输出追加文本）
  const appendToLastMessage = useCallback((textChunk) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        newMessages[newMessages.length - 1] = {
          ...lastMsg,
          content: (lastMsg.content || '') + textChunk
        };
      }
      return newMessages;
    });
  }, []);

  // 替换最后一条助手消息的全部内容（用于重试时重置气泡）
  const updateLastMessage = useCallback((content) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        newMessages[newMessages.length - 1] = { ...lastMsg, content };
      }
      return newMessages;
    });
  }, []);

  // 清空会话历史
  const clearHistory = useCallback(() => {
    setMessages([{ id: '1', role: 'assistant', content: '历史会话已清空，我们重新开始吧。' }]);
    localStorage.removeItem('chat_history');
  }, []);

  // 切换主题
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const value = {
    messages,
    isTyping,
    setIsTyping,
    addMessage,
    appendToLastMessage,
    updateLastMessage,
    clearHistory,
    theme,
    toggleTheme
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
