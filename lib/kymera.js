


var MessageObject = function (body) {
	this.body = body;
};

var ResponseObject = function (finalize) {
	this.body = null;
	this.complete = false;
	this.finalize = finalize;
};

ResponseObject.prototype.end = function () {
	this.complete = true;
	this.finalize.call(null, this.body);
};

ResponseObject.prototype.send = function (data) {
	this.body = data;
	this.end();
};

var PipeIterator = function (module, msg) {
	this.module = module;
	this.pipe = module.wares;
	this.msg = new MessageObject(msg);
	this.index = -1;
};

PipeIterator.prototype.go = function (callback) {
	var response = new ResponseObject(callback);
	var iterator = this;
	var next = function () {
		if (response.complete || ++this.index >= this.pipe.length) {
			callback(response.body);
			return;
		}

		var filter = this.pipe[this.index];
		filter.call(null, this.msg, response, function () {
			kymera.defer(next, null, iterator);
		});
	};

	kymera.defer(next, null, this);
};

var Module = function (name) {
	this.$injector = null;
	this.wares = [];
	this.name = name;
	this.finalized = false;
};

Module.prototype.use = function (middleware) {
	if (this.finalized) {
		throw new Error('cannot add middleware to finalized module');
	}

	this.wares.push(middleware);
};

Module.prototype.send = function (msg, callback) {
	this.finalized = true;
	var iterator = new PipeIterator(this, msg);
	iterator.go(callback);
};

Module.prototype.service = function (name, ctor) {

};

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

kymera.bind = function (fn, thisArg) {
    return function () {
        var args = Array.prototype.slice.call(arguments, 0);
        return fn.apply(thisArg, args);
    };
};

kymera.defer = function (fn, args, thisArg) {
    return setTimeout(function () {
        fn.apply(thisArg, args || []);
    }, 0);
};

kymera.mixin = function (obj, mixins) {
	var keys = Object.keys(mixins);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		obj[key] = mixins[key];
	}
};

kymera.start = function () {
	var list = document.querySelectorAll('[kymera-app]');
	for (var i = 0; i < list.length; i++) {
		var element = kymera.element(list[i]);
		var name = element.attr('kymera-app');
		var module = kymera(name);
		if (module) {
			//module.listen(element);
			module.send({
				q: 'Doe'
			}, function (response) {
				console.log(module.name + '\'s response: ' + response);
				element.text(response);
			});
		}
	}
};

var kymeraCore = kymera('kymera');

kymeraCore.service('$injector', function () {

});
