// src/services/gemini.js
/**
 * 封装 Gemini API 请求，支持流式解析 SSE 数据
 * @param {Array} history - 完整的历史会话记录
 * @param {Function} onMessage - 接收每段文本的回调，用于实现打字机效果
 * @param {Function} onError - 错误回调
 * @param {Function} onComplete - 请求完成回调
 * @param {AbortSignal} signal - 用于取消请求的信号
 */
export const fetchGeminiStream = async (history, onMessage, onError, onComplete, signal) => {
  // 注意：在实际项目中，API Key 应当存放在后端，不应暴露在前端
  // 这里为了 Demo 展示存放在环境变量中
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!API_KEY) {
    onError('未找到 Gemini API Key，请在 .env 文件中配置 VITE_GEMINI_API_KEY');
    return;
  }

  // 转换本地 history 格式到 Gemini 要求的格式
  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contents }),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || '请求 Gemini API 失败');
    }

    // 获取 ReadableStream
    const reader = response.body.getReader();
    // 使用 TextDecoder 解析 Uint8Array 字节流为字符串
    const decoder = new TextDecoder('utf-8');

    let isDone = false;
    let buffer = '';

    while (!isDone) {
      const { value, done } = await reader.read();
      isDone = done;
      if (value) {
        // 解码得到的文本块
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // SSE 数据由多行组成，按 \n 分割解析
        const lines = buffer.split('\n');
        // 保留最后一行未完整的数据在 buffer 中，等待下一次 chunk
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue; // 结束标志
            
            try {
              const data = JSON.parse(dataStr);
              // 提取返回的文本片段
              const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                // 逐字回调给组件，实现打字机动画
                onMessage(textChunk);
              }
            } catch (e) {
              console.warn('解析 SSE 数据行失败:', line, e);
            }
          }
        }
      }
    }
    
    // 触发完成回调
    if (onComplete) onComplete();

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('请求被用户中断');
    } else {
      console.error('Gemini API 错误:', error);
      if (onError) onError(error.message);
    }
  }
};
