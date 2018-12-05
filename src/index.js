import K from './builder';
import {FSM} from '../lib/royal';

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
  let stage = container.getStage();
  let $mouse = FSM.create(['idle', 'dragging_line', 'dragging_resize_horz', 'dragging_resize_vert']);

  $mouse.when('idle', ({data}) => {
    let onMouseDown = (ev) => {
      if (true) {
        let pointerPos = container.getStage().getPointerPosition();
        let grid = container.getStage().getIntersection(pointerPos, '.grid');
        if (grid) {
          if (Math.abs(pointerPos.x - (grid.getAbsolutePosition().x + grid.getAttr('width'))) < 8) {
            $mouse.set('dragging_resize_horz', {grid: grid});
          }
          if (Math.abs(pointerPos.y - (grid.getAbsolutePosition().y + grid.getAttr('height'))) < 8) {
            $mouse.set('dragging_resize_vert', {grid: grid});
          }
        }
      }
      else {
        $mouse.set('dragging_line');
      }
    }

    container.on('mousedown', onMouseDown);

    return () => {
      container.off('mousedown', onMouseDown);
    }
  });

  $mouse.when('dragging_line', ({data}) => {
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
      if (startPt.x === endPt.x && startPt.y === endPt.y) {
        let layer = line.getLayer().draw();
        line.destroy();
        layer.draw();
      }
      $mouse.set('idle');
    }

    container.on('mousemove', onMouseMove);
    container.on('mouseup', onMouseUp);

    return () => {
      container.off('mousemove', onMouseMove);
      container.off('mouseup', onMouseUp);
    }
  });

  $mouse.when('dragging_resize_horz', ({data}) => {
    let grid = data.grid;
    let origWidth = grid.getAttr('width');
    let startPt = container.getStage().getPointerPosition();

    let onMouseUp = (ev) => {
      let endPt = container.getStage().getPointerPosition();
      let distance = endPt.x - startPt.x;

      let parent = grid.getParent();
      let newGrid = K(GridContainer, {...grid.getAttrs(), width: origWidth + distance});
      grid.destroy();
      parent.add(newGrid);
      parent.getLayer().draw();

      $mouse.set('idle');
    }

    container.on('mouseup', onMouseUp);

    return () => {
      container.off('mouseup', onMouseUp);
    };
  });

  $mouse.when('dragging_resize_vert', ({data}) => {
    let grid = data.grid;
    let origHeight = grid.getAttr('height');
    let startPt = container.getStage().getPointerPosition();

    let onMouseUp = (ev) => {
      let endPt = container.getStage().getPointerPosition();
      let distance = endPt.y - startPt.y;

      let parent = grid.getParent();
      let newGrid = K(GridContainer, {...grid.getAttrs(), height: origHeight + distance});
      grid.destroy();
      parent.add(newGrid);
      parent.getLayer().draw();

      $mouse.set('idle');
    }

    container.on('mouseup', onMouseUp);

    return () => {
      container.off('mouseup', onMouseUp);
    };
  });

  $mouse.set('idle');
}

function GridContainer({resolution, ...style}) {
  let container = K('Container', {...style},
    K('Rect', {width: style.width, height: style.height}),
    [GridLines, resolution, resolution, {stroke: 'black', strokeWidth: 1}],
    [Borders, {stroke: 'black', strokeWidth: 1}]
  );
  container.setAttr('resolution', resolution);
  container.addName('grid');

  return container;
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
    }
  });

  group.on('click', (ev) => {
    if (ev.evt.which === 3) {
      let cursorPos = cursor.getAbsolutePosition();
      let newGrid = K(GridContainer, {resolution: 2, x: cursorPos.x, y: cursorPos.y, width: 100, height: 100});
      let backgroundGroup = group.getStage().findOne('.background');
      backgroundGroup.add(newGrid);
      backgroundGroup.getLayer().draw();
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
    )
  ),
  K('Layer', {},
    K('Group', {width: 800, height: 600}, '.foreground',
      K('Rect', {width: 800, height: 600}),
      K('Circle', {radius: 6, stroke: 'black', strokeWidth: 1, x: 0, y: 0, listening: false}, /cursor/),
      [Borders, {stroke: 'red', strokeWidth: 1}],
      [Drawable, /cursor/],
      [setupEvents, /cursor/],
    )
  ),
  [disableRightClick]
)