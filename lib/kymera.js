function (global) {
    /* Element wrapper */


    /* Module */


    /* Class Builder */
    var ClassBuilder = function (T) {
        this.T = T;
        T.annotations = T.annotations || [];
    };

    ClassBuilder.prototype.annotate = function (annotation) {
        this.T.annotations.push(annotation);
    };

    /* Annotations */
    var ComponentAnnotation = function (options) {

    };

    var TemplateAnnotation = function (options) {

    };

    TemplateAnnotation.prototype.apply = function (app, cls, instance) {

    };

    /* Global Interface */
    var moduleCache = {};

    var kymera = function (name) {
        if (moduleCache[name]) {
            return moduleCache[name];
        }

        var m = new Module(name);
        moduleCache[name] = m;
        return m;
    };

    kymera.element = function (element) {
        return new ElementWrapper(element);
    };

    kymera.use = function (T) {
        
    };

    kymera.createClass = function (configure) {
        var T = function () {};
        var builder = new ClassBuilder(T);
        T.prototype = configure.apply(builder);
        return T;
    };

    kymera.app('').

    var app = kymera.app('', ['']);
    app.start()

    var TestSomething = kymera.createClass('kymera.test', 'TestSomething', {
        attrs: [
            new kymera.Trait({
                name: 'ky-app'
            }),

            new kymera.Component({
                name: '',
                link: function (el, attrs) {
                    var app = kymera.app(attrs.kyApp);
                    app.run();
                }
            }),

            new kymera.Template({
                url: ''
            }),

            new kymera.Subscriber({
                addToSet: function () {

                }
            })
        ],

        mixins: [],

        state: {
            x: 5
        }
    });

    kymera.createClass()

    kymera.Component = ComponentAnnotation;
    kymera.Template = TemplateAnnotation;
}(this);