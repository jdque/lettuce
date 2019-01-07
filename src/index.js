import H from './html_builder';
import K from './konva_builder';
import {Command, Commander} from './commander';
import {FSM} from '../lib/royal';

let App = {
  clipboard: [],
  shiftMod: false,
  ctrlMod: false
};

let DrawCommand = Command({
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
});

let EraseCommand = Command({
  commit: ({elements, parent}) => {
    for (let el of elements) {
      el.remove();
    }
    parent.getLayer().draw();
    return {elements, parent};
  },
  rollback: ({elements, parent}) => {
    for (let el of elements) {
      parent.add(el);
    }
    parent.getLayer().draw();
  },
  destroy: ({elements, parent}) => {
    // NO-OP
  }
});

let C = Commander({
  'Draw': DrawCommand,
  'Erase': EraseCommand
});

function queryBounds(container, bounds) {
  let resultChildren = [];

  let {x: sx, y: sy, width: sw, height: sh} = bounds;
  sx += 1;
  sy += 1;
  sw -= 2;
  sh -= 2;

  for (let child of container.getChildren()) {
    if (child.getClassName() === 'Line') {
      let points = child.getAttr('points');
      let {x: cx, y: cy, width: cw, height: ch} = {...child.size(), x: Math.min(points[0], points[2]), y: Math.min(points[1], points[3])};
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

function translateBy(element, dx = 0, dy = 0) {
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

function resizeBy(element, dx = 0, dy = 0) {
  element.setAttrs({
    width: element.getAttr('width') + dx,
    height: element.getAttr('height') + dy
  });
}

function copyBounds(container, bounds) {
  for (let element of App.clipboard) {
    element.destroy();
  }
  App.clipboard = [];

  for (let child of queryBounds(container, bounds)) {
    let clone = child.clone();
    translateBy(clone, -bounds.x, -bounds.y);
    App.clipboard.push(clone);
  }
}

function pastePosition(container, position) {
  let clones = [];

  for (let child of App.clipboard) {
    let clone = child.clone();
    translateBy(clone, position.x, position.y);
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
      let foregroundGroup = container.getStage().findOne('#foreground');
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
      let foregroundGroup = container.getStage().findOne('#foreground');
      if (App.ctrlMod) {
        pastePosition(foregroundGroup, {...rect.position()});
      }
      else {
        copyBounds(foregroundGroup, {...rect.size(), ...rect.position()});
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

function GridContainer({resolutionX, resolutionY, ...style}) {
  return K('Group', {resolutionX, resolutionY, ...style}, '.grid',
    K('Rect', {width: style.width, height: style.height}),
    [GridLines, resolutionX, resolutionY, {stroke: 'black', strokeWidth: 1}],
    [Borders, {stroke: 'black', strokeWidth: 1}]
  );
}

function RegionImage({image, regionX, regionY, regionWidth, regionHeight, ...style}) {
  regionX = regionX == null ? 0 : regionX;
  regionY = regionY == null ? 0 : regionY;
  regionWidth = regionWidth == null ? image.width : regionWidth;
  regionHeight = regionHeight == null ? image.height : regionHeight;

  let sceneFunc = (ctx, shape) => {
    ctx.drawImage(image, regionX, regionY, regionWidth, regionHeight, 0, 0, shape.width(), shape.height());
  };

  return K('Shape', {image, sceneFunc, ...style}, '.regionImage');
}

//---------------------------------------------------------

let getSnapPos = (gridContainer, pos) => {
  let gridX = gridContainer.getAttr('x');
  let gridY = gridContainer.getAttr('y');
  let spacingX = gridContainer.getAttr('width') / gridContainer.getAttr('resolutionX');
  let spacingY = gridContainer.getAttr('height') / gridContainer.getAttr('resolutionY');
  return {
    x: Math.round((pos.x - gridX) / spacingX) * spacingX + gridX,
    y: Math.round((pos.y - gridY) / spacingY) * spacingY + gridY
  };
}

let incrementGridResolution = (gridContainer, dx = 0, dy = 0) => {
  let parent = gridContainer.getParent();
  let newResolutionX = Math.max(gridContainer.getAttr('resolutionX') + dx, 1);
  let newResolutionY = Math.max(gridContainer.getAttr('resolutionY') + dy, 1);
  let newGrid = K(GridContainer, {
    ...gridContainer.getAttrs(),
    resolutionX: newResolutionX,
    resolutionY: newResolutionY
  });
  gridContainer.destroy();
  parent.add(newGrid);
  parent.getLayer().draw();
};

let addGridEvents = (group, cursor) => {
  group.on('wheel', (ev) => {
    let pos = group.getStage().getPointerPosition();
    let grid = group.getStage().getIntersection(pos, '.grid');
    if (grid) {
      let delta = ev.evt.deltaY > 0 ? -1 : 1;
      incrementGridResolution(grid, delta, delta);
      ev.evt.preventDefault();
    }
  });

  group.on('click', (ev) => {
    if (ev.evt.which === 3) {
      if (App.shiftMod) {

      }
      else {
        let cursorPos = cursor.getAbsolutePosition();
        let newGrid = K(GridContainer, {resolutionX: 2, resolutionY: 2, x: cursorPos.x, y: cursorPos.y, width: 128, height: 128});
        let backgroundGroup = group.getStage().findOne('#background');

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
};

let addKeyboardEvents = (stage) => {
  let selectionRect = null;

  let createOrUpdateSelectionRect = (container, pt) => {
    if (!selectionRect) {
      selectionRect = K('Rect', {stroke: 'blue', strokeWidth: 2});
      selectionRect.setAttrs({
        x: pt.x,
        y: pt.y
      });
      container.add(selectionRect);
    }
    selectionRect.setAttrs({
      x: Math.min(selectionRect.x(), pt.x),
      y: Math.min(selectionRect.y(), pt.y),
      width: Math.abs(pt.x - selectionRect.x()),
      height: Math.abs(pt.y - selectionRect.y())
    });
  }

  let removeSelectionRect = () => {
    if (selectionRect) {
      let foregroundGroup = stage.findOne('#foreground');
      copyBounds(foregroundGroup, {...selectionRect.size(), ...selectionRect.position()});
      selectionRect.destroy();
      selectionRect = null;
    }
  }

  stage.container().addEventListener('keydown', (ev) => {
    let cursor = stage.findOne('#cursor');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }

    let xStep = grid.getAttr('width') / grid.getAttr('resolutionX');
    let yStep = grid.getAttr('height') / grid.getAttr('resolutionY');

    if (ev.ctrlKey) {
      if (ev.code === 'KeyC') {
        let foregroundGroup = stage.findOne('#foreground');
        copyBounds(foregroundGroup, {...cursor.position(), width: xStep, height: yStep});
      }
      else if (ev.code === 'KeyV') {
        let foregroundGroup = stage.findOne('#foreground');
        pastePosition(foregroundGroup, cursor.position());
      }
      else if (ev.code === 'KeyA') {
        resizeBy(grid, -xStep, 0);
        incrementGridResolution(grid, -1, 0);
      }
      else if (ev.code === 'KeyD') {
        resizeBy(grid, +xStep, 0);
        incrementGridResolution(grid, +1, 0);
      }
      else if (ev.code === 'KeyW') {
        resizeBy(grid, 0, -yStep);
        incrementGridResolution(grid, 0, -1);
      }
      else if (ev.code === 'KeyS') {
        resizeBy(grid, 0, +yStep);
        incrementGridResolution(grid, 0, +1);
      }
      else {
        return;
      }
    }
    else if (ev.shiftKey) {
      if (ev.code === 'ArrowLeft') {
        translateBy(cursor, -xStep, 0);
        createOrUpdateSelectionRect(cursor.getParent(), cursor.position());
        cursor.getLayer().draw();
      }
      else if (ev.code === 'ArrowRight') {
        translateBy(cursor, +xStep, 0);
        createOrUpdateSelectionRect(cursor.getParent(), cursor.position());
        cursor.getLayer().draw();
      }
      else if (ev.code === 'ArrowUp') {
        translateBy(cursor, 0, -yStep);
        createOrUpdateSelectionRect(cursor.getParent(), cursor.position());
        cursor.getLayer().draw();
      }
      else if (ev.code === 'ArrowDown') {
        translateBy(cursor, 0, +yStep);
        createOrUpdateSelectionRect(cursor.getParent(), cursor.position());
        cursor.getLayer().draw();
      }
      else if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
        createOrUpdateSelectionRect(cursor.getParent(), cursor.position());
      }
    }
    else {
      if (ev.code === 'ArrowLeft') {
        translateBy(cursor, -xStep, 0);
        cursor.getLayer().draw();
      }
      else if (ev.code === 'ArrowRight') {
        translateBy(cursor, +xStep, 0);
        cursor.getLayer().draw();
      }
      else if (ev.code === 'ArrowUp') {
        translateBy(cursor, 0, -yStep);
        cursor.getLayer().draw();
      }
      else if (ev.code === 'ArrowDown') {
        translateBy(cursor, 0, +yStep);
        cursor.getLayer().draw();
      }
      else if (ev.code === 'KeyA') {
        incrementGridResolution(grid, -1, 0);
      }
      else if (ev.code === 'KeyD') {
        incrementGridResolution(grid, +1, 0);
      }
      else if (ev.code === 'KeyW') {
        incrementGridResolution(grid, 0, -1);
      }
      else if (ev.code === 'KeyS') {
        incrementGridResolution(grid, 0, +1);
      }
      else if (ev.code === 'Space') {
        let foregroundGroup = stage.findOne('#foreground');
        pastePosition(foregroundGroup, cursor.position());
      }
      else if (ev.code === 'Backspace') {
        let foregroundGroup = stage.findOne('#foreground');
        let bounds = {...cursor.position(), width: xStep, height: yStep};
        let eraseChildren = queryBounds(foregroundGroup, bounds);
        if (eraseChildren.length > 0) {
          C('Erase', {elements: eraseChildren, parent: foregroundGroup});
        }
      }
      else {
        return;
      }
    }

    ev.preventDefault();
  });

  stage.container().addEventListener('keyup', (ev) => {
    let cursor = stage.findOne('#cursor');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }

    if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
      removeSelectionRect();
      cursor.getLayer().draw();
    }
    else {
      return;
    }

    ev.preventDefault();
  })

  stage.container().addEventListener('keydown', (ev) => {
    if (ev.code === 'KeyZ' && ev.ctrlKey) {
      C('Undo');
    }
    else if (ev.code === 'KeyY' && ev.ctrlKey) {
      C('Redo');
    }
    else {
      return;
    }

    ev.preventDefault();
  });

  stage.container().addEventListener('keydown', (ev) => {
    if (ev.shiftKey) {
      App.shiftMod = true;
    }
    if (ev.ctrlKey) {
      App.ctrlMod = true;
    }
  });

  stage.container().addEventListener('keyup', (ev) => {
    if (!ev.shiftKey) {
      App.shiftMod = false;
    }
    if (!ev.ctrlKey) {
      App.ctrlMod = false;
    }
  });
};

let addDragDropEvents = (stage) => {
  stage.container().addEventListener('drop', (ev) => {
    if (ev.dataTransfer.items) {
      for (let i = 0; i < ev.dataTransfer.items.length; i++) {
        if (ev.dataTransfer.items[i].kind === 'file') {
          let image = new Image();
          let file = ev.dataTransfer.items[i].getAsFile();
          let reader = new FileReader();
          reader.addEventListener('load', (ev) => {
            image.addEventListener('load', (ev) => {
              let imageWidth = image.width;
              let imageHeight = image.height;
              let regionImage = K(RegionImage, {
                image: image,
                width: imageWidth,
                height: imageHeight,
                x: 500,
                y: 10,
                opacity: 0.5,
                scaleX: 2.0,
                scaleY: 2.0
              });
              let foregroundGroup = stage.findOne('#foreground');
              foregroundGroup.add(regionImage);
              foregroundGroup.getLayer().draw();

              let grid = K(GridContainer, {resolutionX: 16, resolutionY: 16, x: 500, y: 10, width: imageWidth * 2, height: imageHeight * 2});
              let backgroundGroup = stage.findOne('#background');
              backgroundGroup.add(grid);
              backgroundGroup.getLayer().draw();

              stage.findOne('#overlay').on('click', (ev) => {
                let cursor = stage.findOne('#cursor');
                if (!stage.getIntersection(cursor.getAbsolutePosition(), '.grid')) {
                  return;
                }
                App.clipboard = [
                  K(RegionImage, {
                    image,
                    width: 8,
                    height: 8,
                    x: 0,
                    y: 0,
                    scaleX: 2.0,
                    scaleY: 2.0,
                    regionX: (cursor.getAbsolutePosition().x - regionImage.getAbsolutePosition().x) / 2.0,
                    regionY: (cursor.getAbsolutePosition().y - regionImage.getAbsolutePosition().y) / 2.0,
                    regionWidth: 8,
                    regionHeight: 8
                  })
                ];
              })
            });
            image.src = reader.result;
          }, false);
          reader.readAsDataURL(file);
        }
      }
    }
    ev.preventDefault();
  });

  stage.container().addEventListener('dragover', (ev) => {
    ev.preventDefault();
  });
}

let disableRightClick = (stage) => {
  stage.on('contentContextmenu', (e) => {
    e.evt.preventDefault();
  });
};

function MakeApp(container, {width, height}) {
  K('Stage', {container: container, width: width, height: height},
    K('Layer', {},
      K('Group', {width: width, height: height}, '#background',
        K(GridContainer, {resolutionX: 16, resolutionY: 16, x: 10, y: 10, width: 256, height: 256}),
        [Borders, {stroke: 'red', strokeWidth: 1}]
      )
    ),
    K('Layer', {},
      K('Group', {width: width, height: height}, '#foreground')
    ),
    K('Layer', {},
      K('Group', {width: width, height: height}, '#overlay',
        K('Rect', {width: width, height: height}),
        K('Circle', {radius: 6, stroke: 'black', strokeWidth: 1, x: 0, y: 0, listening: false}, '#cursor', /cursor/),
        [Drawable, /cursor/],
        [addGridEvents, /cursor/]
      )
    ),
    [disableRightClick],
    [addKeyboardEvents],
    [addDragDropEvents]
  )
}

H(document.body, {},
  H('div', {},
    [el => el.setAttribute('tabindex', 0)],
    [el => el.style.outline = 'none'],
    [MakeApp, {width: 800, height: 600}]
  )
);