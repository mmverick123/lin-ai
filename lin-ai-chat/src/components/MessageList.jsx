// src/components/MessageList.jsx
import React, { useRef, useEffect, useCallback } from 'react';
import { List, useDynamicRowHeight } from 'react-window';
import { useChat } from '../context/ChatContext';

const SCROLL_BOTTOM_THRESHOLD = 80; // px，距底部多少像素内视为"在底部"

const MessageRow = ({ index, style, ariaAttributes, messages, isTyping, observeRowElements }) => {
  const rowRef = useRef(null);
  const message = messages[index];
  const isLast = index === messages.length - 1;

  useEffect(() => {
    if (rowRef.current) {
      return observeRowElements([rowRef.current]);
    }
  });

  return (
    <div style={style} {...ariaAttributes}>
      <div ref={rowRef} className={`message-wrapper ${message?.role || ''}`}>
        <div className="message-bubble">
          {(message?.content || '').split('\n').map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))}
          {isLast && isTyping && message?.role === 'assistant' && (
            <span className="cursor-blink">|</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function MessageList() {
  const { messages, isTyping } = useChat();
  const listRef = useRef(null);
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: 80 });
  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current?.element;
    if (!el) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, []);

  // 只在用户主动向上滚动时才判定为"离开底部"，
  // 避免程序化滚动触发的 scroll 事件误将 isAtBottom 置为 false
  const handleScroll = useCallback(() => {
    const el = listRef.current?.element;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const scrolledUp = scrollTop < lastScrollTopRef.current;

    if (scrolledUp && distanceFromBottom > SCROLL_BOTTOM_THRESHOLD) {
      isAtBottomRef.current = false;
    } else if (distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD) {
      isAtBottomRef.current = true;
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  // 新消息添加时，强制滚动到底部
  useEffect(() => {
    if (messages.length === 0) return;
    isAtBottomRef.current = true;
    requestAnimationFrame(scrollToBottom);
  }, [messages.length, scrollToBottom]);

  // 流式生成时，最后一条消息内容变化 → 主动触发滚动
  const lastMsgContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    requestAnimationFrame(scrollToBottom);
  }, [lastMsgContent, scrollToBottom]);

  // ResizeObserver 监听 spacer 高度变化作为兜底保障，
  // 当 messages.length 变化时重新获取 spacer 引用，防止 DOM 失效
  useEffect(() => {
    const el = listRef.current?.element;
    if (!el) return;
    const spacerEl = el.querySelector('[aria-hidden="true"]');
    if (!spacerEl) return;

    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        scrollToBottom();
      }
    });
    observer.observe(spacerEl);
    return () => observer.disconnect();
  }, [messages.length, scrollToBottom]);

  return (
    <div className="message-list-container">
      <List
        listRef={listRef}
        rowCount={messages.length}
        rowHeight={dynamicRowHeight}
        rowComponent={MessageRow}
        rowProps={{
          messages,
          isTyping,
          observeRowElements: dynamicRowHeight.observeRowElements,
        }}
        onScroll={handleScroll}
        className="virtual-list"
      />
    </div>
  );
}
