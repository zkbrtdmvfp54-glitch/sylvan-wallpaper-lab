// 轻量事件封装：当前只在内存和 CustomEvent 中记录，不向第三方发送数据。
// 后续接入统计平台时，只需要在此文件增加单一适配器。
export function trackEvent(name, properties = {}) {
  const event = {
    name,
    properties,
    path: location.pathname,
    timestamp: new Date().toISOString(),
  };
  window.SYLVAN_ANALYTICS_EVENTS ||= [];
  window.SYLVAN_ANALYTICS_EVENTS.push(event);
  window.dispatchEvent(new CustomEvent('sylvan:analytics', { detail: event }));
}

