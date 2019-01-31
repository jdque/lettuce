import {Builder} from '../core/builder';

function isElement(any) {
  return any instanceof Element;
}

function createElement(tag, props, children) {
  let elem = null;
  if (typeof tag === 'string') {
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
  return elem;
}

function appendChild(elem, child) {
  elem.appendChild(child);
}

function runAction(elem, action) {
  let [func, ...args] = action;
  if (typeof func === 'string') {
    elem[func](...args);
  }
  else if (typeof func === 'function') {
    func(elem, ...args);
  }
}

function setProps(elem, props) {
  for (let name in props) {
    elem[name] = props[name];
  }
}

function getMarker(elem) {
  return elem.getAttribute('__marker__');
}

function setMarker(elem, marker) {
  elem.setAttribute('__marker__', marker);
}

function setId(elem, id) {
  elem.id = id;
}

function addClass(elem, klass) {
  elem.classList.add(klass);
}

function addText(elem, text) {
  elem.textContent += text;
}

export default Builder({
  isElement, createElement, appendChild, runAction, setProps, getMarker, setMarker, setId, addClass, addText
});