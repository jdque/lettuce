import K from './builder';
import Commander from './commander';
import {FSM} from '../lib/royal';

let App = {
  clipboard: [],
  keyMods: {},
  shiftMod: false,
  ctrlMod: false
};

let C = Commander({
  'Draw': {
    commit: ({elements, parent}) => {
      for (let el of elements) {
        parent.add(el);
      }
      parent.getLayer().draw();
      return {elements, parent};
    },
    rollback: ({elements, parent}) => {
      for (let el of elements) {
        el.remove();
      }
      parent.getLayer().draw();
    },
    destroy: ({elements, parent}) => {
      for (let el of elements) {
        el.destroy();
      }
    }
  }
});

function copyBounds(container, boundsRect) {
  for (let element of App.clipboard) {
    element.destroy();
  }
  App.clipboard = [];

  let {x: sx, y: sy, width: sw, height: sh} = boundsRect.getClientRect();
  for (let child of container.getChildren()) {
    let {x: cx, y: cy, width: cw, height: ch} = child.getClientRect();
    if (cx == null || cy == null || cw > sw || ch > sh) {
      continue;
    }
    if (!(cx > sx + sw || cx + cw < sx || cy > sy + sh || cy + ch < sy)) {
      let clone = child.clone();
      let points = clone.getAttr('points');
      if (points) {
        clone.setAttrs({
          points: [points[0] - sx - 1, points[1] - sy - 1, points[2] - sx- 1, points[3] - sy - 1]
        });
      }
      else {
        clone.setAttrs({
          x: cx - sx - 1,
          y: cy - sy - 1
        });
      }
      App.clipboard.push(clone);
    }
  }
}

function pasteBounds(container, boundsRect) {
  let {x: sx, y: sy} = boundsRect.getClientRect();
  let clones = [];
  for (let child of App.clipboard) {
    let {x: cx, y: cy} = child.getClientRect();
    let clone = child.clone();
    let points = clone.getAttr('points');
    if (points) {
      clone.setAttrs({
        points: [points[0] + sx + 1, points[1] + sy + 1, points[2] + sx + 1, points[3] + sy + 1]
      });
    }
    else {
      clone.setAttrs({
        x: cx + sx + 1,
        y: cy + sy + 1
      });
    }
    clones.push(clone);
  }

  if (clones.length > 0) {
    C('Draw', {elements: clones, parent: container});
  }
}

function GridLines(container, numCols, numRows, lineStyle) {
  let width = container.width();
  let height = container.height();

  let xStep = width / numCols;
  for (let col = 1; col < numCols; col++) {
    let x = col * xStep;
    let line = K('Line', {
      points: [x, 0, x, height],
      listening: false,
      ...lineStyle
    });
    container.add(line);
  }

  let yStep = height / numRows;
  for (let row = 1; row < numRows; row++) {
    let y = row * yStep;
    let line = K('Line', {
      points: [0, y, width, y],
      listening: false,
      ...lineStyle
    });
    container.add(line);
  }
}

function Borders(container, borderStyle) {
  let left = 0;
  let top = 0;
  let right = container.width();
  let bottom = container.height();

  container.add(
    K('Line', {points: [left, top, right, top], listening: false, ...borderStyle}),
    K('Line', {points: [right, top, right, bottom], listening: false, ...borderStyle}),
    K('Line', {points: [left, bottom, right, bottom], listening: false, ...borderStyle}),
    K('Line', {points: [left, top, left, bottom], listening: false, ...borderStyle})
  );
}

