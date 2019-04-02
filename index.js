var _ = require('lodash'),
    url = require('url'),
    punycode = require('punycode'),

    /**
     * @private
     * @const
     * @type {String}
     */
    E = '',

    /**
     * @private
     * @const
     * @type {String}
     */
    PROTOCOL_SEPARATOR = '://',

    /**
     * @private
     * @const
     * @type {String}
     */
    PROTOCOL_HTTP = 'http',

    /**
     * @private
     * @const
     * @type {String}
     */
    DEFAULT_PROTOCOL = PROTOCOL_HTTP + PROTOCOL_SEPARATOR,

    /**
     * @private
     * @const
     * @type {String}
     */
    COLON = ':',

    /**
     * @private
     * @const
     * @type {String}
     */
    AUTH_CREDENTIALS_SEPARATOR = '@',

    /**
     * @private
     * @const
     * @type {String}
     */
    DOMAIN_SEPARATOR = '.',

    /**
     * @private
     * @const
     * @type {String}
     */
    PATH_SEPARATOR = '/',

    /**
     * @private
     * @const
     * @type {String}
     */
    QUERY_SEPARATOR = '?',

    /**
     * @private
     * @const
     * @type {String}
     */
    SEARCH_SEPARATOR = '#',

    /**
     * @private
     * @const
     * @type {String}
     */
    AMPERSAND = '&',

    /**
     * @private
     * @const
     * @type {String}
     */
    EQUALS = '=',

    /**
     * @private
     * @const
     * @type {String}
     */
    PERCENT = '%',

    /**
     * @private
     * @const
     * @type {string}
     */
    ZERO = '0',

    /**
     * These characters do not need escaping when encoding strings:
     * + - . _ ~
     * digits
     * alpha (uppercase)
     * alpha (lowercase)
     *
     * @private
     * @const
     * @type {Number[]}
     */
    noEscape = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, // 32 - 47
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
        0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, // 80 - 95
        0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0  // 112 - 127
    ];

