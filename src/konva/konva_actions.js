export function draw(element) {
  element.getLayer().draw();
}

export function resizeBy(element, dx = 0, dy = 0) {
  element.setAttrs({
    width: element.getAttr('width') + dx,
    height: element.getAttr('height') + dy
  });
}

export function translateBy(element, dx = 0, dy = 0) {
  if (element.getClassName() === 'Line') {
    let points = element.getAttr('points');
    element.setAttrs({
      points: [points[0] + dx, points[1] + dy, points[2] + dx, points[3] + dy]
    });
  }
  else {
    element.setAttrs({
      x: element.x() + dx,
      y: element.y() + dy
    });
  }
}

export function queryBounds(container, bounds) {
  let resultChildren = [];

  let {x: sx, y: sy, width: sw, height: sh} = bounds;
  sx += 1;
  sy += 1;
  sw -= 2;
  sh -= 2;

  for (let child of container.getChildren()) {
    if (child.getClassName() === 'Line') {
      let points = child.getAttr('points');
      let linePos = {x: Math.min(points[0], points[2]), y: Math.min(points[1], points[3])};
      let {x: cx, y: cy, width: cw, height: ch} = {...linePos, ...child.size()};
      if ((cx > sx + sw || cx + cw < sx || cy > sy + sh || cy + ch < sy)) {
        continue;
      }
      resultChildren.push(child);
    }
    else {
      let {x: cx, y: cy, width: cw, height: ch} = {...child.position(), ...child.size()};
      if ((cx > sx + sw || cx + cw < sx || cy > sy + sh || cy + ch < sy)) {
        continue;
      }
      resultChildren.push(child);
    }
  }

  return resultChildren;
}

export function disableRightClick(stage) {
  stage.on('contentContextmenu', (e) => {
    e.evt.preventDefault();
  });
}