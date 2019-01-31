export function Builder(implementation) {
  let {isElement, createElement, appendChild, runAction, setProps, getMarker, setMarker, setId, addText, addClass} = implementation;

  let builder = (tag, props = {}, ...children) => {
    let elem = null;
    if (isElement(tag)) {
      elem = tag;
      setProps(elem, props);
    }
    else {
      elem = createElement(tag, props, children);
    }

    let markedChildren = {};

    for (let child of children) {
      if (isElement(child)) {
        let childMarker = getMarker(child);
        if (childMarker) {
          markedChildren[childMarker] = child;
        }
        appendChild(elem, child);
      }
      else if (child instanceof Array) {
        let [func, ...args] = child;
        for (let i = 0; i < args.length; i++) {
          if (args[i] instanceof RegExp) {
            if (args[i].source === 'children') {
              args[i] = markedChildren;
            }
            else {
              args[i] = markedChildren[args[i].source];
            }
          }
        }
        runAction(elem, [func, ...args]);
      }
      else if (child instanceof RegExp) {
        setMarker(elem, child.source);
      }
      else if (typeof child === 'string') {
        if (child[0] === '.') {
          addClass(elem, child.slice(1));
        }
        else if (child[0] === '#') {
          setId(elem, child.slice(1));
        }
        else {
          addText(elem, child);
        }
      }
      else {
        throw new Error('Invalid child');
      }
    }

    return elem;
  }
  return builder;
}
