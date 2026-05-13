/**
 * DOM 选择器模块
 * 让用户在页面上手动选择「当前时间」和「总时长」元素，
 * 通过解析文本获取播放进度。
 *
 * 适用于视频在跨域 iframe 中、无法直接访问 <video> 元素的场景。
 */

export interface PickerResult {
  /** 选中元素的唯一 CSS 选择器（顶层页面元素时有值） */
  selector: string;
  /** 选中时元素的文本内容（用于预览） */
  text: string;
  /** 解析出的秒数（如果能解析） */
  seconds: number | null;
  /** 是否选中的是 iframe（需要用 iframe 探测模式） */
  isIframe: boolean;
}

export interface PickerSession {
  destroy: () => void;
}

/**
 * 从文本中解析时间，支持格式：
 * - "01:23" → 83s
 * - "1:02:30" → 3750s
 * - "01:23 / 45:00" → 取第一个时间 83s
 * - "当前 01:23" → 83s
 */
export function parseTimeFromText(text: string): number | null {
  const timeRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
  const match = timeRegex.exec(text);
  if (!match) return null;

  if (match[3] !== undefined) {
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
  } else {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
}

/**
 * 从文本中解析出两个时间（当前时间 / 总时长）
 * 支持格式："01:23 / 45:00", "01:23/45:00", "01:23 | 45:00"
 */
export function parseTimePair(text: string): { current: number; duration: number } | null {
  const timeRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
  const matches: number[] = [];

  let m;
  while ((m = timeRegex.exec(text)) !== null) {
    if (m[3] !== undefined) {
      matches.push(parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]));
    } else {
      matches.push(parseInt(m[1]) * 60 + parseInt(m[2]));
    }
  }

  if (matches.length >= 2) {
    return { current: matches[0], duration: matches[1] };
  }
  if (matches.length === 1) {
    return { current: matches[0], duration: 0 };
  }
  return null;
}

/**
 * 生成元素的唯一 CSS 选择器
 */
function getUniqueSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    const classes = Array.from(current.classList)
      .filter(c => !c.startsWith('_') && c.length < 30)
      .slice(0, 2);
    if (classes.length > 0) {
      selector += '.' + classes.map(c => CSS.escape(c)).join('.');
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        s => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * 启动 DOM 选择器模式
 * 用户 hover 时高亮元素，点击后返回选择结果。
 * 如果用户点击的是 iframe，返回 isIframe: true，由调用方切换到 iframe 探测模式。
 */
export function startPicker(
  onPick: (result: PickerResult) => void,
  onCancel: () => void
): PickerSession {
  let highlightEl: HTMLDivElement | null = null;
  let tooltipEl: HTMLDivElement | null = null;
  let currentTarget: Element | null = null;

  highlightEl = document.createElement('div');
  Object.assign(highlightEl.style, {
    position: 'fixed',
    pointerEvents: 'none',
    border: '2px solid #4361ee',
    background: 'rgba(67, 97, 238, 0.1)',
    borderRadius: '4px',
    zIndex: '2147483646',
    transition: 'all 0.1s ease',
    display: 'none',
  });
  document.body.appendChild(highlightEl);

  tooltipEl = document.createElement('div');
  tooltipEl.innerHTML = `
    🎯 <b>VideoTracker</b>：点击包含播放时间的元素（如 01:23 / 45:00）<br>
    <span style="font-size:12px;opacity:0.8">💡 如果时间在播放器内部（iframe），直接点击播放器区域即可，插件会自动探测</span><br>
    <span style="font-size:12px;opacity:0.8">按 Esc 取消</span>
  `;
  Object.assign(tooltipEl.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    background: '#4361ee',
    color: '#fff',
    padding: '10px 16px',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    zIndex: '2147483647',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    lineHeight: '1.6',
  });
  document.body.appendChild(tooltipEl);

  function onMouseMove(e: MouseEvent) {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === highlightEl || target === tooltipEl) return;
    currentTarget = target;

    const rect = target.getBoundingClientRect();
    if (highlightEl) {
      highlightEl.style.display = 'block';
      highlightEl.style.top = rect.top + 'px';
      highlightEl.style.left = rect.left + 'px';
      highlightEl.style.width = rect.width + 'px';
      highlightEl.style.height = rect.height + 'px';
    }
  }

  function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!currentTarget) return;

    const isIframe = currentTarget.tagName.toLowerCase() === 'iframe';
    const text = currentTarget.textContent?.trim() || '';
    const selector = getUniqueSelector(currentTarget);
    const seconds = parseTimeFromText(text);

    destroy();
    onPick({ selector, text, seconds, isIframe });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      destroy();
      onCancel();
    }
  }

  function destroy() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    highlightEl?.remove();
    tooltipEl?.remove();
    highlightEl = null;
    tooltipEl = null;
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  return { destroy };
}
