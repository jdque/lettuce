import Mousetrap from 'mousetrap';
import Sortable from 'sortablejs';
import {Command, Commander} from './core/commander';
import {Reflector} from './core/reflector';
import {Selector} from './core/selector';
import {FSM} from '../lib/royal';
import H from './html/html_builder';
import {attr, on, style, focus, children} from './html/html_actions';
import K from './konva/konva_builder';
import {draw, resizeBy, translateBy, queryBounds, disableRightClick} from './konva/konva_actions';

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

let ChangePageCommand = Command({
  commit: ({toPage, appState}) => {
    let fromPage = appState.props('selectedPage');
    appState.update({
      selectedPage: toPage
    });
    return {fromPage, appState};
  },
  rollback: ({fromPage, appState}) => {
    appState.update({
      selectedPage: fromPage
    });
  },
  destroy: ({fromPage, toPage, appState}) => {
    // NO-OP
  }
});

let App = {
  C: Commander({
    'Draw': DrawCommand,
    'Erase': EraseCommand,
    'ChangePage': ChangePageCommand
  }),
  clipboard: [],
  pages:[
    {
      name: 'Hello',
      elem: null,
      stage: null
    },
    {
      name: 'World',
      elem: null,
      stage: null
    },
    {
      name: 'Again',
      elem: null,
      stage: null
    },
    {
      name: 'Another',
      elem: null,
      stage: null
    }
  ],
  shiftMod: false,
  ctrlMod: false
};

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
    App.C('Draw', {elements: clones, parent: container});
  }
}

function RectPreview(buildFunc) {
  let preview = Reflector({
    container: null,
    point: null
  });

  let binding = preview.reflect((props, state) => {
    let {container, point} = props;
    if (container == null && point == null) {
      return;
    }

    if (state.rect == null) {
      state.rect = buildFunc();
      state.rect.setAttrs({
        x: point.x,
        y: point.y
      });
      state.startPoint = {
        x: point.x,
        y: point.y
      };
      container.add(state.rect);
    }

    if (container == null) {
      state.rect.destroy();
      state.rect = null;
      return;
    }

    state.rect.setAttrs({
      x: Math.min(point.x, state.startPoint.x),
      y: Math.min(point.y, state.startPoint.y),
      width: Math.abs(point.x - state.startPoint.x),
      height: Math.abs(point.y - state.startPoint.y)
    });
  });

  return {
    update: (container, point) => {
      preview.update({container, point});
    },
    destroy: () => {
      preview.update({container: null});
    },
    get: () => {
      return binding.state('rect');
    },
    isValid: () => {
      return binding.state('rect') != null;
    }
  };
}

function LinePreview(buildLineFunc) {
  let preview = Reflector({
    container: null,
    point: null
  });

  let binding = preview.reflect((props, state) => {
    let {container, point} = props;
    if (container == null && point == null) {
      return;
    }

    if (state.line == null) {
      state.line = buildLineFunc();
      state.line.setAttrs({
        points: [point.x, point.y, point.x, point.y]
      });
      state.startPoint = {
        x: point.x,
        y: point.y
      };
      container.add(state.line);
    }

    if (container == null) {
      state.line.destroy();
      state.line = null;
      return;
    }

    state.line.setAttrs({
      points: [state.startPoint.x, state.startPoint.y, point.x, point.y]
    });
  });

  return {
    update: (container, point) => {
      preview.update({container, point});
    },
    destroy: () => {
      preview.update({container: null})
    },
    get: () => {
      return binding.state('line');
    },
    isValid: () => {
      return binding.state('line') != null;
    }
  };
}