function Drawable(container, cursor) {
  let $mouse = FSM.create(['idle', 'drag_line', 'drag_select', 'drag_resize_horz', 'drag_resize_vert']);

  $mouse.when('idle', ({data}) => {
    let onMouseDown = (ev) => {
      if (App.shiftMod) {
        $mouse.set('drag_select');
      }
      else {
        $mouse.set('drag_line');
      }
    }

    container.on('mousedown.idle', onMouseDown);

    return () => {
      container.off('mousedown.idle');
    }
  });

  $mouse.when('drag_line', ({data}) => {
    let containerPos = container.getAbsolutePosition();
    let startPt = cursor ? cursor.getAbsolutePosition() : container.getStage().getPointerPosition();
    let endPt = startPt;
    let line = K('Line', {
      points: [startPt.x - containerPos.x, startPt.y - containerPos.y, endPt.x - containerPos.x, endPt.y - containerPos.y],
      stroke: 'red',
      strokeWidth: 2
    });
    container.add(line);

    let onMouseMove = (ev) => {
      let containerPos = container.getAbsolutePosition();
      endPt = cursor ? cursor.getAbsolutePosition() : container.getStage().getPointerPosition();
      line.setAttr('points', [startPt.x - containerPos.x, startPt.y - containerPos.y, endPt.x - containerPos.x, endPt.y - containerPos.y]);
      line.getLayer().draw();
    }

    let onMouseUp = (ev) => {
      let foregroundGroup = container.getStage().findOne('.foreground');
      if (startPt.x !== endPt.x || startPt.y !== endPt.y) {
        C('Draw', {
          elements: [K('Line', {...line.getAttrs()})],
          parent: foregroundGroup
        });
      }

      let layer = line.getLayer().draw();
      line.destroy();
      layer.draw();

      $mouse.set('idle');
    }

    container.on('mousemove.drag_line', onMouseMove);
    container.on('mouseup.drag_line', onMouseUp);

    return () => {
      container.off('mousemove.drag_line');
      container.off('mouseup.drag_line');
    }
  });

  $mouse.when('drag_select', ({data}) => {
    let containerPos = container.getAbsolutePosition();
    let startPt = cursor ? cursor.getAbsolutePosition() : container.getStage().getPointerPosition();
    let endPt = startPt;
    let rect = K('Rect', {stroke: 'blue', strokeWidth: 1});
    rect.setAttrs({
      x: Math.min(startPt.x, endPt.x) - containerPos.x,
      y: Math.min(startPt.y, endPt.y) - containerPos.y,
      width: Math.abs(endPt.x - startPt.x),
      height: Math.abs(endPt.y - startPt.y)
    });
    container.add(rect);

    let onMouseMove = (ev) => {
      let containerPos = container.getAbsolutePosition();
      endPt = cursor ? cursor.getAbsolutePosition() : container.getStage().getPointerPosition();

      rect.setAttrs({
        x: Math.min(startPt.x, endPt.x) - containerPos.x,
        y: Math.min(startPt.y, endPt.y) - containerPos.y,
        width: Math.abs(endPt.x - startPt.x),
        height: Math.abs(endPt.y - startPt.y)
      });
      rect.getLayer().draw();
    }

    let onMouseUp = (ev) => {
      let foregroundGroup = container.getStage().findOne('.foreground');
      if (App.ctrlMod) {
        pasteBounds(foregroundGroup, rect);
      }
      else {
        copyBounds(foregroundGroup, rect);
      }

      let layer = rect.getLayer().draw();
      rect.destroy();
      layer.draw();

      $mouse.set('idle');
    }

    container.on('mousemove.drag_select', onMouseMove);
    container.on('mouseup.drag_select', onMouseUp);

    return () => {
      container.off('mousemove.drag_select');
      container.off('mouseup.drag_select');
    }
  })

  $mouse.set('idle');
}

function GridContainer({resolution, ...style}) {
  return K('Container', {resolution, ...style}, '.grid',
    K('Rect', {width: style.width, height: style.height}),
    [GridLines, resolution, resolution, {stroke: 'black', strokeWidth: 1}],
    [Borders, {stroke: 'black', strokeWidth: 1}]
  );
}

//---------------------------------------------------------

let getSnapPos = (gridContainer, pos) => {
  let gridX = gridContainer.getAttr('x');
  let gridY = gridContainer.getAttr('y');
  let spacingX = gridContainer.getAttr('width') / gridContainer.getAttr('resolution');
  let spacingY = gridContainer.getAttr('height') / gridContainer.getAttr('resolution');
  return {
    x: Math.round((pos.x - gridX) / spacingX) * spacingX + gridX,
    y: Math.round((pos.y - gridY) / spacingY) * spacingY + gridY
  };
}

let setGridResolution = (gridContainer, newResolution) => {
  let parent = gridContainer.getParent();
  let newGrid = K(GridContainer, {...gridContainer.getAttrs(), resolution: newResolution});
  gridContainer.destroy();
  parent.add(newGrid);
  parent.getLayer().draw();
};

