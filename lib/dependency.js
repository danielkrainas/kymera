var DependencyResolver = function (parent) {
	this.parent = parent || null;
	this.dependencies = [];
};

DependencyResolver.ARG_REGEX = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;

DependencyResolver.prototype.resolveAll = function (names) {
	var cache = this.dependencies;
	return names.map(function (name) {
		return cache[name];
	});
};

DependencyResolver.prototype.resolveFor = function (fn) {
	var names = fn.toString()
		.match(DependencyResolver.ARG_REGEX)[1]
		.split(',')
		.map(function (name) {
		return name.trim();
	});

	return this.resolveAll(names);
};

DependencyResolver.prototype.register = function (name, obj) {
	this.dependencies[name] = obj;
};

var Module = function (name) {
	this.name = name;
	this.resolver = new DependencyResolver();
};

Module.prototype.use = function (name, obj) {
	this.resolver.register(name, obj);
};

Module.prototype.fire = function (fn) {
	var args = this.resolver.resolveFor(fn);
	fn.apply(null, args);
};

var kymera = function (name) {
	return new Module(name);
};