function gridLines(container, numCols, numRows, lineStyle) {
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

function borders(container, borderStyle) {
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

function drawable(container, cursor) {
  let $mouse = FSM.create(['idle', 'drag_line', 'drag_select']);

  $mouse.when('idle', ($self) => {
    let onMouseDown = (ev) => {
      if (App.shiftMod) {
        $self.set('drag_select');
      }
      else {
        $self.set('drag_line');
      }
    }

    container.on('mousedown.idle', onMouseDown);

    return () => {
      container.off('mousedown.idle');
    }
  });

  $mouse.when('drag_line', ($self) => {
    let linePreview = LinePreview(() => K('Line', {stroke: 'red', strokeWidth: 2}));

    let onMouseMove = (ev) => {
      let containerPos = container.getAbsolutePosition();
      let pos = cursor ? cursor.getAbsolutePosition() : container.getStage().getPointerPosition();
      linePreview.update(container, {x: pos.x - containerPos.x, y: pos.y - containerPos.y});
      container.getLayer().draw();
    }

    let onMouseUp = (ev) => {
      if (linePreview.isValid()) {
        let foregroundGroup = container.getStage().findOne('.id-foreground');
        let line = linePreview.get();
        let [startX, startY, endX, endY] = line.getAttr('points');
        if (startX !== endX || startY !== endY) {
          App.C('Draw', {
            elements: [K('Line', {...line.getAttrs()})],
            parent: foregroundGroup
          });
        }
        linePreview.destroy();
        container.getLayer().draw();
      }

      $self.set('idle');
    }

    container.on('mousemove.drag_line', onMouseMove);
    container.on('mouseup.drag_line', onMouseUp);

    return () => {
      container.off('mousemove.drag_line');
      container.off('mouseup.drag_line');
    }
  });

  $mouse.when('drag_select', ($self) => {
    let selectionPreview = RectPreview(() => K('Rect', {stroke: 'black', strokeWidth: 1, fill: 'blue', opacity: 0.6}));

    let onMouseMove = (ev) => {
      let containerPos = container.getAbsolutePosition();
      let pos = cursor ? cursor.getAbsolutePosition() : container.getStage().getPointerPosition();
      selectionPreview.update(container, {x: pos.x - containerPos.x, y: pos.y - containerPos.y});
      container.getLayer().draw();
    }

    let onMouseUp = (ev) => {
      if (selectionPreview.isValid()) {
        let foregroundGroup = container.getStage().findOne('.id-foreground');
        let rect = selectionPreview.get();
        copyBounds(foregroundGroup, {...rect.size(), ...rect.position()});
        selectionPreview.destroy();
        container.getLayer().draw();
      }

      $self.set('idle');
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
    [gridLines, resolutionX, resolutionY, {stroke: 'black', strokeWidth: 1}],
    [borders, {stroke: 'black', strokeWidth: 1}]
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

let $K = Selector({translateBy, resizeBy, draw});

let getCellSize = (gridContainer) => {
  return {
    width: gridContainer.getAttr('width') / gridContainer.getAttr('resolutionX'),
    height: gridContainer.getAttr('height') / gridContainer.getAttr('resolutionY')
  };
}

let getSnapPos = (gridContainer, pos) => {
  let {x: gridX, y: gridY} = gridContainer.position();
  let {width: cellWidth, height: cellHeight} = getCellSize(gridContainer);
  return {
    x: Math.round((pos.x - gridX) / cellWidth) * cellWidth + gridX,
    y: Math.round((pos.y - gridY) / cellHeight) * cellHeight + gridY
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
      let cursorPos = cursor.getAbsolutePosition();
      let newGrid = K(GridContainer, {
        resolutionX: 2, resolutionY: 2,
        x: cursorPos.x, y: cursorPos.y,
        width: 128, height: 128
      });
      let backgroundGroup = group.getStage().findOne('.id-background');

      App.C('Draw', {elements: [newGrid], parent: backgroundGroup});
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
  let selectionPreview = RectPreview(() => K('Rect', {stroke: 'black', strokeWidth: 1, fill: 'blue', opacity: 0.6}));
  let mousetrap = new Mousetrap(stage.container());

  mousetrap.bind(['left', 'right', 'up', 'down'], (ev, combo) => {
    let cursor = stage.findOne('.id-cursor');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }
    let {width: cellWidth, height: cellHeight} = getCellSize(grid);

    if (combo === 'left') {
      $K(cursor)
        .translateBy(-cellWidth, 0)
        .draw();
    }
    else if (combo === 'right') {
      $K(cursor)
        .translateBy(+cellWidth, 0)
        .draw();
    }
    else if (combo === 'up') {
      $K(cursor)
        .translateBy(0, -cellHeight)
        .draw();
    }
    else if (combo === 'down') {
      $K(cursor)
        .translateBy(0, +cellHeight)
        .draw();
    }

    return false;
  });

  mousetrap.bind(['a', 'd', 'w', 's'], (ev, combo) => {
    let cursor = stage.findOne('.id-cursor');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }

    if (combo === 'a') {
      $K(grid)
        .do([incrementGridResolution, -1, 0]);
    }
    else if (combo === 'd') {
      $K(grid)
        .do([incrementGridResolution, +1, 0]);
    }
    else if (combo === 'w') {
      $K(grid)
        .do([incrementGridResolution, 0, -1]);
    }
    else if (combo === 's') {
      $K(grid)
        .do([incrementGridResolution, 0, +1]);
    }

    return false;
  })

  mousetrap.bind(['shift+a', 'shift+d', 'shift+w', 'shift+s'], (ev, combo) => {
    let cursor = stage.findOne('.id-cursor');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }
    let {width: cellWidth, height: cellHeight} = getCellSize(grid);

    if (combo === 'shift+a') {
      $K(grid)
        .resizeBy(-cellWidth, 0)
        .do([incrementGridResolution, -1, 0]);
    }
    else if (combo === 'shift+d') {
      $K(grid)
        .resizeBy(+cellWidth, 0)
        .do([incrementGridResolution, +1, 0]);
    }
    else if (combo === 'shift+w') {
      $K(grid)
        .resizeBy(0, -cellHeight)
        .do([incrementGridResolution, 0, -1]);
    }
    else if (combo === 'shift+s') {
      $K(grid)
        .resizeBy(0, +cellHeight)
        .do([incrementGridResolution, 0, +1]);
    }

    return false;
  });

  mousetrap.bind(['shift+left', 'shift+right', 'shift+up', 'shift+down'], (ev, combo) => {
    let cursor = stage.findOne('.id-cursor');
    let overlayGroup = stage.findOne('.id-overlay');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }

    if (!selectionPreview.isValid()) {
      selectionPreview.update(overlayGroup, cursor.position());
    }

    let {width: cellWidth, height: cellHeight} = getCellSize(grid);

    if (combo === 'shift+left') {
      $K(cursor).translateBy(-cellWidth, 0);
      selectionPreview.update(overlayGroup, cursor.position());
      $K(overlayGroup).draw();
    }
    else if (combo === 'shift+right') {
      $K(cursor).translateBy(+cellWidth, 0);
      selectionPreview.update(overlayGroup, cursor.position());
      $K(overlayGroup).draw();
    }
    else if (combo === 'shift+up') {
      $K(cursor).translateBy(0, -cellHeight);
      selectionPreview.update(overlayGroup, cursor.position());
      $K(overlayGroup).draw();
    }
    else if (combo === 'shift+down') {
      $K(cursor).translateBy(0, +cellHeight);
      selectionPreview.update(overlayGroup, cursor.position());
      $K(overlayGroup).draw();
    }

    return false;
  });

  mousetrap.bind('ctrl+c', (ev) => {
    let cursor = stage.findOne('.id-cursor');
    let foregroundGroup = stage.findOne('.id-foreground');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }

    if (selectionPreview.isValid()) {
      let rect = selectionPreview.get();
      copyBounds(foregroundGroup, {...rect.position(), ...rect.size()});
    }
    else {
      copyBounds(foregroundGroup, {...cursor.position(), ...getCellSize(grid)});
    }

    return false;
  });

  mousetrap.bind('ctrl+v', (ev) => {
    let cursor = stage.findOne('.id-cursor');
    let foregroundGroup = stage.findOne('.id-foreground');

    pastePosition(foregroundGroup, cursor.position());

    return false;
  });

  mousetrap.bind('space', (ev) => {
    let cursor = stage.findOne('.id-cursor');
    let foregroundGroup = stage.findOne('.id-foreground');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }

    pastePosition(foregroundGroup, cursor.position());

    return false;
  });

  mousetrap.bind('backspace', (ev) => {
    let cursor = stage.findOne('.id-cursor');
    let foregroundGroup = stage.findOne('.id-foreground');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }

    let bounds = {...cursor.position(), ...getCellSize(grid)};
    let eraseChildren = queryBounds(foregroundGroup, bounds);
    if (eraseChildren.length > 0) {
      App.C('Erase', {elements: eraseChildren, parent: foregroundGroup});
    }

    return false;
  });

  mousetrap.bind('ctrl+z', (ev) => {
    App.C('Undo');
    return false;
  });

  mousetrap.bind('ctrl+y', (ev) => {
    App.C('Redo');
    return false;
  });

  mousetrap.bind('escape', (ev) => {
    let cursor = stage.findOne('.id-cursor');
    let grid = stage.getIntersection(cursor.getAbsolutePosition(), '.grid');
    if (!grid) {
      return;
    }

    if (selectionPreview.isValid()) {
      let overlayGroup = stage.findOne('.id-overlay');
      let foregroundGroup = stage.findOne('.id-foreground');
      let rect = selectionPreview.get();
      copyBounds(foregroundGroup, {...rect.size(), ...rect.position()});
      selectionPreview.destroy();
      overlayGroup.getLayer().draw();
    }
  });

  mousetrap.bind('shift', (ev) => {
    App.shiftMod = true;
  }, 'keydown');

  mousetrap.bind('shift', (ev) => {
    App.shiftMod = false;
  }, 'keyup');

  mousetrap.bind('ctrl', (ev) => {
    App.ctrlMod = true;
  }, 'keydown');

  mousetrap.bind('ctrl', (ev) => {
    App.ctrlMod = false;
  }, 'keyup');
};

