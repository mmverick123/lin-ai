// src/services/gemini.js

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30000; // 30 秒超时
const BASE_RETRY_DELAY_MS = 1000; // 初始重试等待 1s，之后指数增长：1s→2s→4s

/** 判断 HTTP 状态码是否应当重试（网络抖动/服务端错误/限流） */
function isRetryableHttpStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * 将用户取消信号与超时信号合并为一个 AbortSignal。
 * - 用户主动取消 → AbortError（不重试）
 * - 超时到期    → TimeoutError（触发重试）
 */
function createCombinedSignal(userSignal, timeoutMs) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new DOMException('请求超时', 'TimeoutError'));
  }, timeoutMs);

  const combined = new AbortController();
  const cleanup = () => clearTimeout(timeoutId);

  const forwardAbort = (reason) => {
    cleanup();
    if (!combined.signal.aborted) combined.abort(reason);
  };

  if (userSignal?.aborted) {
    combined.abort(userSignal.reason);
    cleanup();
    return { signal: combined.signal, cleanup: () => {} };
  }

  userSignal?.addEventListener('abort', () => forwardAbort(userSignal.reason), { once: true });
  timeoutController.signal.addEventListener('abort', () => forwardAbort(timeoutController.signal.reason), { once: true });

  return { signal: combined.signal, cleanup };
}

/**
 * 封装 Gemini API 请求，支持流式 SSE 解析、超时管理、指数退避自动重试
 * @param {Array}    history   - 完整的历史会话记录
 * @param {Function} onMessage - 接收每段文本的回调，实现打字机效果
 * @param {Function} onError   - 最终失败回调
 * @param {Function} onComplete - 请求成功完成回调
 * @param {AbortSignal} signal - 用于用户主动取消的信号
 * @param {Object}   options  - { maxRetries, timeoutMs, onRetry, onStreamStart }
 */
export const fetchGeminiStream = async (history, onMessage, onError, onComplete, signal, options = {}) => {
  const {
    maxRetries = MAX_RETRIES,
    timeoutMs = REQUEST_TIMEOUT_MS,
    onRetry = null,
    onStreamStart = null,
  } = options;

  // 注意：在实际项目中，API Key 应当存放在后端，不应暴露在前端
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) {
    onError('未找到 Gemini API Key，请在 .env 文件中配置 VITE_GEMINI_API_KEY');
    return;
  }

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal?.aborted) return; // 用户已取消，直接退出

    const { signal: combinedSignal, cleanup } = createCombinedSignal(signal, timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
        signal: combinedSignal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(errorData.error?.message || `请求失败（HTTP ${response.status}）`);
        err.status = response.status;
        throw err;
      }

      // 连接成功，通知组件可以开始展示流式内容
      if (onStreamStart) onStreamStart();

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let isDone = false;
      let buffer = '';

      while (!isDone) {
        const { value, done } = await reader.read();
        isDone = done;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const data = JSON.parse(dataStr);
                const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textChunk) onMessage(textChunk);
              } catch (e) {
                console.warn('解析 SSE 数据行失败:', line, e);
              }
            }
          }
        }
      }

      cleanup();
      if (onComplete) onComplete();
      return; // 成功，结束循环

    } catch (error) {
      cleanup();

      // 用户主动取消（点击"停止生成"或组件卸载）→ 静默退出，不重试
      if (error.name === 'AbortError') {
        console.log('请求被用户中断');
        return;
      }

      const isLastAttempt = attempt === maxRetries - 1;
      const isTimeout = error.name === 'TimeoutError';
      const httpStatus = error.status;
      // 超时、网络错误（无 status）、5xx/429 均可重试；4xx 客户端错误不重试
      const canRetry = isTimeout || !httpStatus || isRetryableHttpStatus(httpStatus);

      if (!isLastAttempt && canRetry) {
        const nextAttempt = attempt + 1;
        const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt); // 1s, 2s, 4s
        console.warn(`第 ${nextAttempt}/${maxRetries} 次重试，${delayMs}ms 后发起...`, error.message);

        if (onRetry) onRetry(nextAttempt, maxRetries, isTimeout ? 'timeout' : 'error');

        // 等待退避延迟，同时监听用户取消
        const waitResult = await new Promise(resolve => {
          const t = setTimeout(() => resolve('continue'), delayMs);
          signal?.addEventListener('abort', () => { clearTimeout(t); resolve('cancelled'); }, { once: true });
        });
        if (waitResult === 'cancelled') return;
        continue;
      }

      // 已达最大重试次数或不可重试的错误
      console.error('Gemini API 请求最终失败:', error);
      const finalMsg = isTimeout
        ? `请求超时（已重试 ${attempt} 次），请检查网络连接后再试`
        : error.message;
      if (onError) onError(finalMsg);
      return;
    }
  }
};
