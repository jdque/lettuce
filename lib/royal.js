"use strict";
exports.__esModule = true;
var MachineState;
(function (MachineState) {
    MachineState[MachineState["IDLE"] = 0] = "IDLE";
    MachineState[MachineState["DEAD"] = 1] = "DEAD";
    MachineState[MachineState["ENTER"] = 2] = "ENTER";
    MachineState[MachineState["EXIT"] = 3] = "EXIT";
    MachineState[MachineState["UPDATE"] = 4] = "UPDATE";
    MachineState[MachineState["RESTORE"] = 5] = "RESTORE";
    MachineState[MachineState["GUARD"] = 6] = "GUARD";
})(MachineState || (MachineState = {}));
function isArray(obj) {
    return Array.isArray(obj);
}
function isFunction(obj) {
    return typeof obj === 'function';
}
function isHandler(obj) {
    if (obj == null) {
        return false;
    }
    return 'enter' in obj && 'update' in obj && 'exit' in obj;
}
function isPartialHandler(obj) {
    if (obj == null) {
        return false;
    }
    return 'enter' in obj || 'update' in obj || 'exit' in obj;
}
function isState(state) {
    return typeof state === 'string';
}
function isTransition(transition) {
    return typeof transition === 'object' && Object.keys(transition).length === 1;
}
function makeTransition(from, to) {
    var transition = {};
    transition[from] = to;
    return transition;
}
function unpack(obj) {
    var key = Object.keys(obj)[0];
    var value = obj[key];
    return [key, value];
}
function extend(base) {
    var objs = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        objs[_i - 1] = arguments[_i];
    }
    for (var _a = 0, objs_1 = objs; _a < objs_1.length; _a++) {
        var obj = objs_1[_a];
        for (var key in obj) {
            base[key] = obj[key];
        }
    }
    return base;
}
var Node = /** @class */ (function () {
    function Node(name, states, children) {
        if (children === void 0) { children = []; }
        this.name = name;
        this.states = states;
        this.children = [];
        this.childMap = {};
        for (var _i = 0, _a = this.states; _i < _a.length; _i++) {
            var state = _a[_i];
            this.childMap[state] = {};
        }
        this.childMap['*'] = {};
        for (var _b = 0, children_1 = children; _b < children_1.length; _b++) {
            var child = children_1[_b];
            this.initChild(child);
        }
    }
    Node.prototype.initChild = function (child) {
        if (child instanceof Restrictor) {
            for (var _i = 0, _a = child.children; _i < _a.length; _i++) {
                var grandChild = _a[_i];
                for (var _b = 0, _c = child.states; _b < _c.length; _b++) {
                    var state = _c[_b];
                    if (this.childMap[state][grandChild.name]) {
                        throw new Error("Duplicate node: " + grandChild.name);
                    }
                    this.childMap[state][grandChild.name] = grandChild;
                    this.children.push(grandChild);
                }
            }
        }
        else {
            if (this.childMap['*'][child.name]) {
                throw new Error("Duplicate node: " + child.name);
            }
            this.childMap['*'][child.name] = child;
            this.children.push(child);
        }
    };
    Node.create = function (name, states, children) {
        if (children === void 0) { children = []; }
        return new Node(name, states, children);
    };
    Node.prototype.hasChild = function (name, state) {
        if (!this.hasState(state)) {
            return false;
        }
        return this.childMap[state][name] || this.childMap['*'][name] ? true : false;
    };
    Node.prototype.hasState = function (state) {
        return this.states.indexOf(state) >= 0 || state === '*';
    };
    Node.prototype.hasTransition = function (from, to) {
        return (this.hasState(from) || from === '*') &&
            (this.hasState(to) || to === '*');
    };
    Node.prototype.getChild = function (name, state) {
        if (!this.hasChild(name, state)) {
            return null;
        }
        return this.childMap[state][name] || this.childMap['*'][name];
    };
    Node.prototype.getChildren = function (state) {
        if (!this.hasState(state)) {
            return null;
        }
        var childMap = extend({}, this.childMap['*'], this.childMap[state]);
        var children = Object.keys(childMap).map(function (key) { return childMap[key]; });
        return children;
    };
    return Node;
}());
var Restrictor = /** @class */ (function () {
    function Restrictor(states, children) {
        if (children === void 0) { children = []; }
        this.type = 'Restrictor';
        if (!isArray(states)) {
            states = [states];
        }
        this.states = states;
        this.children = children;
    }
    return Restrictor;
}());
function s(name, states, children) {
    return new Node(name, states, children);
}
exports.s = s;
function only(states, children) {
    return new Restrictor(states, children);
}
exports.only = only;
var GuardContext = /** @class */ (function () {
    function GuardContext(guard, handler) {
        this.guard = guard;
        this.handler = handler;
        this.machineState = MachineState.IDLE;
    }
    GuardContext.prototype.selfEnter = function () {
        var shouldProceed = false;
        this.machineState = MachineState.ENTER;
        //--------
        var enterRes = null;
        if (this.handler && this.handler.enter) {
            enterRes = this.handler.enter(this.guard);
        }
        if (enterRes === true) {
            shouldProceed = true;
        }
        else if (isPartialHandler(enterRes)) {
            this.handler.update = enterRes.update || null;
            this.handler.exit = enterRes.exit || null;
        }
        else if (isFunction(enterRes)) {
            this.handler.exit = enterRes;
        }
        //--------
        this.machineState = MachineState.IDLE;
        if (shouldProceed) {
            this.guard.proceed();
        }
    };
    GuardContext.prototype.selfExit = function () {
        this.machineState = MachineState.EXIT;
        //--------
        if (this.handler.exit) {
            this.handler.exit();
        }
        //--------
        this.machineState = MachineState.DEAD;
    };
    GuardContext.prototype.selfUpdate = function (delta) {
        this.machineState = MachineState.UPDATE;
        //--------
        if (this.handler.update) {
            this.handler.update(this.guard, delta);
        }
        //--------
        this.machineState = MachineState.IDLE;
    };
    GuardContext.prototype.selfConfigure = function (config) {
        // NOOP
    };
    return GuardContext;
}());
var StateContext = /** @class */ (function () {
    function StateContext(node, parent, state, handler, data) {
        if (parent === void 0) { parent = null; }
        if (state === void 0) { state = '*'; }
        if (handler === void 0) { handler = null; }
        if (data === void 0) { data = {}; }
        this.parent = parent;
        this.node = node;
        this.state = state;
        this.handler = handler;
        this.data = data;
        this.depth = parent ? parent.depth + 1 : 0;
        this.config = parent ? parent.config : null;
        this.machineState = MachineState.IDLE;
        this.nodeOf = {};
        this.stateOf = {};
        this.handlerOf = {};
        this.guardOf = {};
        this.queueOf = {};
        this.contextOf = {};
        var children = this.node.getChildren(this.state);
        for (var _i = 0, children_2 = children; _i < children_2.length; _i++) {
            var child = children_2[_i];
            this.initChild(child);
        }
    }
    StateContext.prototype.initChild = function (node) {
        var name = node.name;
        this.nodeOf[name] = node;
        this.handlerOf[name] = {};
        this.guardOf[name] = {};
        this.queueOf[name] = [];
    };
    StateContext.prototype.isGuarded = function (target, from, to) {
        var fromGuards = this.guardOf[target.name];
        if (!fromGuards) {
            return false;
        }
        var toGuards = fromGuards[from] || fromGuards['*'];
        if (!toGuards) {
            return false;
        }
        var handler = toGuards[to] || toGuards['*'];
        if (!handler) {
            return false;
        }
        return true;
    };
    //TODO - better name
    StateContext.prototype.selfEnter = function () {
        this.machineState = MachineState.ENTER;
        //--------
        var enterRes = null;
        if (this.handler && this.handler.enter) {
            enterRes = this.handler.enter(this);
        }
        if (isPartialHandler(enterRes)) {
            this.handler.update = enterRes.update || null;
            this.handler.exit = enterRes.exit || null;
        }
        else if (isFunction(enterRes)) {
            this.handler.exit = enterRes;
        }
        //--------
        this.machineState = MachineState.IDLE;
    };
    StateContext.prototype.selfExit = function () {
        this.machineState = MachineState.EXIT;
        //--------
        for (var name_1 in this.contextOf) {
            this.execExit(this.nodeOf[name_1], this.stateOf[name_1]);
        }
        if (this.handler && this.handler.exit) {
            this.handler.exit();
        }
        //--------
        this.machineState = MachineState.DEAD;
    };
    StateContext.prototype.selfUpdate = function (delta) {
        this.machineState = MachineState.UPDATE;
        //--------
        for (var name_2 in this.contextOf) {
            this.execUpdate(this.nodeOf[name_2], this.stateOf[name_2], delta);
        }
        if (this.handler && this.handler.update) {
            this.handler.update(this, delta);
        }
        //--------
        this.machineState = MachineState.IDLE;
    };
    StateContext.prototype.selfRestore = function (json) {
        this.machineState = MachineState.RESTORE;
        //--------
        var enterRes = null;
        if (this.handler && this.handler.enter) {
            enterRes = this.handler.enter(this);
        }
        if (isPartialHandler(enterRes)) {
            this.handler.update = enterRes.update || null;
            this.handler.exit = enterRes.exit || null;
        }
        else if (isFunction(enterRes)) {
            this.handler.exit = enterRes;
        }
        for (var _i = 0, _a = json.children; _i < _a.length; _i++) {
            var child = _a[_i];
            this.execRestore(child);
        }
        //--------
        this.machineState = MachineState.IDLE;
    };
    StateContext.prototype.selfConfigure = function (config) {
        this.config = config;
        for (var name_3 in this.contextOf) {
            this.contextOf[name_3].selfConfigure(config);
        }
    };
    StateContext.prototype.execEnter = function (target, toState, data) {
        var handler = this.handlerOf[target.name][toState];
        if (!handler && this.config.requireHandler) {
            throw new Error("No handler registered for: " + target.name + ": enter " + toState);
        }
        var context = new StateContext(target, this, toState, handler, data);
        this.contextOf[target.name] = context;
        this.stateOf[target.name] = toState;
        if (this.config.debug) {
            var indent = new Array(this.depth + 1).join('    ');
            console.log("" + indent + target.name + " => " + toState);
        }
        context.selfEnter();
    };
    StateContext.prototype.execExit = function (target, fromState) {
        var context = this.contextOf[target.name];
        delete this.contextOf[target.name];
        delete this.stateOf[target.name];
        context.selfExit();
    };
    StateContext.prototype.execUpdate = function (target, state, delta) {
        var context = this.contextOf[target.name];
        context.selfUpdate(delta);
        if (this.queueOf[target.name].length > 0) {
            this.run(target);
        }
    };
    StateContext.prototype.execRestore = function (json) {
        var target = this.nodeOf[json.name];
        var toState = json.state;
        var data = json.data;
        var handler = this.handlerOf[target.name][toState];
        if (!handler && this.config.requireHandler) {
            throw new Error("No handler registered for: " + target.name + ": enter " + toState);
        }
        var context = new StateContext(target, this, toState, handler, data);
        this.contextOf[target.name] = context;
        this.stateOf[target.name] = toState;
        context.selfRestore(json);
    };
    StateContext.prototype.execTransition = function (transCommand) {
        var source = transCommand.source, target = transCommand.target, fromState = transCommand.fromState, toState = transCommand.toState, data = transCommand.data;
        if (fromState) {
            this.execExit(target, fromState);
        }
        if (toState) {
            this.execEnter(target, toState, data);
        }
    };
    StateContext.prototype.execGuard = function (transCommand) {
        var _this = this;
        var source = transCommand.source, target = transCommand.target, fromState = transCommand.fromState, toState = transCommand.toState, data = transCommand.data;
        var fromGuards = this.guardOf[target.name];
        var toGuards = fromGuards[fromState] || fromGuards['*'];
        var handler = toGuards[toState] || toGuards['*'];
        var fromName = source === target ? '__self__' :
            source === this.node ? '__parent__' : source.name;
        var prevStateContext = this.contextOf[target.name];
        var guard = {
            from: fromName,
            cancel: function () {
                if (prevStateContext) {
                    prevStateContext.machineState = MachineState.IDLE;
                }
                var guardContext = _this.contextOf[target.name];
                _this.contextOf[target.name] = prevStateContext;
                guardContext.selfExit();
            },
            proceed: function () {
                if (prevStateContext) {
                    prevStateContext.machineState = MachineState.IDLE;
                }
                var guardContext = _this.contextOf[target.name];
                _this.contextOf[target.name] = prevStateContext;
                guardContext.selfExit();
                var queue = _this.queueOf[target.name];
                if (queue.length > 0) {
                    _this.execTransition(transCommand);
                }
                else {
                    queue.push(transCommand);
                    _this.execTransition(transCommand);
                    queue.shift();
                    _this.run(target);
                }
            }
        };
        // TODO - store dummy context instead of undefined
        if (prevStateContext) {
            prevStateContext.machineState = MachineState.GUARD;
        }
        var guardContext = new GuardContext(guard, handler);
        this.contextOf[target.name] = guardContext;
        guardContext.selfEnter();
    };
    StateContext.prototype.execCommand = function (transCommand) {
        var source = transCommand.source, target = transCommand.target, fromState = transCommand.fromState, toState = transCommand.toState, data = transCommand.data;
        if (this.stateOf[target.name] !== fromState) {
            throw new Error('State of ${target.name} is inconsistent');
        }
        if (this.isGuarded(target, fromState, toState)) {
            this.execGuard(transCommand);
        }
        else {
            this.execTransition(transCommand);
        }
    };
    StateContext.prototype.run = function (target) {
        var queue = this.queueOf[target.name];
        while (queue.length > 0) {
            var command = queue[0];
            this.execCommand(command);
            queue.shift();
        }
    };
    StateContext.prototype.schedule = function (source, target, fromState, toState, data) {
        if (!target) {
            throw new Error("Name doesn't exist in state " + this.state + ": " + target.name);
        }
        if (!target.hasState(toState)) {
            throw new Error(target.name + " doesn't have state: " + toState);
        }
        var transCommand = { source: source, target: target, fromState: fromState, toState: toState, data: data };
        var queue = this.queueOf[target.name];
        if (queue.length <= 1) {
            queue.push(transCommand);
        }
        else if (queue.length === 2) {
            queue[1] = transCommand;
        }
        if (queue.length === 1 && this.machineState !== MachineState.UPDATE) {
            this.run(target);
        }
    };
    StateContext.prototype.tell = function (name, state, data) {
        if (this.machineState === MachineState.DEAD) {
            throw new Error("Context was called after it has exited");
        }
        if (this.machineState === MachineState.RESTORE) {
            return;
        }
        var source = this.node;
        var target = this.nodeOf[name];
        var fromState = this.stateOf[name];
        var toState = state;
        this.schedule(source, target, fromState, toState, data);
    };
    StateContext.prototype.ask = function (name, state, data) {
        if (this.machineState === MachineState.DEAD) {
            throw new Error("Context was called after it has exited");
        }
        if (this.machineState === MachineState.RESTORE) {
            return;
        }
        var source = this.node;
        var target = this.parent.nodeOf[name];
        var fromState = this.parent.stateOf[name];
        var toState = state;
        this.parent.schedule(source, target, fromState, toState, data);
    };
    StateContext.prototype.set = function (state, data) {
        if (this.machineState === MachineState.DEAD) {
            throw new Error("Context was called after it has exited");
        }
        if (this.machineState === MachineState.RESTORE) {
            return;
        }
        var source = this.node;
        var target = this.node;
        var fromState = this.parent.stateOf[this.node.name];
        var toState = state;
        this.parent.schedule(source, target, fromState, toState, data);
    };
    StateContext.prototype.when = function (name, stateOrTransition, handlerOrFunc) {
        if (this.machineState === MachineState.DEAD) {
            throw new Error("Context was called after it has exited");
        }
        var target = this.nodeOf[name];
        if (!target) {
            throw new Error("Name doesn't exist in this context: " + name);
        }
        if (isTransition(stateOrTransition)) {
            var _a = unpack(stateOrTransition), from = _a[0], to = _a[1];
            if (!target.hasTransition(from, to) && from !== '*') {
                throw new Error(name + " doesn't have transition: " + from + " -> " + to);
            }
            var handler = null;
            if (isPartialHandler(handlerOrFunc)) {
                handler = {
                    enter: handlerOrFunc.enter,
                    update: handlerOrFunc.update,
                    exit: handlerOrFunc.exit
                };
            }
            else if (isFunction(handlerOrFunc)) {
                handler = {
                    enter: handlerOrFunc,
                    update: null,
                    exit: null
                };
            }
            var guards = this.guardOf[target.name];
            if (!guards[from]) {
                guards[from] = {};
            }
            guards[from][to] = handler;
        }
        else if (isState(stateOrTransition)) {
            var state = stateOrTransition;
            if (!target.hasState(state)) {
                throw new Error(name + " doesn't have state: " + state);
            }
            var handler = null;
            if (isPartialHandler(handlerOrFunc)) {
                handler = {
                    enter: handlerOrFunc.enter,
                    update: handlerOrFunc.update,
                    exit: handlerOrFunc.exit
                };
            }
            else if (isFunction(handlerOrFunc)) {
                handler = {
                    enter: handlerOrFunc,
                    update: null,
                    exit: null
                };
            }
            this.handlerOf[target.name][state] = handler;
        }
        return this;
    };
    StateContext.prototype.update = function (delta) {
        if (this.machineState === MachineState.DEAD) {
            throw new Error("Context was called after it has exited");
        }
        if (this.machineState === MachineState.RESTORE) {
            return;
        }
        this.selfUpdate(delta);
    };
    StateContext.prototype.configure = function (config) {
        if (this.machineState === MachineState.DEAD) {
            throw new Error("Context was called after it has exited");
        }
        if (this.machineState === MachineState.RESTORE) {
            return;
        }
        this.selfConfigure(config);
    };
    StateContext.prototype.restore = function (json) {
        if (this.machineState === MachineState.DEAD) {
            throw new Error("Context was called after it has exited");
        }
        if (this.machineState === MachineState.RESTORE) {
            return;
        }
        this.selfRestore(json);
    };
    return StateContext;
}());
var HSM = /** @class */ (function () {
    function HSM(nodes) {
        var sentinel = new Node(HSM.ROOT_NAME, [], nodes);
        this.context = new StateContext(sentinel);
        this.config = {
            debug: false,
            requireHandler: false
        };
        this.context.configure(this.config);
    }
    HSM.create = function () {
        var nodes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            nodes[_i] = arguments[_i];
        }
        return new HSM(nodes);
    };
    HSM.prototype.restore = function (json) {
        this.context.restore(json);
    };
    HSM.prototype.configure = function (config) {
        if ('debug' in config) {
            this.config.debug = config.debug;
        }
        if ('requireHandler' in config) {
            this.config.requireHandler = config.requireHandler;
        }
        this.context.configure(this.config);
    };
    HSM.ROOT_NAME = '__sentinel__';
    return HSM;
}());
exports.HSM = HSM;
var FSM = /** @class */ (function () {
    function FSM(states) {
        this.hsm = HSM.create(new Node(FSM.ROOT_NAME, states, []));
    }
    FSM.create = function (states) {
        if (isArray(states)) {
            return new FSM(states);
        }
        else {
            var keyStates = Object.keys(states);
            var fsm = new FSM(keyStates);
            for (var _i = 0, keyStates_1 = keyStates; _i < keyStates_1.length; _i++) {
                var state = keyStates_1[_i];
                fsm.when(state, states[state]);
            }
            return fsm;
        }
    };
    FSM.prototype.configure = function (config) {
        var hsmConfig = {};
        if ('debug' in config) {
            hsmConfig.debug = config.debug;
        }
        if ('requireHandler' in config) {
            hsmConfig.requireHandler = config.requireHandler;
        }
        this.hsm.configure(hsmConfig);
        return this;
    };
    FSM.prototype.set = function (state, data) {
        this.hsm.context.tell(FSM.ROOT_NAME, state, data);
    };
    FSM.prototype.when = function (stateOrTransition, handlerOrFunc) {
        this.hsm.context.when(FSM.ROOT_NAME, stateOrTransition, handlerOrFunc);
        return this;
    };
    FSM.prototype.update = function (delta) {
        this.hsm.context.update(delta);
    };
    FSM.ROOT_NAME = '__fsm__';
    return FSM;
}());
exports.FSM = FSM;
