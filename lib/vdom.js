var vparse = function (html) {

};

var NAME_REGEX = /[a-zA-Z_][\w:\-\.]*/;

var DOMParseContext = function (html) {
    this.index = 0;
    this.html = html;
    this.text = '';
    this.elements = [];
    this.processing = [];

    Object.defineProperties(this, {
        eof: {
            get: function () {
                return this.index >= this.length;
            }
        },

        current: {
            get: function () {
                return this.eof ? '' : this.html.charAt(this.index);
            }
        },

        length: {
            get: function () {
                return html.length;
            }
        },

        substring: {
            get: function () {
                return this.html.substring(this.index);
            }
        }
    });
};

DOMParseContext.prototype.popElement = function () {
    var el = this.processing.pop();
    if (el) {
        if (this.processing.length) {
            this.pushElementChild(el);
        } else {
            this.elements.push(el);
        }
    }
};

DOMParseContext.prototype.pushElement = function (name) {
    this.processing.push([name]);
};

DOMParseContext.prototype.pushElementAttrs = function (attrs) {
    var el = this.processing[this.processing.length - 1];
    if (el) {
        if (el.length > 1 && typeof el[1] === 'object') {
            el[1] = attrs;
        } else if (el.length > 1) {
            el.splice(1, 0, attrs);
        } else {
            el.push(attrs);
        }
    }
};

DOMParseContext.prototype.pushElementText = function (text) {
    var el = this.processing[this.processing.length - 1];
    if (el) {
        if (el.length > 1 && typeof el[el.length - 1] === 'string') {
            el[el.length - 1] = text;
        } else {
            el.push(text);
        }
    }
};

DOMParseContext.prototype.pushElementChild = function (child) {
    var el = this.processing[this.processing.length - 1];
    if (el) {
        if (el.length > 2 && typeof el[el.length - 1] === 'string') {
            el.splice(el.length - 2, 0, child);
        } else {
            el.push(child);
        }
    }
};

DOMParseContext.prototype.append = function (text) {
    this.text += text;
};

DOMParseContext.prototype.peek = function (count) {
    return this.html.substr(this.index + 1, count || 1);
};

DOMParseContext.prototype.read = function (count) {
    count = count || 1;
    if (count === 0) {
        return '';
    }

    var next = this.peek(count);
    this.index += count;
    if (this.index > this.length) {
        this.index = this.length;
    }

    return next;
};

DOMParseContext.prototype.readRegExp = function (regexp) {
    var value = (regexp.exec(this.html.substring(this.index)) || [''])[0];
    this.index += value.length;
    return value;
};

DOMParseContext.prototype.peekIgnoreWhitespace = function (count) {
    count = count || 1;
    var value = '';
    var next = '';
    var offset = 0;
    do {
        next = this.html.charAt(this.index + ++offset);
        if (!next) {
            break;
        }

        if (!/\s/.test(next)) {
            value += next;
        }
    } while (value.length < count);

    return value;
};

DOMParseContext.prototype.readUntilNonWhitespace = function () {
    var value = '';
    var next = null;
    while (!this.eof) {
        next = this.read();
        value += next;
        if (!/\s$/.test(value)) {
            break;
        }
    }

    return value;
};

