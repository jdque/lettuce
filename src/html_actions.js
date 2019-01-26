export function attr(el, attrs = {}) {
  for (let name in attrs) {
    el.setAttribute(name, attrs[name]);
  }
}

export function on(el, handlers = {}) {
  for (let name in handlers) {
    el.addEventListener(name, handlers[name]);
  }
}

export function style(el, styles = {}) {
  for (let name in styles) {
    el.style[name] = styles[name];
  }
}

export function focus(el) {
  el.focus();
}

export function children(el, children = [], replace = false) {
  if (replace) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }
  for (let child of children) {
    el.appendChild(child);
  }
}