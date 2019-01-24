function Accessor(binding) {
  let accessor = {
    state: (key) => {
      if (key) {
        return binding.state[key];
      }
      let snapshot = {};
      for (let key in binding.state) {
        snapshot[key] = binding.state[key];
      }
      return snapshot;
    }
  };
  return accessor;
}

export function Reflector(props) {
  let bindings = [];

  let reflector = {
    props: (key) => {
      if (key) {
        return props[key];
      }
      let snapshot = {};
      for (let key in props) {
        snapshot[key] = props[key];
      }
      return snapshot;
    },
    reflect: (func, quiet = false) => {
      let binding = {
        func: func,
        props: props,
        state: {}
      };
      bindings.push(binding);

      if (!quiet) {
        binding.func(props, binding.state);
      }

      return Accessor(binding);
    },
    update: (patch, quiet = false) => {
      if (typeof patch === 'function') {
        patch = patch(props);
      }

      for (let key in patch) {
        if (!props.hasOwnProperty(key)) {
          throw new Error(`Invalid reflector update: ${key}`);
        }
        props[key] = patch[key];
      }

      if (!quiet) {
        for (let binding of bindings) {
          binding.func(props, binding.state);
        }
      }
    }
  }
  return reflector;
}