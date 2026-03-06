// src/components/MessageList.jsx
import React, { useRef, useEffect } from 'react';
import { List, useDynamicRowHeight } from 'react-window';
import { useChat } from '../context/ChatContext';

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

  useEffect(() => {
    if (listRef.current && messages.length > 0) {
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
        className="virtual-list"
      />
    </div>
  );
}
