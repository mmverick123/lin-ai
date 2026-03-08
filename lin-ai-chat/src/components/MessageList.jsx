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
  // 用 ref 而非 state，避免引发额外重渲染
  const isAtBottomRef = useRef(true);

  // 监听用户手动滚动，实时更新"是否在底部"的标志
  const handleScroll = useCallback(() => {
    const el = listRef.current?.element;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
  }, []);

  // 只有当用户本身就在底部时，才跟随新内容自动滚动
  useEffect(() => {
    if (listRef.current && messages.length > 0 && isAtBottomRef.current) {
      listRef.current.scrollToRow({ index: messages.length - 1, align: 'end' });
    }
  }, [messages.length, messages[messages.length - 1]?.content, isTyping]);

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
