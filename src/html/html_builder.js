export default function (tag, props = {}, ...children) {
  let elem = null;
  if (tag instanceof Element) {
    elem = tag;
  }
  else if (typeof tag === 'string') {
    elem = document.createElement(tag);
    for (let name in props) {
      elem[name] = props[name];
    }
  }
  else if (typeof tag === 'function') {
    elem = tag(props);
  }
  else {
    throw new Error('Invalid tag');
  }

  let taggedChildren = {};

  for (let child of children) {
    if (child instanceof Element) {
      elem.appendChild(child);

      let childTag = child.getAttribute('__tag__');
      if (childTag) {
        taggedChildren[childTag] = child;
      }
    }
    else if (child instanceof Array) {
      let [func, ...args] = child;
      for (let i = 0; i < args.length; i++) {
        if (args[i] instanceof RegExp) {
          if (args[i].source === 'children') {
            args[i] = taggedChildren;
          }
          else {
            args[i] = taggedChildren[args[i].source];
          }
        }
      }
      if (typeof func === 'string') {
        elem[func](...args);
      }
      else if (typeof func === 'function') {
        func(elem, ...args);
      }
    }
    else if (child instanceof RegExp) {
      elem.setAttribute('__tag__', child.source);
    }
    else if (typeof child === 'string') {
      if (child[0] === '.') {
        elem.classList.add(child.slice(1));
      }
      else if (child[0] === '#') {
        elem.id = child.slice(1);
      }
      else {
        elem.textContent = child;
      }
    }
    else {
      throw new Error('Invalid child');
    }
  }

  return elem;
}