// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { useChat } from './context/ChatContext';

// 使用 React.lazy 和 Suspense 实现组件的懒加载，提升首屏加载速度
const MessageList = lazy(() => import('./components/MessageList'));
const ChatBox = lazy(() => import('./components/ChatBox'));

export default function App() {
  const { clearHistory, theme, toggleTheme } = useChat();

  return (
    <div className={`app-container ${theme}`}>
      <header className="app-header">
        <div className="header-left">
          <h1>Lin - 智能 AI 对话助手</h1>
          <span className="badge">Gemini</span>
        </div>
        <div className="header-right">
          <button onClick={toggleTheme} className="icon-btn" title="切换主题">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button onClick={clearHistory} className="clear-btn">
            清空对话
          </button>
        </div>
      </header>

      <main className="main-content">
        <Suspense fallback={<div className="loading">加载对话列表中...</div>}>
          <MessageList />
        </Suspense>
      </main>

      <footer className="app-footer">
        <Suspense fallback={<div className="loading">加载输入框中...</div>}>
          <ChatBox />
        </Suspense>
      </footer>
    </div>
  );
}
