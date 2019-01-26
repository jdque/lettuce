export function Selector(actions) {
  let func = (elemOrElems) => {
    let elems = Array.isArray(elemOrElems) ? elemOrElems : [elemOrElems];
    let ret = {};

    ret.isSelector = true;

    for (let name in actions) {
      ret[name] = (...args) => {
        for (let elem of elems) {
          actions[name](elem, ...args);
        }
        return ret;
      };
    }

    ret['do'] = ([func, ...args]) => {
      for (let elem of elems) {
        func(elem, ...args);
      }
      return ret;
    }

    return ret;
  }
  return func;
}