module.exports = {

    percentEncode: function(c) {
        var hex = c.toString(16).toUpperCase();
        (hex.length === 1) && (hex = ZERO + hex);
        return PERCENT + hex;
    },

    isPreEncoded: function(buffer, i) {
    // If it is % check next two bytes for percent encode characters
    // looking for pattern %00 - %FF
        return (buffer[i] === 0x25 &&
            (this.isPreEncodedCharacter(buffer[i + 1]) &&
             this.isPreEncodedCharacter(buffer[i + 2]))
          );
    },

    isPreEncodedCharacter: function(byte) {
        return (byte >= 0x30 && byte <= 0x39) ||  // 0-9
           (byte >= 0x41 && byte <= 0x46) ||  // A-F
           (byte >= 0x61 && byte <= 0x66);     // a-f
    },

    charactersToPercentEncodeForFixture: function(byte) {
        return (byte < 0x23 || byte > 0x7E || // Below # and after ~
            byte === 0x3C || byte === 0x3E || // > and <
            byte === 0x28 || byte === 0x29 || // ( and )
            byte === 0x25 || // %
            byte === 0x27 || // '
            byte === 0x2A    // *
        );
    },

    charactersToPercentEncode: function(byte) {
        if (byte < 0x80) return !Boolean(noEscape[byte]);

        return true;
    },

    /**
     * Percent encode a query string according to RFC 3986.
     * Note: This function is supposed to be used on top of node's inbuilt url encoding
     *       to solve issue https://github.com/nodejs/node/issues/8321
     *
     * @param {String} value
     * @returns {String}
     */
    encode: function (value) {
        if (!value) { return E; }

        var buffer = new Buffer(value),
            ret = E,
            i;

        for (i = 0; i < buffer.length; ++i) {

            if (this.charactersToPercentEncodeForFixture(buffer[i]) && !this.isPreEncoded(buffer, i)) {
                ret += this.percentEncode(buffer[i]);
            }
            else {
                ret += String.fromCodePoint(buffer[i]);  // Only works in ES6 (available in Node v4+)
            }
        }

        return ret;
    },

    /**
     * Percent encode a given string according to RFC 3986.
     *
     * @param {String} value
     * @returns {String}
     */
    encodeString: function (value) {
        if (!value) { return E; }

        var buffer = new Buffer(value),
            ret = E,
            i;

        for (i = 0; i < buffer.length; ++i) {

            if (this.charactersToPercentEncode(buffer[i]) && !this.isPreEncoded(buffer, i)) {
                ret += this.percentEncode(buffer[i]);
            }
            else {
                ret += String.fromCodePoint(buffer[i]);  // Only works in ES6 (available in Node v4+)
            }
        }

        return ret;
    },

    /**
     * Does punycode encoding of hostName according to RFC 3492 and RFC 5891
     *
     * @param {String|String[]} hostName
     * @returns {String}
     */
    encodeHost: function (hostName) {
        if (_.isArray(hostName)) {
            hostName = hostName.join(DOMAIN_SEPARATOR);
        }

        return punycode.toASCII(hostName);
    },

    /**
     * Encodes individual url-path segments
     *
     * @param {String|String[]} path - complete unencoded path (ex. '/foo/bar')
     * @returns {String}
     */
    encodePath: function (path) {
        var segments = path;

        if (typeof segments === 'string') {
            segments = segments.split(PATH_SEPARATOR);
        }

        _.forEach(segments, function (value, i) {
            segments[i] = this.encodeString(value);
        }.bind(this));

        return segments.join(PATH_SEPARATOR);
    },

    /**
     * Encodes query parameters and returns encoded query string
     *
     * @param {PropertyList<QueryParam>} query
     * @param {Boolean} [ignoreDisabled=false]
     * @returns {String}
     */
    encodeQuery: function (query, ignoreDisabled) {
        if (query && _.isFunction(query.all)) {
            query = query.all();
        }

        return _.reduce(query.all(), function (result, param) {
            if (ignoreDisabled && param.disabled === true) { return; }

            var key = param.key,
                value = param.value;

            if (value === undefined) {
                return result;
            }

            if (key === null) {
                key = E;
            }

            result && (result += AMPERSAND);

            if (value === null) {
                return result + this.encodeString(key);
            }

            key = this.encodeString(key);
            value = this.encodeString(value);

            return result + key + EQUALS + value;
        }.bind(this), E);
    },

    /**
     * Unparses a {PostmanUrl} into an encoded URL string.
     *
     * @param {PostmanUrl}
     * @param {Boolean} [forceProtocol=false] - Forces the URL to have a protocol
     * @returns {string}
     */
    encodeUrl: function (url, forceProtocol) {
        var encodedUrl = E,
            protocol = url.protocol;

        forceProtocol && !protocol && (protocol = DEFAULT_PROTOCOL);

        if (protocol) {
            encodedUrl += (_.endsWith(protocol, PROTOCOL_SEPARATOR) ? protocol : protocol + PROTOCOL_SEPARATOR);
        }

        if (url.auth && url.auth.user) { // If the user is not specified, ignore the password.
            encodedUrl = encodedUrl + ((url.auth.password) ?
                // ==> username:password@
                url.auth.user + COLON + url.auth.password : url.auth.user) + AUTH_CREDENTIALS_SEPARATOR;
        }

        if (url.host) {
            encodedUrl += this.encodeHost(url.getHost());
        }

        if (url.port) {
            encodedUrl += COLON + url.port.toString();
        }

        if (url.path) {
            encodedUrl += this.encodePath(url.getPath());
        }

        if (url.query && url.query.count()) {
            encodedUrl += QUERY_SEPARATOR + this.encodeQuery(url.query, true);
        }

        if (url.hash) {
            encodedUrl += SEARCH_SEPARATOR + this.encodeString(url.hash);
        }

        return encodedUrl;
    },

    /**
     * Converts {PostmanUrl} object into Node's Url object with encoded values
     *
     * @param {PostmanUrl} url
     * @returns {Url}
     */
    toNodeUrl: function (url) {
        var nodeUrl = new url.Url();

        if (url.protocol) {
            nodeUrl.protocol = _.trimEnd(url.protocol, PROTOCOL_SEPARATOR) + COLON;
            nodeUrl.slashes = _.endsWith(url.protocol, PROTOCOL_SEPARATOR);
        } else {
            nodeUrl.protocol = PROTOCOL_HTTP + COLON;
            nodeUrl.slashes = true;
        }

        if (url.auth && url.auth.user) { // If the user is not specified, ignore the password.
            nodeUrl.auth = ((url.auth.password) ?
                // ==> username:password@
                url.auth.user + COLON + url.auth.password : url.auth.user);
        }

        if (url.host) {
            nodeUrl.hostname = this.encodeHost(url.getHost());
            nodeUrl.host = nodeUrl.hostname;
        } else {
            nodeUrl.hostName = E;
            nodeUrl.host = E;
        }

        if (url.port) {
            nodeUrl.port = url.port.toString();
            nodeUrl.host = nodeUrl.hostname + COLON + nodeUrl.port;
        }

        if (url.hash) {
            nodeUrl.hash = SEARCH_SEPARATOR + this.encodeString(url.hash);
        }

        if (url.query && url.query.count()) {
            nodeUrl.query = this.encodeQuery(url.query, true);
            nodeUrl.search = QUERY_SEPARATOR + nodeUrl.query;
        }

        if (url.path) {
            nodeUrl.pathname = this.encodePath(url.getPath());
            nodeUrl.path = nodeUrl.pathname + nodeUrl.search;
        }

        nodeUrl.href = encodeUrl(url, true);
    }
};
