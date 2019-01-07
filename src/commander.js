export function Command({commit, rollback, destroy}) {
  return {
    isCommand: true,
    commit: commit || function () {},
    rollback: rollback || function () {},
    destroy: destroy  || function () {},
  };
}

export function Commander(commands) {
  let log = [];
  let currentIdx = -1;
  let locked = false;

  let undo = () => {
    if (currentIdx === -1) {
      throw new Error('Nothing to undo');
    }
    let currentEntry = log[currentIdx];
    currentIdx -= 1;
    currentEntry.command.rollback(currentEntry.rollbackProps);
  }

  let redo = () => {
    if (currentIdx === log.length - 1) {
      throw new Error('Nothing to redo');
    }
    let nextEntry = log[currentIdx + 1];
    currentIdx += 1;
    nextEntry.rollbackProps = nextEntry.command.commit(nextEntry.commitProps);
  }

  let scrub = () => {
    for (let i = log.length - 1; i > currentIdx; i--) {
      let lastEntry = log.pop();
      if (lastEntry.command.destroy) {
        lastEntry.command.destroy(lastEntry.rollbackProps);
      }
    }
  }

  let execute = (name, props) => {
    let command = commands[name];
    if (!command || !command.isCommand) {
      throw new Error(`Unrecognized command: ${name}`);
    }
    let newEntry = {
      command: command,
      commitProps: props,
      rollbackProps: null
    }
    scrub();
    log.push(newEntry);
    currentIdx += 1;
    newEntry.rollbackProps = newEntry.command.commit(newEntry.commitProps);
  }

  return (name, props) => {
    if (locked) {
      throw new Error(`Cannot execute a command inside another command`);
    }

    locked = true;
    try {
      if (name === 'Undo') {
        undo();
      }
      else if (name === 'Redo') {
        redo();
      }
      else {
        execute(name, props);
      }
    }
    finally {
      locked = false;
    }
  }
}