let setupEvents = (group, cursor) => {
  group.on('wheel', (ev) => {
    let pos = group.getStage().getPointerPosition();
    let grid = group.getStage().getIntersection(pos, '.grid');
    if (grid) {
      let newResolution = Math.max(grid.getAttr('resolution') + (ev.evt.deltaY > 0 ? -1 : 1), 1);
      setGridResolution(grid, newResolution);
      ev.evt.preventDefault();
    }
  });

  group.on('click', (ev) => {
    if (ev.evt.which === 3) {
      if (App.shiftMod) {

      }
      else {
        let cursorPos = cursor.getAbsolutePosition();
        let newGrid = K(GridContainer, {resolution: 2, x: cursorPos.x, y: cursorPos.y, width: 100, height: 100});
        let backgroundGroup = group.getStage().findOne('.background');

        C('Draw', {elements: [newGrid], parent: backgroundGroup});
      }
    }
  });

  group.on('mousemove', (ev) => {
    let pos = group.getStage().getPointerPosition();
    let grid = group.getStage().getIntersection(pos, '.grid');
    if (grid) {
      let snapPos = getSnapPos(grid, pos);
      cursor.setAttrs({
        x: snapPos.x,
        y: snapPos.y
      });
    }
    else {
      cursor.setAttrs({
        x: pos.x,
        y: pos.y
      });
    }
    cursor.getLayer().draw();
  });

  document.body.addEventListener('keydown', (ev) => {
    let pos = cursor.getAbsolutePosition();
    let grid = group.getStage().getIntersection(pos, '.grid');
    if (!grid) {
      return;
    }

    let xStep = grid.getAttr('width') / grid.getAttr('resolution');
    let yStep = grid.getAttr('height') / grid.getAttr('resolution');
    if (ev.code === 'ArrowLeft') {
      cursor.setAttr('x', cursor.getAttr('x') - xStep);
    }
    else if (ev.code === 'ArrowRight') {
      cursor.setAttr('x', cursor.getAttr('x') + xStep);
    }
    else if (ev.code === 'ArrowUp') {
      cursor.setAttr('y', cursor.getAttr('y') - yStep);
    }
    else if (ev.code === 'ArrowDown') {
      cursor.setAttr('y', cursor.getAttr('y') + yStep);
    }
    cursor.getLayer().draw();

    ev.preventDefault();
  });
};

let disableRightClick = (stage) => {
  stage.on('contentContextmenu', (e) => {
    e.evt.preventDefault();
  });
};

K('Stage', {container: 'container', width: 800, height: 600},
  K('Layer', {},
    K('Group', {width: 800, height: 600}, '.background',
      K(GridContainer, {resolution: 2, x: 10, y: 10, width: 200, height: 200}),
      K(GridContainer, {resolution: 2, x: 300, y: 10, width: 200, height: 200}),
      [Borders, {stroke: 'red', strokeWidth: 1}]
    )
  ),
  K('Layer', {},
    K('Group', {width: 800, height: 600}, '.foreground')
  ),
  K('Layer', {},
    K('Group', {width: 800, height: 600}, '.overlay',
      K('Rect', {width: 800, height: 600}),
      K('Circle', {radius: 6, stroke: 'black', strokeWidth: 1, x: 0, y: 0, listening: false}, /cursor/),
      [Drawable, /cursor/],
      [setupEvents, /cursor/]
    )
  ),
  [disableRightClick]
)

document.body.addEventListener('keyup', (ev) => {
  if (ev.code === 'KeyZ' && ev.ctrlKey) {
    C('Undo');
  }
  else if (ev.code === 'KeyY' && ev.ctrlKey) {
    C('Redo');
  }
});

document.body.addEventListener('keydown', (ev) => {
  if (ev.shiftKey) {
    App.shiftMod = true;
  }
  if (ev.ctrlKey) {
    App.ctrlMod = true;
  }
  App.keyMods[ev.code] = true;
});

document.body.addEventListener('keyup', (ev) => {
  if (!ev.shiftKey) {
    App.shiftMod = false;
  }
  if (!ev.ctrlKey) {
    App.ctrlMod = false;
  }
  App.keyMods[ev.code] = false;
});