let addDragDropEvents = (stage) => {
  stage.container().addEventListener('drop', (ev) => {
    let {offsetX: dropX, offsetY: dropY} = ev;
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
                x: dropX,
                y: dropY,
                opacity: 0.5,
                scaleX: 2.0,
                scaleY: 2.0
              });
              let foregroundGroup = stage.findOne('.id-foreground');
              foregroundGroup.add(regionImage);
              foregroundGroup.getLayer().draw();

              let grid = K(GridContainer, {resolutionX: 16, resolutionY: 16, x: dropX, y: dropY, width: imageWidth * 2, height: imageHeight * 2});
              let backgroundGroup = stage.findOne('.id-background');
              backgroundGroup.add(grid);
              backgroundGroup.getLayer().draw();

              stage.findOne('.id-overlay').on('click', (ev) => {
                let cursor = stage.findOne('.id-cursor');
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

function MainStage({container, width, height}) {
  return K('Stage', {container: container, width: width, height: height},
    K('Layer', {},
      K('Group', {width: width, height: height}, '.id-background',
        K(GridContainer, {resolutionX: 16, resolutionY: 16, x: 10, y: 10, width: 256, height: 256}),
        [borders, {stroke: 'red', strokeWidth: 1}]
      )
    ),
    K('Layer', {},
      K('Group', {width: width, height: height}, '.id-foreground')
    ),
    K('Layer', {},
      K('Group', {width: width, height: height}, '.id-overlay',
        K('Rect', {width: width, height: height}),
        K('Circle', {radius: 6, stroke: 'black', strokeWidth: 1, x: 0, y: 0, listening: false}, '.id-cursor', /cursor/),
        [drawable, /cursor/],
        [addGridEvents, /cursor/]
      )
    ),
    [disableRightClick],
    [addKeyboardEvents],
    [addDragDropEvents]
  );
}

//-----------------------------------------------------------------------------

function reflectAction(el, reflector, action) {
  reflector.reflect((props) => {
    let [func, ...args] = action;
    let resolvedArgs = args.map((arg) => {
      return arg instanceof RegExp ? props[arg.source] : arg;
    });
    H(el, {}, [func, ...resolvedArgs]);
  });
}

function sortable(el, options = {}) {
  Sortable.create(el, options);
}

function StageContainer({width, height}) {
  return H('div', {},
    [attr, {tabindex: 0}],
    [style, {outline: 'none', cursor: 'none'}]
  );
}

function PageTabBar({appState, onPageSelect}) {
  function PageTab(props) {
    return H('div', {textContent: props.page.name},
      [style, {
        display: 'inline-block',
        width: '8em',
        textAlign: 'center',
        borderRight : '1px solid black',
        backgroundColor: '#ffffff',
        cursor: 'pointer'
      }]
    );
  }

  let renderTabs = (tabBarElem) => {
    let {pages, selectedPage} = appState.props();
    let tabElems = pages.map((page) => {
      let isSelected = page === selectedPage;
      return H(PageTab, {page: page},
        [on, {click: (ev) => onPageSelect(page)}],
        [style, {backgroundColor: isSelected ? '#ffffff' : '#d0d0d0'}]
      )
    });

    H(tabBarElem, {},
      [children, tabElems, true]
    );
  }

  return H('div', {},
    [reflectAction, appState, [renderTabs]],
    [sortable, {
      group: 'default',
      onUpdate: (ev) => {
        appState.update(({pages}) => {
          let movedPage = pages[ev.oldIndex];
          let dir = ev.oldIndex < ev.newIndex ? +1 : -1;
          for (let idx = ev.oldIndex; idx !== ev.newIndex; idx += dir) {
            pages[idx] = pages[idx + dir];
          }
          pages[ev.newIndex] = movedPage;
        });
      }
    }]
  );
}

function PageViewer({appState}) {
  function renderPage(viewerElem) {
    let {selectedPage} = appState.props();
    let pageElem = selectedPage.elem;

    H(viewerElem, {},
      [children, [pageElem], true]
    );
    H(pageElem, {},
      [focus]
    );
  };

  return H('div', {},
    [reflectAction, appState, [renderPage]]
  );
}

function main() {
  let appState = Reflector({
    pages: App.pages,
    selectedPage: App.pages[0],
  });

  let selectPage = (page) => {
    App.C('ChangePage', {toPage: page, appState: appState});
  };

  appState.reflect(({selectedPage}) => {
    if (selectedPage.elem == null) {
      selectedPage.elem = H(StageContainer);
    }
    if (selectedPage.stage == null) {
      selectedPage.stage = K(MainStage, {container: selectedPage.elem, width: 800, height: 600});
    }
  });

  H(document.body, {},
    H('div', {}, [style, {display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh'}],
      H('div', {}, [style, {display: 'flex', flexDirection: 'column', flexGrow: 1, flexBasis: 0, overflow: 'hidden'}],
        H('div', {},
          H(PageTabBar, {appState: appState, onPageSelect: selectPage},
            [style, {paddingTop: '2px'}]
          ),
          [style, {backgroundColor: 'grey'}],
        ),
        H('div', {},
          H(PageViewer, {appState: appState}),
          [style, {padding: '8px', flexGrow: 1, flexBasis: 0}]
        ),
      )
    ),
    [style, {margin: 0}]
  );
}

import * as THREE from 'three';
import T from './three/three_builder';
import {pos, rot, scale, Sector} from './three/three_actions';

function main2() {
  let geometry = new THREE.PlaneGeometry(1, 1);
  let material =  new THREE.MeshLambertMaterial({side: THREE.DoubleSide});

  let camera = T('PerspectiveCamera', [75, window.innerWidth / window.innerHeight]);

  let scene = T('Scene', [],
    T('Group', [],
      [pos, -2, -1, -6],
      [rot, Math.PI / 4, Math.PI / 4, 0],
      T('AxesHelper', [10]),
      T('PointLight', [0xffffff, 2, 60, 2], [pos, -2, 6, 4]),
      T('Group', [], [pos, 0.5, 0.5, 0],
        T(Sector, [geometry, material], [pos, 0, 0, 0]),
        T(Sector, [geometry, material], [pos, 1, 0, 0]),
        T(Sector, [geometry, material], [pos, 0, 0, 1]),
        T(Sector, [geometry, material], [pos, 1, 0, 1]),
        T(Sector, [geometry, material], [pos, 2, 0, 0]),
        T(Sector, [geometry, material], [pos, 1, 0, 2])
      )
    )
  );

  let renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(window.innerWidth,window.innerHeight);
  document.body.style.margin = 0;
  document.body.appendChild(renderer.domElement);

  renderer.render(scene, camera);
}

main2();