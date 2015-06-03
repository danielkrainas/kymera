var bindAll = function (vdom, data) {
    var binders = visitNode(vdom);
    console.log(binders);
    for (var i = 0; i < binders.length; i++) {
        binders[i].update(data);
        console.log(binders[i].value);
    }
};

var resolve = function (obj, path) {
    var paths = path.split('.');
    for (var i = 0; i < paths.length; i++) {
        if (typeof obj[paths[i]] === 'undefined') {
            console.log({obj: obj, path: paths[i]});
            return null;
        }

        obj = obj[paths[i]];
    }

    return obj;
};

var ValueBinder = function (expr, el, attr) {
    this.expr = expr;
    this.value = null;
    this.el = el;
    this.attr = attr;
};

ValueBinder.prototype.update = function (data) {
    this.value = resolve(data, this.expr);
};

var visitNode = function (node) {
    var binders = [];
    console.log({node: node});
    if (node.length > 1) {
        if (typeof node[1] === 'object') {
            var attrs = node[1];
            var keys = Object.keys(attrs);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = attrs[key];
                if (value.match(/\{\{.*?\}\}/)) {
                    console.log('here');
                    var binder = new ValueBinder(value.substr(2, value.length - 4), node, key);
                    attrs[key] = binder;
                    binders.push(binder);
                }
            }
        }

        for (var j = 0; j < node.length; j++) {
            if (Array.isArray(node[j])) {
                var otherBinders = visitNode(node[j]);
                if (otherBinders.length > 0) {
                    binders.push.apply(binders, otherBinders);
                }
            }
        }
    }

    return binders;
};
