import Konva from 'konva';
import {Builder} from '../core/builder';

function isElement(any) {
  return any instanceof Konva.Node;
}

function createElement(tag, props, children) {
  let elem = null;
  if (typeof tag === 'string') {
    elem = new Konva[tag](props);
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
  elem.add(child);
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
  elem.setAttrs(props);
}

function getMarker(elem) {
  return elem.getAttr('__marker__');
}

function setMarker(elem, marker) {
  elem.setAttr('__marker__', marker);
}

function setId(elem, id) {
  elem.setId(id);
}

function addClass(elem, klass) {
  elem.addName(klass);
}

function addText(elem, text) {
  //NO-OP
}

export default Builder({
  isElement, createElement, appendChild, runAction, setProps, getMarker, setMarker, setId, addClass, addText
});