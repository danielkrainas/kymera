(function (global) {
    /* Element wrapper */

    /* Action Dispatcher */
    var ActionDispatcher = function () {
        this.subs = {};
        this.publishing = false;
        this.queue = [];
    };

    ActionDispatcher.prototype.subscribe = function (action, handler) {
        var s = this.subs[action];
        if (!s) {
            s = this.subs[action] = [];
        }

        s.push(handler);
    };

    ActionDispatcher.prototype.publish = function (action, message) {
        message = message || null;
        if (this.publishing) {
            this.queue.push({ action: action, message: message });
        } else {
            kymera.defer(function () {
                this.publishing = true;
                var s = this.subs[action];
                if (s) {
                    s.forEach(function (handler) {
                        handler.call(null, message);
                    });
                }

                this.publishing = false;
                if (this.queue.length) {
                    var next = this.queue.shift();
                    this.publish(next.action, next.message);
                }
            }, this);
        }
    };

    /* Dependency Resolver */
    var ARG_REGEX = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;

    var DependencyContainer = function (subContainers) {
        this.subContainers = subContainers || [];
        this.services = {};
        this.resolveFromSubs = function (name) {
            for (var i = 0; i < this.subContainers.length; i++) {
                var svc = this.subContainers[i].resolve(name);
                if (svc) {
                    return svc;
                }
            }

            return null;
        };
    };

    DependencyContainer.prototype.register = function (name, factory) {
        this.services[name] = {
            factory: factory,
            value: null
        };
    };

    DependencyContainer.prototype.resolveAll = function (names) {
        return names.map(function (name) {
            var svc = this.services[name] || this.resolveFromSubs(name) || null;
            if (svc && svc.factory) {
                return this.inject(svc.factory);
            }

            return null;
        }, this);
    };

    DependencyContainer.prototype.resolveFor = function (fn) {
        var names = fn.toString()
            .match(ARG_REGEX)[1]
            .split(',')
            .map(function (name) {
            return name.trim();
        });

        return this.resolveAll(names);
    };

    DependencyContainer.prototype.inject = function (fn, thisArg) {
        return fn.apply(thisArg, this.resolveFor(fn));
    };

    /* Module */
    var buildClass = function (m, name, def) {
        var T = eval('function ' + name + '(){};' + name);
        var baseProto = def.extend ? def.extend.prototype : {};
        var proto = T.prototype = Object.create(baseProto);
        proto.constructor = function () {
            if (T.attributes) {
                T.attributes.forEach(function (attr) {
                    if (attr.attachTo) {
                        attr.attachTo(m, T, this);
                    }
                }, this);
            }

            if (def.ctor) {
                m.inject(def.ctor, this);
            }
        };

        if (def.mixins) {
            def.mixins.forEach(function (mixin) {
                kymera.mixin(proto, mixin);
            });
        }

        if (def.extend && def.extend.attributes) {
            def.attrs = def.attrs || [];
            def.attrs.push.apply(def.attrs, def.extend.attributes);
        }

        if (def.attrs) {
            T.attributes = [];
            def.attrs.forEach(function (attr) {
                T.attributes.push(attr);
                if (attr.attach) {
                    attr.attach(m, T);
                }
            });
        }

        return T;
    };

    var Module = function (name, dependencies) {
        this.name = name;
        this.synthetic = true;
        this.loaded = false;
        this.pubsub = new ActionDispatcher();
        Object.defineProperty(this, 'dependencies', {
            expandable: true,
            get: function () {
                return dependencies;
            },
            set: function (v) {
                if (this.loaded) {
                    throw new Error('cannot change module dependencies after it has been loaded');
                }

                this.synthetic = false;
                dependencies = v || [];
                this.container.subContainers = dependencies;
            }
        });

        this.container = new DependencyContainer(dependencies);
        this.dependencies = dependencies;
    };

    Module.prototype.register = function (name, factory) {
        if (this.loaded) {
            throw new Error('cannot register service after module has been loaded');
        }

        return this.container.register(name, factory);
    };

    Module.prototype.defineClass = function (name, def) {
        return buildClass(this, name, def);
    };

    Module.prototype.inject = function (fn, thisArg) {
        return this.container.inject(fn, thisArg);
    };

    Module.prototype.resolveAll = function (names) {
        return this.container.resolveAll(names);
    };

    Module.prototype.load = function () {
        if (!this.synthetic) {
            this.dependencies.forEach(function (dep) {
                dep.load();
            });
        }

        this.loaded = true;
    };

    Module.prototype.start = function (action, message) {
        if (this.loaded) {
            throw new Error('module is already loaded');
        }

        action = action || 'start';
        message = message || null;
        this.load();
        this.publish(action, message);
    };

    Module.prototype.publish = function (action, message) {
        this.pubsub.publish(action, message);
    };

    Module.prototype.subscribeTo = function (action, handler) {
        this.pubsub.subscribe(action, handler);
    };

    /* Attributes */
    var ComponentAttribute = function (options) {

    };

    var TemplateAttribute = function (options) {

    };

    var ServiceAttribute = function (options) {
        if (kymera.isString(options)) {
            this.name = options;
        } else {
            this.name = options.name;
        }
    };

    ServiceAttribute.prototype.attach = function (m, T) {
        m.register(this.name, function () {
            return new T();
        });
    };

    var SubscriberAttribute = function (options) {
        options = options || {};
        this.handlers = {};
        Object.keys(options).forEach(function (action) {
            this.handlers[action] = options[action];
        }, this);
    };

    SubscriberAttribute.prototype.attachTo = function (m, T, t) {
        Object.keys(this.handlers).forEach(function (action) {
            m.subscribeTo(action, kymera.bind(this.handlers[action], t));
        }, this);
    };

    /* Global Interface */
    var moduleCache = {};

    var kymera = {};

    kymera.element = function (element) {
        return new ElementWrapper(element);
    };

    kymera.mixin = function (obj, mixins) {
        var keys = Object.keys(mixins);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            obj[key] = mixins[key];
        }
    };

    kymera.module = function (name, modules) {
        modules = modules || [];
        modules = modules.splice(0).map(function (name) {
            return moduleCache[name];
        }).filter(function (m) {
            return m !== null;
        });

        var m = moduleCache[name];
        if (!m) {
            m = new Module(name, modules || null);
            moduleCache[name] = m;
        }

        if (arguments.length > 1 && modules && m.synthetic) {
            m.dependencies = modules;
        }

        return m;
    };

    kymera.bind = function (fn, thisArg) {
        return function () {
            var args = Array.prototype.slice.apply(arguments, 0);
            return fn.apply(thisArg, args);
        };
    };

    kymera.defer = function (fn, thisArg) {
        return setTimeout(function () {
            fn.apply(thisArg, []);
        }, 0);
    };

    kymera.isString = function (s) {
        return typeof s === 'string';
    };

    kymera.isFunction = function (fn) {
        return typeof fn === 'function';
    };

    //kymera.Component = ComponentAttribute;
    kymera.Template = TemplateAttribute;
    kymera.Service = ServiceAttribute;
    kymera.Subscriber = SubscriberAttribute;
    global['kymera'] = kymera;
})(this);