DOMParseContext.prototype.readAttribute = function () {
    var name = this.readRegExp(NAME_REGEX);
    var value = null;
    if (this.current === '=' || this.peekIgnoreWhitespace() === '=') {
        this.readRegExp(/\s*=\s*/);
        var quote = /['"]/.test(this.current) ? this.current : '';
        var attributeValueRegexp = !quote ? /(.*?)(?=[\s>])/ : new RegExp(quote + '(.*?)' + quote);

        var match = attributeValueRegexp.exec(this.substring) || [0, ''];
        value = match[1];
        this.read(match[0].length);
    }

    return [name, value];
};

DOMParseContext.prototype.readAttributes = function (xml) {
    var isClosingToken = function () {
        if (xml) {
            return this.current === '?' && this.peek() === '>';
        }

        return this.current === '>' || (this.current === '/' && this.peekIgnoreWhitespace() === '>');
    };

    var next = this.current;
    var attr = null;
    var attrs = null;
    while (!this.eof && !isClosingToken.call(this)) {
        if (NAME_REGEX.test(next)) {
            attr = this.readAttribute();
            if (!attrs) {
                attrs = {};
            }

            attrs[attr[0]] = attr[1];
            next = this.current;
        } else {
            next = this.read();
        }
    }

    return attrs;
};

DOMParseContext.prototype.readCloserForOpenedElement = function (name) {
    var emptyElements = {
        area: true, base: true, basefont: true, br: true, col: true, frame: true,
        hr: true, img: true, input: true, isindex: true, link: true, meta: true, param: true, embed: true
    };

    var isUnary = name in emptyElements;
    if (this.current === '/') {
        // self closing tag
        this.readUntilNonWhitespace();
        this.read();
        this.popElement();
    } else if (this.current === '?') {
        // xml prolog close
        this.read(2);
    } else {
        // normal closing tag
        this.read();
    }
};

DOMParseContext.prototype.parseOpenElement = function () {
    var name = this.readRegExp(NAME_REGEX);
    this.pushElement(name);
    var attrs = this.readAttributes();
    if (attrs) {
        this.pushElementAttrs(attrs);
    }

    this.readCloserForOpenedElement(name);
    if (!/^(script|xmp)$/i.test(name)) {
        return;
    }

    var regex = new RegExp('^([\\s\\S]*?)(?:$|</(' + name + ')\\s*>)', 'i');
    var match = regex.exec(this.substring);
    this.read(match[0].length);
    if (match[1]) {
        console.log({ m: match[1] });
        // cdata
        this.pushElementText(match[1]);
    } else {
        //this.popElement();
        //close element
    }
};

DOMParseContext.prototype.parseEndElement = function () {
    var name = this.readRegExp(NAME_REGEX);
    this.readRegExp(/.*?(?:>|$)/);
    if (this.text) {
        this.pushElementText(this.text);
        this.text = '';
    }

    this.popElement();
};

DOMParseContext.prototype.parseCData = function () {
    this.read(8);
    var match = /^([\s\S]*?)(?:$|]]>)/.exec(this.substring);
    var value = match[1];
    this.read(match[0].length);
};

DOMParseContext.prototype.parseComment = function () {
    this.read(3);
    var match = /^([\s\S]*?)(?:$|-->)/.exec(this.substring);
    var value = match[1];
    this.read(match[0].length);
};

DOMParseContext.prototype.parseDocType = function () {
    this.read(8);
    var match = /^\s*([\s\S]*?)(?:$|>)/.exec(this.substring);
    var value = match[1];
    this.read(match[0].length);
};

DOMParseContext.prototype.parseXmlProlog = function () {
    this.read(4);
    this.readAttributes(true);
    this.readCloserForOpenedElement('?xml');
};

DOMParseContext.prototype.parseNext = function () {
    var current = this.current;
    var buffer = current;
    if (current == '<') {
        buffer += this.read();
        if (this.current === '/') {
            buffer += this.read();
            if (NAME_REGEX.test(this.current)) {
                //text element
                this.parseEndElement();
            } else {
                // malformed
                this.read();
                this.append(buffer);
            }
        } else if (this.current === '!') {
            if (/^!\[CDATA\[/.test(this.substring)) {
                // text element
                this.parseCData();
            } else if (/^!--/.test(this.substring)) {
                // comment
                this.parseComment();
            } else if (/^!doctype/i.test(context.substring)) {
                // doctype
                this.parseDocType();
            } else {
                // malformed
                this.read();
                this.append(buffer);
            }
        } else if (this.current === '?') {
            if (/^\?xml/.test(this.substring)) {
                // xml prolog
                this.parseXmlProlog();
            } else {
                // malformed
                this.read();
                this.append(buffer);
            }
        } else if (NAME_REGEX.test(this.current)) {
            // open element
            this.parseOpenElement();
        } else {
            // malformed
            this.read();
            this.append(buffer);
        }
    } else {
        this.append(this.current);
        this.read();
    }
};

var parseDOM = function (html) {
    html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var context = new DOMParseContext(html);
    while (!context.eof) {
        context.parseNext();
    }

    console.log(JSON.stringify(context.elements));
    // callback text?
};