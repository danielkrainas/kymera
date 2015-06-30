function (global) {
    /* Element wrapper */

    /* Action PubSub */
    var ActionPubSub = function () {
        this.subs = {};
    };

    ActionPubSub.prototype.subscribe = function (action, handler) {
        var s = this.subs[action];
        if (!s) {
            s = this.subs[action] = [];
        }

        s.push(handler);
    };

    ActionPubSub.prototype.publish = function (action, message) {
        var s = this.subs[action];
        if (s) {
            s.forEach(function (handler) {
                handler.call(null, message);
            });
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

    /* Module */
    var buildClass = function (m, name, def) {
        var T = function () {
            if (T.attributes) {
                T.attributes.forEach(function (attr) {
                    if (attr.attachTo) {
                        attr.attachTo(m, T, this);
                    }
                });
            }

            if (def.ctor) {
                
            }
        };

        var proto = T.prototype = {};
        if (def.mixins) {
            def.mixins.forEach(function (mixin) {
                kymera.mixin(proto, mixin);
            });
        }

        if (def.attrs) {
            T.attributes = [];
            def.attrs.forEach(function (attr) {
                T.attributes.push(attr);
                attr.attach(m, T);
            });
        }

        return T;
    };

    var Module = function (name, dependencies) {
        dependencies = dependencies || [];
        this.name = name;
        this.synthetic = true;
        this.loaded = false;
        this.container = new DependencyContainer(dependencies);

        Object.defineProperty(this, 'dependencies', {
            expandable: true,
            get: function () {
                return dependencies;
            },
            set: function (v) {
                dependencies = v || [];
                this.container.subContainers = dependencies;
            }
        })
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
        return fn.apply(thisArg, this.resolveFor(fn));
    };

    Module.prototype.resolveFor = function (fn) {
        return this.container.resolveFor(fn);
    };

    Module.prototype.resolveAll = function (names) {
        return this.container.resolveAll(names);
    };

    Module.prototype.load = function () {

    };

    Module.prototype.start = function (action, message) {
        action = action || 'start';
        message = message || null;
        this.load();
        this.broadcast.
    };

    /* Attributes */
    var ComponentAttribute = function (options) {

    };

    var TemplateAttribute = function (options) {

    };

    TemplateAttribute.prototype.attach = function (m, T) {

    };

    var ServiceAttribute = function (options) {
        this.name = options.name;
    };

    ServiceAttribute.prototype.attach = function (m, T) {
        m.register(this.name, function () {
            return new T();
        });
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
        var m = moduleCache[name];
        if (!m) {
            m = new Module(name, modules || null);
            moduleCache[name] = m;
        }

        if (arguments.length > 1 && modules && m.synthetic) {
            m.dependencies = modules.splice(0);
        }

        return m;
    };

    kymera.bind = function (fn, thisArg) {
        return function () {
            var args = Array.prototype.slice.apply(arguments, 0);
            return fn.apply(thisArg, args);
        };
    };

    kymera.Component = ComponentAnnotation;
    kymera.Template = TemplateAnnotation;
    kymera.Service = ServiceAttribute;
}(this);