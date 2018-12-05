import Konva from 'konva';

export default function (tag, props = {}, ...children) {
	let elem = null;
  if (tag instanceof Konva.Node) {
    elem = tag;
  }
  if (typeof tag === 'string') {
    elem = new Konva[tag](props);
  }
  else if (typeof tag === 'function') {
    elem = tag(props);
  }
  else {
    throw new Error('Invalid tag');
  }

  //FIX
  if (elem instanceof Konva.Container) {
    elem._validateAdd = (node) => {};
  }

  let taggedChildren = {};

  for (let child of children) {
    if (child instanceof Konva.Node) {
      elem.add(child);

      let childTag = child.getAttr('__tag__');
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
      elem.setAttr('__tag__', child.source);
    }
    else if (typeof child === 'string') {
      if (child[0] === '.') {
        elem.addName(child.slice(1));
      }
      else if (child[0] === '#') {
        elem.setId(child.slice(1))
      }
    }
    else {
      throw new Error('Invalid child');
    }
  }

  return elem;
}