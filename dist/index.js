var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = (id) => {
  return import.meta.require(id);
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// node_modules/delayed-stream/lib/delayed_stream.js
var require_delayed_stream = __commonJS((exports, module) => {
  var DelayedStream = function() {
    this.source = null;
    this.dataSize = 0;
    this.maxDataSize = 1024 * 1024;
    this.pauseStream = true;
    this._maxDataSizeExceeded = false;
    this._released = false;
    this._bufferedEvents = [];
  };
  var Stream = __require("stream").Stream;
  var util = __require("util");
  module.exports = DelayedStream;
  util.inherits(DelayedStream, Stream);
  DelayedStream.create = function(source, options) {
    var delayedStream = new this;
    options = options || {};
    for (var option in options) {
      delayedStream[option] = options[option];
    }
    delayedStream.source = source;
    var realEmit = source.emit;
    source.emit = function() {
      delayedStream._handleEmit(arguments);
      return realEmit.apply(source, arguments);
    };
    source.on("error", function() {
    });
    if (delayedStream.pauseStream) {
      source.pause();
    }
    return delayedStream;
  };
  Object.defineProperty(DelayedStream.prototype, "readable", {
    configurable: true,
    enumerable: true,
    get: function() {
      return this.source.readable;
    }
  });
  DelayedStream.prototype.setEncoding = function() {
    return this.source.setEncoding.apply(this.source, arguments);
  };
  DelayedStream.prototype.resume = function() {
    if (!this._released) {
      this.release();
    }
    this.source.resume();
  };
  DelayedStream.prototype.pause = function() {
    this.source.pause();
  };
  DelayedStream.prototype.release = function() {
    this._released = true;
    this._bufferedEvents.forEach(function(args) {
      this.emit.apply(this, args);
    }.bind(this));
    this._bufferedEvents = [];
  };
  DelayedStream.prototype.pipe = function() {
    var r = Stream.prototype.pipe.apply(this, arguments);
    this.resume();
    return r;
  };
  DelayedStream.prototype._handleEmit = function(args) {
    if (this._released) {
      this.emit.apply(this, args);
      return;
    }
    if (args[0] === "data") {
      this.dataSize += args[1].length;
      this._checkIfMaxDataSizeExceeded();
    }
    this._bufferedEvents.push(args);
  };
  DelayedStream.prototype._checkIfMaxDataSizeExceeded = function() {
    if (this._maxDataSizeExceeded) {
      return;
    }
    if (this.dataSize <= this.maxDataSize) {
      return;
    }
    this._maxDataSizeExceeded = true;
    var message = "DelayedStream#maxDataSize of " + this.maxDataSize + " bytes exceeded.";
    this.emit("error", new Error(message));
  };
});

// node_modules/combined-stream/lib/combined_stream.js
var require_combined_stream = __commonJS((exports, module) => {
  var CombinedStream = function() {
    this.writable = false;
    this.readable = true;
    this.dataSize = 0;
    this.maxDataSize = 2 * 1024 * 1024;
    this.pauseStreams = true;
    this._released = false;
    this._streams = [];
    this._currentStream = null;
    this._insideLoop = false;
    this._pendingNext = false;
  };
  var util = __require("util");
  var Stream = __require("stream").Stream;
  var DelayedStream = require_delayed_stream();
  module.exports = CombinedStream;
  util.inherits(CombinedStream, Stream);
  CombinedStream.create = function(options) {
    var combinedStream = new this;
    options = options || {};
    for (var option in options) {
      combinedStream[option] = options[option];
    }
    return combinedStream;
  };
  CombinedStream.isStreamLike = function(stream) {
    return typeof stream !== "function" && typeof stream !== "string" && typeof stream !== "boolean" && typeof stream !== "number" && !Buffer.isBuffer(stream);
  };
  CombinedStream.prototype.append = function(stream) {
    var isStreamLike = CombinedStream.isStreamLike(stream);
    if (isStreamLike) {
      if (!(stream instanceof DelayedStream)) {
        var newStream = DelayedStream.create(stream, {
          maxDataSize: Infinity,
          pauseStream: this.pauseStreams
        });
        stream.on("data", this._checkDataSize.bind(this));
        stream = newStream;
      }
      this._handleErrors(stream);
      if (this.pauseStreams) {
        stream.pause();
      }
    }
    this._streams.push(stream);
    return this;
  };
  CombinedStream.prototype.pipe = function(dest, options) {
    Stream.prototype.pipe.call(this, dest, options);
    this.resume();
    return dest;
  };
  CombinedStream.prototype._getNext = function() {
    this._currentStream = null;
    if (this._insideLoop) {
      this._pendingNext = true;
      return;
    }
    this._insideLoop = true;
    try {
      do {
        this._pendingNext = false;
        this._realGetNext();
      } while (this._pendingNext);
    } finally {
      this._insideLoop = false;
    }
  };
  CombinedStream.prototype._realGetNext = function() {
    var stream = this._streams.shift();
    if (typeof stream == "undefined") {
      this.end();
      return;
    }
    if (typeof stream !== "function") {
      this._pipeNext(stream);
      return;
    }
    var getStream = stream;
    getStream(function(stream2) {
      var isStreamLike = CombinedStream.isStreamLike(stream2);
      if (isStreamLike) {
        stream2.on("data", this._checkDataSize.bind(this));
        this._handleErrors(stream2);
      }
      this._pipeNext(stream2);
    }.bind(this));
  };
  CombinedStream.prototype._pipeNext = function(stream) {
    this._currentStream = stream;
    var isStreamLike = CombinedStream.isStreamLike(stream);
    if (isStreamLike) {
      stream.on("end", this._getNext.bind(this));
      stream.pipe(this, { end: false });
      return;
    }
    var value = stream;
    this.write(value);
    this._getNext();
  };
  CombinedStream.prototype._handleErrors = function(stream) {
    var self2 = this;
    stream.on("error", function(err) {
      self2._emitError(err);
    });
  };
  CombinedStream.prototype.write = function(data) {
    this.emit("data", data);
  };
  CombinedStream.prototype.pause = function() {
    if (!this.pauseStreams) {
      return;
    }
    if (this.pauseStreams && this._currentStream && typeof this._currentStream.pause == "function")
      this._currentStream.pause();
    this.emit("pause");
  };
  CombinedStream.prototype.resume = function() {
    if (!this._released) {
      this._released = true;
      this.writable = true;
      this._getNext();
    }
    if (this.pauseStreams && this._currentStream && typeof this._currentStream.resume == "function")
      this._currentStream.resume();
    this.emit("resume");
  };
  CombinedStream.prototype.end = function() {
    this._reset();
    this.emit("end");
  };
  CombinedStream.prototype.destroy = function() {
    this._reset();
    this.emit("close");
  };
  CombinedStream.prototype._reset = function() {
    this.writable = false;
    this._streams = [];
    this._currentStream = null;
  };
  CombinedStream.prototype._checkDataSize = function() {
    this._updateDataSize();
    if (this.dataSize <= this.maxDataSize) {
      return;
    }
    var message = "DelayedStream#maxDataSize of " + this.maxDataSize + " bytes exceeded.";
    this._emitError(new Error(message));
  };
  CombinedStream.prototype._updateDataSize = function() {
    this.dataSize = 0;
    var self2 = this;
    this._streams.forEach(function(stream) {
      if (!stream.dataSize) {
        return;
      }
      self2.dataSize += stream.dataSize;
    });
    if (this._currentStream && this._currentStream.dataSize) {
      this.dataSize += this._currentStream.dataSize;
    }
  };
  CombinedStream.prototype._emitError = function(err) {
    this._reset();
    this.emit("error", err);
  };
});

// node_modules/mime-db/db.json
var require_db = __commonJS((exports, module) => {
  module.exports = {
    "application/1d-interleaved-parityfec": {
      source: "iana"
    },
    "application/3gpdash-qoe-report+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/3gpp-ims+xml": {
      source: "iana",
      compressible: true
    },
    "application/3gpphal+json": {
      source: "iana",
      compressible: true
    },
    "application/3gpphalforms+json": {
      source: "iana",
      compressible: true
    },
    "application/a2l": {
      source: "iana"
    },
    "application/ace+cbor": {
      source: "iana"
    },
    "application/activemessage": {
      source: "iana"
    },
    "application/activity+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-costmap+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-costmapfilter+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-directory+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointcost+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointcostparams+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointprop+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-endpointpropparams+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-error+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-networkmap+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-networkmapfilter+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-updatestreamcontrol+json": {
      source: "iana",
      compressible: true
    },
    "application/alto-updatestreamparams+json": {
      source: "iana",
      compressible: true
    },
    "application/aml": {
      source: "iana"
    },
    "application/andrew-inset": {
      source: "iana",
      extensions: ["ez"]
    },
    "application/applefile": {
      source: "iana"
    },
    "application/applixware": {
      source: "apache",
      extensions: ["aw"]
    },
    "application/at+jwt": {
      source: "iana"
    },
    "application/atf": {
      source: "iana"
    },
    "application/atfx": {
      source: "iana"
    },
    "application/atom+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atom"]
    },
    "application/atomcat+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atomcat"]
    },
    "application/atomdeleted+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atomdeleted"]
    },
    "application/atomicmail": {
      source: "iana"
    },
    "application/atomsvc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["atomsvc"]
    },
    "application/atsc-dwd+xml": {
      source: "iana",
      compressible: true,
      extensions: ["dwd"]
    },
    "application/atsc-dynamic-event-message": {
      source: "iana"
    },
    "application/atsc-held+xml": {
      source: "iana",
      compressible: true,
      extensions: ["held"]
    },
    "application/atsc-rdt+json": {
      source: "iana",
      compressible: true
    },
    "application/atsc-rsat+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rsat"]
    },
    "application/atxml": {
      source: "iana"
    },
    "application/auth-policy+xml": {
      source: "iana",
      compressible: true
    },
    "application/bacnet-xdd+zip": {
      source: "iana",
      compressible: false
    },
    "application/batch-smtp": {
      source: "iana"
    },
    "application/bdoc": {
      compressible: false,
      extensions: ["bdoc"]
    },
    "application/beep+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/calendar+json": {
      source: "iana",
      compressible: true
    },
    "application/calendar+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xcs"]
    },
    "application/call-completion": {
      source: "iana"
    },
    "application/cals-1840": {
      source: "iana"
    },
    "application/captive+json": {
      source: "iana",
      compressible: true
    },
    "application/cbor": {
      source: "iana"
    },
    "application/cbor-seq": {
      source: "iana"
    },
    "application/cccex": {
      source: "iana"
    },
    "application/ccmp+xml": {
      source: "iana",
      compressible: true
    },
    "application/ccxml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ccxml"]
    },
    "application/cdfx+xml": {
      source: "iana",
      compressible: true,
      extensions: ["cdfx"]
    },
    "application/cdmi-capability": {
      source: "iana",
      extensions: ["cdmia"]
    },
    "application/cdmi-container": {
      source: "iana",
      extensions: ["cdmic"]
    },
    "application/cdmi-domain": {
      source: "iana",
      extensions: ["cdmid"]
    },
    "application/cdmi-object": {
      source: "iana",
      extensions: ["cdmio"]
    },
    "application/cdmi-queue": {
      source: "iana",
      extensions: ["cdmiq"]
    },
    "application/cdni": {
      source: "iana"
    },
    "application/cea": {
      source: "iana"
    },
    "application/cea-2018+xml": {
      source: "iana",
      compressible: true
    },
    "application/cellml+xml": {
      source: "iana",
      compressible: true
    },
    "application/cfw": {
      source: "iana"
    },
    "application/city+json": {
      source: "iana",
      compressible: true
    },
    "application/clr": {
      source: "iana"
    },
    "application/clue+xml": {
      source: "iana",
      compressible: true
    },
    "application/clue_info+xml": {
      source: "iana",
      compressible: true
    },
    "application/cms": {
      source: "iana"
    },
    "application/cnrp+xml": {
      source: "iana",
      compressible: true
    },
    "application/coap-group+json": {
      source: "iana",
      compressible: true
    },
    "application/coap-payload": {
      source: "iana"
    },
    "application/commonground": {
      source: "iana"
    },
    "application/conference-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/cose": {
      source: "iana"
    },
    "application/cose-key": {
      source: "iana"
    },
    "application/cose-key-set": {
      source: "iana"
    },
    "application/cpl+xml": {
      source: "iana",
      compressible: true,
      extensions: ["cpl"]
    },
    "application/csrattrs": {
      source: "iana"
    },
    "application/csta+xml": {
      source: "iana",
      compressible: true
    },
    "application/cstadata+xml": {
      source: "iana",
      compressible: true
    },
    "application/csvm+json": {
      source: "iana",
      compressible: true
    },
    "application/cu-seeme": {
      source: "apache",
      extensions: ["cu"]
    },
    "application/cwt": {
      source: "iana"
    },
    "application/cybercash": {
      source: "iana"
    },
    "application/dart": {
      compressible: true
    },
    "application/dash+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mpd"]
    },
    "application/dash-patch+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mpp"]
    },
    "application/dashdelta": {
      source: "iana"
    },
    "application/davmount+xml": {
      source: "iana",
      compressible: true,
      extensions: ["davmount"]
    },
    "application/dca-rft": {
      source: "iana"
    },
    "application/dcd": {
      source: "iana"
    },
    "application/dec-dx": {
      source: "iana"
    },
    "application/dialog-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/dicom": {
      source: "iana"
    },
    "application/dicom+json": {
      source: "iana",
      compressible: true
    },
    "application/dicom+xml": {
      source: "iana",
      compressible: true
    },
    "application/dii": {
      source: "iana"
    },
    "application/dit": {
      source: "iana"
    },
    "application/dns": {
      source: "iana"
    },
    "application/dns+json": {
      source: "iana",
      compressible: true
    },
    "application/dns-message": {
      source: "iana"
    },
    "application/docbook+xml": {
      source: "apache",
      compressible: true,
      extensions: ["dbk"]
    },
    "application/dots+cbor": {
      source: "iana"
    },
    "application/dskpp+xml": {
      source: "iana",
      compressible: true
    },
    "application/dssc+der": {
      source: "iana",
      extensions: ["dssc"]
    },
    "application/dssc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xdssc"]
    },
    "application/dvcs": {
      source: "iana"
    },
    "application/ecmascript": {
      source: "iana",
      compressible: true,
      extensions: ["es", "ecma"]
    },
    "application/edi-consent": {
      source: "iana"
    },
    "application/edi-x12": {
      source: "iana",
      compressible: false
    },
    "application/edifact": {
      source: "iana",
      compressible: false
    },
    "application/efi": {
      source: "iana"
    },
    "application/elm+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/elm+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.cap+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/emergencycalldata.comment+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.control+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.deviceinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.ecall.msd": {
      source: "iana"
    },
    "application/emergencycalldata.providerinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.serviceinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.subscriberinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/emergencycalldata.veds+xml": {
      source: "iana",
      compressible: true
    },
    "application/emma+xml": {
      source: "iana",
      compressible: true,
      extensions: ["emma"]
    },
    "application/emotionml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["emotionml"]
    },
    "application/encaprtp": {
      source: "iana"
    },
    "application/epp+xml": {
      source: "iana",
      compressible: true
    },
    "application/epub+zip": {
      source: "iana",
      compressible: false,
      extensions: ["epub"]
    },
    "application/eshop": {
      source: "iana"
    },
    "application/exi": {
      source: "iana",
      extensions: ["exi"]
    },
    "application/expect-ct-report+json": {
      source: "iana",
      compressible: true
    },
    "application/express": {
      source: "iana",
      extensions: ["exp"]
    },
    "application/fastinfoset": {
      source: "iana"
    },
    "application/fastsoap": {
      source: "iana"
    },
    "application/fdt+xml": {
      source: "iana",
      compressible: true,
      extensions: ["fdt"]
    },
    "application/fhir+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/fhir+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/fido.trusted-apps+json": {
      compressible: true
    },
    "application/fits": {
      source: "iana"
    },
    "application/flexfec": {
      source: "iana"
    },
    "application/font-sfnt": {
      source: "iana"
    },
    "application/font-tdpfr": {
      source: "iana",
      extensions: ["pfr"]
    },
    "application/font-woff": {
      source: "iana",
      compressible: false
    },
    "application/framework-attributes+xml": {
      source: "iana",
      compressible: true
    },
    "application/geo+json": {
      source: "iana",
      compressible: true,
      extensions: ["geojson"]
    },
    "application/geo+json-seq": {
      source: "iana"
    },
    "application/geopackage+sqlite3": {
      source: "iana"
    },
    "application/geoxacml+xml": {
      source: "iana",
      compressible: true
    },
    "application/gltf-buffer": {
      source: "iana"
    },
    "application/gml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["gml"]
    },
    "application/gpx+xml": {
      source: "apache",
      compressible: true,
      extensions: ["gpx"]
    },
    "application/gxf": {
      source: "apache",
      extensions: ["gxf"]
    },
    "application/gzip": {
      source: "iana",
      compressible: false,
      extensions: ["gz"]
    },
    "application/h224": {
      source: "iana"
    },
    "application/held+xml": {
      source: "iana",
      compressible: true
    },
    "application/hjson": {
      extensions: ["hjson"]
    },
    "application/http": {
      source: "iana"
    },
    "application/hyperstudio": {
      source: "iana",
      extensions: ["stk"]
    },
    "application/ibe-key-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/ibe-pkg-reply+xml": {
      source: "iana",
      compressible: true
    },
    "application/ibe-pp-data": {
      source: "iana"
    },
    "application/iges": {
      source: "iana"
    },
    "application/im-iscomposing+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/index": {
      source: "iana"
    },
    "application/index.cmd": {
      source: "iana"
    },
    "application/index.obj": {
      source: "iana"
    },
    "application/index.response": {
      source: "iana"
    },
    "application/index.vnd": {
      source: "iana"
    },
    "application/inkml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ink", "inkml"]
    },
    "application/iotp": {
      source: "iana"
    },
    "application/ipfix": {
      source: "iana",
      extensions: ["ipfix"]
    },
    "application/ipp": {
      source: "iana"
    },
    "application/isup": {
      source: "iana"
    },
    "application/its+xml": {
      source: "iana",
      compressible: true,
      extensions: ["its"]
    },
    "application/java-archive": {
      source: "apache",
      compressible: false,
      extensions: ["jar", "war", "ear"]
    },
    "application/java-serialized-object": {
      source: "apache",
      compressible: false,
      extensions: ["ser"]
    },
    "application/java-vm": {
      source: "apache",
      compressible: false,
      extensions: ["class"]
    },
    "application/javascript": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["js", "mjs"]
    },
    "application/jf2feed+json": {
      source: "iana",
      compressible: true
    },
    "application/jose": {
      source: "iana"
    },
    "application/jose+json": {
      source: "iana",
      compressible: true
    },
    "application/jrd+json": {
      source: "iana",
      compressible: true
    },
    "application/jscalendar+json": {
      source: "iana",
      compressible: true
    },
    "application/json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["json", "map"]
    },
    "application/json-patch+json": {
      source: "iana",
      compressible: true
    },
    "application/json-seq": {
      source: "iana"
    },
    "application/json5": {
      extensions: ["json5"]
    },
    "application/jsonml+json": {
      source: "apache",
      compressible: true,
      extensions: ["jsonml"]
    },
    "application/jwk+json": {
      source: "iana",
      compressible: true
    },
    "application/jwk-set+json": {
      source: "iana",
      compressible: true
    },
    "application/jwt": {
      source: "iana"
    },
    "application/kpml-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/kpml-response+xml": {
      source: "iana",
      compressible: true
    },
    "application/ld+json": {
      source: "iana",
      compressible: true,
      extensions: ["jsonld"]
    },
    "application/lgr+xml": {
      source: "iana",
      compressible: true,
      extensions: ["lgr"]
    },
    "application/link-format": {
      source: "iana"
    },
    "application/load-control+xml": {
      source: "iana",
      compressible: true
    },
    "application/lost+xml": {
      source: "iana",
      compressible: true,
      extensions: ["lostxml"]
    },
    "application/lostsync+xml": {
      source: "iana",
      compressible: true
    },
    "application/lpf+zip": {
      source: "iana",
      compressible: false
    },
    "application/lxf": {
      source: "iana"
    },
    "application/mac-binhex40": {
      source: "iana",
      extensions: ["hqx"]
    },
    "application/mac-compactpro": {
      source: "apache",
      extensions: ["cpt"]
    },
    "application/macwriteii": {
      source: "iana"
    },
    "application/mads+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mads"]
    },
    "application/manifest+json": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["webmanifest"]
    },
    "application/marc": {
      source: "iana",
      extensions: ["mrc"]
    },
    "application/marcxml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mrcx"]
    },
    "application/mathematica": {
      source: "iana",
      extensions: ["ma", "nb", "mb"]
    },
    "application/mathml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mathml"]
    },
    "application/mathml-content+xml": {
      source: "iana",
      compressible: true
    },
    "application/mathml-presentation+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-associated-procedure-description+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-deregister+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-envelope+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-msk+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-msk-response+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-protection-description+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-reception-report+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-register+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-register-response+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-schedule+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbms-user-service-description+xml": {
      source: "iana",
      compressible: true
    },
    "application/mbox": {
      source: "iana",
      extensions: ["mbox"]
    },
    "application/media-policy-dataset+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mpf"]
    },
    "application/media_control+xml": {
      source: "iana",
      compressible: true
    },
    "application/mediaservercontrol+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mscml"]
    },
    "application/merge-patch+json": {
      source: "iana",
      compressible: true
    },
    "application/metalink+xml": {
      source: "apache",
      compressible: true,
      extensions: ["metalink"]
    },
    "application/metalink4+xml": {
      source: "iana",
      compressible: true,
      extensions: ["meta4"]
    },
    "application/mets+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mets"]
    },
    "application/mf4": {
      source: "iana"
    },
    "application/mikey": {
      source: "iana"
    },
    "application/mipc": {
      source: "iana"
    },
    "application/missing-blocks+cbor-seq": {
      source: "iana"
    },
    "application/mmt-aei+xml": {
      source: "iana",
      compressible: true,
      extensions: ["maei"]
    },
    "application/mmt-usd+xml": {
      source: "iana",
      compressible: true,
      extensions: ["musd"]
    },
    "application/mods+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mods"]
    },
    "application/moss-keys": {
      source: "iana"
    },
    "application/moss-signature": {
      source: "iana"
    },
    "application/mosskey-data": {
      source: "iana"
    },
    "application/mosskey-request": {
      source: "iana"
    },
    "application/mp21": {
      source: "iana",
      extensions: ["m21", "mp21"]
    },
    "application/mp4": {
      source: "iana",
      extensions: ["mp4s", "m4p"]
    },
    "application/mpeg4-generic": {
      source: "iana"
    },
    "application/mpeg4-iod": {
      source: "iana"
    },
    "application/mpeg4-iod-xmt": {
      source: "iana"
    },
    "application/mrb-consumer+xml": {
      source: "iana",
      compressible: true
    },
    "application/mrb-publish+xml": {
      source: "iana",
      compressible: true
    },
    "application/msc-ivr+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/msc-mixer+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/msword": {
      source: "iana",
      compressible: false,
      extensions: ["doc", "dot"]
    },
    "application/mud+json": {
      source: "iana",
      compressible: true
    },
    "application/multipart-core": {
      source: "iana"
    },
    "application/mxf": {
      source: "iana",
      extensions: ["mxf"]
    },
    "application/n-quads": {
      source: "iana",
      extensions: ["nq"]
    },
    "application/n-triples": {
      source: "iana",
      extensions: ["nt"]
    },
    "application/nasdata": {
      source: "iana"
    },
    "application/news-checkgroups": {
      source: "iana",
      charset: "US-ASCII"
    },
    "application/news-groupinfo": {
      source: "iana",
      charset: "US-ASCII"
    },
    "application/news-transmission": {
      source: "iana"
    },
    "application/nlsml+xml": {
      source: "iana",
      compressible: true
    },
    "application/node": {
      source: "iana",
      extensions: ["cjs"]
    },
    "application/nss": {
      source: "iana"
    },
    "application/oauth-authz-req+jwt": {
      source: "iana"
    },
    "application/oblivious-dns-message": {
      source: "iana"
    },
    "application/ocsp-request": {
      source: "iana"
    },
    "application/ocsp-response": {
      source: "iana"
    },
    "application/octet-stream": {
      source: "iana",
      compressible: false,
      extensions: ["bin", "dms", "lrf", "mar", "so", "dist", "distz", "pkg", "bpk", "dump", "elc", "deploy", "exe", "dll", "deb", "dmg", "iso", "img", "msi", "msp", "msm", "buffer"]
    },
    "application/oda": {
      source: "iana",
      extensions: ["oda"]
    },
    "application/odm+xml": {
      source: "iana",
      compressible: true
    },
    "application/odx": {
      source: "iana"
    },
    "application/oebps-package+xml": {
      source: "iana",
      compressible: true,
      extensions: ["opf"]
    },
    "application/ogg": {
      source: "iana",
      compressible: false,
      extensions: ["ogx"]
    },
    "application/omdoc+xml": {
      source: "apache",
      compressible: true,
      extensions: ["omdoc"]
    },
    "application/onenote": {
      source: "apache",
      extensions: ["onetoc", "onetoc2", "onetmp", "onepkg"]
    },
    "application/opc-nodeset+xml": {
      source: "iana",
      compressible: true
    },
    "application/oscore": {
      source: "iana"
    },
    "application/oxps": {
      source: "iana",
      extensions: ["oxps"]
    },
    "application/p21": {
      source: "iana"
    },
    "application/p21+zip": {
      source: "iana",
      compressible: false
    },
    "application/p2p-overlay+xml": {
      source: "iana",
      compressible: true,
      extensions: ["relo"]
    },
    "application/parityfec": {
      source: "iana"
    },
    "application/passport": {
      source: "iana"
    },
    "application/patch-ops-error+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xer"]
    },
    "application/pdf": {
      source: "iana",
      compressible: false,
      extensions: ["pdf"]
    },
    "application/pdx": {
      source: "iana"
    },
    "application/pem-certificate-chain": {
      source: "iana"
    },
    "application/pgp-encrypted": {
      source: "iana",
      compressible: false,
      extensions: ["pgp"]
    },
    "application/pgp-keys": {
      source: "iana",
      extensions: ["asc"]
    },
    "application/pgp-signature": {
      source: "iana",
      extensions: ["asc", "sig"]
    },
    "application/pics-rules": {
      source: "apache",
      extensions: ["prf"]
    },
    "application/pidf+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/pidf-diff+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/pkcs10": {
      source: "iana",
      extensions: ["p10"]
    },
    "application/pkcs12": {
      source: "iana"
    },
    "application/pkcs7-mime": {
      source: "iana",
      extensions: ["p7m", "p7c"]
    },
    "application/pkcs7-signature": {
      source: "iana",
      extensions: ["p7s"]
    },
    "application/pkcs8": {
      source: "iana",
      extensions: ["p8"]
    },
    "application/pkcs8-encrypted": {
      source: "iana"
    },
    "application/pkix-attr-cert": {
      source: "iana",
      extensions: ["ac"]
    },
    "application/pkix-cert": {
      source: "iana",
      extensions: ["cer"]
    },
    "application/pkix-crl": {
      source: "iana",
      extensions: ["crl"]
    },
    "application/pkix-pkipath": {
      source: "iana",
      extensions: ["pkipath"]
    },
    "application/pkixcmp": {
      source: "iana",
      extensions: ["pki"]
    },
    "application/pls+xml": {
      source: "iana",
      compressible: true,
      extensions: ["pls"]
    },
    "application/poc-settings+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/postscript": {
      source: "iana",
      compressible: true,
      extensions: ["ai", "eps", "ps"]
    },
    "application/ppsp-tracker+json": {
      source: "iana",
      compressible: true
    },
    "application/problem+json": {
      source: "iana",
      compressible: true
    },
    "application/problem+xml": {
      source: "iana",
      compressible: true
    },
    "application/provenance+xml": {
      source: "iana",
      compressible: true,
      extensions: ["provx"]
    },
    "application/prs.alvestrand.titrax-sheet": {
      source: "iana"
    },
    "application/prs.cww": {
      source: "iana",
      extensions: ["cww"]
    },
    "application/prs.cyn": {
      source: "iana",
      charset: "7-BIT"
    },
    "application/prs.hpub+zip": {
      source: "iana",
      compressible: false
    },
    "application/prs.nprend": {
      source: "iana"
    },
    "application/prs.plucker": {
      source: "iana"
    },
    "application/prs.rdf-xml-crypt": {
      source: "iana"
    },
    "application/prs.xsf+xml": {
      source: "iana",
      compressible: true
    },
    "application/pskc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["pskcxml"]
    },
    "application/pvd+json": {
      source: "iana",
      compressible: true
    },
    "application/qsig": {
      source: "iana"
    },
    "application/raml+yaml": {
      compressible: true,
      extensions: ["raml"]
    },
    "application/raptorfec": {
      source: "iana"
    },
    "application/rdap+json": {
      source: "iana",
      compressible: true
    },
    "application/rdf+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rdf", "owl"]
    },
    "application/reginfo+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rif"]
    },
    "application/relax-ng-compact-syntax": {
      source: "iana",
      extensions: ["rnc"]
    },
    "application/remote-printing": {
      source: "iana"
    },
    "application/reputon+json": {
      source: "iana",
      compressible: true
    },
    "application/resource-lists+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rl"]
    },
    "application/resource-lists-diff+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rld"]
    },
    "application/rfc+xml": {
      source: "iana",
      compressible: true
    },
    "application/riscos": {
      source: "iana"
    },
    "application/rlmi+xml": {
      source: "iana",
      compressible: true
    },
    "application/rls-services+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rs"]
    },
    "application/route-apd+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rapd"]
    },
    "application/route-s-tsid+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sls"]
    },
    "application/route-usd+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rusd"]
    },
    "application/rpki-ghostbusters": {
      source: "iana",
      extensions: ["gbr"]
    },
    "application/rpki-manifest": {
      source: "iana",
      extensions: ["mft"]
    },
    "application/rpki-publication": {
      source: "iana"
    },
    "application/rpki-roa": {
      source: "iana",
      extensions: ["roa"]
    },
    "application/rpki-updown": {
      source: "iana"
    },
    "application/rsd+xml": {
      source: "apache",
      compressible: true,
      extensions: ["rsd"]
    },
    "application/rss+xml": {
      source: "apache",
      compressible: true,
      extensions: ["rss"]
    },
    "application/rtf": {
      source: "iana",
      compressible: true,
      extensions: ["rtf"]
    },
    "application/rtploopback": {
      source: "iana"
    },
    "application/rtx": {
      source: "iana"
    },
    "application/samlassertion+xml": {
      source: "iana",
      compressible: true
    },
    "application/samlmetadata+xml": {
      source: "iana",
      compressible: true
    },
    "application/sarif+json": {
      source: "iana",
      compressible: true
    },
    "application/sarif-external-properties+json": {
      source: "iana",
      compressible: true
    },
    "application/sbe": {
      source: "iana"
    },
    "application/sbml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sbml"]
    },
    "application/scaip+xml": {
      source: "iana",
      compressible: true
    },
    "application/scim+json": {
      source: "iana",
      compressible: true
    },
    "application/scvp-cv-request": {
      source: "iana",
      extensions: ["scq"]
    },
    "application/scvp-cv-response": {
      source: "iana",
      extensions: ["scs"]
    },
    "application/scvp-vp-request": {
      source: "iana",
      extensions: ["spq"]
    },
    "application/scvp-vp-response": {
      source: "iana",
      extensions: ["spp"]
    },
    "application/sdp": {
      source: "iana",
      extensions: ["sdp"]
    },
    "application/secevent+jwt": {
      source: "iana"
    },
    "application/senml+cbor": {
      source: "iana"
    },
    "application/senml+json": {
      source: "iana",
      compressible: true
    },
    "application/senml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["senmlx"]
    },
    "application/senml-etch+cbor": {
      source: "iana"
    },
    "application/senml-etch+json": {
      source: "iana",
      compressible: true
    },
    "application/senml-exi": {
      source: "iana"
    },
    "application/sensml+cbor": {
      source: "iana"
    },
    "application/sensml+json": {
      source: "iana",
      compressible: true
    },
    "application/sensml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sensmlx"]
    },
    "application/sensml-exi": {
      source: "iana"
    },
    "application/sep+xml": {
      source: "iana",
      compressible: true
    },
    "application/sep-exi": {
      source: "iana"
    },
    "application/session-info": {
      source: "iana"
    },
    "application/set-payment": {
      source: "iana"
    },
    "application/set-payment-initiation": {
      source: "iana",
      extensions: ["setpay"]
    },
    "application/set-registration": {
      source: "iana"
    },
    "application/set-registration-initiation": {
      source: "iana",
      extensions: ["setreg"]
    },
    "application/sgml": {
      source: "iana"
    },
    "application/sgml-open-catalog": {
      source: "iana"
    },
    "application/shf+xml": {
      source: "iana",
      compressible: true,
      extensions: ["shf"]
    },
    "application/sieve": {
      source: "iana",
      extensions: ["siv", "sieve"]
    },
    "application/simple-filter+xml": {
      source: "iana",
      compressible: true
    },
    "application/simple-message-summary": {
      source: "iana"
    },
    "application/simplesymbolcontainer": {
      source: "iana"
    },
    "application/sipc": {
      source: "iana"
    },
    "application/slate": {
      source: "iana"
    },
    "application/smil": {
      source: "iana"
    },
    "application/smil+xml": {
      source: "iana",
      compressible: true,
      extensions: ["smi", "smil"]
    },
    "application/smpte336m": {
      source: "iana"
    },
    "application/soap+fastinfoset": {
      source: "iana"
    },
    "application/soap+xml": {
      source: "iana",
      compressible: true
    },
    "application/sparql-query": {
      source: "iana",
      extensions: ["rq"]
    },
    "application/sparql-results+xml": {
      source: "iana",
      compressible: true,
      extensions: ["srx"]
    },
    "application/spdx+json": {
      source: "iana",
      compressible: true
    },
    "application/spirits-event+xml": {
      source: "iana",
      compressible: true
    },
    "application/sql": {
      source: "iana"
    },
    "application/srgs": {
      source: "iana",
      extensions: ["gram"]
    },
    "application/srgs+xml": {
      source: "iana",
      compressible: true,
      extensions: ["grxml"]
    },
    "application/sru+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sru"]
    },
    "application/ssdl+xml": {
      source: "apache",
      compressible: true,
      extensions: ["ssdl"]
    },
    "application/ssml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ssml"]
    },
    "application/stix+json": {
      source: "iana",
      compressible: true
    },
    "application/swid+xml": {
      source: "iana",
      compressible: true,
      extensions: ["swidtag"]
    },
    "application/tamp-apex-update": {
      source: "iana"
    },
    "application/tamp-apex-update-confirm": {
      source: "iana"
    },
    "application/tamp-community-update": {
      source: "iana"
    },
    "application/tamp-community-update-confirm": {
      source: "iana"
    },
    "application/tamp-error": {
      source: "iana"
    },
    "application/tamp-sequence-adjust": {
      source: "iana"
    },
    "application/tamp-sequence-adjust-confirm": {
      source: "iana"
    },
    "application/tamp-status-query": {
      source: "iana"
    },
    "application/tamp-status-response": {
      source: "iana"
    },
    "application/tamp-update": {
      source: "iana"
    },
    "application/tamp-update-confirm": {
      source: "iana"
    },
    "application/tar": {
      compressible: true
    },
    "application/taxii+json": {
      source: "iana",
      compressible: true
    },
    "application/td+json": {
      source: "iana",
      compressible: true
    },
    "application/tei+xml": {
      source: "iana",
      compressible: true,
      extensions: ["tei", "teicorpus"]
    },
    "application/tetra_isi": {
      source: "iana"
    },
    "application/thraud+xml": {
      source: "iana",
      compressible: true,
      extensions: ["tfi"]
    },
    "application/timestamp-query": {
      source: "iana"
    },
    "application/timestamp-reply": {
      source: "iana"
    },
    "application/timestamped-data": {
      source: "iana",
      extensions: ["tsd"]
    },
    "application/tlsrpt+gzip": {
      source: "iana"
    },
    "application/tlsrpt+json": {
      source: "iana",
      compressible: true
    },
    "application/tnauthlist": {
      source: "iana"
    },
    "application/token-introspection+jwt": {
      source: "iana"
    },
    "application/toml": {
      compressible: true,
      extensions: ["toml"]
    },
    "application/trickle-ice-sdpfrag": {
      source: "iana"
    },
    "application/trig": {
      source: "iana",
      extensions: ["trig"]
    },
    "application/ttml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ttml"]
    },
    "application/tve-trigger": {
      source: "iana"
    },
    "application/tzif": {
      source: "iana"
    },
    "application/tzif-leap": {
      source: "iana"
    },
    "application/ubjson": {
      compressible: false,
      extensions: ["ubj"]
    },
    "application/ulpfec": {
      source: "iana"
    },
    "application/urc-grpsheet+xml": {
      source: "iana",
      compressible: true
    },
    "application/urc-ressheet+xml": {
      source: "iana",
      compressible: true,
      extensions: ["rsheet"]
    },
    "application/urc-targetdesc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["td"]
    },
    "application/urc-uisocketdesc+xml": {
      source: "iana",
      compressible: true
    },
    "application/vcard+json": {
      source: "iana",
      compressible: true
    },
    "application/vcard+xml": {
      source: "iana",
      compressible: true
    },
    "application/vemmi": {
      source: "iana"
    },
    "application/vividence.scriptfile": {
      source: "apache"
    },
    "application/vnd.1000minds.decision-model+xml": {
      source: "iana",
      compressible: true,
      extensions: ["1km"]
    },
    "application/vnd.3gpp-prose+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp-prose-pc3ch+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp-v2x-local-service-information": {
      source: "iana"
    },
    "application/vnd.3gpp.5gnas": {
      source: "iana"
    },
    "application/vnd.3gpp.access-transfer-events+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.bsf+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.gmop+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.gtpc": {
      source: "iana"
    },
    "application/vnd.3gpp.interworking-data": {
      source: "iana"
    },
    "application/vnd.3gpp.lpp": {
      source: "iana"
    },
    "application/vnd.3gpp.mc-signalling-ear": {
      source: "iana"
    },
    "application/vnd.3gpp.mcdata-affiliation-command+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcdata-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcdata-payload": {
      source: "iana"
    },
    "application/vnd.3gpp.mcdata-service-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcdata-signalling": {
      source: "iana"
    },
    "application/vnd.3gpp.mcdata-ue-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcdata-user-profile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-affiliation-command+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-floor-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-location-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-mbms-usage-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-service-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-signed+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-ue-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-ue-init-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcptt-user-profile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-affiliation-command+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-affiliation-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-location-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-mbms-usage-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-service-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-transmission-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-ue-config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mcvideo-user-profile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.mid-call+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.ngap": {
      source: "iana"
    },
    "application/vnd.3gpp.pfcp": {
      source: "iana"
    },
    "application/vnd.3gpp.pic-bw-large": {
      source: "iana",
      extensions: ["plb"]
    },
    "application/vnd.3gpp.pic-bw-small": {
      source: "iana",
      extensions: ["psb"]
    },
    "application/vnd.3gpp.pic-bw-var": {
      source: "iana",
      extensions: ["pvb"]
    },
    "application/vnd.3gpp.s1ap": {
      source: "iana"
    },
    "application/vnd.3gpp.sms": {
      source: "iana"
    },
    "application/vnd.3gpp.sms+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.srvcc-ext+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.srvcc-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.state-and-event-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp.ussd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp2.bcmcsinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.3gpp2.sms": {
      source: "iana"
    },
    "application/vnd.3gpp2.tcap": {
      source: "iana",
      extensions: ["tcap"]
    },
    "application/vnd.3lightssoftware.imagescal": {
      source: "iana"
    },
    "application/vnd.3m.post-it-notes": {
      source: "iana",
      extensions: ["pwn"]
    },
    "application/vnd.accpac.simply.aso": {
      source: "iana",
      extensions: ["aso"]
    },
    "application/vnd.accpac.simply.imp": {
      source: "iana",
      extensions: ["imp"]
    },
    "application/vnd.acucobol": {
      source: "iana",
      extensions: ["acu"]
    },
    "application/vnd.acucorp": {
      source: "iana",
      extensions: ["atc", "acutc"]
    },
    "application/vnd.adobe.air-application-installer-package+zip": {
      source: "apache",
      compressible: false,
      extensions: ["air"]
    },
    "application/vnd.adobe.flash.movie": {
      source: "iana"
    },
    "application/vnd.adobe.formscentral.fcdt": {
      source: "iana",
      extensions: ["fcdt"]
    },
    "application/vnd.adobe.fxp": {
      source: "iana",
      extensions: ["fxp", "fxpl"]
    },
    "application/vnd.adobe.partial-upload": {
      source: "iana"
    },
    "application/vnd.adobe.xdp+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xdp"]
    },
    "application/vnd.adobe.xfdf": {
      source: "iana",
      extensions: ["xfdf"]
    },
    "application/vnd.aether.imp": {
      source: "iana"
    },
    "application/vnd.afpc.afplinedata": {
      source: "iana"
    },
    "application/vnd.afpc.afplinedata-pagedef": {
      source: "iana"
    },
    "application/vnd.afpc.cmoca-cmresource": {
      source: "iana"
    },
    "application/vnd.afpc.foca-charset": {
      source: "iana"
    },
    "application/vnd.afpc.foca-codedfont": {
      source: "iana"
    },
    "application/vnd.afpc.foca-codepage": {
      source: "iana"
    },
    "application/vnd.afpc.modca": {
      source: "iana"
    },
    "application/vnd.afpc.modca-cmtable": {
      source: "iana"
    },
    "application/vnd.afpc.modca-formdef": {
      source: "iana"
    },
    "application/vnd.afpc.modca-mediummap": {
      source: "iana"
    },
    "application/vnd.afpc.modca-objectcontainer": {
      source: "iana"
    },
    "application/vnd.afpc.modca-overlay": {
      source: "iana"
    },
    "application/vnd.afpc.modca-pagesegment": {
      source: "iana"
    },
    "application/vnd.age": {
      source: "iana",
      extensions: ["age"]
    },
    "application/vnd.ah-barcode": {
      source: "iana"
    },
    "application/vnd.ahead.space": {
      source: "iana",
      extensions: ["ahead"]
    },
    "application/vnd.airzip.filesecure.azf": {
      source: "iana",
      extensions: ["azf"]
    },
    "application/vnd.airzip.filesecure.azs": {
      source: "iana",
      extensions: ["azs"]
    },
    "application/vnd.amadeus+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.amazon.ebook": {
      source: "apache",
      extensions: ["azw"]
    },
    "application/vnd.amazon.mobi8-ebook": {
      source: "iana"
    },
    "application/vnd.americandynamics.acc": {
      source: "iana",
      extensions: ["acc"]
    },
    "application/vnd.amiga.ami": {
      source: "iana",
      extensions: ["ami"]
    },
    "application/vnd.amundsen.maze+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.android.ota": {
      source: "iana"
    },
    "application/vnd.android.package-archive": {
      source: "apache",
      compressible: false,
      extensions: ["apk"]
    },
    "application/vnd.anki": {
      source: "iana"
    },
    "application/vnd.anser-web-certificate-issue-initiation": {
      source: "iana",
      extensions: ["cii"]
    },
    "application/vnd.anser-web-funds-transfer-initiation": {
      source: "apache",
      extensions: ["fti"]
    },
    "application/vnd.antix.game-component": {
      source: "iana",
      extensions: ["atx"]
    },
    "application/vnd.apache.arrow.file": {
      source: "iana"
    },
    "application/vnd.apache.arrow.stream": {
      source: "iana"
    },
    "application/vnd.apache.thrift.binary": {
      source: "iana"
    },
    "application/vnd.apache.thrift.compact": {
      source: "iana"
    },
    "application/vnd.apache.thrift.json": {
      source: "iana"
    },
    "application/vnd.api+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.aplextor.warrp+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.apothekende.reservation+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.apple.installer+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mpkg"]
    },
    "application/vnd.apple.keynote": {
      source: "iana",
      extensions: ["key"]
    },
    "application/vnd.apple.mpegurl": {
      source: "iana",
      extensions: ["m3u8"]
    },
    "application/vnd.apple.numbers": {
      source: "iana",
      extensions: ["numbers"]
    },
    "application/vnd.apple.pages": {
      source: "iana",
      extensions: ["pages"]
    },
    "application/vnd.apple.pkpass": {
      compressible: false,
      extensions: ["pkpass"]
    },
    "application/vnd.arastra.swi": {
      source: "iana"
    },
    "application/vnd.aristanetworks.swi": {
      source: "iana",
      extensions: ["swi"]
    },
    "application/vnd.artisan+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.artsquare": {
      source: "iana"
    },
    "application/vnd.astraea-software.iota": {
      source: "iana",
      extensions: ["iota"]
    },
    "application/vnd.audiograph": {
      source: "iana",
      extensions: ["aep"]
    },
    "application/vnd.autopackage": {
      source: "iana"
    },
    "application/vnd.avalon+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.avistar+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.balsamiq.bmml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["bmml"]
    },
    "application/vnd.balsamiq.bmpr": {
      source: "iana"
    },
    "application/vnd.banana-accounting": {
      source: "iana"
    },
    "application/vnd.bbf.usp.error": {
      source: "iana"
    },
    "application/vnd.bbf.usp.msg": {
      source: "iana"
    },
    "application/vnd.bbf.usp.msg+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.bekitzur-stech+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.bint.med-content": {
      source: "iana"
    },
    "application/vnd.biopax.rdf+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.blink-idb-value-wrapper": {
      source: "iana"
    },
    "application/vnd.blueice.multipass": {
      source: "iana",
      extensions: ["mpm"]
    },
    "application/vnd.bluetooth.ep.oob": {
      source: "iana"
    },
    "application/vnd.bluetooth.le.oob": {
      source: "iana"
    },
    "application/vnd.bmi": {
      source: "iana",
      extensions: ["bmi"]
    },
    "application/vnd.bpf": {
      source: "iana"
    },
    "application/vnd.bpf3": {
      source: "iana"
    },
    "application/vnd.businessobjects": {
      source: "iana",
      extensions: ["rep"]
    },
    "application/vnd.byu.uapi+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cab-jscript": {
      source: "iana"
    },
    "application/vnd.canon-cpdl": {
      source: "iana"
    },
    "application/vnd.canon-lips": {
      source: "iana"
    },
    "application/vnd.capasystems-pg+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cendio.thinlinc.clientconf": {
      source: "iana"
    },
    "application/vnd.century-systems.tcp_stream": {
      source: "iana"
    },
    "application/vnd.chemdraw+xml": {
      source: "iana",
      compressible: true,
      extensions: ["cdxml"]
    },
    "application/vnd.chess-pgn": {
      source: "iana"
    },
    "application/vnd.chipnuts.karaoke-mmd": {
      source: "iana",
      extensions: ["mmd"]
    },
    "application/vnd.ciedi": {
      source: "iana"
    },
    "application/vnd.cinderella": {
      source: "iana",
      extensions: ["cdy"]
    },
    "application/vnd.cirpack.isdn-ext": {
      source: "iana"
    },
    "application/vnd.citationstyles.style+xml": {
      source: "iana",
      compressible: true,
      extensions: ["csl"]
    },
    "application/vnd.claymore": {
      source: "iana",
      extensions: ["cla"]
    },
    "application/vnd.cloanto.rp9": {
      source: "iana",
      extensions: ["rp9"]
    },
    "application/vnd.clonk.c4group": {
      source: "iana",
      extensions: ["c4g", "c4d", "c4f", "c4p", "c4u"]
    },
    "application/vnd.cluetrust.cartomobile-config": {
      source: "iana",
      extensions: ["c11amc"]
    },
    "application/vnd.cluetrust.cartomobile-config-pkg": {
      source: "iana",
      extensions: ["c11amz"]
    },
    "application/vnd.coffeescript": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.document": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.document-template": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.presentation": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.presentation-template": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.spreadsheet": {
      source: "iana"
    },
    "application/vnd.collabio.xodocuments.spreadsheet-template": {
      source: "iana"
    },
    "application/vnd.collection+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.collection.doc+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.collection.next+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.comicbook+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.comicbook-rar": {
      source: "iana"
    },
    "application/vnd.commerce-battelle": {
      source: "iana"
    },
    "application/vnd.commonspace": {
      source: "iana",
      extensions: ["csp"]
    },
    "application/vnd.contact.cmsg": {
      source: "iana",
      extensions: ["cdbcmsg"]
    },
    "application/vnd.coreos.ignition+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cosmocaller": {
      source: "iana",
      extensions: ["cmc"]
    },
    "application/vnd.crick.clicker": {
      source: "iana",
      extensions: ["clkx"]
    },
    "application/vnd.crick.clicker.keyboard": {
      source: "iana",
      extensions: ["clkk"]
    },
    "application/vnd.crick.clicker.palette": {
      source: "iana",
      extensions: ["clkp"]
    },
    "application/vnd.crick.clicker.template": {
      source: "iana",
      extensions: ["clkt"]
    },
    "application/vnd.crick.clicker.wordbank": {
      source: "iana",
      extensions: ["clkw"]
    },
    "application/vnd.criticaltools.wbs+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wbs"]
    },
    "application/vnd.cryptii.pipe+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.crypto-shade-file": {
      source: "iana"
    },
    "application/vnd.cryptomator.encrypted": {
      source: "iana"
    },
    "application/vnd.cryptomator.vault": {
      source: "iana"
    },
    "application/vnd.ctc-posml": {
      source: "iana",
      extensions: ["pml"]
    },
    "application/vnd.ctct.ws+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cups-pdf": {
      source: "iana"
    },
    "application/vnd.cups-postscript": {
      source: "iana"
    },
    "application/vnd.cups-ppd": {
      source: "iana",
      extensions: ["ppd"]
    },
    "application/vnd.cups-raster": {
      source: "iana"
    },
    "application/vnd.cups-raw": {
      source: "iana"
    },
    "application/vnd.curl": {
      source: "iana"
    },
    "application/vnd.curl.car": {
      source: "apache",
      extensions: ["car"]
    },
    "application/vnd.curl.pcurl": {
      source: "apache",
      extensions: ["pcurl"]
    },
    "application/vnd.cyan.dean.root+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cybank": {
      source: "iana"
    },
    "application/vnd.cyclonedx+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.cyclonedx+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.d2l.coursepackage1p0+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.d3m-dataset": {
      source: "iana"
    },
    "application/vnd.d3m-problem": {
      source: "iana"
    },
    "application/vnd.dart": {
      source: "iana",
      compressible: true,
      extensions: ["dart"]
    },
    "application/vnd.data-vision.rdz": {
      source: "iana",
      extensions: ["rdz"]
    },
    "application/vnd.datapackage+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dataresource+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dbf": {
      source: "iana",
      extensions: ["dbf"]
    },
    "application/vnd.debian.binary-package": {
      source: "iana"
    },
    "application/vnd.dece.data": {
      source: "iana",
      extensions: ["uvf", "uvvf", "uvd", "uvvd"]
    },
    "application/vnd.dece.ttml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["uvt", "uvvt"]
    },
    "application/vnd.dece.unspecified": {
      source: "iana",
      extensions: ["uvx", "uvvx"]
    },
    "application/vnd.dece.zip": {
      source: "iana",
      extensions: ["uvz", "uvvz"]
    },
    "application/vnd.denovo.fcselayout-link": {
      source: "iana",
      extensions: ["fe_launch"]
    },
    "application/vnd.desmume.movie": {
      source: "iana"
    },
    "application/vnd.dir-bi.plate-dl-nosuffix": {
      source: "iana"
    },
    "application/vnd.dm.delegation+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dna": {
      source: "iana",
      extensions: ["dna"]
    },
    "application/vnd.document+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dolby.mlp": {
      source: "apache",
      extensions: ["mlp"]
    },
    "application/vnd.dolby.mobile.1": {
      source: "iana"
    },
    "application/vnd.dolby.mobile.2": {
      source: "iana"
    },
    "application/vnd.doremir.scorecloud-binary-document": {
      source: "iana"
    },
    "application/vnd.dpgraph": {
      source: "iana",
      extensions: ["dpg"]
    },
    "application/vnd.dreamfactory": {
      source: "iana",
      extensions: ["dfac"]
    },
    "application/vnd.drive+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ds-keypoint": {
      source: "apache",
      extensions: ["kpxx"]
    },
    "application/vnd.dtg.local": {
      source: "iana"
    },
    "application/vnd.dtg.local.flash": {
      source: "iana"
    },
    "application/vnd.dtg.local.html": {
      source: "iana"
    },
    "application/vnd.dvb.ait": {
      source: "iana",
      extensions: ["ait"]
    },
    "application/vnd.dvb.dvbisl+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.dvbj": {
      source: "iana"
    },
    "application/vnd.dvb.esgcontainer": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcdftnotifaccess": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgaccess": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgaccess2": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcesgpdd": {
      source: "iana"
    },
    "application/vnd.dvb.ipdcroaming": {
      source: "iana"
    },
    "application/vnd.dvb.iptv.alfec-base": {
      source: "iana"
    },
    "application/vnd.dvb.iptv.alfec-enhancement": {
      source: "iana"
    },
    "application/vnd.dvb.notif-aggregate-root+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-container+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-generic+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-ia-msglist+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-ia-registration-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-ia-registration-response+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.notif-init+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.dvb.pfr": {
      source: "iana"
    },
    "application/vnd.dvb.service": {
      source: "iana",
      extensions: ["svc"]
    },
    "application/vnd.dxr": {
      source: "iana"
    },
    "application/vnd.dynageo": {
      source: "iana",
      extensions: ["geo"]
    },
    "application/vnd.dzr": {
      source: "iana"
    },
    "application/vnd.easykaraoke.cdgdownload": {
      source: "iana"
    },
    "application/vnd.ecdis-update": {
      source: "iana"
    },
    "application/vnd.ecip.rlp": {
      source: "iana"
    },
    "application/vnd.eclipse.ditto+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ecowin.chart": {
      source: "iana",
      extensions: ["mag"]
    },
    "application/vnd.ecowin.filerequest": {
      source: "iana"
    },
    "application/vnd.ecowin.fileupdate": {
      source: "iana"
    },
    "application/vnd.ecowin.series": {
      source: "iana"
    },
    "application/vnd.ecowin.seriesrequest": {
      source: "iana"
    },
    "application/vnd.ecowin.seriesupdate": {
      source: "iana"
    },
    "application/vnd.efi.img": {
      source: "iana"
    },
    "application/vnd.efi.iso": {
      source: "iana"
    },
    "application/vnd.emclient.accessrequest+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.enliven": {
      source: "iana",
      extensions: ["nml"]
    },
    "application/vnd.enphase.envoy": {
      source: "iana"
    },
    "application/vnd.eprints.data+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.epson.esf": {
      source: "iana",
      extensions: ["esf"]
    },
    "application/vnd.epson.msf": {
      source: "iana",
      extensions: ["msf"]
    },
    "application/vnd.epson.quickanime": {
      source: "iana",
      extensions: ["qam"]
    },
    "application/vnd.epson.salt": {
      source: "iana",
      extensions: ["slt"]
    },
    "application/vnd.epson.ssf": {
      source: "iana",
      extensions: ["ssf"]
    },
    "application/vnd.ericsson.quickcall": {
      source: "iana"
    },
    "application/vnd.espass-espass+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.eszigno3+xml": {
      source: "iana",
      compressible: true,
      extensions: ["es3", "et3"]
    },
    "application/vnd.etsi.aoc+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.asic-e+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.etsi.asic-s+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.etsi.cug+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvcommand+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvdiscovery+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvprofile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvsad-bc+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvsad-cod+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvsad-npvr+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvservice+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvsync+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.iptvueprofile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.mcid+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.mheg5": {
      source: "iana"
    },
    "application/vnd.etsi.overload-control-policy-dataset+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.pstn+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.sci+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.simservs+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.timestamp-token": {
      source: "iana"
    },
    "application/vnd.etsi.tsl+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.etsi.tsl.der": {
      source: "iana"
    },
    "application/vnd.eu.kasparian.car+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.eudora.data": {
      source: "iana"
    },
    "application/vnd.evolv.ecig.profile": {
      source: "iana"
    },
    "application/vnd.evolv.ecig.settings": {
      source: "iana"
    },
    "application/vnd.evolv.ecig.theme": {
      source: "iana"
    },
    "application/vnd.exstream-empower+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.exstream-package": {
      source: "iana"
    },
    "application/vnd.ezpix-album": {
      source: "iana",
      extensions: ["ez2"]
    },
    "application/vnd.ezpix-package": {
      source: "iana",
      extensions: ["ez3"]
    },
    "application/vnd.f-secure.mobile": {
      source: "iana"
    },
    "application/vnd.familysearch.gedcom+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.fastcopy-disk-image": {
      source: "iana"
    },
    "application/vnd.fdf": {
      source: "iana",
      extensions: ["fdf"]
    },
    "application/vnd.fdsn.mseed": {
      source: "iana",
      extensions: ["mseed"]
    },
    "application/vnd.fdsn.seed": {
      source: "iana",
      extensions: ["seed", "dataless"]
    },
    "application/vnd.ffsns": {
      source: "iana"
    },
    "application/vnd.ficlab.flb+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.filmit.zfc": {
      source: "iana"
    },
    "application/vnd.fints": {
      source: "iana"
    },
    "application/vnd.firemonkeys.cloudcell": {
      source: "iana"
    },
    "application/vnd.flographit": {
      source: "iana",
      extensions: ["gph"]
    },
    "application/vnd.fluxtime.clip": {
      source: "iana",
      extensions: ["ftc"]
    },
    "application/vnd.font-fontforge-sfd": {
      source: "iana"
    },
    "application/vnd.framemaker": {
      source: "iana",
      extensions: ["fm", "frame", "maker", "book"]
    },
    "application/vnd.frogans.fnc": {
      source: "iana",
      extensions: ["fnc"]
    },
    "application/vnd.frogans.ltf": {
      source: "iana",
      extensions: ["ltf"]
    },
    "application/vnd.fsc.weblaunch": {
      source: "iana",
      extensions: ["fsc"]
    },
    "application/vnd.fujifilm.fb.docuworks": {
      source: "iana"
    },
    "application/vnd.fujifilm.fb.docuworks.binder": {
      source: "iana"
    },
    "application/vnd.fujifilm.fb.docuworks.container": {
      source: "iana"
    },
    "application/vnd.fujifilm.fb.jfi+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.fujitsu.oasys": {
      source: "iana",
      extensions: ["oas"]
    },
    "application/vnd.fujitsu.oasys2": {
      source: "iana",
      extensions: ["oa2"]
    },
    "application/vnd.fujitsu.oasys3": {
      source: "iana",
      extensions: ["oa3"]
    },
    "application/vnd.fujitsu.oasysgp": {
      source: "iana",
      extensions: ["fg5"]
    },
    "application/vnd.fujitsu.oasysprs": {
      source: "iana",
      extensions: ["bh2"]
    },
    "application/vnd.fujixerox.art-ex": {
      source: "iana"
    },
    "application/vnd.fujixerox.art4": {
      source: "iana"
    },
    "application/vnd.fujixerox.ddd": {
      source: "iana",
      extensions: ["ddd"]
    },
    "application/vnd.fujixerox.docuworks": {
      source: "iana",
      extensions: ["xdw"]
    },
    "application/vnd.fujixerox.docuworks.binder": {
      source: "iana",
      extensions: ["xbd"]
    },
    "application/vnd.fujixerox.docuworks.container": {
      source: "iana"
    },
    "application/vnd.fujixerox.hbpl": {
      source: "iana"
    },
    "application/vnd.fut-misnet": {
      source: "iana"
    },
    "application/vnd.futoin+cbor": {
      source: "iana"
    },
    "application/vnd.futoin+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.fuzzysheet": {
      source: "iana",
      extensions: ["fzs"]
    },
    "application/vnd.genomatix.tuxedo": {
      source: "iana",
      extensions: ["txd"]
    },
    "application/vnd.gentics.grd+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.geo+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.geocube+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.geogebra.file": {
      source: "iana",
      extensions: ["ggb"]
    },
    "application/vnd.geogebra.slides": {
      source: "iana"
    },
    "application/vnd.geogebra.tool": {
      source: "iana",
      extensions: ["ggt"]
    },
    "application/vnd.geometry-explorer": {
      source: "iana",
      extensions: ["gex", "gre"]
    },
    "application/vnd.geonext": {
      source: "iana",
      extensions: ["gxt"]
    },
    "application/vnd.geoplan": {
      source: "iana",
      extensions: ["g2w"]
    },
    "application/vnd.geospace": {
      source: "iana",
      extensions: ["g3w"]
    },
    "application/vnd.gerber": {
      source: "iana"
    },
    "application/vnd.globalplatform.card-content-mgt": {
      source: "iana"
    },
    "application/vnd.globalplatform.card-content-mgt-response": {
      source: "iana"
    },
    "application/vnd.gmx": {
      source: "iana",
      extensions: ["gmx"]
    },
    "application/vnd.google-apps.document": {
      compressible: false,
      extensions: ["gdoc"]
    },
    "application/vnd.google-apps.presentation": {
      compressible: false,
      extensions: ["gslides"]
    },
    "application/vnd.google-apps.spreadsheet": {
      compressible: false,
      extensions: ["gsheet"]
    },
    "application/vnd.google-earth.kml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["kml"]
    },
    "application/vnd.google-earth.kmz": {
      source: "iana",
      compressible: false,
      extensions: ["kmz"]
    },
    "application/vnd.gov.sk.e-form+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.gov.sk.e-form+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.gov.sk.xmldatacontainer+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.grafeq": {
      source: "iana",
      extensions: ["gqf", "gqs"]
    },
    "application/vnd.gridmp": {
      source: "iana"
    },
    "application/vnd.groove-account": {
      source: "iana",
      extensions: ["gac"]
    },
    "application/vnd.groove-help": {
      source: "iana",
      extensions: ["ghf"]
    },
    "application/vnd.groove-identity-message": {
      source: "iana",
      extensions: ["gim"]
    },
    "application/vnd.groove-injector": {
      source: "iana",
      extensions: ["grv"]
    },
    "application/vnd.groove-tool-message": {
      source: "iana",
      extensions: ["gtm"]
    },
    "application/vnd.groove-tool-template": {
      source: "iana",
      extensions: ["tpl"]
    },
    "application/vnd.groove-vcard": {
      source: "iana",
      extensions: ["vcg"]
    },
    "application/vnd.hal+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hal+xml": {
      source: "iana",
      compressible: true,
      extensions: ["hal"]
    },
    "application/vnd.handheld-entertainment+xml": {
      source: "iana",
      compressible: true,
      extensions: ["zmm"]
    },
    "application/vnd.hbci": {
      source: "iana",
      extensions: ["hbci"]
    },
    "application/vnd.hc+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hcl-bireports": {
      source: "iana"
    },
    "application/vnd.hdt": {
      source: "iana"
    },
    "application/vnd.heroku+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hhe.lesson-player": {
      source: "iana",
      extensions: ["les"]
    },
    "application/vnd.hl7cda+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.hl7v2+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.hp-hpgl": {
      source: "iana",
      extensions: ["hpgl"]
    },
    "application/vnd.hp-hpid": {
      source: "iana",
      extensions: ["hpid"]
    },
    "application/vnd.hp-hps": {
      source: "iana",
      extensions: ["hps"]
    },
    "application/vnd.hp-jlyt": {
      source: "iana",
      extensions: ["jlt"]
    },
    "application/vnd.hp-pcl": {
      source: "iana",
      extensions: ["pcl"]
    },
    "application/vnd.hp-pclxl": {
      source: "iana",
      extensions: ["pclxl"]
    },
    "application/vnd.httphone": {
      source: "iana"
    },
    "application/vnd.hydrostatix.sof-data": {
      source: "iana",
      extensions: ["sfd-hdstx"]
    },
    "application/vnd.hyper+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hyper-item+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hyperdrive+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.hzn-3d-crossword": {
      source: "iana"
    },
    "application/vnd.ibm.afplinedata": {
      source: "iana"
    },
    "application/vnd.ibm.electronic-media": {
      source: "iana"
    },
    "application/vnd.ibm.minipay": {
      source: "iana",
      extensions: ["mpy"]
    },
    "application/vnd.ibm.modcap": {
      source: "iana",
      extensions: ["afp", "listafp", "list3820"]
    },
    "application/vnd.ibm.rights-management": {
      source: "iana",
      extensions: ["irm"]
    },
    "application/vnd.ibm.secure-container": {
      source: "iana",
      extensions: ["sc"]
    },
    "application/vnd.iccprofile": {
      source: "iana",
      extensions: ["icc", "icm"]
    },
    "application/vnd.ieee.1905": {
      source: "iana"
    },
    "application/vnd.igloader": {
      source: "iana",
      extensions: ["igl"]
    },
    "application/vnd.imagemeter.folder+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.imagemeter.image+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.immervision-ivp": {
      source: "iana",
      extensions: ["ivp"]
    },
    "application/vnd.immervision-ivu": {
      source: "iana",
      extensions: ["ivu"]
    },
    "application/vnd.ims.imsccv1p1": {
      source: "iana"
    },
    "application/vnd.ims.imsccv1p2": {
      source: "iana"
    },
    "application/vnd.ims.imsccv1p3": {
      source: "iana"
    },
    "application/vnd.ims.lis.v2.result+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolconsumerprofile+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolproxy+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolproxy.id+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolsettings+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ims.lti.v2.toolsettings.simple+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.informedcontrol.rms+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.informix-visionary": {
      source: "iana"
    },
    "application/vnd.infotech.project": {
      source: "iana"
    },
    "application/vnd.infotech.project+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.innopath.wamp.notification": {
      source: "iana"
    },
    "application/vnd.insors.igm": {
      source: "iana",
      extensions: ["igm"]
    },
    "application/vnd.intercon.formnet": {
      source: "iana",
      extensions: ["xpw", "xpx"]
    },
    "application/vnd.intergeo": {
      source: "iana",
      extensions: ["i2g"]
    },
    "application/vnd.intertrust.digibox": {
      source: "iana"
    },
    "application/vnd.intertrust.nncp": {
      source: "iana"
    },
    "application/vnd.intu.qbo": {
      source: "iana",
      extensions: ["qbo"]
    },
    "application/vnd.intu.qfx": {
      source: "iana",
      extensions: ["qfx"]
    },
    "application/vnd.iptc.g2.catalogitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.conceptitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.knowledgeitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.newsitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.newsmessage+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.packageitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.iptc.g2.planningitem+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ipunplugged.rcprofile": {
      source: "iana",
      extensions: ["rcprofile"]
    },
    "application/vnd.irepository.package+xml": {
      source: "iana",
      compressible: true,
      extensions: ["irp"]
    },
    "application/vnd.is-xpr": {
      source: "iana",
      extensions: ["xpr"]
    },
    "application/vnd.isac.fcs": {
      source: "iana",
      extensions: ["fcs"]
    },
    "application/vnd.iso11783-10+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.jam": {
      source: "iana",
      extensions: ["jam"]
    },
    "application/vnd.japannet-directory-service": {
      source: "iana"
    },
    "application/vnd.japannet-jpnstore-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-payment-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-registration": {
      source: "iana"
    },
    "application/vnd.japannet-registration-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-setstore-wakeup": {
      source: "iana"
    },
    "application/vnd.japannet-verification": {
      source: "iana"
    },
    "application/vnd.japannet-verification-wakeup": {
      source: "iana"
    },
    "application/vnd.jcp.javame.midlet-rms": {
      source: "iana",
      extensions: ["rms"]
    },
    "application/vnd.jisp": {
      source: "iana",
      extensions: ["jisp"]
    },
    "application/vnd.joost.joda-archive": {
      source: "iana",
      extensions: ["joda"]
    },
    "application/vnd.jsk.isdn-ngn": {
      source: "iana"
    },
    "application/vnd.kahootz": {
      source: "iana",
      extensions: ["ktz", "ktr"]
    },
    "application/vnd.kde.karbon": {
      source: "iana",
      extensions: ["karbon"]
    },
    "application/vnd.kde.kchart": {
      source: "iana",
      extensions: ["chrt"]
    },
    "application/vnd.kde.kformula": {
      source: "iana",
      extensions: ["kfo"]
    },
    "application/vnd.kde.kivio": {
      source: "iana",
      extensions: ["flw"]
    },
    "application/vnd.kde.kontour": {
      source: "iana",
      extensions: ["kon"]
    },
    "application/vnd.kde.kpresenter": {
      source: "iana",
      extensions: ["kpr", "kpt"]
    },
    "application/vnd.kde.kspread": {
      source: "iana",
      extensions: ["ksp"]
    },
    "application/vnd.kde.kword": {
      source: "iana",
      extensions: ["kwd", "kwt"]
    },
    "application/vnd.kenameaapp": {
      source: "iana",
      extensions: ["htke"]
    },
    "application/vnd.kidspiration": {
      source: "iana",
      extensions: ["kia"]
    },
    "application/vnd.kinar": {
      source: "iana",
      extensions: ["kne", "knp"]
    },
    "application/vnd.koan": {
      source: "iana",
      extensions: ["skp", "skd", "skt", "skm"]
    },
    "application/vnd.kodak-descriptor": {
      source: "iana",
      extensions: ["sse"]
    },
    "application/vnd.las": {
      source: "iana"
    },
    "application/vnd.las.las+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.las.las+xml": {
      source: "iana",
      compressible: true,
      extensions: ["lasxml"]
    },
    "application/vnd.laszip": {
      source: "iana"
    },
    "application/vnd.leap+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.liberty-request+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.llamagraphics.life-balance.desktop": {
      source: "iana",
      extensions: ["lbd"]
    },
    "application/vnd.llamagraphics.life-balance.exchange+xml": {
      source: "iana",
      compressible: true,
      extensions: ["lbe"]
    },
    "application/vnd.logipipe.circuit+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.loom": {
      source: "iana"
    },
    "application/vnd.lotus-1-2-3": {
      source: "iana",
      extensions: ["123"]
    },
    "application/vnd.lotus-approach": {
      source: "iana",
      extensions: ["apr"]
    },
    "application/vnd.lotus-freelance": {
      source: "iana",
      extensions: ["pre"]
    },
    "application/vnd.lotus-notes": {
      source: "iana",
      extensions: ["nsf"]
    },
    "application/vnd.lotus-organizer": {
      source: "iana",
      extensions: ["org"]
    },
    "application/vnd.lotus-screencam": {
      source: "iana",
      extensions: ["scm"]
    },
    "application/vnd.lotus-wordpro": {
      source: "iana",
      extensions: ["lwp"]
    },
    "application/vnd.macports.portpkg": {
      source: "iana",
      extensions: ["portpkg"]
    },
    "application/vnd.mapbox-vector-tile": {
      source: "iana",
      extensions: ["mvt"]
    },
    "application/vnd.marlin.drm.actiontoken+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.marlin.drm.conftoken+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.marlin.drm.license+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.marlin.drm.mdcf": {
      source: "iana"
    },
    "application/vnd.mason+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.maxar.archive.3tz+zip": {
      source: "iana",
      compressible: false
    },
    "application/vnd.maxmind.maxmind-db": {
      source: "iana"
    },
    "application/vnd.mcd": {
      source: "iana",
      extensions: ["mcd"]
    },
    "application/vnd.medcalcdata": {
      source: "iana",
      extensions: ["mc1"]
    },
    "application/vnd.mediastation.cdkey": {
      source: "iana",
      extensions: ["cdkey"]
    },
    "application/vnd.meridian-slingshot": {
      source: "iana"
    },
    "application/vnd.mfer": {
      source: "iana",
      extensions: ["mwf"]
    },
    "application/vnd.mfmp": {
      source: "iana",
      extensions: ["mfm"]
    },
    "application/vnd.micro+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.micrografx.flo": {
      source: "iana",
      extensions: ["flo"]
    },
    "application/vnd.micrografx.igx": {
      source: "iana",
      extensions: ["igx"]
    },
    "application/vnd.microsoft.portable-executable": {
      source: "iana"
    },
    "application/vnd.microsoft.windows.thumbnail-cache": {
      source: "iana"
    },
    "application/vnd.miele+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.mif": {
      source: "iana",
      extensions: ["mif"]
    },
    "application/vnd.minisoft-hp3000-save": {
      source: "iana"
    },
    "application/vnd.mitsubishi.misty-guard.trustweb": {
      source: "iana"
    },
    "application/vnd.mobius.daf": {
      source: "iana",
      extensions: ["daf"]
    },
    "application/vnd.mobius.dis": {
      source: "iana",
      extensions: ["dis"]
    },
    "application/vnd.mobius.mbk": {
      source: "iana",
      extensions: ["mbk"]
    },
    "application/vnd.mobius.mqy": {
      source: "iana",
      extensions: ["mqy"]
    },
    "application/vnd.mobius.msl": {
      source: "iana",
      extensions: ["msl"]
    },
    "application/vnd.mobius.plc": {
      source: "iana",
      extensions: ["plc"]
    },
    "application/vnd.mobius.txf": {
      source: "iana",
      extensions: ["txf"]
    },
    "application/vnd.mophun.application": {
      source: "iana",
      extensions: ["mpn"]
    },
    "application/vnd.mophun.certificate": {
      source: "iana",
      extensions: ["mpc"]
    },
    "application/vnd.motorola.flexsuite": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.adsi": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.fis": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.gotap": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.kmr": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.ttc": {
      source: "iana"
    },
    "application/vnd.motorola.flexsuite.wem": {
      source: "iana"
    },
    "application/vnd.motorola.iprm": {
      source: "iana"
    },
    "application/vnd.mozilla.xul+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xul"]
    },
    "application/vnd.ms-3mfdocument": {
      source: "iana"
    },
    "application/vnd.ms-artgalry": {
      source: "iana",
      extensions: ["cil"]
    },
    "application/vnd.ms-asf": {
      source: "iana"
    },
    "application/vnd.ms-cab-compressed": {
      source: "iana",
      extensions: ["cab"]
    },
    "application/vnd.ms-color.iccprofile": {
      source: "apache"
    },
    "application/vnd.ms-excel": {
      source: "iana",
      compressible: false,
      extensions: ["xls", "xlm", "xla", "xlc", "xlt", "xlw"]
    },
    "application/vnd.ms-excel.addin.macroenabled.12": {
      source: "iana",
      extensions: ["xlam"]
    },
    "application/vnd.ms-excel.sheet.binary.macroenabled.12": {
      source: "iana",
      extensions: ["xlsb"]
    },
    "application/vnd.ms-excel.sheet.macroenabled.12": {
      source: "iana",
      extensions: ["xlsm"]
    },
    "application/vnd.ms-excel.template.macroenabled.12": {
      source: "iana",
      extensions: ["xltm"]
    },
    "application/vnd.ms-fontobject": {
      source: "iana",
      compressible: true,
      extensions: ["eot"]
    },
    "application/vnd.ms-htmlhelp": {
      source: "iana",
      extensions: ["chm"]
    },
    "application/vnd.ms-ims": {
      source: "iana",
      extensions: ["ims"]
    },
    "application/vnd.ms-lrm": {
      source: "iana",
      extensions: ["lrm"]
    },
    "application/vnd.ms-office.activex+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ms-officetheme": {
      source: "iana",
      extensions: ["thmx"]
    },
    "application/vnd.ms-opentype": {
      source: "apache",
      compressible: true
    },
    "application/vnd.ms-outlook": {
      compressible: false,
      extensions: ["msg"]
    },
    "application/vnd.ms-package.obfuscated-opentype": {
      source: "apache"
    },
    "application/vnd.ms-pki.seccat": {
      source: "apache",
      extensions: ["cat"]
    },
    "application/vnd.ms-pki.stl": {
      source: "apache",
      extensions: ["stl"]
    },
    "application/vnd.ms-playready.initiator+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ms-powerpoint": {
      source: "iana",
      compressible: false,
      extensions: ["ppt", "pps", "pot"]
    },
    "application/vnd.ms-powerpoint.addin.macroenabled.12": {
      source: "iana",
      extensions: ["ppam"]
    },
    "application/vnd.ms-powerpoint.presentation.macroenabled.12": {
      source: "iana",
      extensions: ["pptm"]
    },
    "application/vnd.ms-powerpoint.slide.macroenabled.12": {
      source: "iana",
      extensions: ["sldm"]
    },
    "application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
      source: "iana",
      extensions: ["ppsm"]
    },
    "application/vnd.ms-powerpoint.template.macroenabled.12": {
      source: "iana",
      extensions: ["potm"]
    },
    "application/vnd.ms-printdevicecapabilities+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ms-printing.printticket+xml": {
      source: "apache",
      compressible: true
    },
    "application/vnd.ms-printschematicket+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ms-project": {
      source: "iana",
      extensions: ["mpp", "mpt"]
    },
    "application/vnd.ms-tnef": {
      source: "iana"
    },
    "application/vnd.ms-windows.devicepairing": {
      source: "iana"
    },
    "application/vnd.ms-windows.nwprinting.oob": {
      source: "iana"
    },
    "application/vnd.ms-windows.printerpairing": {
      source: "iana"
    },
    "application/vnd.ms-windows.wsd.oob": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.lic-chlg-req": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.lic-resp": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.meter-chlg-req": {
      source: "iana"
    },
    "application/vnd.ms-wmdrm.meter-resp": {
      source: "iana"
    },
    "application/vnd.ms-word.document.macroenabled.12": {
      source: "iana",
      extensions: ["docm"]
    },
    "application/vnd.ms-word.template.macroenabled.12": {
      source: "iana",
      extensions: ["dotm"]
    },
    "application/vnd.ms-works": {
      source: "iana",
      extensions: ["wps", "wks", "wcm", "wdb"]
    },
    "application/vnd.ms-wpl": {
      source: "iana",
      extensions: ["wpl"]
    },
    "application/vnd.ms-xpsdocument": {
      source: "iana",
      compressible: false,
      extensions: ["xps"]
    },
    "application/vnd.msa-disk-image": {
      source: "iana"
    },
    "application/vnd.mseq": {
      source: "iana",
      extensions: ["mseq"]
    },
    "application/vnd.msign": {
      source: "iana"
    },
    "application/vnd.multiad.creator": {
      source: "iana"
    },
    "application/vnd.multiad.creator.cif": {
      source: "iana"
    },
    "application/vnd.music-niff": {
      source: "iana"
    },
    "application/vnd.musician": {
      source: "iana",
      extensions: ["mus"]
    },
    "application/vnd.muvee.style": {
      source: "iana",
      extensions: ["msty"]
    },
    "application/vnd.mynfc": {
      source: "iana",
      extensions: ["taglet"]
    },
    "application/vnd.nacamar.ybrid+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.ncd.control": {
      source: "iana"
    },
    "application/vnd.ncd.reference": {
      source: "iana"
    },
    "application/vnd.nearst.inv+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nebumind.line": {
      source: "iana"
    },
    "application/vnd.nervana": {
      source: "iana"
    },
    "application/vnd.netfpx": {
      source: "iana"
    },
    "application/vnd.neurolanguage.nlu": {
      source: "iana",
      extensions: ["nlu"]
    },
    "application/vnd.nimn": {
      source: "iana"
    },
    "application/vnd.nintendo.nitro.rom": {
      source: "iana"
    },
    "application/vnd.nintendo.snes.rom": {
      source: "iana"
    },
    "application/vnd.nitf": {
      source: "iana",
      extensions: ["ntf", "nitf"]
    },
    "application/vnd.noblenet-directory": {
      source: "iana",
      extensions: ["nnd"]
    },
    "application/vnd.noblenet-sealer": {
      source: "iana",
      extensions: ["nns"]
    },
    "application/vnd.noblenet-web": {
      source: "iana",
      extensions: ["nnw"]
    },
    "application/vnd.nokia.catalogs": {
      source: "iana"
    },
    "application/vnd.nokia.conml+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.conml+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.iptv.config+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.isds-radio-presets": {
      source: "iana"
    },
    "application/vnd.nokia.landmark+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.landmark+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.landmarkcollection+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.n-gage.ac+xml": {
      source: "iana",
      compressible: true,
      extensions: ["ac"]
    },
    "application/vnd.nokia.n-gage.data": {
      source: "iana",
      extensions: ["ngdat"]
    },
    "application/vnd.nokia.n-gage.symbian.install": {
      source: "iana",
      extensions: ["n-gage"]
    },
    "application/vnd.nokia.ncd": {
      source: "iana"
    },
    "application/vnd.nokia.pcd+wbxml": {
      source: "iana"
    },
    "application/vnd.nokia.pcd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.nokia.radio-preset": {
      source: "iana",
      extensions: ["rpst"]
    },
    "application/vnd.nokia.radio-presets": {
      source: "iana",
      extensions: ["rpss"]
    },
    "application/vnd.novadigm.edm": {
      source: "iana",
      extensions: ["edm"]
    },
    "application/vnd.novadigm.edx": {
      source: "iana",
      extensions: ["edx"]
    },
    "application/vnd.novadigm.ext": {
      source: "iana",
      extensions: ["ext"]
    },
    "application/vnd.ntt-local.content-share": {
      source: "iana"
    },
    "application/vnd.ntt-local.file-transfer": {
      source: "iana"
    },
    "application/vnd.ntt-local.ogw_remote-access": {
      source: "iana"
    },
    "application/vnd.ntt-local.sip-ta_remote": {
      source: "iana"
    },
    "application/vnd.ntt-local.sip-ta_tcp_stream": {
      source: "iana"
    },
    "application/vnd.oasis.opendocument.chart": {
      source: "iana",
      extensions: ["odc"]
    },
    "application/vnd.oasis.opendocument.chart-template": {
      source: "iana",
      extensions: ["otc"]
    },
    "application/vnd.oasis.opendocument.database": {
      source: "iana",
      extensions: ["odb"]
    },
    "application/vnd.oasis.opendocument.formula": {
      source: "iana",
      extensions: ["odf"]
    },
    "application/vnd.oasis.opendocument.formula-template": {
      source: "iana",
      extensions: ["odft"]
    },
    "application/vnd.oasis.opendocument.graphics": {
      source: "iana",
      compressible: false,
      extensions: ["odg"]
    },
    "application/vnd.oasis.opendocument.graphics-template": {
      source: "iana",
      extensions: ["otg"]
    },
    "application/vnd.oasis.opendocument.image": {
      source: "iana",
      extensions: ["odi"]
    },
    "application/vnd.oasis.opendocument.image-template": {
      source: "iana",
      extensions: ["oti"]
    },
    "application/vnd.oasis.opendocument.presentation": {
      source: "iana",
      compressible: false,
      extensions: ["odp"]
    },
    "application/vnd.oasis.opendocument.presentation-template": {
      source: "iana",
      extensions: ["otp"]
    },
    "application/vnd.oasis.opendocument.spreadsheet": {
      source: "iana",
      compressible: false,
      extensions: ["ods"]
    },
    "application/vnd.oasis.opendocument.spreadsheet-template": {
      source: "iana",
      extensions: ["ots"]
    },
    "application/vnd.oasis.opendocument.text": {
      source: "iana",
      compressible: false,
      extensions: ["odt"]
    },
    "application/vnd.oasis.opendocument.text-master": {
      source: "iana",
      extensions: ["odm"]
    },
    "application/vnd.oasis.opendocument.text-template": {
      source: "iana",
      extensions: ["ott"]
    },
    "application/vnd.oasis.opendocument.text-web": {
      source: "iana",
      extensions: ["oth"]
    },
    "application/vnd.obn": {
      source: "iana"
    },
    "application/vnd.ocf+cbor": {
      source: "iana"
    },
    "application/vnd.oci.image.manifest.v1+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oftn.l10n+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.contentaccessdownload+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.contentaccessstreaming+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.cspg-hexbinary": {
      source: "iana"
    },
    "application/vnd.oipf.dae.svg+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.dae.xhtml+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.mippvcontrolmessage+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.pae.gem": {
      source: "iana"
    },
    "application/vnd.oipf.spdiscovery+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.spdlist+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.ueprofile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oipf.userprofile+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.olpc-sugar": {
      source: "iana",
      extensions: ["xo"]
    },
    "application/vnd.oma-scws-config": {
      source: "iana"
    },
    "application/vnd.oma-scws-http-request": {
      source: "iana"
    },
    "application/vnd.oma-scws-http-response": {
      source: "iana"
    },
    "application/vnd.oma.bcast.associated-procedure-parameter+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.drm-trigger+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.imd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.ltkm": {
      source: "iana"
    },
    "application/vnd.oma.bcast.notification+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.provisioningtrigger": {
      source: "iana"
    },
    "application/vnd.oma.bcast.sgboot": {
      source: "iana"
    },
    "application/vnd.oma.bcast.sgdd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.sgdu": {
      source: "iana"
    },
    "application/vnd.oma.bcast.simple-symbol-container": {
      source: "iana"
    },
    "application/vnd.oma.bcast.smartcard-trigger+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.sprov+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.bcast.stkm": {
      source: "iana"
    },
    "application/vnd.oma.cab-address-book+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.cab-feature-handler+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.cab-pcc+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.cab-subs-invite+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.cab-user-prefs+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.dcd": {
      source: "iana"
    },
    "application/vnd.oma.dcdc": {
      source: "iana"
    },
    "application/vnd.oma.dd2+xml": {
      source: "iana",
      compressible: true,
      extensions: ["dd2"]
    },
    "application/vnd.oma.drm.risd+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.group-usage-list+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.lwm2m+cbor": {
      source: "iana"
    },
    "application/vnd.oma.lwm2m+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.lwm2m+tlv": {
      source: "iana"
    },
    "application/vnd.oma.pal+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.detailed-progress-report+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.final-report+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.groups+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.invocation-descriptor+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.poc.optimized-progress-report+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.push": {
      source: "iana"
    },
    "application/vnd.oma.scidm.messages+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oma.xcap-directory+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.omads-email+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.omads-file+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.omads-folder+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.omaloc-supl-init": {
      source: "iana"
    },
    "application/vnd.onepager": {
      source: "iana"
    },
    "application/vnd.onepagertamp": {
      source: "iana"
    },
    "application/vnd.onepagertamx": {
      source: "iana"
    },
    "application/vnd.onepagertat": {
      source: "iana"
    },
    "application/vnd.onepagertatp": {
      source: "iana"
    },
    "application/vnd.onepagertatx": {
      source: "iana"
    },
    "application/vnd.openblox.game+xml": {
      source: "iana",
      compressible: true,
      extensions: ["obgx"]
    },
    "application/vnd.openblox.game-binary": {
      source: "iana"
    },
    "application/vnd.openeye.oeb": {
      source: "iana"
    },
    "application/vnd.openofficeorg.extension": {
      source: "apache",
      extensions: ["oxt"]
    },
    "application/vnd.openstreetmap.data+xml": {
      source: "iana",
      compressible: true,
      extensions: ["osm"]
    },
    "application/vnd.opentimestamps.ots": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.custom-properties+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawing+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.extended-properties+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.comments+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      source: "iana",
      compressible: false,
      extensions: ["pptx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slide": {
      source: "iana",
      extensions: ["sldx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
      source: "iana",
      extensions: ["ppsx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.template": {
      source: "iana",
      extensions: ["potx"]
    },
    "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      source: "iana",
      compressible: false,
      extensions: ["xlsx"]
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
      source: "iana",
      extensions: ["xltx"]
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.theme+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.themeoverride+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.vmldrawing": {
      source: "iana"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      source: "iana",
      compressible: false,
      extensions: ["docx"]
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
      source: "iana",
      extensions: ["dotx"]
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-package.core-properties+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.openxmlformats-package.relationships+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oracle.resource+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.orange.indata": {
      source: "iana"
    },
    "application/vnd.osa.netdeploy": {
      source: "iana"
    },
    "application/vnd.osgeo.mapguide.package": {
      source: "iana",
      extensions: ["mgp"]
    },
    "application/vnd.osgi.bundle": {
      source: "iana"
    },
    "application/vnd.osgi.dp": {
      source: "iana",
      extensions: ["dp"]
    },
    "application/vnd.osgi.subsystem": {
      source: "iana",
      extensions: ["esa"]
    },
    "application/vnd.otps.ct-kip+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.oxli.countgraph": {
      source: "iana"
    },
    "application/vnd.pagerduty+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.palm": {
      source: "iana",
      extensions: ["pdb", "pqa", "oprc"]
    },
    "application/vnd.panoply": {
      source: "iana"
    },
    "application/vnd.paos.xml": {
      source: "iana"
    },
    "application/vnd.patentdive": {
      source: "iana"
    },
    "application/vnd.patientecommsdoc": {
      source: "iana"
    },
    "application/vnd.pawaafile": {
      source: "iana",
      extensions: ["paw"]
    },
    "application/vnd.pcos": {
      source: "iana"
    },
    "application/vnd.pg.format": {
      source: "iana",
      extensions: ["str"]
    },
    "application/vnd.pg.osasli": {
      source: "iana",
      extensions: ["ei6"]
    },
    "application/vnd.piaccess.application-licence": {
      source: "iana"
    },
    "application/vnd.picsel": {
      source: "iana",
      extensions: ["efif"]
    },
    "application/vnd.pmi.widget": {
      source: "iana",
      extensions: ["wg"]
    },
    "application/vnd.poc.group-advertisement+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.pocketlearn": {
      source: "iana",
      extensions: ["plf"]
    },
    "application/vnd.powerbuilder6": {
      source: "iana",
      extensions: ["pbd"]
    },
    "application/vnd.powerbuilder6-s": {
      source: "iana"
    },
    "application/vnd.powerbuilder7": {
      source: "iana"
    },
    "application/vnd.powerbuilder7-s": {
      source: "iana"
    },
    "application/vnd.powerbuilder75": {
      source: "iana"
    },
    "application/vnd.powerbuilder75-s": {
      source: "iana"
    },
    "application/vnd.preminet": {
      source: "iana"
    },
    "application/vnd.previewsystems.box": {
      source: "iana",
      extensions: ["box"]
    },
    "application/vnd.proteus.magazine": {
      source: "iana",
      extensions: ["mgz"]
    },
    "application/vnd.psfs": {
      source: "iana"
    },
    "application/vnd.publishare-delta-tree": {
      source: "iana",
      extensions: ["qps"]
    },
    "application/vnd.pvi.ptid1": {
      source: "iana",
      extensions: ["ptid"]
    },
    "application/vnd.pwg-multiplexed": {
      source: "iana"
    },
    "application/vnd.pwg-xhtml-print+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.qualcomm.brew-app-res": {
      source: "iana"
    },
    "application/vnd.quarantainenet": {
      source: "iana"
    },
    "application/vnd.quark.quarkxpress": {
      source: "iana",
      extensions: ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"]
    },
    "application/vnd.quobject-quoxdocument": {
      source: "iana"
    },
    "application/vnd.radisys.moml+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit-conf+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit-conn+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit-dialog+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-audit-stream+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-conf+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-base+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-fax-detect+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-group+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-speech+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.radisys.msml-dialog-transform+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.rainstor.data": {
      source: "iana"
    },
    "application/vnd.rapid": {
      source: "iana"
    },
    "application/vnd.rar": {
      source: "iana",
      extensions: ["rar"]
    },
    "application/vnd.realvnc.bed": {
      source: "iana",
      extensions: ["bed"]
    },
    "application/vnd.recordare.musicxml": {
      source: "iana",
      extensions: ["mxl"]
    },
    "application/vnd.recordare.musicxml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["musicxml"]
    },
    "application/vnd.renlearn.rlprint": {
      source: "iana"
    },
    "application/vnd.resilient.logic": {
      source: "iana"
    },
    "application/vnd.restful+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.rig.cryptonote": {
      source: "iana",
      extensions: ["cryptonote"]
    },
    "application/vnd.rim.cod": {
      source: "apache",
      extensions: ["cod"]
    },
    "application/vnd.rn-realmedia": {
      source: "apache",
      extensions: ["rm"]
    },
    "application/vnd.rn-realmedia-vbr": {
      source: "apache",
      extensions: ["rmvb"]
    },
    "application/vnd.route66.link66+xml": {
      source: "iana",
      compressible: true,
      extensions: ["link66"]
    },
    "application/vnd.rs-274x": {
      source: "iana"
    },
    "application/vnd.ruckus.download": {
      source: "iana"
    },
    "application/vnd.s3sms": {
      source: "iana"
    },
    "application/vnd.sailingtracker.track": {
      source: "iana",
      extensions: ["st"]
    },
    "application/vnd.sar": {
      source: "iana"
    },
    "application/vnd.sbm.cid": {
      source: "iana"
    },
    "application/vnd.sbm.mid2": {
      source: "iana"
    },
    "application/vnd.scribus": {
      source: "iana"
    },
    "application/vnd.sealed.3df": {
      source: "iana"
    },
    "application/vnd.sealed.csf": {
      source: "iana"
    },
    "application/vnd.sealed.doc": {
      source: "iana"
    },
    "application/vnd.sealed.eml": {
      source: "iana"
    },
    "application/vnd.sealed.mht": {
      source: "iana"
    },
    "application/vnd.sealed.net": {
      source: "iana"
    },
    "application/vnd.sealed.ppt": {
      source: "iana"
    },
    "application/vnd.sealed.tiff": {
      source: "iana"
    },
    "application/vnd.sealed.xls": {
      source: "iana"
    },
    "application/vnd.sealedmedia.softseal.html": {
      source: "iana"
    },
    "application/vnd.sealedmedia.softseal.pdf": {
      source: "iana"
    },
    "application/vnd.seemail": {
      source: "iana",
      extensions: ["see"]
    },
    "application/vnd.seis+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.sema": {
      source: "iana",
      extensions: ["sema"]
    },
    "application/vnd.semd": {
      source: "iana",
      extensions: ["semd"]
    },
    "application/vnd.semf": {
      source: "iana",
      extensions: ["semf"]
    },
    "application/vnd.shade-save-file": {
      source: "iana"
    },
    "application/vnd.shana.informed.formdata": {
      source: "iana",
      extensions: ["ifm"]
    },
    "application/vnd.shana.informed.formtemplate": {
      source: "iana",
      extensions: ["itp"]
    },
    "application/vnd.shana.informed.interchange": {
      source: "iana",
      extensions: ["iif"]
    },
    "application/vnd.shana.informed.package": {
      source: "iana",
      extensions: ["ipk"]
    },
    "application/vnd.shootproof+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.shopkick+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.shp": {
      source: "iana"
    },
    "application/vnd.shx": {
      source: "iana"
    },
    "application/vnd.sigrok.session": {
      source: "iana"
    },
    "application/vnd.simtech-mindmapper": {
      source: "iana",
      extensions: ["twd", "twds"]
    },
    "application/vnd.siren+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.smaf": {
      source: "iana",
      extensions: ["mmf"]
    },
    "application/vnd.smart.notebook": {
      source: "iana"
    },
    "application/vnd.smart.teacher": {
      source: "iana",
      extensions: ["teacher"]
    },
    "application/vnd.snesdev-page-table": {
      source: "iana"
    },
    "application/vnd.software602.filler.form+xml": {
      source: "iana",
      compressible: true,
      extensions: ["fo"]
    },
    "application/vnd.software602.filler.form-xml-zip": {
      source: "iana"
    },
    "application/vnd.solent.sdkm+xml": {
      source: "iana",
      compressible: true,
      extensions: ["sdkm", "sdkd"]
    },
    "application/vnd.spotfire.dxp": {
      source: "iana",
      extensions: ["dxp"]
    },
    "application/vnd.spotfire.sfs": {
      source: "iana",
      extensions: ["sfs"]
    },
    "application/vnd.sqlite3": {
      source: "iana"
    },
    "application/vnd.sss-cod": {
      source: "iana"
    },
    "application/vnd.sss-dtf": {
      source: "iana"
    },
    "application/vnd.sss-ntf": {
      source: "iana"
    },
    "application/vnd.stardivision.calc": {
      source: "apache",
      extensions: ["sdc"]
    },
    "application/vnd.stardivision.draw": {
      source: "apache",
      extensions: ["sda"]
    },
    "application/vnd.stardivision.impress": {
      source: "apache",
      extensions: ["sdd"]
    },
    "application/vnd.stardivision.math": {
      source: "apache",
      extensions: ["smf"]
    },
    "application/vnd.stardivision.writer": {
      source: "apache",
      extensions: ["sdw", "vor"]
    },
    "application/vnd.stardivision.writer-global": {
      source: "apache",
      extensions: ["sgl"]
    },
    "application/vnd.stepmania.package": {
      source: "iana",
      extensions: ["smzip"]
    },
    "application/vnd.stepmania.stepchart": {
      source: "iana",
      extensions: ["sm"]
    },
    "application/vnd.street-stream": {
      source: "iana"
    },
    "application/vnd.sun.wadl+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wadl"]
    },
    "application/vnd.sun.xml.calc": {
      source: "apache",
      extensions: ["sxc"]
    },
    "application/vnd.sun.xml.calc.template": {
      source: "apache",
      extensions: ["stc"]
    },
    "application/vnd.sun.xml.draw": {
      source: "apache",
      extensions: ["sxd"]
    },
    "application/vnd.sun.xml.draw.template": {
      source: "apache",
      extensions: ["std"]
    },
    "application/vnd.sun.xml.impress": {
      source: "apache",
      extensions: ["sxi"]
    },
    "application/vnd.sun.xml.impress.template": {
      source: "apache",
      extensions: ["sti"]
    },
    "application/vnd.sun.xml.math": {
      source: "apache",
      extensions: ["sxm"]
    },
    "application/vnd.sun.xml.writer": {
      source: "apache",
      extensions: ["sxw"]
    },
    "application/vnd.sun.xml.writer.global": {
      source: "apache",
      extensions: ["sxg"]
    },
    "application/vnd.sun.xml.writer.template": {
      source: "apache",
      extensions: ["stw"]
    },
    "application/vnd.sus-calendar": {
      source: "iana",
      extensions: ["sus", "susp"]
    },
    "application/vnd.svd": {
      source: "iana",
      extensions: ["svd"]
    },
    "application/vnd.swiftview-ics": {
      source: "iana"
    },
    "application/vnd.sycle+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.syft+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.symbian.install": {
      source: "apache",
      extensions: ["sis", "sisx"]
    },
    "application/vnd.syncml+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["xsm"]
    },
    "application/vnd.syncml.dm+wbxml": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["bdm"]
    },
    "application/vnd.syncml.dm+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["xdm"]
    },
    "application/vnd.syncml.dm.notification": {
      source: "iana"
    },
    "application/vnd.syncml.dmddf+wbxml": {
      source: "iana"
    },
    "application/vnd.syncml.dmddf+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["ddf"]
    },
    "application/vnd.syncml.dmtnds+wbxml": {
      source: "iana"
    },
    "application/vnd.syncml.dmtnds+xml": {
      source: "iana",
      charset: "UTF-8",
      compressible: true
    },
    "application/vnd.syncml.ds.notification": {
      source: "iana"
    },
    "application/vnd.tableschema+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.tao.intent-module-archive": {
      source: "iana",
      extensions: ["tao"]
    },
    "application/vnd.tcpdump.pcap": {
      source: "iana",
      extensions: ["pcap", "cap", "dmp"]
    },
    "application/vnd.think-cell.ppttc+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.tmd.mediaflex.api+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.tml": {
      source: "iana"
    },
    "application/vnd.tmobile-livetv": {
      source: "iana",
      extensions: ["tmo"]
    },
    "application/vnd.tri.onesource": {
      source: "iana"
    },
    "application/vnd.trid.tpt": {
      source: "iana",
      extensions: ["tpt"]
    },
    "application/vnd.triscape.mxs": {
      source: "iana",
      extensions: ["mxs"]
    },
    "application/vnd.trueapp": {
      source: "iana",
      extensions: ["tra"]
    },
    "application/vnd.truedoc": {
      source: "iana"
    },
    "application/vnd.ubisoft.webplayer": {
      source: "iana"
    },
    "application/vnd.ufdl": {
      source: "iana",
      extensions: ["ufd", "ufdl"]
    },
    "application/vnd.uiq.theme": {
      source: "iana",
      extensions: ["utz"]
    },
    "application/vnd.umajin": {
      source: "iana",
      extensions: ["umj"]
    },
    "application/vnd.unity": {
      source: "iana",
      extensions: ["unityweb"]
    },
    "application/vnd.uoml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["uoml"]
    },
    "application/vnd.uplanet.alert": {
      source: "iana"
    },
    "application/vnd.uplanet.alert-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.bearer-choice": {
      source: "iana"
    },
    "application/vnd.uplanet.bearer-choice-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.cacheop": {
      source: "iana"
    },
    "application/vnd.uplanet.cacheop-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.channel": {
      source: "iana"
    },
    "application/vnd.uplanet.channel-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.list": {
      source: "iana"
    },
    "application/vnd.uplanet.list-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.listcmd": {
      source: "iana"
    },
    "application/vnd.uplanet.listcmd-wbxml": {
      source: "iana"
    },
    "application/vnd.uplanet.signal": {
      source: "iana"
    },
    "application/vnd.uri-map": {
      source: "iana"
    },
    "application/vnd.valve.source.material": {
      source: "iana"
    },
    "application/vnd.vcx": {
      source: "iana",
      extensions: ["vcx"]
    },
    "application/vnd.vd-study": {
      source: "iana"
    },
    "application/vnd.vectorworks": {
      source: "iana"
    },
    "application/vnd.vel+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.verimatrix.vcas": {
      source: "iana"
    },
    "application/vnd.veritone.aion+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.veryant.thin": {
      source: "iana"
    },
    "application/vnd.ves.encrypted": {
      source: "iana"
    },
    "application/vnd.vidsoft.vidconference": {
      source: "iana"
    },
    "application/vnd.visio": {
      source: "iana",
      extensions: ["vsd", "vst", "vss", "vsw"]
    },
    "application/vnd.visionary": {
      source: "iana",
      extensions: ["vis"]
    },
    "application/vnd.vividence.scriptfile": {
      source: "iana"
    },
    "application/vnd.vsf": {
      source: "iana",
      extensions: ["vsf"]
    },
    "application/vnd.wap.sic": {
      source: "iana"
    },
    "application/vnd.wap.slc": {
      source: "iana"
    },
    "application/vnd.wap.wbxml": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["wbxml"]
    },
    "application/vnd.wap.wmlc": {
      source: "iana",
      extensions: ["wmlc"]
    },
    "application/vnd.wap.wmlscriptc": {
      source: "iana",
      extensions: ["wmlsc"]
    },
    "application/vnd.webturbo": {
      source: "iana",
      extensions: ["wtb"]
    },
    "application/vnd.wfa.dpp": {
      source: "iana"
    },
    "application/vnd.wfa.p2p": {
      source: "iana"
    },
    "application/vnd.wfa.wsc": {
      source: "iana"
    },
    "application/vnd.windows.devicepairing": {
      source: "iana"
    },
    "application/vnd.wmc": {
      source: "iana"
    },
    "application/vnd.wmf.bootstrap": {
      source: "iana"
    },
    "application/vnd.wolfram.mathematica": {
      source: "iana"
    },
    "application/vnd.wolfram.mathematica.package": {
      source: "iana"
    },
    "application/vnd.wolfram.player": {
      source: "iana",
      extensions: ["nbp"]
    },
    "application/vnd.wordperfect": {
      source: "iana",
      extensions: ["wpd"]
    },
    "application/vnd.wqd": {
      source: "iana",
      extensions: ["wqd"]
    },
    "application/vnd.wrq-hp3000-labelled": {
      source: "iana"
    },
    "application/vnd.wt.stf": {
      source: "iana",
      extensions: ["stf"]
    },
    "application/vnd.wv.csp+wbxml": {
      source: "iana"
    },
    "application/vnd.wv.csp+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.wv.ssp+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.xacml+json": {
      source: "iana",
      compressible: true
    },
    "application/vnd.xara": {
      source: "iana",
      extensions: ["xar"]
    },
    "application/vnd.xfdl": {
      source: "iana",
      extensions: ["xfdl"]
    },
    "application/vnd.xfdl.webform": {
      source: "iana"
    },
    "application/vnd.xmi+xml": {
      source: "iana",
      compressible: true
    },
    "application/vnd.xmpie.cpkg": {
      source: "iana"
    },
    "application/vnd.xmpie.dpkg": {
      source: "iana"
    },
    "application/vnd.xmpie.plan": {
      source: "iana"
    },
    "application/vnd.xmpie.ppkg": {
      source: "iana"
    },
    "application/vnd.xmpie.xlim": {
      source: "iana"
    },
    "application/vnd.yamaha.hv-dic": {
      source: "iana",
      extensions: ["hvd"]
    },
    "application/vnd.yamaha.hv-script": {
      source: "iana",
      extensions: ["hvs"]
    },
    "application/vnd.yamaha.hv-voice": {
      source: "iana",
      extensions: ["hvp"]
    },
    "application/vnd.yamaha.openscoreformat": {
      source: "iana",
      extensions: ["osf"]
    },
    "application/vnd.yamaha.openscoreformat.osfpvg+xml": {
      source: "iana",
      compressible: true,
      extensions: ["osfpvg"]
    },
    "application/vnd.yamaha.remote-setup": {
      source: "iana"
    },
    "application/vnd.yamaha.smaf-audio": {
      source: "iana",
      extensions: ["saf"]
    },
    "application/vnd.yamaha.smaf-phrase": {
      source: "iana",
      extensions: ["spf"]
    },
    "application/vnd.yamaha.through-ngn": {
      source: "iana"
    },
    "application/vnd.yamaha.tunnel-udpencap": {
      source: "iana"
    },
    "application/vnd.yaoweme": {
      source: "iana"
    },
    "application/vnd.yellowriver-custom-menu": {
      source: "iana",
      extensions: ["cmp"]
    },
    "application/vnd.youtube.yt": {
      source: "iana"
    },
    "application/vnd.zul": {
      source: "iana",
      extensions: ["zir", "zirz"]
    },
    "application/vnd.zzazz.deck+xml": {
      source: "iana",
      compressible: true,
      extensions: ["zaz"]
    },
    "application/voicexml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["vxml"]
    },
    "application/voucher-cms+json": {
      source: "iana",
      compressible: true
    },
    "application/vq-rtcpxr": {
      source: "iana"
    },
    "application/wasm": {
      source: "iana",
      compressible: true,
      extensions: ["wasm"]
    },
    "application/watcherinfo+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wif"]
    },
    "application/webpush-options+json": {
      source: "iana",
      compressible: true
    },
    "application/whoispp-query": {
      source: "iana"
    },
    "application/whoispp-response": {
      source: "iana"
    },
    "application/widget": {
      source: "iana",
      extensions: ["wgt"]
    },
    "application/winhlp": {
      source: "apache",
      extensions: ["hlp"]
    },
    "application/wita": {
      source: "iana"
    },
    "application/wordperfect5.1": {
      source: "iana"
    },
    "application/wsdl+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wsdl"]
    },
    "application/wspolicy+xml": {
      source: "iana",
      compressible: true,
      extensions: ["wspolicy"]
    },
    "application/x-7z-compressed": {
      source: "apache",
      compressible: false,
      extensions: ["7z"]
    },
    "application/x-abiword": {
      source: "apache",
      extensions: ["abw"]
    },
    "application/x-ace-compressed": {
      source: "apache",
      extensions: ["ace"]
    },
    "application/x-amf": {
      source: "apache"
    },
    "application/x-apple-diskimage": {
      source: "apache",
      extensions: ["dmg"]
    },
    "application/x-arj": {
      compressible: false,
      extensions: ["arj"]
    },
    "application/x-authorware-bin": {
      source: "apache",
      extensions: ["aab", "x32", "u32", "vox"]
    },
    "application/x-authorware-map": {
      source: "apache",
      extensions: ["aam"]
    },
    "application/x-authorware-seg": {
      source: "apache",
      extensions: ["aas"]
    },
    "application/x-bcpio": {
      source: "apache",
      extensions: ["bcpio"]
    },
    "application/x-bdoc": {
      compressible: false,
      extensions: ["bdoc"]
    },
    "application/x-bittorrent": {
      source: "apache",
      extensions: ["torrent"]
    },
    "application/x-blorb": {
      source: "apache",
      extensions: ["blb", "blorb"]
    },
    "application/x-bzip": {
      source: "apache",
      compressible: false,
      extensions: ["bz"]
    },
    "application/x-bzip2": {
      source: "apache",
      compressible: false,
      extensions: ["bz2", "boz"]
    },
    "application/x-cbr": {
      source: "apache",
      extensions: ["cbr", "cba", "cbt", "cbz", "cb7"]
    },
    "application/x-cdlink": {
      source: "apache",
      extensions: ["vcd"]
    },
    "application/x-cfs-compressed": {
      source: "apache",
      extensions: ["cfs"]
    },
    "application/x-chat": {
      source: "apache",
      extensions: ["chat"]
    },
    "application/x-chess-pgn": {
      source: "apache",
      extensions: ["pgn"]
    },
    "application/x-chrome-extension": {
      extensions: ["crx"]
    },
    "application/x-cocoa": {
      source: "nginx",
      extensions: ["cco"]
    },
    "application/x-compress": {
      source: "apache"
    },
    "application/x-conference": {
      source: "apache",
      extensions: ["nsc"]
    },
    "application/x-cpio": {
      source: "apache",
      extensions: ["cpio"]
    },
    "application/x-csh": {
      source: "apache",
      extensions: ["csh"]
    },
    "application/x-deb": {
      compressible: false
    },
    "application/x-debian-package": {
      source: "apache",
      extensions: ["deb", "udeb"]
    },
    "application/x-dgc-compressed": {
      source: "apache",
      extensions: ["dgc"]
    },
    "application/x-director": {
      source: "apache",
      extensions: ["dir", "dcr", "dxr", "cst", "cct", "cxt", "w3d", "fgd", "swa"]
    },
    "application/x-doom": {
      source: "apache",
      extensions: ["wad"]
    },
    "application/x-dtbncx+xml": {
      source: "apache",
      compressible: true,
      extensions: ["ncx"]
    },
    "application/x-dtbook+xml": {
      source: "apache",
      compressible: true,
      extensions: ["dtb"]
    },
    "application/x-dtbresource+xml": {
      source: "apache",
      compressible: true,
      extensions: ["res"]
    },
    "application/x-dvi": {
      source: "apache",
      compressible: false,
      extensions: ["dvi"]
    },
    "application/x-envoy": {
      source: "apache",
      extensions: ["evy"]
    },
    "application/x-eva": {
      source: "apache",
      extensions: ["eva"]
    },
    "application/x-font-bdf": {
      source: "apache",
      extensions: ["bdf"]
    },
    "application/x-font-dos": {
      source: "apache"
    },
    "application/x-font-framemaker": {
      source: "apache"
    },
    "application/x-font-ghostscript": {
      source: "apache",
      extensions: ["gsf"]
    },
    "application/x-font-libgrx": {
      source: "apache"
    },
    "application/x-font-linux-psf": {
      source: "apache",
      extensions: ["psf"]
    },
    "application/x-font-pcf": {
      source: "apache",
      extensions: ["pcf"]
    },
    "application/x-font-snf": {
      source: "apache",
      extensions: ["snf"]
    },
    "application/x-font-speedo": {
      source: "apache"
    },
    "application/x-font-sunos-news": {
      source: "apache"
    },
    "application/x-font-type1": {
      source: "apache",
      extensions: ["pfa", "pfb", "pfm", "afm"]
    },
    "application/x-font-vfont": {
      source: "apache"
    },
    "application/x-freearc": {
      source: "apache",
      extensions: ["arc"]
    },
    "application/x-futuresplash": {
      source: "apache",
      extensions: ["spl"]
    },
    "application/x-gca-compressed": {
      source: "apache",
      extensions: ["gca"]
    },
    "application/x-glulx": {
      source: "apache",
      extensions: ["ulx"]
    },
    "application/x-gnumeric": {
      source: "apache",
      extensions: ["gnumeric"]
    },
    "application/x-gramps-xml": {
      source: "apache",
      extensions: ["gramps"]
    },
    "application/x-gtar": {
      source: "apache",
      extensions: ["gtar"]
    },
    "application/x-gzip": {
      source: "apache"
    },
    "application/x-hdf": {
      source: "apache",
      extensions: ["hdf"]
    },
    "application/x-httpd-php": {
      compressible: true,
      extensions: ["php"]
    },
    "application/x-install-instructions": {
      source: "apache",
      extensions: ["install"]
    },
    "application/x-iso9660-image": {
      source: "apache",
      extensions: ["iso"]
    },
    "application/x-iwork-keynote-sffkey": {
      extensions: ["key"]
    },
    "application/x-iwork-numbers-sffnumbers": {
      extensions: ["numbers"]
    },
    "application/x-iwork-pages-sffpages": {
      extensions: ["pages"]
    },
    "application/x-java-archive-diff": {
      source: "nginx",
      extensions: ["jardiff"]
    },
    "application/x-java-jnlp-file": {
      source: "apache",
      compressible: false,
      extensions: ["jnlp"]
    },
    "application/x-javascript": {
      compressible: true
    },
    "application/x-keepass2": {
      extensions: ["kdbx"]
    },
    "application/x-latex": {
      source: "apache",
      compressible: false,
      extensions: ["latex"]
    },
    "application/x-lua-bytecode": {
      extensions: ["luac"]
    },
    "application/x-lzh-compressed": {
      source: "apache",
      extensions: ["lzh", "lha"]
    },
    "application/x-makeself": {
      source: "nginx",
      extensions: ["run"]
    },
    "application/x-mie": {
      source: "apache",
      extensions: ["mie"]
    },
    "application/x-mobipocket-ebook": {
      source: "apache",
      extensions: ["prc", "mobi"]
    },
    "application/x-mpegurl": {
      compressible: false
    },
    "application/x-ms-application": {
      source: "apache",
      extensions: ["application"]
    },
    "application/x-ms-shortcut": {
      source: "apache",
      extensions: ["lnk"]
    },
    "application/x-ms-wmd": {
      source: "apache",
      extensions: ["wmd"]
    },
    "application/x-ms-wmz": {
      source: "apache",
      extensions: ["wmz"]
    },
    "application/x-ms-xbap": {
      source: "apache",
      extensions: ["xbap"]
    },
    "application/x-msaccess": {
      source: "apache",
      extensions: ["mdb"]
    },
    "application/x-msbinder": {
      source: "apache",
      extensions: ["obd"]
    },
    "application/x-mscardfile": {
      source: "apache",
      extensions: ["crd"]
    },
    "application/x-msclip": {
      source: "apache",
      extensions: ["clp"]
    },
    "application/x-msdos-program": {
      extensions: ["exe"]
    },
    "application/x-msdownload": {
      source: "apache",
      extensions: ["exe", "dll", "com", "bat", "msi"]
    },
    "application/x-msmediaview": {
      source: "apache",
      extensions: ["mvb", "m13", "m14"]
    },
    "application/x-msmetafile": {
      source: "apache",
      extensions: ["wmf", "wmz", "emf", "emz"]
    },
    "application/x-msmoney": {
      source: "apache",
      extensions: ["mny"]
    },
    "application/x-mspublisher": {
      source: "apache",
      extensions: ["pub"]
    },
    "application/x-msschedule": {
      source: "apache",
      extensions: ["scd"]
    },
    "application/x-msterminal": {
      source: "apache",
      extensions: ["trm"]
    },
    "application/x-mswrite": {
      source: "apache",
      extensions: ["wri"]
    },
    "application/x-netcdf": {
      source: "apache",
      extensions: ["nc", "cdf"]
    },
    "application/x-ns-proxy-autoconfig": {
      compressible: true,
      extensions: ["pac"]
    },
    "application/x-nzb": {
      source: "apache",
      extensions: ["nzb"]
    },
    "application/x-perl": {
      source: "nginx",
      extensions: ["pl", "pm"]
    },
    "application/x-pilot": {
      source: "nginx",
      extensions: ["prc", "pdb"]
    },
    "application/x-pkcs12": {
      source: "apache",
      compressible: false,
      extensions: ["p12", "pfx"]
    },
    "application/x-pkcs7-certificates": {
      source: "apache",
      extensions: ["p7b", "spc"]
    },
    "application/x-pkcs7-certreqresp": {
      source: "apache",
      extensions: ["p7r"]
    },
    "application/x-pki-message": {
      source: "iana"
    },
    "application/x-rar-compressed": {
      source: "apache",
      compressible: false,
      extensions: ["rar"]
    },
    "application/x-redhat-package-manager": {
      source: "nginx",
      extensions: ["rpm"]
    },
    "application/x-research-info-systems": {
      source: "apache",
      extensions: ["ris"]
    },
    "application/x-sea": {
      source: "nginx",
      extensions: ["sea"]
    },
    "application/x-sh": {
      source: "apache",
      compressible: true,
      extensions: ["sh"]
    },
    "application/x-shar": {
      source: "apache",
      extensions: ["shar"]
    },
    "application/x-shockwave-flash": {
      source: "apache",
      compressible: false,
      extensions: ["swf"]
    },
    "application/x-silverlight-app": {
      source: "apache",
      extensions: ["xap"]
    },
    "application/x-sql": {
      source: "apache",
      extensions: ["sql"]
    },
    "application/x-stuffit": {
      source: "apache",
      compressible: false,
      extensions: ["sit"]
    },
    "application/x-stuffitx": {
      source: "apache",
      extensions: ["sitx"]
    },
    "application/x-subrip": {
      source: "apache",
      extensions: ["srt"]
    },
    "application/x-sv4cpio": {
      source: "apache",
      extensions: ["sv4cpio"]
    },
    "application/x-sv4crc": {
      source: "apache",
      extensions: ["sv4crc"]
    },
    "application/x-t3vm-image": {
      source: "apache",
      extensions: ["t3"]
    },
    "application/x-tads": {
      source: "apache",
      extensions: ["gam"]
    },
    "application/x-tar": {
      source: "apache",
      compressible: true,
      extensions: ["tar"]
    },
    "application/x-tcl": {
      source: "apache",
      extensions: ["tcl", "tk"]
    },
    "application/x-tex": {
      source: "apache",
      extensions: ["tex"]
    },
    "application/x-tex-tfm": {
      source: "apache",
      extensions: ["tfm"]
    },
    "application/x-texinfo": {
      source: "apache",
      extensions: ["texinfo", "texi"]
    },
    "application/x-tgif": {
      source: "apache",
      extensions: ["obj"]
    },
    "application/x-ustar": {
      source: "apache",
      extensions: ["ustar"]
    },
    "application/x-virtualbox-hdd": {
      compressible: true,
      extensions: ["hdd"]
    },
    "application/x-virtualbox-ova": {
      compressible: true,
      extensions: ["ova"]
    },
    "application/x-virtualbox-ovf": {
      compressible: true,
      extensions: ["ovf"]
    },
    "application/x-virtualbox-vbox": {
      compressible: true,
      extensions: ["vbox"]
    },
    "application/x-virtualbox-vbox-extpack": {
      compressible: false,
      extensions: ["vbox-extpack"]
    },
    "application/x-virtualbox-vdi": {
      compressible: true,
      extensions: ["vdi"]
    },
    "application/x-virtualbox-vhd": {
      compressible: true,
      extensions: ["vhd"]
    },
    "application/x-virtualbox-vmdk": {
      compressible: true,
      extensions: ["vmdk"]
    },
    "application/x-wais-source": {
      source: "apache",
      extensions: ["src"]
    },
    "application/x-web-app-manifest+json": {
      compressible: true,
      extensions: ["webapp"]
    },
    "application/x-www-form-urlencoded": {
      source: "iana",
      compressible: true
    },
    "application/x-x509-ca-cert": {
      source: "iana",
      extensions: ["der", "crt", "pem"]
    },
    "application/x-x509-ca-ra-cert": {
      source: "iana"
    },
    "application/x-x509-next-ca-cert": {
      source: "iana"
    },
    "application/x-xfig": {
      source: "apache",
      extensions: ["fig"]
    },
    "application/x-xliff+xml": {
      source: "apache",
      compressible: true,
      extensions: ["xlf"]
    },
    "application/x-xpinstall": {
      source: "apache",
      compressible: false,
      extensions: ["xpi"]
    },
    "application/x-xz": {
      source: "apache",
      extensions: ["xz"]
    },
    "application/x-zmachine": {
      source: "apache",
      extensions: ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"]
    },
    "application/x400-bp": {
      source: "iana"
    },
    "application/xacml+xml": {
      source: "iana",
      compressible: true
    },
    "application/xaml+xml": {
      source: "apache",
      compressible: true,
      extensions: ["xaml"]
    },
    "application/xcap-att+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xav"]
    },
    "application/xcap-caps+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xca"]
    },
    "application/xcap-diff+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xdf"]
    },
    "application/xcap-el+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xel"]
    },
    "application/xcap-error+xml": {
      source: "iana",
      compressible: true
    },
    "application/xcap-ns+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xns"]
    },
    "application/xcon-conference-info+xml": {
      source: "iana",
      compressible: true
    },
    "application/xcon-conference-info-diff+xml": {
      source: "iana",
      compressible: true
    },
    "application/xenc+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xenc"]
    },
    "application/xhtml+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xhtml", "xht"]
    },
    "application/xhtml-voice+xml": {
      source: "apache",
      compressible: true
    },
    "application/xliff+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xlf"]
    },
    "application/xml": {
      source: "iana",
      compressible: true,
      extensions: ["xml", "xsl", "xsd", "rng"]
    },
    "application/xml-dtd": {
      source: "iana",
      compressible: true,
      extensions: ["dtd"]
    },
    "application/xml-external-parsed-entity": {
      source: "iana"
    },
    "application/xml-patch+xml": {
      source: "iana",
      compressible: true
    },
    "application/xmpp+xml": {
      source: "iana",
      compressible: true
    },
    "application/xop+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xop"]
    },
    "application/xproc+xml": {
      source: "apache",
      compressible: true,
      extensions: ["xpl"]
    },
    "application/xslt+xml": {
      source: "iana",
      compressible: true,
      extensions: ["xsl", "xslt"]
    },
    "application/xspf+xml": {
      source: "apache",
      compressible: true,
      extensions: ["xspf"]
    },
    "application/xv+xml": {
      source: "iana",
      compressible: true,
      extensions: ["mxml", "xhvml", "xvml", "xvm"]
    },
    "application/yang": {
      source: "iana",
      extensions: ["yang"]
    },
    "application/yang-data+json": {
      source: "iana",
      compressible: true
    },
    "application/yang-data+xml": {
      source: "iana",
      compressible: true
    },
    "application/yang-patch+json": {
      source: "iana",
      compressible: true
    },
    "application/yang-patch+xml": {
      source: "iana",
      compressible: true
    },
    "application/yin+xml": {
      source: "iana",
      compressible: true,
      extensions: ["yin"]
    },
    "application/zip": {
      source: "iana",
      compressible: false,
      extensions: ["zip"]
    },
    "application/zlib": {
      source: "iana"
    },
    "application/zstd": {
      source: "iana"
    },
    "audio/1d-interleaved-parityfec": {
      source: "iana"
    },
    "audio/32kadpcm": {
      source: "iana"
    },
    "audio/3gpp": {
      source: "iana",
      compressible: false,
      extensions: ["3gpp"]
    },
    "audio/3gpp2": {
      source: "iana"
    },
    "audio/aac": {
      source: "iana"
    },
    "audio/ac3": {
      source: "iana"
    },
    "audio/adpcm": {
      source: "apache",
      extensions: ["adp"]
    },
    "audio/amr": {
      source: "iana",
      extensions: ["amr"]
    },
    "audio/amr-wb": {
      source: "iana"
    },
    "audio/amr-wb+": {
      source: "iana"
    },
    "audio/aptx": {
      source: "iana"
    },
    "audio/asc": {
      source: "iana"
    },
    "audio/atrac-advanced-lossless": {
      source: "iana"
    },
    "audio/atrac-x": {
      source: "iana"
    },
    "audio/atrac3": {
      source: "iana"
    },
    "audio/basic": {
      source: "iana",
      compressible: false,
      extensions: ["au", "snd"]
    },
    "audio/bv16": {
      source: "iana"
    },
    "audio/bv32": {
      source: "iana"
    },
    "audio/clearmode": {
      source: "iana"
    },
    "audio/cn": {
      source: "iana"
    },
    "audio/dat12": {
      source: "iana"
    },
    "audio/dls": {
      source: "iana"
    },
    "audio/dsr-es201108": {
      source: "iana"
    },
    "audio/dsr-es202050": {
      source: "iana"
    },
    "audio/dsr-es202211": {
      source: "iana"
    },
    "audio/dsr-es202212": {
      source: "iana"
    },
    "audio/dv": {
      source: "iana"
    },
    "audio/dvi4": {
      source: "iana"
    },
    "audio/eac3": {
      source: "iana"
    },
    "audio/encaprtp": {
      source: "iana"
    },
    "audio/evrc": {
      source: "iana"
    },
    "audio/evrc-qcp": {
      source: "iana"
    },
    "audio/evrc0": {
      source: "iana"
    },
    "audio/evrc1": {
      source: "iana"
    },
    "audio/evrcb": {
      source: "iana"
    },
    "audio/evrcb0": {
      source: "iana"
    },
    "audio/evrcb1": {
      source: "iana"
    },
    "audio/evrcnw": {
      source: "iana"
    },
    "audio/evrcnw0": {
      source: "iana"
    },
    "audio/evrcnw1": {
      source: "iana"
    },
    "audio/evrcwb": {
      source: "iana"
    },
    "audio/evrcwb0": {
      source: "iana"
    },
    "audio/evrcwb1": {
      source: "iana"
    },
    "audio/evs": {
      source: "iana"
    },
    "audio/flexfec": {
      source: "iana"
    },
    "audio/fwdred": {
      source: "iana"
    },
    "audio/g711-0": {
      source: "iana"
    },
    "audio/g719": {
      source: "iana"
    },
    "audio/g722": {
      source: "iana"
    },
    "audio/g7221": {
      source: "iana"
    },
    "audio/g723": {
      source: "iana"
    },
    "audio/g726-16": {
      source: "iana"
    },
    "audio/g726-24": {
      source: "iana"
    },
    "audio/g726-32": {
      source: "iana"
    },
    "audio/g726-40": {
      source: "iana"
    },
    "audio/g728": {
      source: "iana"
    },
    "audio/g729": {
      source: "iana"
    },
    "audio/g7291": {
      source: "iana"
    },
    "audio/g729d": {
      source: "iana"
    },
    "audio/g729e": {
      source: "iana"
    },
    "audio/gsm": {
      source: "iana"
    },
    "audio/gsm-efr": {
      source: "iana"
    },
    "audio/gsm-hr-08": {
      source: "iana"
    },
    "audio/ilbc": {
      source: "iana"
    },
    "audio/ip-mr_v2.5": {
      source: "iana"
    },
    "audio/isac": {
      source: "apache"
    },
    "audio/l16": {
      source: "iana"
    },
    "audio/l20": {
      source: "iana"
    },
    "audio/l24": {
      source: "iana",
      compressible: false
    },
    "audio/l8": {
      source: "iana"
    },
    "audio/lpc": {
      source: "iana"
    },
    "audio/melp": {
      source: "iana"
    },
    "audio/melp1200": {
      source: "iana"
    },
    "audio/melp2400": {
      source: "iana"
    },
    "audio/melp600": {
      source: "iana"
    },
    "audio/mhas": {
      source: "iana"
    },
    "audio/midi": {
      source: "apache",
      extensions: ["mid", "midi", "kar", "rmi"]
    },
    "audio/mobile-xmf": {
      source: "iana",
      extensions: ["mxmf"]
    },
    "audio/mp3": {
      compressible: false,
      extensions: ["mp3"]
    },
    "audio/mp4": {
      source: "iana",
      compressible: false,
      extensions: ["m4a", "mp4a"]
    },
    "audio/mp4a-latm": {
      source: "iana"
    },
    "audio/mpa": {
      source: "iana"
    },
    "audio/mpa-robust": {
      source: "iana"
    },
    "audio/mpeg": {
      source: "iana",
      compressible: false,
      extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"]
    },
    "audio/mpeg4-generic": {
      source: "iana"
    },
    "audio/musepack": {
      source: "apache"
    },
    "audio/ogg": {
      source: "iana",
      compressible: false,
      extensions: ["oga", "ogg", "spx", "opus"]
    },
    "audio/opus": {
      source: "iana"
    },
    "audio/parityfec": {
      source: "iana"
    },
    "audio/pcma": {
      source: "iana"
    },
    "audio/pcma-wb": {
      source: "iana"
    },
    "audio/pcmu": {
      source: "iana"
    },
    "audio/pcmu-wb": {
      source: "iana"
    },
    "audio/prs.sid": {
      source: "iana"
    },
    "audio/qcelp": {
      source: "iana"
    },
    "audio/raptorfec": {
      source: "iana"
    },
    "audio/red": {
      source: "iana"
    },
    "audio/rtp-enc-aescm128": {
      source: "iana"
    },
    "audio/rtp-midi": {
      source: "iana"
    },
    "audio/rtploopback": {
      source: "iana"
    },
    "audio/rtx": {
      source: "iana"
    },
    "audio/s3m": {
      source: "apache",
      extensions: ["s3m"]
    },
    "audio/scip": {
      source: "iana"
    },
    "audio/silk": {
      source: "apache",
      extensions: ["sil"]
    },
    "audio/smv": {
      source: "iana"
    },
    "audio/smv-qcp": {
      source: "iana"
    },
    "audio/smv0": {
      source: "iana"
    },
    "audio/sofa": {
      source: "iana"
    },
    "audio/sp-midi": {
      source: "iana"
    },
    "audio/speex": {
      source: "iana"
    },
    "audio/t140c": {
      source: "iana"
    },
    "audio/t38": {
      source: "iana"
    },
    "audio/telephone-event": {
      source: "iana"
    },
    "audio/tetra_acelp": {
      source: "iana"
    },
    "audio/tetra_acelp_bb": {
      source: "iana"
    },
    "audio/tone": {
      source: "iana"
    },
    "audio/tsvcis": {
      source: "iana"
    },
    "audio/uemclip": {
      source: "iana"
    },
    "audio/ulpfec": {
      source: "iana"
    },
    "audio/usac": {
      source: "iana"
    },
    "audio/vdvi": {
      source: "iana"
    },
    "audio/vmr-wb": {
      source: "iana"
    },
    "audio/vnd.3gpp.iufp": {
      source: "iana"
    },
    "audio/vnd.4sb": {
      source: "iana"
    },
    "audio/vnd.audiokoz": {
      source: "iana"
    },
    "audio/vnd.celp": {
      source: "iana"
    },
    "audio/vnd.cisco.nse": {
      source: "iana"
    },
    "audio/vnd.cmles.radio-events": {
      source: "iana"
    },
    "audio/vnd.cns.anp1": {
      source: "iana"
    },
    "audio/vnd.cns.inf1": {
      source: "iana"
    },
    "audio/vnd.dece.audio": {
      source: "iana",
      extensions: ["uva", "uvva"]
    },
    "audio/vnd.digital-winds": {
      source: "iana",
      extensions: ["eol"]
    },
    "audio/vnd.dlna.adts": {
      source: "iana"
    },
    "audio/vnd.dolby.heaac.1": {
      source: "iana"
    },
    "audio/vnd.dolby.heaac.2": {
      source: "iana"
    },
    "audio/vnd.dolby.mlp": {
      source: "iana"
    },
    "audio/vnd.dolby.mps": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2x": {
      source: "iana"
    },
    "audio/vnd.dolby.pl2z": {
      source: "iana"
    },
    "audio/vnd.dolby.pulse.1": {
      source: "iana"
    },
    "audio/vnd.dra": {
      source: "iana",
      extensions: ["dra"]
    },
    "audio/vnd.dts": {
      source: "iana",
      extensions: ["dts"]
    },
    "audio/vnd.dts.hd": {
      source: "iana",
      extensions: ["dtshd"]
    },
    "audio/vnd.dts.uhd": {
      source: "iana"
    },
    "audio/vnd.dvb.file": {
      source: "iana"
    },
    "audio/vnd.everad.plj": {
      source: "iana"
    },
    "audio/vnd.hns.audio": {
      source: "iana"
    },
    "audio/vnd.lucent.voice": {
      source: "iana",
      extensions: ["lvp"]
    },
    "audio/vnd.ms-playready.media.pya": {
      source: "iana",
      extensions: ["pya"]
    },
    "audio/vnd.nokia.mobile-xmf": {
      source: "iana"
    },
    "audio/vnd.nortel.vbk": {
      source: "iana"
    },
    "audio/vnd.nuera.ecelp4800": {
      source: "iana",
      extensions: ["ecelp4800"]
    },
    "audio/vnd.nuera.ecelp7470": {
      source: "iana",
      extensions: ["ecelp7470"]
    },
    "audio/vnd.nuera.ecelp9600": {
      source: "iana",
      extensions: ["ecelp9600"]
    },
    "audio/vnd.octel.sbc": {
      source: "iana"
    },
    "audio/vnd.presonus.multitrack": {
      source: "iana"
    },
    "audio/vnd.qcelp": {
      source: "iana"
    },
    "audio/vnd.rhetorex.32kadpcm": {
      source: "iana"
    },
    "audio/vnd.rip": {
      source: "iana",
      extensions: ["rip"]
    },
    "audio/vnd.rn-realaudio": {
      compressible: false
    },
    "audio/vnd.sealedmedia.softseal.mpeg": {
      source: "iana"
    },
    "audio/vnd.vmx.cvsd": {
      source: "iana"
    },
    "audio/vnd.wave": {
      compressible: false
    },
    "audio/vorbis": {
      source: "iana",
      compressible: false
    },
    "audio/vorbis-config": {
      source: "iana"
    },
    "audio/wav": {
      compressible: false,
      extensions: ["wav"]
    },
    "audio/wave": {
      compressible: false,
      extensions: ["wav"]
    },
    "audio/webm": {
      source: "apache",
      compressible: false,
      extensions: ["weba"]
    },
    "audio/x-aac": {
      source: "apache",
      compressible: false,
      extensions: ["aac"]
    },
    "audio/x-aiff": {
      source: "apache",
      extensions: ["aif", "aiff", "aifc"]
    },
    "audio/x-caf": {
      source: "apache",
      compressible: false,
      extensions: ["caf"]
    },
    "audio/x-flac": {
      source: "apache",
      extensions: ["flac"]
    },
    "audio/x-m4a": {
      source: "nginx",
      extensions: ["m4a"]
    },
    "audio/x-matroska": {
      source: "apache",
      extensions: ["mka"]
    },
    "audio/x-mpegurl": {
      source: "apache",
      extensions: ["m3u"]
    },
    "audio/x-ms-wax": {
      source: "apache",
      extensions: ["wax"]
    },
    "audio/x-ms-wma": {
      source: "apache",
      extensions: ["wma"]
    },
    "audio/x-pn-realaudio": {
      source: "apache",
      extensions: ["ram", "ra"]
    },
    "audio/x-pn-realaudio-plugin": {
      source: "apache",
      extensions: ["rmp"]
    },
    "audio/x-realaudio": {
      source: "nginx",
      extensions: ["ra"]
    },
    "audio/x-tta": {
      source: "apache"
    },
    "audio/x-wav": {
      source: "apache",
      extensions: ["wav"]
    },
    "audio/xm": {
      source: "apache",
      extensions: ["xm"]
    },
    "chemical/x-cdx": {
      source: "apache",
      extensions: ["cdx"]
    },
    "chemical/x-cif": {
      source: "apache",
      extensions: ["cif"]
    },
    "chemical/x-cmdf": {
      source: "apache",
      extensions: ["cmdf"]
    },
    "chemical/x-cml": {
      source: "apache",
      extensions: ["cml"]
    },
    "chemical/x-csml": {
      source: "apache",
      extensions: ["csml"]
    },
    "chemical/x-pdb": {
      source: "apache"
    },
    "chemical/x-xyz": {
      source: "apache",
      extensions: ["xyz"]
    },
    "font/collection": {
      source: "iana",
      extensions: ["ttc"]
    },
    "font/otf": {
      source: "iana",
      compressible: true,
      extensions: ["otf"]
    },
    "font/sfnt": {
      source: "iana"
    },
    "font/ttf": {
      source: "iana",
      compressible: true,
      extensions: ["ttf"]
    },
    "font/woff": {
      source: "iana",
      extensions: ["woff"]
    },
    "font/woff2": {
      source: "iana",
      extensions: ["woff2"]
    },
    "image/aces": {
      source: "iana",
      extensions: ["exr"]
    },
    "image/apng": {
      compressible: false,
      extensions: ["apng"]
    },
    "image/avci": {
      source: "iana",
      extensions: ["avci"]
    },
    "image/avcs": {
      source: "iana",
      extensions: ["avcs"]
    },
    "image/avif": {
      source: "iana",
      compressible: false,
      extensions: ["avif"]
    },
    "image/bmp": {
      source: "iana",
      compressible: true,
      extensions: ["bmp"]
    },
    "image/cgm": {
      source: "iana",
      extensions: ["cgm"]
    },
    "image/dicom-rle": {
      source: "iana",
      extensions: ["drle"]
    },
    "image/emf": {
      source: "iana",
      extensions: ["emf"]
    },
    "image/fits": {
      source: "iana",
      extensions: ["fits"]
    },
    "image/g3fax": {
      source: "iana",
      extensions: ["g3"]
    },
    "image/gif": {
      source: "iana",
      compressible: false,
      extensions: ["gif"]
    },
    "image/heic": {
      source: "iana",
      extensions: ["heic"]
    },
    "image/heic-sequence": {
      source: "iana",
      extensions: ["heics"]
    },
    "image/heif": {
      source: "iana",
      extensions: ["heif"]
    },
    "image/heif-sequence": {
      source: "iana",
      extensions: ["heifs"]
    },
    "image/hej2k": {
      source: "iana",
      extensions: ["hej2"]
    },
    "image/hsj2": {
      source: "iana",
      extensions: ["hsj2"]
    },
    "image/ief": {
      source: "iana",
      extensions: ["ief"]
    },
    "image/jls": {
      source: "iana",
      extensions: ["jls"]
    },
    "image/jp2": {
      source: "iana",
      compressible: false,
      extensions: ["jp2", "jpg2"]
    },
    "image/jpeg": {
      source: "iana",
      compressible: false,
      extensions: ["jpeg", "jpg", "jpe"]
    },
    "image/jph": {
      source: "iana",
      extensions: ["jph"]
    },
    "image/jphc": {
      source: "iana",
      extensions: ["jhc"]
    },
    "image/jpm": {
      source: "iana",
      compressible: false,
      extensions: ["jpm"]
    },
    "image/jpx": {
      source: "iana",
      compressible: false,
      extensions: ["jpx", "jpf"]
    },
    "image/jxr": {
      source: "iana",
      extensions: ["jxr"]
    },
    "image/jxra": {
      source: "iana",
      extensions: ["jxra"]
    },
    "image/jxrs": {
      source: "iana",
      extensions: ["jxrs"]
    },
    "image/jxs": {
      source: "iana",
      extensions: ["jxs"]
    },
    "image/jxsc": {
      source: "iana",
      extensions: ["jxsc"]
    },
    "image/jxsi": {
      source: "iana",
      extensions: ["jxsi"]
    },
    "image/jxss": {
      source: "iana",
      extensions: ["jxss"]
    },
    "image/ktx": {
      source: "iana",
      extensions: ["ktx"]
    },
    "image/ktx2": {
      source: "iana",
      extensions: ["ktx2"]
    },
    "image/naplps": {
      source: "iana"
    },
    "image/pjpeg": {
      compressible: false
    },
    "image/png": {
      source: "iana",
      compressible: false,
      extensions: ["png"]
    },
    "image/prs.btif": {
      source: "iana",
      extensions: ["btif"]
    },
    "image/prs.pti": {
      source: "iana",
      extensions: ["pti"]
    },
    "image/pwg-raster": {
      source: "iana"
    },
    "image/sgi": {
      source: "apache",
      extensions: ["sgi"]
    },
    "image/svg+xml": {
      source: "iana",
      compressible: true,
      extensions: ["svg", "svgz"]
    },
    "image/t38": {
      source: "iana",
      extensions: ["t38"]
    },
    "image/tiff": {
      source: "iana",
      compressible: false,
      extensions: ["tif", "tiff"]
    },
    "image/tiff-fx": {
      source: "iana",
      extensions: ["tfx"]
    },
    "image/vnd.adobe.photoshop": {
      source: "iana",
      compressible: true,
      extensions: ["psd"]
    },
    "image/vnd.airzip.accelerator.azv": {
      source: "iana",
      extensions: ["azv"]
    },
    "image/vnd.cns.inf2": {
      source: "iana"
    },
    "image/vnd.dece.graphic": {
      source: "iana",
      extensions: ["uvi", "uvvi", "uvg", "uvvg"]
    },
    "image/vnd.djvu": {
      source: "iana",
      extensions: ["djvu", "djv"]
    },
    "image/vnd.dvb.subtitle": {
      source: "iana",
      extensions: ["sub"]
    },
    "image/vnd.dwg": {
      source: "iana",
      extensions: ["dwg"]
    },
    "image/vnd.dxf": {
      source: "iana",
      extensions: ["dxf"]
    },
    "image/vnd.fastbidsheet": {
      source: "iana",
      extensions: ["fbs"]
    },
    "image/vnd.fpx": {
      source: "iana",
      extensions: ["fpx"]
    },
    "image/vnd.fst": {
      source: "iana",
      extensions: ["fst"]
    },
    "image/vnd.fujixerox.edmics-mmr": {
      source: "iana",
      extensions: ["mmr"]
    },
    "image/vnd.fujixerox.edmics-rlc": {
      source: "iana",
      extensions: ["rlc"]
    },
    "image/vnd.globalgraphics.pgb": {
      source: "iana"
    },
    "image/vnd.microsoft.icon": {
      source: "iana",
      compressible: true,
      extensions: ["ico"]
    },
    "image/vnd.mix": {
      source: "iana"
    },
    "image/vnd.mozilla.apng": {
      source: "iana"
    },
    "image/vnd.ms-dds": {
      compressible: true,
      extensions: ["dds"]
    },
    "image/vnd.ms-modi": {
      source: "iana",
      extensions: ["mdi"]
    },
    "image/vnd.ms-photo": {
      source: "apache",
      extensions: ["wdp"]
    },
    "image/vnd.net-fpx": {
      source: "iana",
      extensions: ["npx"]
    },
    "image/vnd.pco.b16": {
      source: "iana",
      extensions: ["b16"]
    },
    "image/vnd.radiance": {
      source: "iana"
    },
    "image/vnd.sealed.png": {
      source: "iana"
    },
    "image/vnd.sealedmedia.softseal.gif": {
      source: "iana"
    },
    "image/vnd.sealedmedia.softseal.jpg": {
      source: "iana"
    },
    "image/vnd.svf": {
      source: "iana"
    },
    "image/vnd.tencent.tap": {
      source: "iana",
      extensions: ["tap"]
    },
    "image/vnd.valve.source.texture": {
      source: "iana",
      extensions: ["vtf"]
    },
    "image/vnd.wap.wbmp": {
      source: "iana",
      extensions: ["wbmp"]
    },
    "image/vnd.xiff": {
      source: "iana",
      extensions: ["xif"]
    },
    "image/vnd.zbrush.pcx": {
      source: "iana",
      extensions: ["pcx"]
    },
    "image/webp": {
      source: "apache",
      extensions: ["webp"]
    },
    "image/wmf": {
      source: "iana",
      extensions: ["wmf"]
    },
    "image/x-3ds": {
      source: "apache",
      extensions: ["3ds"]
    },
    "image/x-cmu-raster": {
      source: "apache",
      extensions: ["ras"]
    },
    "image/x-cmx": {
      source: "apache",
      extensions: ["cmx"]
    },
    "image/x-freehand": {
      source: "apache",
      extensions: ["fh", "fhc", "fh4", "fh5", "fh7"]
    },
    "image/x-icon": {
      source: "apache",
      compressible: true,
      extensions: ["ico"]
    },
    "image/x-jng": {
      source: "nginx",
      extensions: ["jng"]
    },
    "image/x-mrsid-image": {
      source: "apache",
      extensions: ["sid"]
    },
    "image/x-ms-bmp": {
      source: "nginx",
      compressible: true,
      extensions: ["bmp"]
    },
    "image/x-pcx": {
      source: "apache",
      extensions: ["pcx"]
    },
    "image/x-pict": {
      source: "apache",
      extensions: ["pic", "pct"]
    },
    "image/x-portable-anymap": {
      source: "apache",
      extensions: ["pnm"]
    },
    "image/x-portable-bitmap": {
      source: "apache",
      extensions: ["pbm"]
    },
    "image/x-portable-graymap": {
      source: "apache",
      extensions: ["pgm"]
    },
    "image/x-portable-pixmap": {
      source: "apache",
      extensions: ["ppm"]
    },
    "image/x-rgb": {
      source: "apache",
      extensions: ["rgb"]
    },
    "image/x-tga": {
      source: "apache",
      extensions: ["tga"]
    },
    "image/x-xbitmap": {
      source: "apache",
      extensions: ["xbm"]
    },
    "image/x-xcf": {
      compressible: false
    },
    "image/x-xpixmap": {
      source: "apache",
      extensions: ["xpm"]
    },
    "image/x-xwindowdump": {
      source: "apache",
      extensions: ["xwd"]
    },
    "message/cpim": {
      source: "iana"
    },
    "message/delivery-status": {
      source: "iana"
    },
    "message/disposition-notification": {
      source: "iana",
      extensions: [
        "disposition-notification"
      ]
    },
    "message/external-body": {
      source: "iana"
    },
    "message/feedback-report": {
      source: "iana"
    },
    "message/global": {
      source: "iana",
      extensions: ["u8msg"]
    },
    "message/global-delivery-status": {
      source: "iana",
      extensions: ["u8dsn"]
    },
    "message/global-disposition-notification": {
      source: "iana",
      extensions: ["u8mdn"]
    },
    "message/global-headers": {
      source: "iana",
      extensions: ["u8hdr"]
    },
    "message/http": {
      source: "iana",
      compressible: false
    },
    "message/imdn+xml": {
      source: "iana",
      compressible: true
    },
    "message/news": {
      source: "iana"
    },
    "message/partial": {
      source: "iana",
      compressible: false
    },
    "message/rfc822": {
      source: "iana",
      compressible: true,
      extensions: ["eml", "mime"]
    },
    "message/s-http": {
      source: "iana"
    },
    "message/sip": {
      source: "iana"
    },
    "message/sipfrag": {
      source: "iana"
    },
    "message/tracking-status": {
      source: "iana"
    },
    "message/vnd.si.simp": {
      source: "iana"
    },
    "message/vnd.wfa.wsc": {
      source: "iana",
      extensions: ["wsc"]
    },
    "model/3mf": {
      source: "iana",
      extensions: ["3mf"]
    },
    "model/e57": {
      source: "iana"
    },
    "model/gltf+json": {
      source: "iana",
      compressible: true,
      extensions: ["gltf"]
    },
    "model/gltf-binary": {
      source: "iana",
      compressible: true,
      extensions: ["glb"]
    },
    "model/iges": {
      source: "iana",
      compressible: false,
      extensions: ["igs", "iges"]
    },
    "model/mesh": {
      source: "iana",
      compressible: false,
      extensions: ["msh", "mesh", "silo"]
    },
    "model/mtl": {
      source: "iana",
      extensions: ["mtl"]
    },
    "model/obj": {
      source: "iana",
      extensions: ["obj"]
    },
    "model/step": {
      source: "iana"
    },
    "model/step+xml": {
      source: "iana",
      compressible: true,
      extensions: ["stpx"]
    },
    "model/step+zip": {
      source: "iana",
      compressible: false,
      extensions: ["stpz"]
    },
    "model/step-xml+zip": {
      source: "iana",
      compressible: false,
      extensions: ["stpxz"]
    },
    "model/stl": {
      source: "iana",
      extensions: ["stl"]
    },
    "model/vnd.collada+xml": {
      source: "iana",
      compressible: true,
      extensions: ["dae"]
    },
    "model/vnd.dwf": {
      source: "iana",
      extensions: ["dwf"]
    },
    "model/vnd.flatland.3dml": {
      source: "iana"
    },
    "model/vnd.gdl": {
      source: "iana",
      extensions: ["gdl"]
    },
    "model/vnd.gs-gdl": {
      source: "apache"
    },
    "model/vnd.gs.gdl": {
      source: "iana"
    },
    "model/vnd.gtw": {
      source: "iana",
      extensions: ["gtw"]
    },
    "model/vnd.moml+xml": {
      source: "iana",
      compressible: true
    },
    "model/vnd.mts": {
      source: "iana",
      extensions: ["mts"]
    },
    "model/vnd.opengex": {
      source: "iana",
      extensions: ["ogex"]
    },
    "model/vnd.parasolid.transmit.binary": {
      source: "iana",
      extensions: ["x_b"]
    },
    "model/vnd.parasolid.transmit.text": {
      source: "iana",
      extensions: ["x_t"]
    },
    "model/vnd.pytha.pyox": {
      source: "iana"
    },
    "model/vnd.rosette.annotated-data-model": {
      source: "iana"
    },
    "model/vnd.sap.vds": {
      source: "iana",
      extensions: ["vds"]
    },
    "model/vnd.usdz+zip": {
      source: "iana",
      compressible: false,
      extensions: ["usdz"]
    },
    "model/vnd.valve.source.compiled-map": {
      source: "iana",
      extensions: ["bsp"]
    },
    "model/vnd.vtu": {
      source: "iana",
      extensions: ["vtu"]
    },
    "model/vrml": {
      source: "iana",
      compressible: false,
      extensions: ["wrl", "vrml"]
    },
    "model/x3d+binary": {
      source: "apache",
      compressible: false,
      extensions: ["x3db", "x3dbz"]
    },
    "model/x3d+fastinfoset": {
      source: "iana",
      extensions: ["x3db"]
    },
    "model/x3d+vrml": {
      source: "apache",
      compressible: false,
      extensions: ["x3dv", "x3dvz"]
    },
    "model/x3d+xml": {
      source: "iana",
      compressible: true,
      extensions: ["x3d", "x3dz"]
    },
    "model/x3d-vrml": {
      source: "iana",
      extensions: ["x3dv"]
    },
    "multipart/alternative": {
      source: "iana",
      compressible: false
    },
    "multipart/appledouble": {
      source: "iana"
    },
    "multipart/byteranges": {
      source: "iana"
    },
    "multipart/digest": {
      source: "iana"
    },
    "multipart/encrypted": {
      source: "iana",
      compressible: false
    },
    "multipart/form-data": {
      source: "iana",
      compressible: false
    },
    "multipart/header-set": {
      source: "iana"
    },
    "multipart/mixed": {
      source: "iana"
    },
    "multipart/multilingual": {
      source: "iana"
    },
    "multipart/parallel": {
      source: "iana"
    },
    "multipart/related": {
      source: "iana",
      compressible: false
    },
    "multipart/report": {
      source: "iana"
    },
    "multipart/signed": {
      source: "iana",
      compressible: false
    },
    "multipart/vnd.bint.med-plus": {
      source: "iana"
    },
    "multipart/voice-message": {
      source: "iana"
    },
    "multipart/x-mixed-replace": {
      source: "iana"
    },
    "text/1d-interleaved-parityfec": {
      source: "iana"
    },
    "text/cache-manifest": {
      source: "iana",
      compressible: true,
      extensions: ["appcache", "manifest"]
    },
    "text/calendar": {
      source: "iana",
      extensions: ["ics", "ifb"]
    },
    "text/calender": {
      compressible: true
    },
    "text/cmd": {
      compressible: true
    },
    "text/coffeescript": {
      extensions: ["coffee", "litcoffee"]
    },
    "text/cql": {
      source: "iana"
    },
    "text/cql-expression": {
      source: "iana"
    },
    "text/cql-identifier": {
      source: "iana"
    },
    "text/css": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["css"]
    },
    "text/csv": {
      source: "iana",
      compressible: true,
      extensions: ["csv"]
    },
    "text/csv-schema": {
      source: "iana"
    },
    "text/directory": {
      source: "iana"
    },
    "text/dns": {
      source: "iana"
    },
    "text/ecmascript": {
      source: "iana"
    },
    "text/encaprtp": {
      source: "iana"
    },
    "text/enriched": {
      source: "iana"
    },
    "text/fhirpath": {
      source: "iana"
    },
    "text/flexfec": {
      source: "iana"
    },
    "text/fwdred": {
      source: "iana"
    },
    "text/gff3": {
      source: "iana"
    },
    "text/grammar-ref-list": {
      source: "iana"
    },
    "text/html": {
      source: "iana",
      compressible: true,
      extensions: ["html", "htm", "shtml"]
    },
    "text/jade": {
      extensions: ["jade"]
    },
    "text/javascript": {
      source: "iana",
      compressible: true
    },
    "text/jcr-cnd": {
      source: "iana"
    },
    "text/jsx": {
      compressible: true,
      extensions: ["jsx"]
    },
    "text/less": {
      compressible: true,
      extensions: ["less"]
    },
    "text/markdown": {
      source: "iana",
      compressible: true,
      extensions: ["markdown", "md"]
    },
    "text/mathml": {
      source: "nginx",
      extensions: ["mml"]
    },
    "text/mdx": {
      compressible: true,
      extensions: ["mdx"]
    },
    "text/mizar": {
      source: "iana"
    },
    "text/n3": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["n3"]
    },
    "text/parameters": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/parityfec": {
      source: "iana"
    },
    "text/plain": {
      source: "iana",
      compressible: true,
      extensions: ["txt", "text", "conf", "def", "list", "log", "in", "ini"]
    },
    "text/provenance-notation": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/prs.fallenstein.rst": {
      source: "iana"
    },
    "text/prs.lines.tag": {
      source: "iana",
      extensions: ["dsc"]
    },
    "text/prs.prop.logic": {
      source: "iana"
    },
    "text/raptorfec": {
      source: "iana"
    },
    "text/red": {
      source: "iana"
    },
    "text/rfc822-headers": {
      source: "iana"
    },
    "text/richtext": {
      source: "iana",
      compressible: true,
      extensions: ["rtx"]
    },
    "text/rtf": {
      source: "iana",
      compressible: true,
      extensions: ["rtf"]
    },
    "text/rtp-enc-aescm128": {
      source: "iana"
    },
    "text/rtploopback": {
      source: "iana"
    },
    "text/rtx": {
      source: "iana"
    },
    "text/sgml": {
      source: "iana",
      extensions: ["sgml", "sgm"]
    },
    "text/shaclc": {
      source: "iana"
    },
    "text/shex": {
      source: "iana",
      extensions: ["shex"]
    },
    "text/slim": {
      extensions: ["slim", "slm"]
    },
    "text/spdx": {
      source: "iana",
      extensions: ["spdx"]
    },
    "text/strings": {
      source: "iana"
    },
    "text/stylus": {
      extensions: ["stylus", "styl"]
    },
    "text/t140": {
      source: "iana"
    },
    "text/tab-separated-values": {
      source: "iana",
      compressible: true,
      extensions: ["tsv"]
    },
    "text/troff": {
      source: "iana",
      extensions: ["t", "tr", "roff", "man", "me", "ms"]
    },
    "text/turtle": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["ttl"]
    },
    "text/ulpfec": {
      source: "iana"
    },
    "text/uri-list": {
      source: "iana",
      compressible: true,
      extensions: ["uri", "uris", "urls"]
    },
    "text/vcard": {
      source: "iana",
      compressible: true,
      extensions: ["vcard"]
    },
    "text/vnd.a": {
      source: "iana"
    },
    "text/vnd.abc": {
      source: "iana"
    },
    "text/vnd.ascii-art": {
      source: "iana"
    },
    "text/vnd.curl": {
      source: "iana",
      extensions: ["curl"]
    },
    "text/vnd.curl.dcurl": {
      source: "apache",
      extensions: ["dcurl"]
    },
    "text/vnd.curl.mcurl": {
      source: "apache",
      extensions: ["mcurl"]
    },
    "text/vnd.curl.scurl": {
      source: "apache",
      extensions: ["scurl"]
    },
    "text/vnd.debian.copyright": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/vnd.dmclientscript": {
      source: "iana"
    },
    "text/vnd.dvb.subtitle": {
      source: "iana",
      extensions: ["sub"]
    },
    "text/vnd.esmertec.theme-descriptor": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/vnd.familysearch.gedcom": {
      source: "iana",
      extensions: ["ged"]
    },
    "text/vnd.ficlab.flt": {
      source: "iana"
    },
    "text/vnd.fly": {
      source: "iana",
      extensions: ["fly"]
    },
    "text/vnd.fmi.flexstor": {
      source: "iana",
      extensions: ["flx"]
    },
    "text/vnd.gml": {
      source: "iana"
    },
    "text/vnd.graphviz": {
      source: "iana",
      extensions: ["gv"]
    },
    "text/vnd.hans": {
      source: "iana"
    },
    "text/vnd.hgl": {
      source: "iana"
    },
    "text/vnd.in3d.3dml": {
      source: "iana",
      extensions: ["3dml"]
    },
    "text/vnd.in3d.spot": {
      source: "iana",
      extensions: ["spot"]
    },
    "text/vnd.iptc.newsml": {
      source: "iana"
    },
    "text/vnd.iptc.nitf": {
      source: "iana"
    },
    "text/vnd.latex-z": {
      source: "iana"
    },
    "text/vnd.motorola.reflex": {
      source: "iana"
    },
    "text/vnd.ms-mediapackage": {
      source: "iana"
    },
    "text/vnd.net2phone.commcenter.command": {
      source: "iana"
    },
    "text/vnd.radisys.msml-basic-layout": {
      source: "iana"
    },
    "text/vnd.senx.warpscript": {
      source: "iana"
    },
    "text/vnd.si.uricatalogue": {
      source: "iana"
    },
    "text/vnd.sosi": {
      source: "iana"
    },
    "text/vnd.sun.j2me.app-descriptor": {
      source: "iana",
      charset: "UTF-8",
      extensions: ["jad"]
    },
    "text/vnd.trolltech.linguist": {
      source: "iana",
      charset: "UTF-8"
    },
    "text/vnd.wap.si": {
      source: "iana"
    },
    "text/vnd.wap.sl": {
      source: "iana"
    },
    "text/vnd.wap.wml": {
      source: "iana",
      extensions: ["wml"]
    },
    "text/vnd.wap.wmlscript": {
      source: "iana",
      extensions: ["wmls"]
    },
    "text/vtt": {
      source: "iana",
      charset: "UTF-8",
      compressible: true,
      extensions: ["vtt"]
    },
    "text/x-asm": {
      source: "apache",
      extensions: ["s", "asm"]
    },
    "text/x-c": {
      source: "apache",
      extensions: ["c", "cc", "cxx", "cpp", "h", "hh", "dic"]
    },
    "text/x-component": {
      source: "nginx",
      extensions: ["htc"]
    },
    "text/x-fortran": {
      source: "apache",
      extensions: ["f", "for", "f77", "f90"]
    },
    "text/x-gwt-rpc": {
      compressible: true
    },
    "text/x-handlebars-template": {
      extensions: ["hbs"]
    },
    "text/x-java-source": {
      source: "apache",
      extensions: ["java"]
    },
    "text/x-jquery-tmpl": {
      compressible: true
    },
    "text/x-lua": {
      extensions: ["lua"]
    },
    "text/x-markdown": {
      compressible: true,
      extensions: ["mkd"]
    },
    "text/x-nfo": {
      source: "apache",
      extensions: ["nfo"]
    },
    "text/x-opml": {
      source: "apache",
      extensions: ["opml"]
    },
    "text/x-org": {
      compressible: true,
      extensions: ["org"]
    },
    "text/x-pascal": {
      source: "apache",
      extensions: ["p", "pas"]
    },
    "text/x-processing": {
      compressible: true,
      extensions: ["pde"]
    },
    "text/x-sass": {
      extensions: ["sass"]
    },
    "text/x-scss": {
      extensions: ["scss"]
    },
    "text/x-setext": {
      source: "apache",
      extensions: ["etx"]
    },
    "text/x-sfv": {
      source: "apache",
      extensions: ["sfv"]
    },
    "text/x-suse-ymp": {
      compressible: true,
      extensions: ["ymp"]
    },
    "text/x-uuencode": {
      source: "apache",
      extensions: ["uu"]
    },
    "text/x-vcalendar": {
      source: "apache",
      extensions: ["vcs"]
    },
    "text/x-vcard": {
      source: "apache",
      extensions: ["vcf"]
    },
    "text/xml": {
      source: "iana",
      compressible: true,
      extensions: ["xml"]
    },
    "text/xml-external-parsed-entity": {
      source: "iana"
    },
    "text/yaml": {
      compressible: true,
      extensions: ["yaml", "yml"]
    },
    "video/1d-interleaved-parityfec": {
      source: "iana"
    },
    "video/3gpp": {
      source: "iana",
      extensions: ["3gp", "3gpp"]
    },
    "video/3gpp-tt": {
      source: "iana"
    },
    "video/3gpp2": {
      source: "iana",
      extensions: ["3g2"]
    },
    "video/av1": {
      source: "iana"
    },
    "video/bmpeg": {
      source: "iana"
    },
    "video/bt656": {
      source: "iana"
    },
    "video/celb": {
      source: "iana"
    },
    "video/dv": {
      source: "iana"
    },
    "video/encaprtp": {
      source: "iana"
    },
    "video/ffv1": {
      source: "iana"
    },
    "video/flexfec": {
      source: "iana"
    },
    "video/h261": {
      source: "iana",
      extensions: ["h261"]
    },
    "video/h263": {
      source: "iana",
      extensions: ["h263"]
    },
    "video/h263-1998": {
      source: "iana"
    },
    "video/h263-2000": {
      source: "iana"
    },
    "video/h264": {
      source: "iana",
      extensions: ["h264"]
    },
    "video/h264-rcdo": {
      source: "iana"
    },
    "video/h264-svc": {
      source: "iana"
    },
    "video/h265": {
      source: "iana"
    },
    "video/iso.segment": {
      source: "iana",
      extensions: ["m4s"]
    },
    "video/jpeg": {
      source: "iana",
      extensions: ["jpgv"]
    },
    "video/jpeg2000": {
      source: "iana"
    },
    "video/jpm": {
      source: "apache",
      extensions: ["jpm", "jpgm"]
    },
    "video/jxsv": {
      source: "iana"
    },
    "video/mj2": {
      source: "iana",
      extensions: ["mj2", "mjp2"]
    },
    "video/mp1s": {
      source: "iana"
    },
    "video/mp2p": {
      source: "iana"
    },
    "video/mp2t": {
      source: "iana",
      extensions: ["ts"]
    },
    "video/mp4": {
      source: "iana",
      compressible: false,
      extensions: ["mp4", "mp4v", "mpg4"]
    },
    "video/mp4v-es": {
      source: "iana"
    },
    "video/mpeg": {
      source: "iana",
      compressible: false,
      extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"]
    },
    "video/mpeg4-generic": {
      source: "iana"
    },
    "video/mpv": {
      source: "iana"
    },
    "video/nv": {
      source: "iana"
    },
    "video/ogg": {
      source: "iana",
      compressible: false,
      extensions: ["ogv"]
    },
    "video/parityfec": {
      source: "iana"
    },
    "video/pointer": {
      source: "iana"
    },
    "video/quicktime": {
      source: "iana",
      compressible: false,
      extensions: ["qt", "mov"]
    },
    "video/raptorfec": {
      source: "iana"
    },
    "video/raw": {
      source: "iana"
    },
    "video/rtp-enc-aescm128": {
      source: "iana"
    },
    "video/rtploopback": {
      source: "iana"
    },
    "video/rtx": {
      source: "iana"
    },
    "video/scip": {
      source: "iana"
    },
    "video/smpte291": {
      source: "iana"
    },
    "video/smpte292m": {
      source: "iana"
    },
    "video/ulpfec": {
      source: "iana"
    },
    "video/vc1": {
      source: "iana"
    },
    "video/vc2": {
      source: "iana"
    },
    "video/vnd.cctv": {
      source: "iana"
    },
    "video/vnd.dece.hd": {
      source: "iana",
      extensions: ["uvh", "uvvh"]
    },
    "video/vnd.dece.mobile": {
      source: "iana",
      extensions: ["uvm", "uvvm"]
    },
    "video/vnd.dece.mp4": {
      source: "iana"
    },
    "video/vnd.dece.pd": {
      source: "iana",
      extensions: ["uvp", "uvvp"]
    },
    "video/vnd.dece.sd": {
      source: "iana",
      extensions: ["uvs", "uvvs"]
    },
    "video/vnd.dece.video": {
      source: "iana",
      extensions: ["uvv", "uvvv"]
    },
    "video/vnd.directv.mpeg": {
      source: "iana"
    },
    "video/vnd.directv.mpeg-tts": {
      source: "iana"
    },
    "video/vnd.dlna.mpeg-tts": {
      source: "iana"
    },
    "video/vnd.dvb.file": {
      source: "iana",
      extensions: ["dvb"]
    },
    "video/vnd.fvt": {
      source: "iana",
      extensions: ["fvt"]
    },
    "video/vnd.hns.video": {
      source: "iana"
    },
    "video/vnd.iptvforum.1dparityfec-1010": {
      source: "iana"
    },
    "video/vnd.iptvforum.1dparityfec-2005": {
      source: "iana"
    },
    "video/vnd.iptvforum.2dparityfec-1010": {
      source: "iana"
    },
    "video/vnd.iptvforum.2dparityfec-2005": {
      source: "iana"
    },
    "video/vnd.iptvforum.ttsavc": {
      source: "iana"
    },
    "video/vnd.iptvforum.ttsmpeg2": {
      source: "iana"
    },
    "video/vnd.motorola.video": {
      source: "iana"
    },
    "video/vnd.motorola.videop": {
      source: "iana"
    },
    "video/vnd.mpegurl": {
      source: "iana",
      extensions: ["mxu", "m4u"]
    },
    "video/vnd.ms-playready.media.pyv": {
      source: "iana",
      extensions: ["pyv"]
    },
    "video/vnd.nokia.interleaved-multimedia": {
      source: "iana"
    },
    "video/vnd.nokia.mp4vr": {
      source: "iana"
    },
    "video/vnd.nokia.videovoip": {
      source: "iana"
    },
    "video/vnd.objectvideo": {
      source: "iana"
    },
    "video/vnd.radgamettools.bink": {
      source: "iana"
    },
    "video/vnd.radgamettools.smacker": {
      source: "iana"
    },
    "video/vnd.sealed.mpeg1": {
      source: "iana"
    },
    "video/vnd.sealed.mpeg4": {
      source: "iana"
    },
    "video/vnd.sealed.swf": {
      source: "iana"
    },
    "video/vnd.sealedmedia.softseal.mov": {
      source: "iana"
    },
    "video/vnd.uvvu.mp4": {
      source: "iana",
      extensions: ["uvu", "uvvu"]
    },
    "video/vnd.vivo": {
      source: "iana",
      extensions: ["viv"]
    },
    "video/vnd.youtube.yt": {
      source: "iana"
    },
    "video/vp8": {
      source: "iana"
    },
    "video/vp9": {
      source: "iana"
    },
    "video/webm": {
      source: "apache",
      compressible: false,
      extensions: ["webm"]
    },
    "video/x-f4v": {
      source: "apache",
      extensions: ["f4v"]
    },
    "video/x-fli": {
      source: "apache",
      extensions: ["fli"]
    },
    "video/x-flv": {
      source: "apache",
      compressible: false,
      extensions: ["flv"]
    },
    "video/x-m4v": {
      source: "apache",
      extensions: ["m4v"]
    },
    "video/x-matroska": {
      source: "apache",
      compressible: false,
      extensions: ["mkv", "mk3d", "mks"]
    },
    "video/x-mng": {
      source: "apache",
      extensions: ["mng"]
    },
    "video/x-ms-asf": {
      source: "apache",
      extensions: ["asf", "asx"]
    },
    "video/x-ms-vob": {
      source: "apache",
      extensions: ["vob"]
    },
    "video/x-ms-wm": {
      source: "apache",
      extensions: ["wm"]
    },
    "video/x-ms-wmv": {
      source: "apache",
      compressible: false,
      extensions: ["wmv"]
    },
    "video/x-ms-wmx": {
      source: "apache",
      extensions: ["wmx"]
    },
    "video/x-ms-wvx": {
      source: "apache",
      extensions: ["wvx"]
    },
    "video/x-msvideo": {
      source: "apache",
      extensions: ["avi"]
    },
    "video/x-sgi-movie": {
      source: "apache",
      extensions: ["movie"]
    },
    "video/x-smv": {
      source: "apache",
      extensions: ["smv"]
    },
    "x-conference/x-cooltalk": {
      source: "apache",
      extensions: ["ice"]
    },
    "x-shader/x-fragment": {
      compressible: true
    },
    "x-shader/x-vertex": {
      compressible: true
    }
  };
});

// node_modules/mime-db/index.js
var require_mime_db = __commonJS((exports, module) => {
  /*!
   * mime-db
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015-2022 Douglas Christopher Wilson
   * MIT Licensed
   */
  module.exports = require_db();
});

// node_modules/mime-types/index.js
var require_mime_types = __commonJS((exports) => {
  var charset = function(type) {
    if (!type || typeof type !== "string") {
      return false;
    }
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    var mime = match && db[match[1].toLowerCase()];
    if (mime && mime.charset) {
      return mime.charset;
    }
    if (match && TEXT_TYPE_REGEXP.test(match[1])) {
      return "UTF-8";
    }
    return false;
  };
  var contentType = function(str) {
    if (!str || typeof str !== "string") {
      return false;
    }
    var mime = str.indexOf("/") === -1 ? exports.lookup(str) : str;
    if (!mime) {
      return false;
    }
    if (mime.indexOf("charset") === -1) {
      var charset2 = exports.charset(mime);
      if (charset2)
        mime += "; charset=" + charset2.toLowerCase();
    }
    return mime;
  };
  var extension = function(type) {
    if (!type || typeof type !== "string") {
      return false;
    }
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    var exts = match && exports.extensions[match[1].toLowerCase()];
    if (!exts || !exts.length) {
      return false;
    }
    return exts[0];
  };
  var lookup = function(path) {
    if (!path || typeof path !== "string") {
      return false;
    }
    var extension2 = extname("x." + path).toLowerCase().substr(1);
    if (!extension2) {
      return false;
    }
    return exports.types[extension2] || false;
  };
  var populateMaps = function(extensions, types) {
    var preference = ["nginx", "apache", undefined, "iana"];
    Object.keys(db).forEach(function forEachMimeType(type) {
      var mime = db[type];
      var exts = mime.extensions;
      if (!exts || !exts.length) {
        return;
      }
      extensions[type] = exts;
      for (var i = 0;i < exts.length; i++) {
        var extension2 = exts[i];
        if (types[extension2]) {
          var from = preference.indexOf(db[types[extension2]].source);
          var to = preference.indexOf(mime.source);
          if (types[extension2] !== "application/octet-stream" && (from > to || from === to && types[extension2].substr(0, 12) === "application/")) {
            continue;
          }
        }
        types[extension2] = type;
      }
    });
  };
  /*!
   * mime-types
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   */
  var db = require_mime_db();
  var extname = __require("path").extname;
  var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
  var TEXT_TYPE_REGEXP = /^text\//i;
  exports.charset = charset;
  exports.charsets = { lookup: charset };
  exports.contentType = contentType;
  exports.extension = extension;
  exports.extensions = Object.create(null);
  exports.lookup = lookup;
  exports.types = Object.create(null);
  populateMaps(exports.extensions, exports.types);
});

// node_modules/asynckit/lib/defer.js
var require_defer = __commonJS((exports, module) => {
  var defer = function(fn) {
    var nextTick = typeof setImmediate == "function" ? setImmediate : typeof process == "object" && typeof process.nextTick == "function" ? process.nextTick : null;
    if (nextTick) {
      nextTick(fn);
    } else {
      setTimeout(fn, 0);
    }
  };
  module.exports = defer;
});

// node_modules/asynckit/lib/async.js
var require_async = __commonJS((exports, module) => {
  var async = function(callback) {
    var isAsync = false;
    defer(function() {
      isAsync = true;
    });
    return function async_callback(err, result) {
      if (isAsync) {
        callback(err, result);
      } else {
        defer(function nextTick_callback() {
          callback(err, result);
        });
      }
    };
  };
  var defer = require_defer();
  module.exports = async;
});

// node_modules/asynckit/lib/abort.js
var require_abort = __commonJS((exports, module) => {
  var abort = function(state) {
    Object.keys(state.jobs).forEach(clean.bind(state));
    state.jobs = {};
  };
  var clean = function(key) {
    if (typeof this.jobs[key] == "function") {
      this.jobs[key]();
    }
  };
  module.exports = abort;
});

// node_modules/asynckit/lib/iterate.js
var require_iterate = __commonJS((exports, module) => {
  var iterate = function(list, iterator, state, callback) {
    var key = state["keyedList"] ? state["keyedList"][state.index] : state.index;
    state.jobs[key] = runJob(iterator, key, list[key], function(error, output) {
      if (!(key in state.jobs)) {
        return;
      }
      delete state.jobs[key];
      if (error) {
        abort(state);
      } else {
        state.results[key] = output;
      }
      callback(error, state.results);
    });
  };
  var runJob = function(iterator, key, item, callback) {
    var aborter;
    if (iterator.length == 2) {
      aborter = iterator(item, async(callback));
    } else {
      aborter = iterator(item, key, async(callback));
    }
    return aborter;
  };
  var async = require_async();
  var abort = require_abort();
  module.exports = iterate;
});

// node_modules/asynckit/lib/state.js
var require_state = __commonJS((exports, module) => {
  var state = function(list, sortMethod) {
    var isNamedList = !Array.isArray(list), initState = {
      index: 0,
      keyedList: isNamedList || sortMethod ? Object.keys(list) : null,
      jobs: {},
      results: isNamedList ? {} : [],
      size: isNamedList ? Object.keys(list).length : list.length
    };
    if (sortMethod) {
      initState.keyedList.sort(isNamedList ? sortMethod : function(a, b) {
        return sortMethod(list[a], list[b]);
      });
    }
    return initState;
  };
  module.exports = state;
});

// node_modules/asynckit/lib/terminator.js
var require_terminator = __commonJS((exports, module) => {
  var terminator = function(callback) {
    if (!Object.keys(this.jobs).length) {
      return;
    }
    this.index = this.size;
    abort(this);
    async(callback)(null, this.results);
  };
  var abort = require_abort();
  var async = require_async();
  module.exports = terminator;
});

// node_modules/asynckit/parallel.js
var require_parallel = __commonJS((exports, module) => {
  var parallel = function(list, iterator, callback) {
    var state = initState(list);
    while (state.index < (state["keyedList"] || list).length) {
      iterate(list, iterator, state, function(error, result) {
        if (error) {
          callback(error, result);
          return;
        }
        if (Object.keys(state.jobs).length === 0) {
          callback(null, state.results);
          return;
        }
      });
      state.index++;
    }
    return terminator.bind(state, callback);
  };
  var iterate = require_iterate();
  var initState = require_state();
  var terminator = require_terminator();
  module.exports = parallel;
});

// node_modules/asynckit/serialOrdered.js
var require_serialOrdered = __commonJS((exports, module) => {
  var serialOrdered = function(list, iterator, sortMethod, callback) {
    var state = initState(list, sortMethod);
    iterate(list, iterator, state, function iteratorHandler(error, result) {
      if (error) {
        callback(error, result);
        return;
      }
      state.index++;
      if (state.index < (state["keyedList"] || list).length) {
        iterate(list, iterator, state, iteratorHandler);
        return;
      }
      callback(null, state.results);
    });
    return terminator.bind(state, callback);
  };
  var ascending = function(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  };
  var descending = function(a, b) {
    return -1 * ascending(a, b);
  };
  var iterate = require_iterate();
  var initState = require_state();
  var terminator = require_terminator();
  module.exports = serialOrdered;
  module.exports.ascending = ascending;
  module.exports.descending = descending;
});

// node_modules/asynckit/serial.js
var require_serial = __commonJS((exports, module) => {
  var serial = function(list, iterator, callback) {
    return serialOrdered(list, iterator, null, callback);
  };
  var serialOrdered = require_serialOrdered();
  module.exports = serial;
});

// node_modules/asynckit/index.js
var require_asynckit = __commonJS((exports, module) => {
  module.exports = {
    parallel: require_parallel(),
    serial: require_serial(),
    serialOrdered: require_serialOrdered()
  };
});

// node_modules/axios/node_modules/form-data/lib/populate.js
var require_populate = __commonJS((exports, module) => {
  module.exports = function(dst, src) {
    Object.keys(src).forEach(function(prop) {
      dst[prop] = dst[prop] || src[prop];
    });
    return dst;
  };
});

// node_modules/axios/node_modules/form-data/lib/form_data.js
var require_form_data = __commonJS((exports, module) => {
  var FormData2 = function(options) {
    if (!(this instanceof FormData2)) {
      return new FormData2(options);
    }
    this._overheadLength = 0;
    this._valueLength = 0;
    this._valuesToMeasure = [];
    CombinedStream.call(this);
    options = options || {};
    for (var option in options) {
      this[option] = options[option];
    }
  };
  var CombinedStream = require_combined_stream();
  var util = __require("util");
  var path = __require("path");
  var http = __require("http");
  var https = __require("https");
  var parseUrl = __require("url").parse;
  var fs = __require("fs");
  var Stream = __require("stream").Stream;
  var mime = require_mime_types();
  var asynckit = require_asynckit();
  var populate = require_populate();
  module.exports = FormData2;
  util.inherits(FormData2, CombinedStream);
  FormData2.LINE_BREAK = "\r\n";
  FormData2.DEFAULT_CONTENT_TYPE = "application/octet-stream";
  FormData2.prototype.append = function(field, value, options) {
    options = options || {};
    if (typeof options == "string") {
      options = { filename: options };
    }
    var append = CombinedStream.prototype.append.bind(this);
    if (typeof value == "number") {
      value = "" + value;
    }
    if (util.isArray(value)) {
      this._error(new Error("Arrays are not supported."));
      return;
    }
    var header = this._multiPartHeader(field, value, options);
    var footer = this._multiPartFooter();
    append(header);
    append(value);
    append(footer);
    this._trackLength(header, value, options);
  };
  FormData2.prototype._trackLength = function(header, value, options) {
    var valueLength = 0;
    if (options.knownLength != null) {
      valueLength += +options.knownLength;
    } else if (Buffer.isBuffer(value)) {
      valueLength = value.length;
    } else if (typeof value === "string") {
      valueLength = Buffer.byteLength(value);
    }
    this._valueLength += valueLength;
    this._overheadLength += Buffer.byteLength(header) + FormData2.LINE_BREAK.length;
    if (!value || !value.path && !(value.readable && value.hasOwnProperty("httpVersion")) && !(value instanceof Stream)) {
      return;
    }
    if (!options.knownLength) {
      this._valuesToMeasure.push(value);
    }
  };
  FormData2.prototype._lengthRetriever = function(value, callback) {
    if (value.hasOwnProperty("fd")) {
      if (value.end != null && value.end != Infinity && value.start != null) {
        callback(null, value.end + 1 - (value.start ? value.start : 0));
      } else {
        fs.stat(value.path, function(err, stat) {
          var fileSize;
          if (err) {
            callback(err);
            return;
          }
          fileSize = stat.size - (value.start ? value.start : 0);
          callback(null, fileSize);
        });
      }
    } else if (value.hasOwnProperty("httpVersion")) {
      callback(null, +value.headers["content-length"]);
    } else if (value.hasOwnProperty("httpModule")) {
      value.on("response", function(response) {
        value.pause();
        callback(null, +response.headers["content-length"]);
      });
      value.resume();
    } else {
      callback("Unknown stream");
    }
  };
  FormData2.prototype._multiPartHeader = function(field, value, options) {
    if (typeof options.header == "string") {
      return options.header;
    }
    var contentDisposition = this._getContentDisposition(value, options);
    var contentType = this._getContentType(value, options);
    var contents = "";
    var headers = {
      "Content-Disposition": ["form-data", 'name="' + field + '"'].concat(contentDisposition || []),
      "Content-Type": [].concat(contentType || [])
    };
    if (typeof options.header == "object") {
      populate(headers, options.header);
    }
    var header;
    for (var prop in headers) {
      if (!headers.hasOwnProperty(prop))
        continue;
      header = headers[prop];
      if (header == null) {
        continue;
      }
      if (!Array.isArray(header)) {
        header = [header];
      }
      if (header.length) {
        contents += prop + ": " + header.join("; ") + FormData2.LINE_BREAK;
      }
    }
    return "--" + this.getBoundary() + FormData2.LINE_BREAK + contents + FormData2.LINE_BREAK;
  };
  FormData2.prototype._getContentDisposition = function(value, options) {
    var filename, contentDisposition;
    if (typeof options.filepath === "string") {
      filename = path.normalize(options.filepath).replace(/\\/g, "/");
    } else if (options.filename || value.name || value.path) {
      filename = path.basename(options.filename || value.name || value.path);
    } else if (value.readable && value.hasOwnProperty("httpVersion")) {
      filename = path.basename(value.client._httpMessage.path || "");
    }
    if (filename) {
      contentDisposition = 'filename="' + filename + '"';
    }
    return contentDisposition;
  };
  FormData2.prototype._getContentType = function(value, options) {
    var contentType = options.contentType;
    if (!contentType && value.name) {
      contentType = mime.lookup(value.name);
    }
    if (!contentType && value.path) {
      contentType = mime.lookup(value.path);
    }
    if (!contentType && value.readable && value.hasOwnProperty("httpVersion")) {
      contentType = value.headers["content-type"];
    }
    if (!contentType && (options.filepath || options.filename)) {
      contentType = mime.lookup(options.filepath || options.filename);
    }
    if (!contentType && typeof value == "object") {
      contentType = FormData2.DEFAULT_CONTENT_TYPE;
    }
    return contentType;
  };
  FormData2.prototype._multiPartFooter = function() {
    return function(next) {
      var footer = FormData2.LINE_BREAK;
      var lastPart = this._streams.length === 0;
      if (lastPart) {
        footer += this._lastBoundary();
      }
      next(footer);
    }.bind(this);
  };
  FormData2.prototype._lastBoundary = function() {
    return "--" + this.getBoundary() + "--" + FormData2.LINE_BREAK;
  };
  FormData2.prototype.getHeaders = function(userHeaders) {
    var header;
    var formHeaders = {
      "content-type": "multipart/form-data; boundary=" + this.getBoundary()
    };
    for (header in userHeaders) {
      if (userHeaders.hasOwnProperty(header)) {
        formHeaders[header.toLowerCase()] = userHeaders[header];
      }
    }
    return formHeaders;
  };
  FormData2.prototype.setBoundary = function(boundary) {
    this._boundary = boundary;
  };
  FormData2.prototype.getBoundary = function() {
    if (!this._boundary) {
      this._generateBoundary();
    }
    return this._boundary;
  };
  FormData2.prototype.getBuffer = function() {
    var dataBuffer = new Buffer.alloc(0);
    var boundary = this.getBoundary();
    for (var i = 0, len = this._streams.length;i < len; i++) {
      if (typeof this._streams[i] !== "function") {
        if (Buffer.isBuffer(this._streams[i])) {
          dataBuffer = Buffer.concat([dataBuffer, this._streams[i]]);
        } else {
          dataBuffer = Buffer.concat([dataBuffer, Buffer.from(this._streams[i])]);
        }
        if (typeof this._streams[i] !== "string" || this._streams[i].substring(2, boundary.length + 2) !== boundary) {
          dataBuffer = Buffer.concat([dataBuffer, Buffer.from(FormData2.LINE_BREAK)]);
        }
      }
    }
    return Buffer.concat([dataBuffer, Buffer.from(this._lastBoundary())]);
  };
  FormData2.prototype._generateBoundary = function() {
    var boundary = "--------------------------";
    for (var i = 0;i < 24; i++) {
      boundary += Math.floor(Math.random() * 10).toString(16);
    }
    this._boundary = boundary;
  };
  FormData2.prototype.getLengthSync = function() {
    var knownLength = this._overheadLength + this._valueLength;
    if (this._streams.length) {
      knownLength += this._lastBoundary().length;
    }
    if (!this.hasKnownLength()) {
      this._error(new Error("Cannot calculate proper length in synchronous way."));
    }
    return knownLength;
  };
  FormData2.prototype.hasKnownLength = function() {
    var hasKnownLength = true;
    if (this._valuesToMeasure.length) {
      hasKnownLength = false;
    }
    return hasKnownLength;
  };
  FormData2.prototype.getLength = function(cb) {
    var knownLength = this._overheadLength + this._valueLength;
    if (this._streams.length) {
      knownLength += this._lastBoundary().length;
    }
    if (!this._valuesToMeasure.length) {
      process.nextTick(cb.bind(this, null, knownLength));
      return;
    }
    asynckit.parallel(this._valuesToMeasure, this._lengthRetriever, function(err, values) {
      if (err) {
        cb(err);
        return;
      }
      values.forEach(function(length) {
        knownLength += length;
      });
      cb(null, knownLength);
    });
  };
  FormData2.prototype.submit = function(params, cb) {
    var request, options, defaults = { method: "post" };
    if (typeof params == "string") {
      params = parseUrl(params);
      options = populate({
        port: params.port,
        path: params.pathname,
        host: params.hostname,
        protocol: params.protocol
      }, defaults);
    } else {
      options = populate(params, defaults);
      if (!options.port) {
        options.port = options.protocol == "https:" ? 443 : 80;
      }
    }
    options.headers = this.getHeaders(params.headers);
    if (options.protocol == "https:") {
      request = https.request(options);
    } else {
      request = http.request(options);
    }
    this.getLength(function(err, length) {
      if (err && err !== "Unknown stream") {
        this._error(err);
        return;
      }
      if (length) {
        request.setHeader("Content-Length", length);
      }
      this.pipe(request);
      if (cb) {
        var onResponse;
        var callback = function(error, responce) {
          request.removeListener("error", callback);
          request.removeListener("response", onResponse);
          return cb.call(this, error, responce);
        };
        onResponse = callback.bind(this, null);
        request.on("error", callback);
        request.on("response", onResponse);
      }
    }.bind(this));
    return request;
  };
  FormData2.prototype._error = function(err) {
    if (!this.error) {
      this.error = err;
      this.pause();
      this.emit("error", err);
    }
  };
  FormData2.prototype.toString = function() {
    return "[object FormData]";
  };
});

// node_modules/ms/index.js
var require_ms = __commonJS((exports, module) => {
  var parse = function(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return;
    }
  };
  var fmtShort = function(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return Math.round(ms / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + "s";
    }
    return ms + "ms";
  };
  var fmtLong = function(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return plural(ms, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, "second");
    }
    return ms + " ms";
  };
  var plural = function(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
  };
  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
  };
});

// node_modules/debug/src/common.js
var require_common = __commonJS((exports, module) => {
  var setup = function(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self2 = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self2.diff = ms;
        self2.prev = prevTime;
        self2.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self2, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self2, args);
        const logFn = self2.log || createDebug.log;
        logFn.apply(self2, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend2;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend2(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      let i;
      const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
      const len = split.length;
      for (i = 0;i < len; i++) {
        if (!split[i]) {
          continue;
        }
        namespaces = split[i].replace(/\*/g, ".*?");
        if (namespaces[0] === "-") {
          createDebug.skips.push(new RegExp("^" + namespaces.slice(1) + "$"));
        } else {
          createDebug.names.push(new RegExp("^" + namespaces + "$"));
        }
      }
    }
    function disable() {
      const namespaces = [
        ...createDebug.names.map(toNamespace),
        ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      if (name[name.length - 1] === "*") {
        return true;
      }
      let i;
      let len;
      for (i = 0, len = createDebug.skips.length;i < len; i++) {
        if (createDebug.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = createDebug.names.length;i < len; i++) {
        if (createDebug.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }
    function toNamespace(regexp) {
      return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  };
  module.exports = setup;
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS((exports, module) => {
  var useColors = function() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  };
  var formatArgs = function(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  };
  var save = function(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {
    }
  };
  var load = function() {
    let r;
    try {
      r = exports.storage.getItem("debug");
    } catch (error) {
    }
    if (!r && typeof process !== "undefined" && ("env" in process)) {
      r = process.env.DEBUG;
    }
    return r;
  };
  var localstorage = function() {
    try {
      return localStorage;
    } catch (error) {
    }
  };
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  exports.log = console.debug || console.log || (() => {
  });
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// node_modules/debug/src/node.js
var require_node = __commonJS((exports, module) => {
  var useColors = function() {
    return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
  };
  var formatArgs = function(args) {
    const { namespace: name, useColors: useColors2 } = this;
    if (useColors2) {
      const c = this.color;
      const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
      const prefix = `  ${colorCode};1m${name} \x1B[0m`;
      args[0] = prefix + args[0].split("\n").join("\n" + prefix);
      args.push(colorCode + "m+" + exports.humanize(this.diff) + "\x1B[0m");
    } else {
      args[0] = getDate() + name + " " + args[0];
    }
  };
  var getDate = function() {
    if (exports.inspectOpts.hideDate) {
      return "";
    }
    return new Date().toISOString() + " ";
  };
  var log = function(...args) {
    return process.stderr.write(util.format(...args) + "\n");
  };
  var save = function(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  };
  var load = function() {
    return process.env.DEBUG;
  };
  var init = function(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0;i < keys.length; i++) {
      debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
  };
  var tty = __require("tty");
  var util = __require("util");
  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.destroy = util.deprecate(() => {
  }, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  exports.colors = [6, 2, 3, 4, 5, 1];
  try {
    const supportsColor = (()=>{ throw new Error(`Cannot require module "supports-color"`);})();
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
      exports.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ];
    }
  } catch (error) {
  }
  exports.inspectOpts = Object.keys(process.env).filter((key) => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === "null") {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {});
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
  };
  formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts);
  };
});

// node_modules/debug/src/index.js
var require_src = __commonJS((exports, module) => {
  if (typeof process === "undefined" || process.type === "renderer" || false || process.__nwjs) {
    module.exports = require_browser();
  } else {
    module.exports = require_node();
  }
});

// node_modules/follow-redirects/debug.js
var require_debug = __commonJS((exports, module) => {
  var debug;
  module.exports = function() {
    if (!debug) {
      try {
        debug = require_src()("follow-redirects");
      } catch (error) {
      }
      if (typeof debug !== "function") {
        debug = function() {
        };
      }
    }
    debug.apply(null, arguments);
  };
});

// node_modules/follow-redirects/index.js
var require_follow_redirects = __commonJS((exports, module) => {
  var RedirectableRequest = function(options, responseCallback) {
    Writable.call(this);
    this._sanitizeOptions(options);
    this._options = options;
    this._ended = false;
    this._ending = false;
    this._redirectCount = 0;
    this._redirects = [];
    this._requestBodyLength = 0;
    this._requestBodyBuffers = [];
    if (responseCallback) {
      this.on("response", responseCallback);
    }
    var self2 = this;
    this._onNativeResponse = function(response) {
      self2._processResponse(response);
    };
    this._performRequest();
  };
  var wrap = function(protocols) {
    var exports2 = {
      maxRedirects: 21,
      maxBodyLength: 10 * 1024 * 1024
    };
    var nativeProtocols = {};
    Object.keys(protocols).forEach(function(scheme) {
      var protocol = scheme + ":";
      var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
      var wrappedProtocol = exports2[scheme] = Object.create(nativeProtocol);
      function request(input, options, callback) {
        if (isString2(input)) {
          var parsed;
          try {
            parsed = urlToOptions(new URL2(input));
          } catch (err) {
            parsed = url2.parse(input);
          }
          if (!isString2(parsed.protocol)) {
            throw new InvalidUrlError({ input });
          }
          input = parsed;
        } else if (URL2 && input instanceof URL2) {
          input = urlToOptions(input);
        } else {
          callback = options;
          options = input;
          input = { protocol };
        }
        if (isFunction2(options)) {
          callback = options;
          options = null;
        }
        options = Object.assign({
          maxRedirects: exports2.maxRedirects,
          maxBodyLength: exports2.maxBodyLength
        }, input, options);
        options.nativeProtocols = nativeProtocols;
        if (!isString2(options.host) && !isString2(options.hostname)) {
          options.hostname = "::1";
        }
        assert.equal(options.protocol, protocol, "protocol mismatch");
        debug("options", options);
        return new RedirectableRequest(options, callback);
      }
      function get(input, options, callback) {
        var wrappedRequest = wrappedProtocol.request(input, options, callback);
        wrappedRequest.end();
        return wrappedRequest;
      }
      Object.defineProperties(wrappedProtocol, {
        request: { value: request, configurable: true, enumerable: true, writable: true },
        get: { value: get, configurable: true, enumerable: true, writable: true }
      });
    });
    return exports2;
  };
  var noop2 = function() {
  };
  var urlToOptions = function(urlObject) {
    var options = {
      protocol: urlObject.protocol,
      hostname: urlObject.hostname.startsWith("[") ? urlObject.hostname.slice(1, -1) : urlObject.hostname,
      hash: urlObject.hash,
      search: urlObject.search,
      pathname: urlObject.pathname,
      path: urlObject.pathname + urlObject.search,
      href: urlObject.href
    };
    if (urlObject.port !== "") {
      options.port = Number(urlObject.port);
    }
    return options;
  };
  var removeMatchingHeaders = function(regex, headers) {
    var lastValue;
    for (var header in headers) {
      if (regex.test(header)) {
        lastValue = headers[header];
        delete headers[header];
      }
    }
    return lastValue === null || typeof lastValue === "undefined" ? undefined : String(lastValue).trim();
  };
  var createErrorType = function(code, message, baseClass) {
    function CustomError(properties) {
      Error.captureStackTrace(this, this.constructor);
      Object.assign(this, properties || {});
      this.code = code;
      this.message = this.cause ? message + ": " + this.cause.message : message;
    }
    CustomError.prototype = new (baseClass || Error);
    CustomError.prototype.constructor = CustomError;
    CustomError.prototype.name = "Error [" + code + "]";
    return CustomError;
  };
  var destroyRequest = function(request, error) {
    for (var event of events) {
      request.removeListener(event, eventHandlers[event]);
    }
    request.on("error", noop2);
    request.destroy(error);
  };
  var isSubdomain = function(subdomain, domain) {
    assert(isString2(subdomain) && isString2(domain));
    var dot = subdomain.length - domain.length - 1;
    return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
  };
  var isString2 = function(value) {
    return typeof value === "string" || value instanceof String;
  };
  var isFunction2 = function(value) {
    return typeof value === "function";
  };
  var isBuffer2 = function(value) {
    return typeof value === "object" && ("length" in value);
  };
  var url2 = __require("url");
  var URL2 = url2.URL;
  var http = __require("http");
  var https = __require("https");
  var Writable = __require("stream").Writable;
  var assert = __require("assert");
  var debug = require_debug();
  var events = ["abort", "aborted", "connect", "error", "socket", "timeout"];
  var eventHandlers = Object.create(null);
  events.forEach(function(event) {
    eventHandlers[event] = function(arg1, arg2, arg3) {
      this._redirectable.emit(event, arg1, arg2, arg3);
    };
  });
  var InvalidUrlError = createErrorType("ERR_INVALID_URL", "Invalid URL", TypeError);
  var RedirectionError = createErrorType("ERR_FR_REDIRECTION_FAILURE", "Redirected request failed");
  var TooManyRedirectsError = createErrorType("ERR_FR_TOO_MANY_REDIRECTS", "Maximum number of redirects exceeded");
  var MaxBodyLengthExceededError = createErrorType("ERR_FR_MAX_BODY_LENGTH_EXCEEDED", "Request body larger than maxBodyLength limit");
  var WriteAfterEndError = createErrorType("ERR_STREAM_WRITE_AFTER_END", "write after end");
  var destroy = Writable.prototype.destroy || noop2;
  RedirectableRequest.prototype = Object.create(Writable.prototype);
  RedirectableRequest.prototype.abort = function() {
    destroyRequest(this._currentRequest);
    this._currentRequest.abort();
    this.emit("abort");
  };
  RedirectableRequest.prototype.destroy = function(error) {
    destroyRequest(this._currentRequest, error);
    destroy.call(this, error);
    return this;
  };
  RedirectableRequest.prototype.write = function(data, encoding, callback) {
    if (this._ending) {
      throw new WriteAfterEndError;
    }
    if (!isString2(data) && !isBuffer2(data)) {
      throw new TypeError("data should be a string, Buffer or Uint8Array");
    }
    if (isFunction2(encoding)) {
      callback = encoding;
      encoding = null;
    }
    if (data.length === 0) {
      if (callback) {
        callback();
      }
      return;
    }
    if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
      this._requestBodyLength += data.length;
      this._requestBodyBuffers.push({ data, encoding });
      this._currentRequest.write(data, encoding, callback);
    } else {
      this.emit("error", new MaxBodyLengthExceededError);
      this.abort();
    }
  };
  RedirectableRequest.prototype.end = function(data, encoding, callback) {
    if (isFunction2(data)) {
      callback = data;
      data = encoding = null;
    } else if (isFunction2(encoding)) {
      callback = encoding;
      encoding = null;
    }
    if (!data) {
      this._ended = this._ending = true;
      this._currentRequest.end(null, null, callback);
    } else {
      var self2 = this;
      var currentRequest = this._currentRequest;
      this.write(data, encoding, function() {
        self2._ended = true;
        currentRequest.end(null, null, callback);
      });
      this._ending = true;
    }
  };
  RedirectableRequest.prototype.setHeader = function(name, value) {
    this._options.headers[name] = value;
    this._currentRequest.setHeader(name, value);
  };
  RedirectableRequest.prototype.removeHeader = function(name) {
    delete this._options.headers[name];
    this._currentRequest.removeHeader(name);
  };
  RedirectableRequest.prototype.setTimeout = function(msecs, callback) {
    var self2 = this;
    function destroyOnTimeout(socket) {
      socket.setTimeout(msecs);
      socket.removeListener("timeout", socket.destroy);
      socket.addListener("timeout", socket.destroy);
    }
    function startTimer(socket) {
      if (self2._timeout) {
        clearTimeout(self2._timeout);
      }
      self2._timeout = setTimeout(function() {
        self2.emit("timeout");
        clearTimer();
      }, msecs);
      destroyOnTimeout(socket);
    }
    function clearTimer() {
      if (self2._timeout) {
        clearTimeout(self2._timeout);
        self2._timeout = null;
      }
      self2.removeListener("abort", clearTimer);
      self2.removeListener("error", clearTimer);
      self2.removeListener("response", clearTimer);
      self2.removeListener("close", clearTimer);
      if (callback) {
        self2.removeListener("timeout", callback);
      }
      if (!self2.socket) {
        self2._currentRequest.removeListener("socket", startTimer);
      }
    }
    if (callback) {
      this.on("timeout", callback);
    }
    if (this.socket) {
      startTimer(this.socket);
    } else {
      this._currentRequest.once("socket", startTimer);
    }
    this.on("socket", destroyOnTimeout);
    this.on("abort", clearTimer);
    this.on("error", clearTimer);
    this.on("response", clearTimer);
    this.on("close", clearTimer);
    return this;
  };
  [
    "flushHeaders",
    "getHeader",
    "setNoDelay",
    "setSocketKeepAlive"
  ].forEach(function(method) {
    RedirectableRequest.prototype[method] = function(a, b) {
      return this._currentRequest[method](a, b);
    };
  });
  ["aborted", "connection", "socket"].forEach(function(property) {
    Object.defineProperty(RedirectableRequest.prototype, property, {
      get: function() {
        return this._currentRequest[property];
      }
    });
  });
  RedirectableRequest.prototype._sanitizeOptions = function(options) {
    if (!options.headers) {
      options.headers = {};
    }
    if (options.host) {
      if (!options.hostname) {
        options.hostname = options.host;
      }
      delete options.host;
    }
    if (!options.pathname && options.path) {
      var searchPos = options.path.indexOf("?");
      if (searchPos < 0) {
        options.pathname = options.path;
      } else {
        options.pathname = options.path.substring(0, searchPos);
        options.search = options.path.substring(searchPos);
      }
    }
  };
  RedirectableRequest.prototype._performRequest = function() {
    var protocol = this._options.protocol;
    var nativeProtocol = this._options.nativeProtocols[protocol];
    if (!nativeProtocol) {
      this.emit("error", new TypeError("Unsupported protocol " + protocol));
      return;
    }
    if (this._options.agents) {
      var scheme = protocol.slice(0, -1);
      this._options.agent = this._options.agents[scheme];
    }
    var request = this._currentRequest = nativeProtocol.request(this._options, this._onNativeResponse);
    request._redirectable = this;
    for (var event of events) {
      request.on(event, eventHandlers[event]);
    }
    this._currentUrl = /^\//.test(this._options.path) ? url2.format(this._options) : this._options.path;
    if (this._isRedirect) {
      var i = 0;
      var self2 = this;
      var buffers = this._requestBodyBuffers;
      (function writeNext(error) {
        if (request === self2._currentRequest) {
          if (error) {
            self2.emit("error", error);
          } else if (i < buffers.length) {
            var buffer = buffers[i++];
            if (!request.finished) {
              request.write(buffer.data, buffer.encoding, writeNext);
            }
          } else if (self2._ended) {
            request.end();
          }
        }
      })();
    }
  };
  RedirectableRequest.prototype._processResponse = function(response) {
    var statusCode = response.statusCode;
    if (this._options.trackRedirects) {
      this._redirects.push({
        url: this._currentUrl,
        headers: response.headers,
        statusCode
      });
    }
    var location = response.headers.location;
    if (!location || this._options.followRedirects === false || statusCode < 300 || statusCode >= 400) {
      response.responseUrl = this._currentUrl;
      response.redirects = this._redirects;
      this.emit("response", response);
      this._requestBodyBuffers = [];
      return;
    }
    destroyRequest(this._currentRequest);
    response.destroy();
    if (++this._redirectCount > this._options.maxRedirects) {
      this.emit("error", new TooManyRedirectsError);
      return;
    }
    var requestHeaders;
    var beforeRedirect = this._options.beforeRedirect;
    if (beforeRedirect) {
      requestHeaders = Object.assign({
        Host: response.req.getHeader("host")
      }, this._options.headers);
    }
    var method = this._options.method;
    if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" || statusCode === 303 && !/^(?:GET|HEAD)$/.test(this._options.method)) {
      this._options.method = "GET";
      this._requestBodyBuffers = [];
      removeMatchingHeaders(/^content-/i, this._options.headers);
    }
    var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);
    var currentUrlParts = url2.parse(this._currentUrl);
    var currentHost = currentHostHeader || currentUrlParts.host;
    var currentUrl = /^\w+:/.test(location) ? this._currentUrl : url2.format(Object.assign(currentUrlParts, { host: currentHost }));
    var redirectUrl;
    try {
      redirectUrl = url2.resolve(currentUrl, location);
    } catch (cause) {
      this.emit("error", new RedirectionError({ cause }));
      return;
    }
    debug("redirecting to", redirectUrl);
    this._isRedirect = true;
    var redirectUrlParts = url2.parse(redirectUrl);
    Object.assign(this._options, redirectUrlParts);
    if (redirectUrlParts.protocol !== currentUrlParts.protocol && redirectUrlParts.protocol !== "https:" || redirectUrlParts.host !== currentHost && !isSubdomain(redirectUrlParts.host, currentHost)) {
      removeMatchingHeaders(/^(?:authorization|cookie)$/i, this._options.headers);
    }
    if (isFunction2(beforeRedirect)) {
      var responseDetails = {
        headers: response.headers,
        statusCode
      };
      var requestDetails = {
        url: currentUrl,
        method,
        headers: requestHeaders
      };
      try {
        beforeRedirect(this._options, responseDetails, requestDetails);
      } catch (err) {
        this.emit("error", err);
        return;
      }
      this._sanitizeOptions(this._options);
    }
    try {
      this._performRequest();
    } catch (cause) {
      this.emit("error", new RedirectionError({ cause }));
    }
  };
  module.exports = wrap({ http, https });
  module.exports.wrap = wrap;
});

// node_modules/adm-zip/util/fileSystem.js
var require_fileSystem = __commonJS((exports) => {
  exports.require = function() {
    if (typeof process === "object" && process.versions && process.versions["electron"]) {
      try {
        const originalFs = (()=>{ throw new Error(`Cannot require module "original-fs"`);})();
        if (Object.keys(originalFs).length > 0) {
          return originalFs;
        }
      } catch (e) {
      }
    }
    return __require("fs");
  };
});

// node_modules/adm-zip/util/constants.js
var require_constants = __commonJS((exports, module) => {
  module.exports = {
    LOCHDR: 30,
    LOCSIG: 67324752,
    LOCVER: 4,
    LOCFLG: 6,
    LOCHOW: 8,
    LOCTIM: 10,
    LOCCRC: 14,
    LOCSIZ: 18,
    LOCLEN: 22,
    LOCNAM: 26,
    LOCEXT: 28,
    EXTSIG: 134695760,
    EXTHDR: 16,
    EXTCRC: 4,
    EXTSIZ: 8,
    EXTLEN: 12,
    CENHDR: 46,
    CENSIG: 33639248,
    CENVEM: 4,
    CENVER: 6,
    CENFLG: 8,
    CENHOW: 10,
    CENTIM: 12,
    CENCRC: 16,
    CENSIZ: 20,
    CENLEN: 24,
    CENNAM: 28,
    CENEXT: 30,
    CENCOM: 32,
    CENDSK: 34,
    CENATT: 36,
    CENATX: 38,
    CENOFF: 42,
    ENDHDR: 22,
    ENDSIG: 101010256,
    ENDSUB: 8,
    ENDTOT: 10,
    ENDSIZ: 12,
    ENDOFF: 16,
    ENDCOM: 20,
    END64HDR: 20,
    END64SIG: 117853008,
    END64START: 4,
    END64OFF: 8,
    END64NUMDISKS: 16,
    ZIP64SIG: 101075792,
    ZIP64HDR: 56,
    ZIP64LEAD: 12,
    ZIP64SIZE: 4,
    ZIP64VEM: 12,
    ZIP64VER: 14,
    ZIP64DSK: 16,
    ZIP64DSKDIR: 20,
    ZIP64SUB: 24,
    ZIP64TOT: 32,
    ZIP64SIZB: 40,
    ZIP64OFF: 48,
    ZIP64EXTRA: 56,
    STORED: 0,
    SHRUNK: 1,
    REDUCED1: 2,
    REDUCED2: 3,
    REDUCED3: 4,
    REDUCED4: 5,
    IMPLODED: 6,
    DEFLATED: 8,
    ENHANCED_DEFLATED: 9,
    PKWARE: 10,
    BZIP2: 12,
    LZMA: 14,
    IBM_TERSE: 18,
    IBM_LZ77: 19,
    AES_ENCRYPT: 99,
    FLG_ENC: 1,
    FLG_COMP1: 2,
    FLG_COMP2: 4,
    FLG_DESC: 8,
    FLG_ENH: 16,
    FLG_PATCH: 32,
    FLG_STR: 64,
    FLG_EFS: 2048,
    FLG_MSK: 4096,
    FILE: 2,
    BUFFER: 1,
    NONE: 0,
    EF_ID: 0,
    EF_SIZE: 2,
    ID_ZIP64: 1,
    ID_AVINFO: 7,
    ID_PFS: 8,
    ID_OS2: 9,
    ID_NTFS: 10,
    ID_OPENVMS: 12,
    ID_UNIX: 13,
    ID_FORK: 14,
    ID_PATCH: 15,
    ID_X509_PKCS7: 20,
    ID_X509_CERTID_F: 21,
    ID_X509_CERTID_C: 22,
    ID_STRONGENC: 23,
    ID_RECORD_MGT: 24,
    ID_X509_PKCS7_RL: 25,
    ID_IBM1: 101,
    ID_IBM2: 102,
    ID_POSZIP: 18064,
    EF_ZIP64_OR_32: 4294967295,
    EF_ZIP64_OR_16: 65535,
    EF_ZIP64_SUNCOMP: 0,
    EF_ZIP64_SCOMP: 8,
    EF_ZIP64_RHO: 16,
    EF_ZIP64_DSN: 24
  };
});

// node_modules/adm-zip/util/errors.js
var require_errors = __commonJS((exports, module) => {
  module.exports = {
    INVALID_LOC: "Invalid LOC header (bad signature)",
    INVALID_CEN: "Invalid CEN header (bad signature)",
    INVALID_END: "Invalid END header (bad signature)",
    NO_DATA: "Nothing to decompress",
    BAD_CRC: "CRC32 checksum failed",
    FILE_IN_THE_WAY: "There is a file in the way: %s",
    UNKNOWN_METHOD: "Invalid/unsupported compression method",
    AVAIL_DATA: "inflate::Available inflate data did not terminate",
    INVALID_DISTANCE: "inflate::Invalid literal/length or distance code in fixed or dynamic block",
    TO_MANY_CODES: "inflate::Dynamic block code description: too many length or distance codes",
    INVALID_REPEAT_LEN: "inflate::Dynamic block code description: repeat more than specified lengths",
    INVALID_REPEAT_FIRST: "inflate::Dynamic block code description: repeat lengths with no first length",
    INCOMPLETE_CODES: "inflate::Dynamic block code description: code lengths codes incomplete",
    INVALID_DYN_DISTANCE: "inflate::Dynamic block code description: invalid distance code lengths",
    INVALID_CODES_LEN: "inflate::Dynamic block code description: invalid literal/length code lengths",
    INVALID_STORE_BLOCK: "inflate::Stored block length did not match one's complement",
    INVALID_BLOCK_TYPE: "inflate::Invalid block type (type == 3)",
    CANT_EXTRACT_FILE: "Could not extract the file",
    CANT_OVERRIDE: "Target file already exists",
    NO_ZIP: "No zip file was loaded",
    NO_ENTRY: "Entry doesn't exist",
    DIRECTORY_CONTENT_ERROR: "A directory cannot have content",
    FILE_NOT_FOUND: "File not found: %s",
    NOT_IMPLEMENTED: "Not implemented",
    INVALID_FILENAME: "Invalid filename",
    INVALID_FORMAT: "Invalid or unsupported zip format. No END header found"
  };
});

// node_modules/adm-zip/util/utils.js
var require_utils = __commonJS((exports, module) => {
  var Utils = function(opts) {
    this.sep = pth.sep;
    this.fs = fsystem;
    if (is_Obj(opts)) {
      if (is_Obj(opts.fs) && typeof opts.fs.statSync === "function") {
        this.fs = opts.fs;
      }
    }
  };
  var fsystem = require_fileSystem().require();
  var pth = __require("path");
  var Constants = require_constants();
  var Errors = require_errors();
  var isWin = typeof process === "object" && process.platform === "win32";
  var is_Obj = (obj) => obj && typeof obj === "object";
  var crcTable = new Uint32Array(256).map((t, c) => {
    for (let k = 0;k < 8; k++) {
      if ((c & 1) !== 0) {
        c = 3988292384 ^ c >>> 1;
      } else {
        c >>>= 1;
      }
    }
    return c >>> 0;
  });
  module.exports = Utils;
  Utils.prototype.makeDir = function(folder) {
    const self2 = this;
    function mkdirSync(fpath) {
      let resolvedPath = fpath.split(self2.sep)[0];
      fpath.split(self2.sep).forEach(function(name) {
        if (!name || name.substr(-1, 1) === ":")
          return;
        resolvedPath += self2.sep + name;
        var stat;
        try {
          stat = self2.fs.statSync(resolvedPath);
        } catch (e) {
          self2.fs.mkdirSync(resolvedPath);
        }
        if (stat && stat.isFile())
          throw Errors.FILE_IN_THE_WAY.replace("%s", resolvedPath);
      });
    }
    mkdirSync(folder);
  };
  Utils.prototype.writeFileTo = function(path, content, overwrite, attr) {
    const self2 = this;
    if (self2.fs.existsSync(path)) {
      if (!overwrite)
        return false;
      var stat = self2.fs.statSync(path);
      if (stat.isDirectory()) {
        return false;
      }
    }
    var folder = pth.dirname(path);
    if (!self2.fs.existsSync(folder)) {
      self2.makeDir(folder);
    }
    var fd;
    try {
      fd = self2.fs.openSync(path, "w", 438);
    } catch (e) {
      self2.fs.chmodSync(path, 438);
      fd = self2.fs.openSync(path, "w", 438);
    }
    if (fd) {
      try {
        self2.fs.writeSync(fd, content, 0, content.length, 0);
      } finally {
        self2.fs.closeSync(fd);
      }
    }
    self2.fs.chmodSync(path, attr || 438);
    return true;
  };
  Utils.prototype.writeFileToAsync = function(path, content, overwrite, attr, callback) {
    if (typeof attr === "function") {
      callback = attr;
      attr = undefined;
    }
    const self2 = this;
    self2.fs.exists(path, function(exist) {
      if (exist && !overwrite)
        return callback(false);
      self2.fs.stat(path, function(err, stat) {
        if (exist && stat.isDirectory()) {
          return callback(false);
        }
        var folder = pth.dirname(path);
        self2.fs.exists(folder, function(exists) {
          if (!exists)
            self2.makeDir(folder);
          self2.fs.open(path, "w", 438, function(err2, fd) {
            if (err2) {
              self2.fs.chmod(path, 438, function() {
                self2.fs.open(path, "w", 438, function(err3, fd2) {
                  self2.fs.write(fd2, content, 0, content.length, 0, function() {
                    self2.fs.close(fd2, function() {
                      self2.fs.chmod(path, attr || 438, function() {
                        callback(true);
                      });
                    });
                  });
                });
              });
            } else if (fd) {
              self2.fs.write(fd, content, 0, content.length, 0, function() {
                self2.fs.close(fd, function() {
                  self2.fs.chmod(path, attr || 438, function() {
                    callback(true);
                  });
                });
              });
            } else {
              self2.fs.chmod(path, attr || 438, function() {
                callback(true);
              });
            }
          });
        });
      });
    });
  };
  Utils.prototype.findFiles = function(path) {
    const self2 = this;
    function findSync(dir, pattern, recursive) {
      if (typeof pattern === "boolean") {
        recursive = pattern;
        pattern = undefined;
      }
      let files = [];
      self2.fs.readdirSync(dir).forEach(function(file) {
        var path2 = pth.join(dir, file);
        if (self2.fs.statSync(path2).isDirectory() && recursive)
          files = files.concat(findSync(path2, pattern, recursive));
        if (!pattern || pattern.test(path2)) {
          files.push(pth.normalize(path2) + (self2.fs.statSync(path2).isDirectory() ? self2.sep : ""));
        }
      });
      return files;
    }
    return findSync(path, undefined, true);
  };
  Utils.prototype.getAttributes = function() {
  };
  Utils.prototype.setAttributes = function() {
  };
  Utils.crc32update = function(crc, byte) {
    return crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  };
  Utils.crc32 = function(buf) {
    if (typeof buf === "string") {
      buf = Buffer.from(buf, "utf8");
    }
    if (!crcTable.length)
      genCRCTable();
    let len = buf.length;
    let crc = ~0;
    for (let off = 0;off < len; )
      crc = Utils.crc32update(crc, buf[off++]);
    return ~crc >>> 0;
  };
  Utils.methodToString = function(method) {
    switch (method) {
      case Constants.STORED:
        return "STORED (" + method + ")";
      case Constants.DEFLATED:
        return "DEFLATED (" + method + ")";
      default:
        return "UNSUPPORTED (" + method + ")";
    }
  };
  Utils.canonical = function(path) {
    if (!path)
      return "";
    var safeSuffix = pth.posix.normalize("/" + path.split("\\").join("/"));
    return pth.join(".", safeSuffix);
  };
  Utils.sanitize = function(prefix, name) {
    prefix = pth.resolve(pth.normalize(prefix));
    var parts = name.split("/");
    for (var i = 0, l = parts.length;i < l; i++) {
      var path = pth.normalize(pth.join(prefix, parts.slice(i, l).join(pth.sep)));
      if (path.indexOf(prefix) === 0) {
        return path;
      }
    }
    return pth.normalize(pth.join(prefix, pth.basename(name)));
  };
  Utils.toBuffer = function toBuffer(input) {
    if (Buffer.isBuffer(input)) {
      return input;
    } else if (input instanceof Uint8Array) {
      return Buffer.from(input);
    } else {
      return typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.alloc(0);
    }
  };
  Utils.readBigUInt64LE = function(buffer, index) {
    var slice = Buffer.from(buffer.slice(index, index + 8));
    slice.swap64();
    return parseInt(`0x${slice.toString("hex")}`);
  };
  Utils.isWin = isWin;
  Utils.crcTable = crcTable;
});

// node_modules/adm-zip/util/fattr.js
var require_fattr = __commonJS((exports, module) => {
  var fs = require_fileSystem().require();
  var pth = __require("path");
  fs.existsSync = fs.existsSync || pth.existsSync;
  module.exports = function(path) {
    var _path = path || "", _obj = newAttr(), _stat = null;
    function newAttr() {
      return {
        directory: false,
        readonly: false,
        hidden: false,
        executable: false,
        mtime: 0,
        atime: 0
      };
    }
    if (_path && fs.existsSync(_path)) {
      _stat = fs.statSync(_path);
      _obj.directory = _stat.isDirectory();
      _obj.mtime = _stat.mtime;
      _obj.atime = _stat.atime;
      _obj.executable = (73 & _stat.mode) !== 0;
      _obj.readonly = (128 & _stat.mode) === 0;
      _obj.hidden = pth.basename(_path)[0] === ".";
    } else {
      console.warn("Invalid path: " + _path);
    }
    return {
      get directory() {
        return _obj.directory;
      },
      get readOnly() {
        return _obj.readonly;
      },
      get hidden() {
        return _obj.hidden;
      },
      get mtime() {
        return _obj.mtime;
      },
      get atime() {
        return _obj.atime;
      },
      get executable() {
        return _obj.executable;
      },
      decodeAttributes: function() {
      },
      encodeAttributes: function() {
      },
      toJSON: function() {
        return {
          path: _path,
          isDirectory: _obj.directory,
          isReadOnly: _obj.readonly,
          isHidden: _obj.hidden,
          isExecutable: _obj.executable,
          mTime: _obj.mtime,
          aTime: _obj.atime
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "\t");
      }
    };
  };
});

// node_modules/adm-zip/util/index.js
var require_util = __commonJS((exports, module) => {
  module.exports = require_utils();
  module.exports.Constants = require_constants();
  module.exports.Errors = require_errors();
  module.exports.FileAttr = require_fattr();
});

// node_modules/adm-zip/headers/entryHeader.js
var require_entryHeader = __commonJS((exports, module) => {
  var Utils = require_util();
  var Constants = Utils.Constants;
  module.exports = function() {
    var _verMade = 20, _version = 10, _flags = 0, _method = 0, _time = 0, _crc = 0, _compressedSize = 0, _size = 0, _fnameLen = 0, _extraLen = 0, _comLen = 0, _diskStart = 0, _inattr = 0, _attr = 0, _offset = 0;
    _verMade |= Utils.isWin ? 2560 : 768;
    _flags |= Constants.FLG_EFS;
    var _dataHeader = {};
    function setTime(val) {
      val = new Date(val);
      _time = (val.getFullYear() - 1980 & 127) << 25 | val.getMonth() + 1 << 21 | val.getDate() << 16 | val.getHours() << 11 | val.getMinutes() << 5 | val.getSeconds() >> 1;
    }
    setTime(+new Date);
    return {
      get made() {
        return _verMade;
      },
      set made(val) {
        _verMade = val;
      },
      get version() {
        return _version;
      },
      set version(val) {
        _version = val;
      },
      get flags() {
        return _flags;
      },
      set flags(val) {
        _flags = val;
      },
      get method() {
        return _method;
      },
      set method(val) {
        switch (val) {
          case Constants.STORED:
            this.version = 10;
          case Constants.DEFLATED:
          default:
            this.version = 20;
        }
        _method = val;
      },
      get time() {
        return new Date((_time >> 25 & 127) + 1980, (_time >> 21 & 15) - 1, _time >> 16 & 31, _time >> 11 & 31, _time >> 5 & 63, (_time & 31) << 1);
      },
      set time(val) {
        setTime(val);
      },
      get crc() {
        return _crc;
      },
      set crc(val) {
        _crc = Math.max(0, val) >>> 0;
      },
      get compressedSize() {
        return _compressedSize;
      },
      set compressedSize(val) {
        _compressedSize = Math.max(0, val) >>> 0;
      },
      get size() {
        return _size;
      },
      set size(val) {
        _size = Math.max(0, val) >>> 0;
      },
      get fileNameLength() {
        return _fnameLen;
      },
      set fileNameLength(val) {
        _fnameLen = val;
      },
      get extraLength() {
        return _extraLen;
      },
      set extraLength(val) {
        _extraLen = val;
      },
      get commentLength() {
        return _comLen;
      },
      set commentLength(val) {
        _comLen = val;
      },
      get diskNumStart() {
        return _diskStart;
      },
      set diskNumStart(val) {
        _diskStart = Math.max(0, val) >>> 0;
      },
      get inAttr() {
        return _inattr;
      },
      set inAttr(val) {
        _inattr = Math.max(0, val) >>> 0;
      },
      get attr() {
        return _attr;
      },
      set attr(val) {
        _attr = Math.max(0, val) >>> 0;
      },
      get fileAttr() {
        return _attr ? (_attr >>> 0 | 0) >> 16 & 4095 : 0;
      },
      get offset() {
        return _offset;
      },
      set offset(val) {
        _offset = Math.max(0, val) >>> 0;
      },
      get encripted() {
        return (_flags & 1) === 1;
      },
      get entryHeaderSize() {
        return Constants.CENHDR + _fnameLen + _extraLen + _comLen;
      },
      get realDataOffset() {
        return _offset + Constants.LOCHDR + _dataHeader.fnameLen + _dataHeader.extraLen;
      },
      get dataHeader() {
        return _dataHeader;
      },
      loadDataHeaderFromBinary: function(input) {
        var data4 = input.slice(_offset, _offset + Constants.LOCHDR);
        if (data4.readUInt32LE(0) !== Constants.LOCSIG) {
          throw new Error(Utils.Errors.INVALID_LOC);
        }
        _dataHeader = {
          version: data4.readUInt16LE(Constants.LOCVER),
          flags: data4.readUInt16LE(Constants.LOCFLG),
          method: data4.readUInt16LE(Constants.LOCHOW),
          time: data4.readUInt32LE(Constants.LOCTIM),
          crc: data4.readUInt32LE(Constants.LOCCRC),
          compressedSize: data4.readUInt32LE(Constants.LOCSIZ),
          size: data4.readUInt32LE(Constants.LOCLEN),
          fnameLen: data4.readUInt16LE(Constants.LOCNAM),
          extraLen: data4.readUInt16LE(Constants.LOCEXT)
        };
      },
      loadFromBinary: function(data4) {
        if (data4.length !== Constants.CENHDR || data4.readUInt32LE(0) !== Constants.CENSIG) {
          throw new Error(Utils.Errors.INVALID_CEN);
        }
        _verMade = data4.readUInt16LE(Constants.CENVEM);
        _version = data4.readUInt16LE(Constants.CENVER);
        _flags = data4.readUInt16LE(Constants.CENFLG);
        _method = data4.readUInt16LE(Constants.CENHOW);
        _time = data4.readUInt32LE(Constants.CENTIM);
        _crc = data4.readUInt32LE(Constants.CENCRC);
        _compressedSize = data4.readUInt32LE(Constants.CENSIZ);
        _size = data4.readUInt32LE(Constants.CENLEN);
        _fnameLen = data4.readUInt16LE(Constants.CENNAM);
        _extraLen = data4.readUInt16LE(Constants.CENEXT);
        _comLen = data4.readUInt16LE(Constants.CENCOM);
        _diskStart = data4.readUInt16LE(Constants.CENDSK);
        _inattr = data4.readUInt16LE(Constants.CENATT);
        _attr = data4.readUInt32LE(Constants.CENATX);
        _offset = data4.readUInt32LE(Constants.CENOFF);
      },
      dataHeaderToBinary: function() {
        var data4 = Buffer.alloc(Constants.LOCHDR);
        data4.writeUInt32LE(Constants.LOCSIG, 0);
        data4.writeUInt16LE(_version, Constants.LOCVER);
        data4.writeUInt16LE(_flags, Constants.LOCFLG);
        data4.writeUInt16LE(_method, Constants.LOCHOW);
        data4.writeUInt32LE(_time, Constants.LOCTIM);
        data4.writeUInt32LE(_crc, Constants.LOCCRC);
        data4.writeUInt32LE(_compressedSize, Constants.LOCSIZ);
        data4.writeUInt32LE(_size, Constants.LOCLEN);
        data4.writeUInt16LE(_fnameLen, Constants.LOCNAM);
        data4.writeUInt16LE(_extraLen, Constants.LOCEXT);
        return data4;
      },
      entryHeaderToBinary: function() {
        var data4 = Buffer.alloc(Constants.CENHDR + _fnameLen + _extraLen + _comLen);
        data4.writeUInt32LE(Constants.CENSIG, 0);
        data4.writeUInt16LE(_verMade, Constants.CENVEM);
        data4.writeUInt16LE(_version, Constants.CENVER);
        data4.writeUInt16LE(_flags, Constants.CENFLG);
        data4.writeUInt16LE(_method, Constants.CENHOW);
        data4.writeUInt32LE(_time, Constants.CENTIM);
        data4.writeUInt32LE(_crc, Constants.CENCRC);
        data4.writeUInt32LE(_compressedSize, Constants.CENSIZ);
        data4.writeUInt32LE(_size, Constants.CENLEN);
        data4.writeUInt16LE(_fnameLen, Constants.CENNAM);
        data4.writeUInt16LE(_extraLen, Constants.CENEXT);
        data4.writeUInt16LE(_comLen, Constants.CENCOM);
        data4.writeUInt16LE(_diskStart, Constants.CENDSK);
        data4.writeUInt16LE(_inattr, Constants.CENATT);
        data4.writeUInt32LE(_attr, Constants.CENATX);
        data4.writeUInt32LE(_offset, Constants.CENOFF);
        data4.fill(0, Constants.CENHDR);
        return data4;
      },
      toJSON: function() {
        const bytes = function(nr) {
          return nr + " bytes";
        };
        return {
          made: _verMade,
          version: _version,
          flags: _flags,
          method: Utils.methodToString(_method),
          time: this.time,
          crc: "0x" + _crc.toString(16).toUpperCase(),
          compressedSize: bytes(_compressedSize),
          size: bytes(_size),
          fileNameLength: bytes(_fnameLen),
          extraLength: bytes(_extraLen),
          commentLength: bytes(_comLen),
          diskNumStart: _diskStart,
          inAttr: _inattr,
          attr: _attr,
          offset: _offset,
          entryHeaderSize: bytes(Constants.CENHDR + _fnameLen + _extraLen + _comLen)
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "\t");
      }
    };
  };
});

// node_modules/adm-zip/headers/mainHeader.js
var require_mainHeader = __commonJS((exports, module) => {
  var Utils = require_util();
  var Constants = Utils.Constants;
  module.exports = function() {
    var _volumeEntries = 0, _totalEntries = 0, _size = 0, _offset = 0, _commentLength = 0;
    return {
      get diskEntries() {
        return _volumeEntries;
      },
      set diskEntries(val) {
        _volumeEntries = _totalEntries = val;
      },
      get totalEntries() {
        return _totalEntries;
      },
      set totalEntries(val) {
        _totalEntries = _volumeEntries = val;
      },
      get size() {
        return _size;
      },
      set size(val) {
        _size = val;
      },
      get offset() {
        return _offset;
      },
      set offset(val) {
        _offset = val;
      },
      get commentLength() {
        return _commentLength;
      },
      set commentLength(val) {
        _commentLength = val;
      },
      get mainHeaderSize() {
        return Constants.ENDHDR + _commentLength;
      },
      loadFromBinary: function(data4) {
        if ((data4.length !== Constants.ENDHDR || data4.readUInt32LE(0) !== Constants.ENDSIG) && (data4.length < Constants.ZIP64HDR || data4.readUInt32LE(0) !== Constants.ZIP64SIG)) {
          throw new Error(Utils.Errors.INVALID_END);
        }
        if (data4.readUInt32LE(0) === Constants.ENDSIG) {
          _volumeEntries = data4.readUInt16LE(Constants.ENDSUB);
          _totalEntries = data4.readUInt16LE(Constants.ENDTOT);
          _size = data4.readUInt32LE(Constants.ENDSIZ);
          _offset = data4.readUInt32LE(Constants.ENDOFF);
          _commentLength = data4.readUInt16LE(Constants.ENDCOM);
        } else {
          _volumeEntries = Utils.readBigUInt64LE(data4, Constants.ZIP64SUB);
          _totalEntries = Utils.readBigUInt64LE(data4, Constants.ZIP64TOT);
          _size = Utils.readBigUInt64LE(data4, Constants.ZIP64SIZE);
          _offset = Utils.readBigUInt64LE(data4, Constants.ZIP64OFF);
          _commentLength = 0;
        }
      },
      toBinary: function() {
        var b = Buffer.alloc(Constants.ENDHDR + _commentLength);
        b.writeUInt32LE(Constants.ENDSIG, 0);
        b.writeUInt32LE(0, 4);
        b.writeUInt16LE(_volumeEntries, Constants.ENDSUB);
        b.writeUInt16LE(_totalEntries, Constants.ENDTOT);
        b.writeUInt32LE(_size, Constants.ENDSIZ);
        b.writeUInt32LE(_offset, Constants.ENDOFF);
        b.writeUInt16LE(_commentLength, Constants.ENDCOM);
        b.fill(" ", Constants.ENDHDR);
        return b;
      },
      toJSON: function() {
        const offset = function(nr, len) {
          let offs = nr.toString(16).toUpperCase();
          while (offs.length < len)
            offs = "0" + offs;
          return "0x" + offs;
        };
        return {
          diskEntries: _volumeEntries,
          totalEntries: _totalEntries,
          size: _size + " bytes",
          offset: offset(_offset, 4),
          commentLength: _commentLength
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "\t");
      }
    };
  };
});

// node_modules/adm-zip/headers/index.js
var require_headers = __commonJS((exports) => {
  exports.EntryHeader = require_entryHeader();
  exports.MainHeader = require_mainHeader();
});

// node_modules/adm-zip/methods/deflater.js
var require_deflater = __commonJS((exports, module) => {
  module.exports = function(inbuf) {
    var zlib2 = __require("zlib");
    var opts = { chunkSize: (parseInt(inbuf.length / 1024) + 1) * 1024 };
    return {
      deflate: function() {
        return zlib2.deflateRawSync(inbuf, opts);
      },
      deflateAsync: function(callback) {
        var tmp = zlib2.createDeflateRaw(opts), parts = [], total = 0;
        tmp.on("data", function(data4) {
          parts.push(data4);
          total += data4.length;
        });
        tmp.on("end", function() {
          var buf = Buffer.alloc(total), written = 0;
          buf.fill(0);
          for (var i = 0;i < parts.length; i++) {
            var part = parts[i];
            part.copy(buf, written);
            written += part.length;
          }
          callback && callback(buf);
        });
        tmp.end(inbuf);
      }
    };
  };
});

// node_modules/adm-zip/methods/inflater.js
var require_inflater = __commonJS((exports, module) => {
  module.exports = function(inbuf) {
    var zlib2 = __require("zlib");
    return {
      inflate: function() {
        return zlib2.inflateRawSync(inbuf);
      },
      inflateAsync: function(callback) {
        var tmp = zlib2.createInflateRaw(), parts = [], total = 0;
        tmp.on("data", function(data4) {
          parts.push(data4);
          total += data4.length;
        });
        tmp.on("end", function() {
          var buf = Buffer.alloc(total), written = 0;
          buf.fill(0);
          for (var i = 0;i < parts.length; i++) {
            var part = parts[i];
            part.copy(buf, written);
            written += part.length;
          }
          callback && callback(buf);
        });
        tmp.end(inbuf);
      }
    };
  };
});

// node_modules/adm-zip/methods/zipcrypto.js
var require_zipcrypto = __commonJS((exports, module) => {
  var Initkeys = function(pw) {
    const pass = Buffer.isBuffer(pw) ? pw : Buffer.from(pw);
    this.keys = new Uint32Array([305419896, 591751049, 878082192]);
    for (let i = 0;i < pass.length; i++) {
      this.updateKeys(pass[i]);
    }
  };
  var make_decrypter = function(pwd) {
    const keys = new Initkeys(pwd);
    return function(data4) {
      const result = Buffer.alloc(data4.length);
      let pos = 0;
      for (let c of data4) {
        result[pos++] = keys.updateKeys(c ^ keys.next());
      }
      return result;
    };
  };
  var make_encrypter = function(pwd) {
    const keys = new Initkeys(pwd);
    return function(data4, result, pos = 0) {
      if (!result)
        result = Buffer.alloc(data4.length);
      for (let c of data4) {
        const k = keys.next();
        result[pos++] = c ^ k;
        keys.updateKeys(c);
      }
      return result;
    };
  };
  var decrypt = function(data4, header, pwd) {
    if (!data4 || !Buffer.isBuffer(data4) || data4.length < 12) {
      return Buffer.alloc(0);
    }
    const decrypter = make_decrypter(pwd);
    const salt = decrypter(data4.slice(0, 12));
    if (salt[11] !== header.crc >>> 24) {
      throw "ADM-ZIP: Wrong Password";
    }
    return decrypter(data4.slice(12));
  };
  var _salter = function(data4) {
    if (Buffer.isBuffer(data4) && data4.length >= 12) {
      config.genSalt = function() {
        return data4.slice(0, 12);
      };
    } else if (data4 === "node") {
      config.genSalt = genSalt.node;
    } else {
      config.genSalt = genSalt;
    }
  };
  var encrypt = function(data4, header, pwd, oldlike = false) {
    if (data4 == null)
      data4 = Buffer.alloc(0);
    if (!Buffer.isBuffer(data4))
      data4 = Buffer.from(data4.toString());
    const encrypter = make_encrypter(pwd);
    const salt = config.genSalt();
    salt[11] = header.crc >>> 24 & 255;
    if (oldlike)
      salt[10] = header.crc >>> 16 & 255;
    const result = Buffer.alloc(data4.length + 12);
    encrypter(salt, result);
    return encrypter(data4, result, 12);
  };
  var { randomFillSync } = __require("crypto");
  var crctable = new Uint32Array(256).map((t, crc) => {
    for (let j = 0;j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = crc >>> 1 ^ 3988292384;
      } else {
        crc >>>= 1;
      }
    }
    return crc >>> 0;
  });
  var uMul = (a, b) => Math.imul(a, b) >>> 0;
  var crc32update = (pCrc32, bval) => {
    return crctable[(pCrc32 ^ bval) & 255] ^ pCrc32 >>> 8;
  };
  var genSalt = () => {
    if (typeof randomFillSync === "function") {
      return randomFillSync(Buffer.alloc(12));
    } else {
      return genSalt.node();
    }
  };
  genSalt.node = () => {
    const salt = Buffer.alloc(12);
    const len = salt.length;
    for (let i = 0;i < len; i++)
      salt[i] = Math.random() * 256 & 255;
    return salt;
  };
  var config = {
    genSalt
  };
  Initkeys.prototype.updateKeys = function(byteValue) {
    const keys = this.keys;
    keys[0] = crc32update(keys[0], byteValue);
    keys[1] += keys[0] & 255;
    keys[1] = uMul(keys[1], 134775813) + 1;
    keys[2] = crc32update(keys[2], keys[1] >>> 24);
    return byteValue;
  };
  Initkeys.prototype.next = function() {
    const k = (this.keys[2] | 2) >>> 0;
    return uMul(k, k ^ 1) >> 8 & 255;
  };
  module.exports = { decrypt, encrypt, _salter };
});

// node_modules/adm-zip/methods/index.js
var require_methods = __commonJS((exports) => {
  exports.Deflater = require_deflater();
  exports.Inflater = require_inflater();
  exports.ZipCrypto = require_zipcrypto();
});

// node_modules/adm-zip/zipEntry.js
var require_zipEntry = __commonJS((exports, module) => {
  var Utils = require_util();
  var Headers = require_headers();
  var Constants = Utils.Constants;
  var Methods = require_methods();
  module.exports = function(input) {
    var _entryHeader = new Headers.EntryHeader, _entryName = Buffer.alloc(0), _comment = Buffer.alloc(0), _isDirectory = false, uncompressedData = null, _extra = Buffer.alloc(0);
    function getCompressedDataFromZip() {
      if (!input || !Buffer.isBuffer(input)) {
        return Buffer.alloc(0);
      }
      _entryHeader.loadDataHeaderFromBinary(input);
      return input.slice(_entryHeader.realDataOffset, _entryHeader.realDataOffset + _entryHeader.compressedSize);
    }
    function crc32OK(data4) {
      if ((_entryHeader.flags & 8) !== 8) {
        if (Utils.crc32(data4) !== _entryHeader.dataHeader.crc) {
          return false;
        }
      } else {
      }
      return true;
    }
    function decompress(async, callback, pass) {
      if (typeof callback === "undefined" && typeof async === "string") {
        pass = async;
        async = undefined;
      }
      if (_isDirectory) {
        if (async && callback) {
          callback(Buffer.alloc(0), Utils.Errors.DIRECTORY_CONTENT_ERROR);
        }
        return Buffer.alloc(0);
      }
      var compressedData = getCompressedDataFromZip();
      if (compressedData.length === 0) {
        if (async && callback)
          callback(compressedData);
        return compressedData;
      }
      if (_entryHeader.encripted) {
        if (typeof pass !== "string" && !Buffer.isBuffer(pass)) {
          throw new Error("ADM-ZIP: Incompatible password parameter");
        }
        compressedData = Methods.ZipCrypto.decrypt(compressedData, _entryHeader, pass);
      }
      var data4 = Buffer.alloc(_entryHeader.size);
      switch (_entryHeader.method) {
        case Utils.Constants.STORED:
          compressedData.copy(data4);
          if (!crc32OK(data4)) {
            if (async && callback)
              callback(data4, Utils.Errors.BAD_CRC);
            throw new Error(Utils.Errors.BAD_CRC);
          } else {
            if (async && callback)
              callback(data4);
            return data4;
          }
        case Utils.Constants.DEFLATED:
          var inflater = new Methods.Inflater(compressedData);
          if (!async) {
            const result = inflater.inflate(data4);
            result.copy(data4, 0);
            if (!crc32OK(data4)) {
              throw new Error(Utils.Errors.BAD_CRC + " " + _entryName.toString());
            }
            return data4;
          } else {
            inflater.inflateAsync(function(result) {
              result.copy(result, 0);
              if (callback) {
                if (!crc32OK(result)) {
                  callback(result, Utils.Errors.BAD_CRC);
                } else {
                  callback(result);
                }
              }
            });
          }
          break;
        default:
          if (async && callback)
            callback(Buffer.alloc(0), Utils.Errors.UNKNOWN_METHOD);
          throw new Error(Utils.Errors.UNKNOWN_METHOD);
      }
    }
    function compress(async, callback) {
      if ((!uncompressedData || !uncompressedData.length) && Buffer.isBuffer(input)) {
        if (async && callback)
          callback(getCompressedDataFromZip());
        return getCompressedDataFromZip();
      }
      if (uncompressedData.length && !_isDirectory) {
        var compressedData;
        switch (_entryHeader.method) {
          case Utils.Constants.STORED:
            _entryHeader.compressedSize = _entryHeader.size;
            compressedData = Buffer.alloc(uncompressedData.length);
            uncompressedData.copy(compressedData);
            if (async && callback)
              callback(compressedData);
            return compressedData;
          default:
          case Utils.Constants.DEFLATED:
            var deflater = new Methods.Deflater(uncompressedData);
            if (!async) {
              var deflated = deflater.deflate();
              _entryHeader.compressedSize = deflated.length;
              return deflated;
            } else {
              deflater.deflateAsync(function(data4) {
                compressedData = Buffer.alloc(data4.length);
                _entryHeader.compressedSize = data4.length;
                data4.copy(compressedData);
                callback && callback(compressedData);
              });
            }
            deflater = null;
            break;
        }
      } else if (async && callback) {
        callback(Buffer.alloc(0));
      } else {
        return Buffer.alloc(0);
      }
    }
    function readUInt64LE(buffer, offset) {
      return (buffer.readUInt32LE(offset + 4) << 4) + buffer.readUInt32LE(offset);
    }
    function parseExtra(data4) {
      var offset = 0;
      var signature, size, part;
      while (offset < data4.length) {
        signature = data4.readUInt16LE(offset);
        offset += 2;
        size = data4.readUInt16LE(offset);
        offset += 2;
        part = data4.slice(offset, offset + size);
        offset += size;
        if (Constants.ID_ZIP64 === signature) {
          parseZip64ExtendedInformation(part);
        }
      }
    }
    function parseZip64ExtendedInformation(data4) {
      var size, compressedSize, offset, diskNumStart;
      if (data4.length >= Constants.EF_ZIP64_SCOMP) {
        size = readUInt64LE(data4, Constants.EF_ZIP64_SUNCOMP);
        if (_entryHeader.size === Constants.EF_ZIP64_OR_32) {
          _entryHeader.size = size;
        }
      }
      if (data4.length >= Constants.EF_ZIP64_RHO) {
        compressedSize = readUInt64LE(data4, Constants.EF_ZIP64_SCOMP);
        if (_entryHeader.compressedSize === Constants.EF_ZIP64_OR_32) {
          _entryHeader.compressedSize = compressedSize;
        }
      }
      if (data4.length >= Constants.EF_ZIP64_DSN) {
        offset = readUInt64LE(data4, Constants.EF_ZIP64_RHO);
        if (_entryHeader.offset === Constants.EF_ZIP64_OR_32) {
          _entryHeader.offset = offset;
        }
      }
      if (data4.length >= Constants.EF_ZIP64_DSN + 4) {
        diskNumStart = data4.readUInt32LE(Constants.EF_ZIP64_DSN);
        if (_entryHeader.diskNumStart === Constants.EF_ZIP64_OR_16) {
          _entryHeader.diskNumStart = diskNumStart;
        }
      }
    }
    return {
      get entryName() {
        return _entryName.toString();
      },
      get rawEntryName() {
        return _entryName;
      },
      set entryName(val) {
        _entryName = Utils.toBuffer(val);
        var lastChar = _entryName[_entryName.length - 1];
        _isDirectory = lastChar === 47 || lastChar === 92;
        _entryHeader.fileNameLength = _entryName.length;
      },
      get extra() {
        return _extra;
      },
      set extra(val) {
        _extra = val;
        _entryHeader.extraLength = val.length;
        parseExtra(val);
      },
      get comment() {
        return _comment.toString();
      },
      set comment(val) {
        _comment = Utils.toBuffer(val);
        _entryHeader.commentLength = _comment.length;
      },
      get name() {
        var n = _entryName.toString();
        return _isDirectory ? n.substr(n.length - 1).split("/").pop() : n.split("/").pop();
      },
      get isDirectory() {
        return _isDirectory;
      },
      getCompressedData: function() {
        return compress(false, null);
      },
      getCompressedDataAsync: function(callback) {
        compress(true, callback);
      },
      setData: function(value) {
        uncompressedData = Utils.toBuffer(value);
        if (!_isDirectory && uncompressedData.length) {
          _entryHeader.size = uncompressedData.length;
          _entryHeader.method = Utils.Constants.DEFLATED;
          _entryHeader.crc = Utils.crc32(value);
          _entryHeader.changed = true;
        } else {
          _entryHeader.method = Utils.Constants.STORED;
        }
      },
      getData: function(pass) {
        if (_entryHeader.changed) {
          return uncompressedData;
        } else {
          return decompress(false, null, pass);
        }
      },
      getDataAsync: function(callback, pass) {
        if (_entryHeader.changed) {
          callback(uncompressedData);
        } else {
          decompress(true, callback, pass);
        }
      },
      set attr(attr) {
        _entryHeader.attr = attr;
      },
      get attr() {
        return _entryHeader.attr;
      },
      set header(data4) {
        _entryHeader.loadFromBinary(data4);
      },
      get header() {
        return _entryHeader;
      },
      packHeader: function() {
        var header = _entryHeader.entryHeaderToBinary();
        var addpos = Utils.Constants.CENHDR;
        _entryName.copy(header, addpos);
        addpos += _entryName.length;
        if (_entryHeader.extraLength) {
          _extra.copy(header, addpos);
          addpos += _entryHeader.extraLength;
        }
        if (_entryHeader.commentLength) {
          _comment.copy(header, addpos);
        }
        return header;
      },
      toJSON: function() {
        const bytes = function(nr) {
          return "<" + (nr && nr.length + " bytes buffer" || "null") + ">";
        };
        return {
          entryName: this.entryName,
          name: this.name,
          comment: this.comment,
          isDirectory: this.isDirectory,
          header: _entryHeader.toJSON(),
          compressedData: bytes(input),
          data: bytes(uncompressedData)
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "\t");
      }
    };
  };
});

// node_modules/adm-zip/zipFile.js
var require_zipFile = __commonJS((exports, module) => {
  var ZipEntry = require_zipEntry();
  var Headers = require_headers();
  var Utils = require_util();
  module.exports = function(inBuffer, options) {
    var entryList = [], entryTable = {}, _comment = Buffer.alloc(0), mainHeader = new Headers.MainHeader, loadedEntries = false;
    const opts = Object.assign(Object.create(null), options);
    const { noSort } = opts;
    if (inBuffer) {
      readMainHeader(opts.readEntries);
    } else {
      loadedEntries = true;
    }
    function iterateEntries(callback) {
      const totalEntries = mainHeader.diskEntries;
      let index = mainHeader.offset;
      for (let i = 0;i < totalEntries; i++) {
        let tmp = index;
        const entry = new ZipEntry(inBuffer);
        entry.header = inBuffer.slice(tmp, tmp += Utils.Constants.CENHDR);
        entry.entryName = inBuffer.slice(tmp, tmp += entry.header.fileNameLength);
        index += entry.header.entryHeaderSize;
        callback(entry);
      }
    }
    function readEntries() {
      loadedEntries = true;
      entryTable = {};
      entryList = new Array(mainHeader.diskEntries);
      var index = mainHeader.offset;
      for (var i = 0;i < entryList.length; i++) {
        var tmp = index, entry = new ZipEntry(inBuffer);
        entry.header = inBuffer.slice(tmp, tmp += Utils.Constants.CENHDR);
        entry.entryName = inBuffer.slice(tmp, tmp += entry.header.fileNameLength);
        if (entry.header.extraLength) {
          entry.extra = inBuffer.slice(tmp, tmp += entry.header.extraLength);
        }
        if (entry.header.commentLength)
          entry.comment = inBuffer.slice(tmp, tmp + entry.header.commentLength);
        index += entry.header.entryHeaderSize;
        entryList[i] = entry;
        entryTable[entry.entryName] = entry;
      }
    }
    function readMainHeader(readNow) {
      var i = inBuffer.length - Utils.Constants.ENDHDR, max = Math.max(0, i - 65535), n = max, endStart = inBuffer.length, endOffset = -1, commentEnd = 0;
      for (i;i >= n; i--) {
        if (inBuffer[i] !== 80)
          continue;
        if (inBuffer.readUInt32LE(i) === Utils.Constants.ENDSIG) {
          endOffset = i;
          commentEnd = i;
          endStart = i + Utils.Constants.ENDHDR;
          n = i - Utils.Constants.END64HDR;
          continue;
        }
        if (inBuffer.readUInt32LE(i) === Utils.Constants.END64SIG) {
          n = max;
          continue;
        }
        if (inBuffer.readUInt32LE(i) === Utils.Constants.ZIP64SIG) {
          endOffset = i;
          endStart = i + Utils.readBigUInt64LE(inBuffer, i + Utils.Constants.ZIP64SIZE) + Utils.Constants.ZIP64LEAD;
          break;
        }
      }
      if (!~endOffset)
        throw new Error(Utils.Errors.INVALID_FORMAT);
      mainHeader.loadFromBinary(inBuffer.slice(endOffset, endStart));
      if (mainHeader.commentLength) {
        _comment = inBuffer.slice(commentEnd + Utils.Constants.ENDHDR);
      }
      if (readNow)
        readEntries();
    }
    function sortEntries() {
      if (entryList.length > 1 && !noSort) {
        entryList.sort((a, b) => a.entryName.toLowerCase().localeCompare(b.entryName.toLowerCase()));
      }
    }
    return {
      get entries() {
        if (!loadedEntries) {
          readEntries();
        }
        return entryList;
      },
      get comment() {
        return _comment.toString();
      },
      set comment(val) {
        _comment = Utils.toBuffer(val);
        mainHeader.commentLength = _comment.length;
      },
      getEntryCount: function() {
        if (!loadedEntries) {
          return mainHeader.diskEntries;
        }
        return entryList.length;
      },
      forEach: function(callback) {
        if (!loadedEntries) {
          iterateEntries(callback);
          return;
        }
        entryList.forEach(callback);
      },
      getEntry: function(entryName) {
        if (!loadedEntries) {
          readEntries();
        }
        return entryTable[entryName] || null;
      },
      setEntry: function(entry) {
        if (!loadedEntries) {
          readEntries();
        }
        entryList.push(entry);
        entryTable[entry.entryName] = entry;
        mainHeader.totalEntries = entryList.length;
      },
      deleteEntry: function(entryName) {
        if (!loadedEntries) {
          readEntries();
        }
        var entry = entryTable[entryName];
        if (entry && entry.isDirectory) {
          var _self = this;
          this.getEntryChildren(entry).forEach(function(child) {
            if (child.entryName !== entryName) {
              _self.deleteEntry(child.entryName);
            }
          });
        }
        entryList.splice(entryList.indexOf(entry), 1);
        delete entryTable[entryName];
        mainHeader.totalEntries = entryList.length;
      },
      getEntryChildren: function(entry) {
        if (!loadedEntries) {
          readEntries();
        }
        if (entry && entry.isDirectory) {
          const list = [];
          const name = entry.entryName;
          const len = name.length;
          entryList.forEach(function(zipEntry) {
            if (zipEntry.entryName.substr(0, len) === name) {
              list.push(zipEntry);
            }
          });
          return list;
        }
        return [];
      },
      compressToBuffer: function() {
        if (!loadedEntries) {
          readEntries();
        }
        sortEntries();
        const dataBlock = [];
        const entryHeaders = [];
        let totalSize = 0;
        let dindex = 0;
        mainHeader.size = 0;
        mainHeader.offset = 0;
        for (const entry of entryList) {
          const compressedData = entry.getCompressedData();
          entry.header.offset = dindex;
          const dataHeader = entry.header.dataHeaderToBinary();
          const entryNameLen = entry.rawEntryName.length;
          const postHeader = Buffer.alloc(entryNameLen + entry.extra.length);
          entry.rawEntryName.copy(postHeader, 0);
          postHeader.copy(entry.extra, entryNameLen);
          const dataLength = dataHeader.length + postHeader.length + compressedData.length;
          dindex += dataLength;
          dataBlock.push(dataHeader);
          dataBlock.push(postHeader);
          dataBlock.push(compressedData);
          const entryHeader = entry.packHeader();
          entryHeaders.push(entryHeader);
          mainHeader.size += entryHeader.length;
          totalSize += dataLength + entryHeader.length;
        }
        totalSize += mainHeader.mainHeaderSize;
        mainHeader.offset = dindex;
        dindex = 0;
        const outBuffer = Buffer.alloc(totalSize);
        for (const content of dataBlock) {
          content.copy(outBuffer, dindex);
          dindex += content.length;
        }
        for (const content of entryHeaders) {
          content.copy(outBuffer, dindex);
          dindex += content.length;
        }
        const mh = mainHeader.toBinary();
        if (_comment) {
          _comment.copy(mh, Utils.Constants.ENDHDR);
        }
        mh.copy(outBuffer, dindex);
        return outBuffer;
      },
      toAsyncBuffer: function(onSuccess, onFail, onItemStart, onItemEnd) {
        try {
          if (!loadedEntries) {
            readEntries();
          }
          sortEntries();
          const dataBlock = [];
          const entryHeaders = [];
          let totalSize = 0;
          let dindex = 0;
          mainHeader.size = 0;
          mainHeader.offset = 0;
          const compress2Buffer = function(entryLists) {
            if (entryLists.length) {
              const entry = entryLists.pop();
              const name = entry.entryName + entry.extra.toString();
              if (onItemStart)
                onItemStart(name);
              entry.getCompressedDataAsync(function(compressedData) {
                if (onItemEnd)
                  onItemEnd(name);
                entry.header.offset = dindex;
                const dataHeader = entry.header.dataHeaderToBinary();
                const postHeader = Buffer.alloc(name.length, name);
                const dataLength = dataHeader.length + postHeader.length + compressedData.length;
                dindex += dataLength;
                dataBlock.push(dataHeader);
                dataBlock.push(postHeader);
                dataBlock.push(compressedData);
                const entryHeader = entry.packHeader();
                entryHeaders.push(entryHeader);
                mainHeader.size += entryHeader.length;
                totalSize += dataLength + entryHeader.length;
                compress2Buffer(entryLists);
              });
            } else {
              totalSize += mainHeader.mainHeaderSize;
              mainHeader.offset = dindex;
              dindex = 0;
              const outBuffer = Buffer.alloc(totalSize);
              dataBlock.forEach(function(content) {
                content.copy(outBuffer, dindex);
                dindex += content.length;
              });
              entryHeaders.forEach(function(content) {
                content.copy(outBuffer, dindex);
                dindex += content.length;
              });
              const mh = mainHeader.toBinary();
              if (_comment) {
                _comment.copy(mh, Utils.Constants.ENDHDR);
              }
              mh.copy(outBuffer, dindex);
              onSuccess(outBuffer);
            }
          };
          compress2Buffer(entryList);
        } catch (e) {
          onFail(e);
        }
      }
    };
  };
});

// node_modules/adm-zip/adm-zip.js
var require_adm_zip = __commonJS((exports, module) => {
  var Utils = require_util();
  var pth = __require("path");
  var ZipEntry = require_zipEntry();
  var ZipFile = require_zipFile();
  var get_Bool = (val, def) => typeof val === "boolean" ? val : def;
  var get_Str = (val, def) => typeof val === "string" ? val : def;
  var defaultOptions = {
    noSort: false,
    readEntries: false,
    method: Utils.Constants.NONE,
    fs: null
  };
  module.exports = function(input, options) {
    let inBuffer = null;
    const opts = Object.assign(Object.create(null), defaultOptions);
    if (input && typeof input === "object") {
      if (!(input instanceof Uint8Array)) {
        Object.assign(opts, input);
        input = opts.input ? opts.input : undefined;
        if (opts.input)
          delete opts.input;
      }
      if (Buffer.isBuffer(input)) {
        inBuffer = input;
        opts.method = Utils.Constants.BUFFER;
        input = undefined;
      }
    }
    Object.assign(opts, options);
    const filetools = new Utils(opts);
    if (input && typeof input === "string") {
      if (filetools.fs.existsSync(input)) {
        opts.method = Utils.Constants.FILE;
        opts.filename = input;
        inBuffer = filetools.fs.readFileSync(input);
      } else {
        throw new Error(Utils.Errors.INVALID_FILENAME);
      }
    }
    const _zip = new ZipFile(inBuffer, opts);
    const { canonical, sanitize } = Utils;
    function getEntry(entry) {
      if (entry && _zip) {
        var item;
        if (typeof entry === "string")
          item = _zip.getEntry(entry);
        if (typeof entry === "object" && typeof entry.entryName !== "undefined" && typeof entry.header !== "undefined")
          item = _zip.getEntry(entry.entryName);
        if (item) {
          return item;
        }
      }
      return null;
    }
    function fixPath(zipPath) {
      const { join, normalize, sep } = pth.posix;
      return join(".", normalize(sep + zipPath.split("\\").join(sep) + sep));
    }
    return {
      readFile: function(entry, pass) {
        var item = getEntry(entry);
        return item && item.getData(pass) || null;
      },
      readFileAsync: function(entry, callback) {
        var item = getEntry(entry);
        if (item) {
          item.getDataAsync(callback);
        } else {
          callback(null, "getEntry failed for:" + entry);
        }
      },
      readAsText: function(entry, encoding) {
        var item = getEntry(entry);
        if (item) {
          var data4 = item.getData();
          if (data4 && data4.length) {
            return data4.toString(encoding || "utf8");
          }
        }
        return "";
      },
      readAsTextAsync: function(entry, callback, encoding) {
        var item = getEntry(entry);
        if (item) {
          item.getDataAsync(function(data4, err) {
            if (err) {
              callback(data4, err);
              return;
            }
            if (data4 && data4.length) {
              callback(data4.toString(encoding || "utf8"));
            } else {
              callback("");
            }
          });
        } else {
          callback("");
        }
      },
      deleteFile: function(entry) {
        var item = getEntry(entry);
        if (item) {
          _zip.deleteEntry(item.entryName);
        }
      },
      addZipComment: function(comment) {
        _zip.comment = comment;
      },
      getZipComment: function() {
        return _zip.comment || "";
      },
      addZipEntryComment: function(entry, comment) {
        var item = getEntry(entry);
        if (item) {
          item.comment = comment;
        }
      },
      getZipEntryComment: function(entry) {
        var item = getEntry(entry);
        if (item) {
          return item.comment || "";
        }
        return "";
      },
      updateFile: function(entry, content) {
        var item = getEntry(entry);
        if (item) {
          item.setData(content);
        }
      },
      addLocalFile: function(localPath, zipPath, zipName, comment) {
        if (filetools.fs.existsSync(localPath)) {
          zipPath = zipPath ? fixPath(zipPath) : "";
          var p = localPath.split("\\").join("/").split("/").pop();
          zipPath += zipName ? zipName : p;
          const _attr = filetools.fs.statSync(localPath);
          this.addFile(zipPath, filetools.fs.readFileSync(localPath), comment, _attr);
        } else {
          throw new Error(Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
        }
      },
      addLocalFolder: function(localPath, zipPath, filter2, attr) {
        if (filter2 instanceof RegExp) {
          filter2 = function(rx) {
            return function(filename) {
              return rx.test(filename);
            };
          }(filter2);
        } else if (typeof filter2 !== "function") {
          filter2 = function() {
            return true;
          };
        }
        zipPath = zipPath ? fixPath(zipPath) : "";
        localPath = pth.normalize(localPath);
        if (filetools.fs.existsSync(localPath)) {
          const items = filetools.findFiles(localPath);
          const self2 = this;
          if (items.length) {
            items.forEach(function(filepath) {
              var p = pth.relative(localPath, filepath).split("\\").join("/");
              if (filter2(p)) {
                var stats = filetools.fs.statSync(filepath);
                if (stats.isFile()) {
                  self2.addFile(zipPath + p, filetools.fs.readFileSync(filepath), "", attr ? attr : stats);
                } else {
                  self2.addFile(zipPath + p + "/", Buffer.alloc(0), "", attr ? attr : stats);
                }
              }
            });
          }
        } else {
          throw new Error(Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
        }
      },
      addLocalFolderAsync: function(localPath, callback, zipPath, filter2) {
        if (filter2 instanceof RegExp) {
          filter2 = function(rx) {
            return function(filename) {
              return rx.test(filename);
            };
          }(filter2);
        } else if (typeof filter2 !== "function") {
          filter2 = function() {
            return true;
          };
        }
        zipPath = zipPath ? fixPath(zipPath) : "";
        localPath = pth.normalize(localPath);
        var self2 = this;
        filetools.fs.open(localPath, "r", function(err) {
          if (err && err.code === "ENOENT") {
            callback(undefined, Utils.Errors.FILE_NOT_FOUND.replace("%s", localPath));
          } else if (err) {
            callback(undefined, err);
          } else {
            var items = filetools.findFiles(localPath);
            var i = -1;
            var next = function() {
              i += 1;
              if (i < items.length) {
                var filepath = items[i];
                var p = pth.relative(localPath, filepath).split("\\").join("/");
                p = p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
                if (filter2(p)) {
                  filetools.fs.stat(filepath, function(er0, stats) {
                    if (er0)
                      callback(undefined, er0);
                    if (stats.isFile()) {
                      filetools.fs.readFile(filepath, function(er1, data4) {
                        if (er1) {
                          callback(undefined, er1);
                        } else {
                          self2.addFile(zipPath + p, data4, "", stats);
                          next();
                        }
                      });
                    } else {
                      self2.addFile(zipPath + p + "/", Buffer.alloc(0), "", stats);
                      next();
                    }
                  });
                } else {
                  process.nextTick(() => {
                    next();
                  });
                }
              } else {
                callback(true, undefined);
              }
            };
            next();
          }
        });
      },
      addLocalFolderPromise: function(localPath, props) {
        return new Promise((resolve, reject) => {
          const { filter: filter2, zipPath } = Object.assign({}, props);
          this.addLocalFolderAsync(localPath, (done, err) => {
            if (err)
              reject(err);
            if (done)
              resolve(this);
          }, zipPath, filter2);
        });
      },
      addFile: function(entryName, content, comment, attr) {
        let entry = getEntry(entryName);
        const update = entry != null;
        if (!update) {
          entry = new ZipEntry;
          entry.entryName = entryName;
        }
        entry.comment = comment || "";
        const isStat = typeof attr === "object" && attr instanceof filetools.fs.Stats;
        if (isStat) {
          entry.header.time = attr.mtime;
        }
        var fileattr = entry.isDirectory ? 16 : 0;
        let unix = entry.isDirectory ? 16384 : 32768;
        if (isStat) {
          unix |= 4095 & attr.mode;
        } else if (typeof attr === "number") {
          unix |= 4095 & attr;
        } else {
          unix |= entry.isDirectory ? 493 : 420;
        }
        fileattr = (fileattr | unix << 16) >>> 0;
        entry.attr = fileattr;
        entry.setData(content);
        if (!update)
          _zip.setEntry(entry);
      },
      getEntries: function() {
        return _zip ? _zip.entries : [];
      },
      getEntry: function(name) {
        return getEntry(name);
      },
      getEntryCount: function() {
        return _zip.getEntryCount();
      },
      forEach: function(callback) {
        return _zip.forEach(callback);
      },
      extractEntryTo: function(entry, targetPath, maintainEntryPath, overwrite, keepOriginalPermission, outFileName) {
        overwrite = get_Bool(overwrite, false);
        keepOriginalPermission = get_Bool(keepOriginalPermission, false);
        maintainEntryPath = get_Bool(maintainEntryPath, true);
        outFileName = get_Str(outFileName, get_Str(keepOriginalPermission, undefined));
        var item = getEntry(entry);
        if (!item) {
          throw new Error(Utils.Errors.NO_ENTRY);
        }
        var entryName = canonical(item.entryName);
        var target = sanitize(targetPath, outFileName && !item.isDirectory ? outFileName : maintainEntryPath ? entryName : pth.basename(entryName));
        if (item.isDirectory) {
          var children = _zip.getEntryChildren(item);
          children.forEach(function(child) {
            if (child.isDirectory)
              return;
            var content2 = child.getData();
            if (!content2) {
              throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
            }
            var name = canonical(child.entryName);
            var childName = sanitize(targetPath, maintainEntryPath ? name : pth.basename(name));
            const fileAttr2 = keepOriginalPermission ? child.header.fileAttr : undefined;
            filetools.writeFileTo(childName, content2, overwrite, fileAttr2);
          });
          return true;
        }
        var content = item.getData();
        if (!content)
          throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
        if (filetools.fs.existsSync(target) && !overwrite) {
          throw new Error(Utils.Errors.CANT_OVERRIDE);
        }
        const fileAttr = keepOriginalPermission ? entry.header.fileAttr : undefined;
        filetools.writeFileTo(target, content, overwrite, fileAttr);
        return true;
      },
      test: function(pass) {
        if (!_zip) {
          return false;
        }
        for (var entry in _zip.entries) {
          try {
            if (entry.isDirectory) {
              continue;
            }
            var content = _zip.entries[entry].getData(pass);
            if (!content) {
              return false;
            }
          } catch (err) {
            return false;
          }
        }
        return true;
      },
      extractAllTo: function(targetPath, overwrite, keepOriginalPermission, pass) {
        overwrite = get_Bool(overwrite, false);
        pass = get_Str(keepOriginalPermission, pass);
        keepOriginalPermission = get_Bool(keepOriginalPermission, false);
        if (!_zip) {
          throw new Error(Utils.Errors.NO_ZIP);
        }
        _zip.entries.forEach(function(entry) {
          var entryName = sanitize(targetPath, canonical(entry.entryName.toString()));
          if (entry.isDirectory) {
            filetools.makeDir(entryName);
            return;
          }
          var content = entry.getData(pass);
          if (!content) {
            throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
          }
          const fileAttr = keepOriginalPermission ? entry.header.fileAttr : undefined;
          filetools.writeFileTo(entryName, content, overwrite, fileAttr);
          try {
            filetools.fs.utimesSync(entryName, entry.header.time, entry.header.time);
          } catch (err) {
            throw new Error(Utils.Errors.CANT_EXTRACT_FILE);
          }
        });
      },
      extractAllToAsync: function(targetPath, overwrite, keepOriginalPermission, callback) {
        overwrite = get_Bool(overwrite, false);
        if (typeof keepOriginalPermission === "function" && !callback)
          callback = keepOriginalPermission;
        keepOriginalPermission = get_Bool(keepOriginalPermission, false);
        if (!callback) {
          callback = function(err) {
            throw new Error(err);
          };
        }
        if (!_zip) {
          callback(new Error(Utils.Errors.NO_ZIP));
          return;
        }
        targetPath = pth.resolve(targetPath);
        const getPath = (entry) => sanitize(targetPath, pth.normalize(canonical(entry.entryName.toString())));
        const getError = (msg, file) => new Error(msg + ': "' + file + '"');
        const dirEntries = [];
        const fileEntries = new Set;
        _zip.entries.forEach((e) => {
          if (e.isDirectory) {
            dirEntries.push(e);
          } else {
            fileEntries.add(e);
          }
        });
        for (const entry of dirEntries) {
          const dirPath = getPath(entry);
          const dirAttr = keepOriginalPermission ? entry.header.fileAttr : undefined;
          try {
            filetools.makeDir(dirPath);
            if (dirAttr)
              filetools.fs.chmodSync(dirPath, dirAttr);
            filetools.fs.utimesSync(dirPath, entry.header.time, entry.header.time);
          } catch (er) {
            callback(getError("Unable to create folder", dirPath));
          }
        }
        const done = () => {
          if (fileEntries.size === 0) {
            callback();
          }
        };
        for (const entry of fileEntries.values()) {
          const entryName = pth.normalize(canonical(entry.entryName.toString()));
          const filePath = sanitize(targetPath, entryName);
          entry.getDataAsync(function(content, err_1) {
            if (err_1) {
              callback(new Error(err_1));
              return;
            }
            if (!content) {
              callback(new Error(Utils.Errors.CANT_EXTRACT_FILE));
            } else {
              const fileAttr = keepOriginalPermission ? entry.header.fileAttr : undefined;
              filetools.writeFileToAsync(filePath, content, overwrite, fileAttr, function(succ) {
                if (!succ) {
                  callback(getError("Unable to write file", filePath));
                  return;
                }
                filetools.fs.utimes(filePath, entry.header.time, entry.header.time, function(err_2) {
                  if (err_2) {
                    callback(getError("Unable to set times", filePath));
                    return;
                  }
                  fileEntries.delete(entry);
                  done();
                });
              });
            }
          });
        }
        done();
      },
      writeZip: function(targetFileName, callback) {
        if (arguments.length === 1) {
          if (typeof targetFileName === "function") {
            callback = targetFileName;
            targetFileName = "";
          }
        }
        if (!targetFileName && opts.filename) {
          targetFileName = opts.filename;
        }
        if (!targetFileName)
          return;
        var zipData = _zip.compressToBuffer();
        if (zipData) {
          var ok = filetools.writeFileTo(targetFileName, zipData, true);
          if (typeof callback === "function")
            callback(!ok ? new Error("failed") : null, "");
        }
      },
      writeZipPromise: function(targetFileName, props) {
        const { overwrite, perm } = Object.assign({ overwrite: true }, props);
        return new Promise((resolve, reject) => {
          if (!targetFileName && opts.filename)
            targetFileName = opts.filename;
          if (!targetFileName)
            reject("ADM-ZIP: ZIP File Name Missing");
          this.toBufferPromise().then((zipData) => {
            const ret = (done) => done ? resolve(done) : reject("ADM-ZIP: Wasn't able to write zip file");
            filetools.writeFileToAsync(targetFileName, zipData, overwrite, perm, ret);
          }, reject);
        });
      },
      toBufferPromise: function() {
        return new Promise((resolve, reject) => {
          _zip.toAsyncBuffer(resolve, reject);
        });
      },
      toBuffer: function(onSuccess, onFail, onItemStart, onItemEnd) {
        this.valueOf = 2;
        if (typeof onSuccess === "function") {
          _zip.toAsyncBuffer(onSuccess, onFail, onItemStart, onItemEnd);
          return null;
        }
        return _zip.compressToBuffer();
      }
    };
  };
});

// node_modules/csvtojson/v2/Parameters.js
var require_Parameters = __commonJS((exports) => {
  var mergeParams = function(params) {
    var defaultParam = {
      delimiter: ",",
      ignoreColumns: undefined,
      includeColumns: undefined,
      quote: '"',
      trim: true,
      checkType: false,
      ignoreEmpty: false,
      noheader: false,
      headers: undefined,
      flatKeys: false,
      maxRowLength: 0,
      checkColumn: false,
      escape: '"',
      colParser: {},
      eol: undefined,
      alwaysSplitAtEOL: false,
      output: "json",
      nullObject: false,
      downstreamFormat: "line",
      needEmitAll: true
    };
    if (!params) {
      params = {};
    }
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        if (Array.isArray(params[key])) {
          defaultParam[key] = [].concat(params[key]);
        } else {
          defaultParam[key] = params[key];
        }
      }
    }
    return defaultParam;
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.mergeParams = mergeParams;
});

// node_modules/csvtojson/v2/ParseRuntime.js
var require_ParseRuntime = __commonJS((exports) => {
  var initParseRuntime = function(converter) {
    var params = converter.parseParam;
    var rtn = {
      needProcessIgnoreColumn: false,
      needProcessIncludeColumn: false,
      selectedColumns: undefined,
      ended: false,
      hasError: false,
      error: undefined,
      delimiter: converter.parseParam.delimiter,
      eol: converter.parseParam.eol,
      columnConv: [],
      headerType: [],
      headerTitle: [],
      headerFlag: [],
      headers: undefined,
      started: false,
      parsedLineNumber: 0,
      columnValueSetter: []
    };
    if (params.ignoreColumns) {
      rtn.needProcessIgnoreColumn = true;
    }
    if (params.includeColumns) {
      rtn.needProcessIncludeColumn = true;
    }
    return rtn;
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.initParseRuntime = initParseRuntime;
});

// node_modules/bluebird/js/release/es5.js
var require_es5 = __commonJS((exports, module) => {
  var isES5 = function() {
    return this === undefined;
  }();
  if (isES5) {
    module.exports = {
      freeze: Object.freeze,
      defineProperty: Object.defineProperty,
      getDescriptor: Object.getOwnPropertyDescriptor,
      keys: Object.keys,
      names: Object.getOwnPropertyNames,
      getPrototypeOf: Object.getPrototypeOf,
      isArray: Array.isArray,
      isES5,
      propertyIsWritable: function(obj, prop) {
        var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        return !!(!descriptor || descriptor.writable || descriptor.set);
      }
    };
  } else {
    has = {}.hasOwnProperty;
    str = {}.toString;
    proto = {}.constructor.prototype;
    ObjectKeys = function(o) {
      var ret = [];
      for (var key in o) {
        if (has.call(o, key)) {
          ret.push(key);
        }
      }
      return ret;
    };
    ObjectGetDescriptor = function(o, key) {
      return { value: o[key] };
    };
    ObjectDefineProperty = function(o, key, desc) {
      o[key] = desc.value;
      return o;
    };
    ObjectFreeze = function(obj) {
      return obj;
    };
    ObjectGetPrototypeOf = function(obj) {
      try {
        return Object(obj).constructor.prototype;
      } catch (e) {
        return proto;
      }
    };
    ArrayIsArray = function(obj) {
      try {
        return str.call(obj) === "[object Array]";
      } catch (e) {
        return false;
      }
    };
    module.exports = {
      isArray: ArrayIsArray,
      keys: ObjectKeys,
      names: ObjectKeys,
      defineProperty: ObjectDefineProperty,
      getDescriptor: ObjectGetDescriptor,
      freeze: ObjectFreeze,
      getPrototypeOf: ObjectGetPrototypeOf,
      isES5,
      propertyIsWritable: function() {
        return true;
      }
    };
  }
  var has;
  var str;
  var proto;
  var ObjectKeys;
  var ObjectGetDescriptor;
  var ObjectDefineProperty;
  var ObjectFreeze;
  var ObjectGetPrototypeOf;
  var ArrayIsArray;
});

// node_modules/bluebird/js/release/util.js
var require_util2 = __commonJS((exports, module) => {
  var tryCatcher = function() {
    try {
      var target = tryCatchTarget;
      tryCatchTarget = null;
      return target.apply(this, arguments);
    } catch (e) {
      errorObj.e = e;
      return errorObj;
    }
  };
  var tryCatch = function(fn) {
    tryCatchTarget = fn;
    return tryCatcher;
  };
  var isPrimitive = function(val) {
    return val == null || val === true || val === false || typeof val === "string" || typeof val === "number";
  };
  var isObject2 = function(value) {
    return typeof value === "function" || typeof value === "object" && value !== null;
  };
  var maybeWrapAsError = function(maybeError) {
    if (!isPrimitive(maybeError))
      return maybeError;
    return new Error(safeToString(maybeError));
  };
  var withAppended = function(target, appendee) {
    var len = target.length;
    var ret2 = new Array(len + 1);
    var i;
    for (i = 0;i < len; ++i) {
      ret2[i] = target[i];
    }
    ret2[i] = appendee;
    return ret2;
  };
  var getDataPropertyOrDefault = function(obj, key, defaultValue) {
    if (es5.isES5) {
      var desc = Object.getOwnPropertyDescriptor(obj, key);
      if (desc != null) {
        return desc.get == null && desc.set == null ? desc.value : defaultValue;
      }
    } else {
      return {}.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
    }
  };
  var notEnumerableProp = function(obj, name, value) {
    if (isPrimitive(obj))
      return obj;
    var descriptor = {
      value,
      configurable: true,
      enumerable: false,
      writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
  };
  var thrower = function(r) {
    throw r;
  };
  var isClass = function(fn) {
    try {
      if (typeof fn === "function") {
        var keys = es5.names(fn.prototype);
        var hasMethods = es5.isES5 && keys.length > 1;
        var hasMethodsOtherThanConstructor = keys.length > 0 && !(keys.length === 1 && keys[0] === "constructor");
        var hasThisAssignmentAndStaticMethods = thisAssignmentPattern.test(fn + "") && es5.names(fn).length > 0;
        if (hasMethods || hasMethodsOtherThanConstructor || hasThisAssignmentAndStaticMethods) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };
  var toFastProperties = function(obj) {
    function FakeConstructor() {
    }
    FakeConstructor.prototype = obj;
    var receiver = new FakeConstructor;
    function ic() {
      return typeof receiver.foo;
    }
    ic();
    ic();
    return obj;
    (0, eval)(obj);
  };
  var isIdentifier = function(str) {
    return rident.test(str);
  };
  var filledRange = function(count, prefix, suffix) {
    var ret2 = new Array(count);
    for (var i = 0;i < count; ++i) {
      ret2[i] = prefix + i + suffix;
    }
    return ret2;
  };
  var safeToString = function(obj) {
    try {
      return obj + "";
    } catch (e) {
      return "[no string representation]";
    }
  };
  var isError = function(obj) {
    return obj instanceof Error || obj !== null && typeof obj === "object" && typeof obj.message === "string" && typeof obj.name === "string";
  };
  var markAsOriginatingFromRejection = function(e) {
    try {
      notEnumerableProp(e, "isOperational", true);
    } catch (ignore) {
    }
  };
  var originatesFromRejection = function(e) {
    if (e == null)
      return false;
    return e instanceof Error["__BluebirdErrorTypes__"].OperationalError || e["isOperational"] === true;
  };
  var canAttachTrace = function(obj) {
    return isError(obj) && es5.propertyIsWritable(obj, "stack");
  };
  var classString = function(obj) {
    return {}.toString.call(obj);
  };
  var copyDescriptors = function(from, to, filter2) {
    var keys = es5.names(from);
    for (var i = 0;i < keys.length; ++i) {
      var key = keys[i];
      if (filter2(key)) {
        try {
          es5.defineProperty(to, key, es5.getDescriptor(from, key));
        } catch (ignore) {
        }
      }
    }
  };
  var env = function(key) {
    return hasEnvVariables ? process.env[key] : undefined;
  };
  var getNativePromise = function() {
    if (typeof Promise === "function") {
      try {
        var promise = new Promise(function() {
        });
        if (classString(promise) === "[object Promise]") {
          return Promise;
        }
      } catch (e) {
      }
    }
  };
  var contextBind = function(ctx, cb) {
    if (ctx === null || typeof cb !== "function" || cb === reflectHandler) {
      return cb;
    }
    if (ctx.domain !== null) {
      cb = ctx.domain.bind(cb);
    }
    var async = ctx.async;
    if (async !== null) {
      var old = cb;
      cb = function() {
        var $_len = arguments.length + 2;
        var args = new Array($_len);
        for (var $_i = 2;$_i < $_len; ++$_i) {
          args[$_i] = arguments[$_i - 2];
        }
        args[0] = old;
        args[1] = this;
        return async.runInAsyncScope.apply(async, args);
      };
    }
    return cb;
  };
  var es5 = require_es5();
  var canEvaluate = typeof navigator == "undefined";
  var errorObj = { e: {} };
  var tryCatchTarget;
  var globalObject = typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : exports !== undefined ? exports : null;
  var inherits2 = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;
    function T() {
      this.constructor = Child;
      this.constructor$ = Parent;
      for (var propertyName in Parent.prototype) {
        if (hasProp.call(Parent.prototype, propertyName) && propertyName.charAt(propertyName.length - 1) !== "$") {
          this[propertyName + "$"] = Parent.prototype[propertyName];
        }
      }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T;
    return Child.prototype;
  };
  var inheritedDataKeys = function() {
    var excludedPrototypes = [
      Array.prototype,
      Object.prototype,
      Function.prototype
    ];
    var isExcludedProto = function(val) {
      for (var i = 0;i < excludedPrototypes.length; ++i) {
        if (excludedPrototypes[i] === val) {
          return true;
        }
      }
      return false;
    };
    if (es5.isES5) {
      var getKeys = Object.getOwnPropertyNames;
      return function(obj) {
        var ret2 = [];
        var visitedKeys = Object.create(null);
        while (obj != null && !isExcludedProto(obj)) {
          var keys;
          try {
            keys = getKeys(obj);
          } catch (e) {
            return ret2;
          }
          for (var i = 0;i < keys.length; ++i) {
            var key = keys[i];
            if (visitedKeys[key])
              continue;
            visitedKeys[key] = true;
            var desc = Object.getOwnPropertyDescriptor(obj, key);
            if (desc != null && desc.get == null && desc.set == null) {
              ret2.push(key);
            }
          }
          obj = es5.getPrototypeOf(obj);
        }
        return ret2;
      };
    } else {
      var hasProp = {}.hasOwnProperty;
      return function(obj) {
        if (isExcludedProto(obj))
          return [];
        var ret2 = [];
        enumeration:
          for (var key in obj) {
            if (hasProp.call(obj, key)) {
              ret2.push(key);
            } else {
              for (var i = 0;i < excludedPrototypes.length; ++i) {
                if (hasProp.call(excludedPrototypes[i], key)) {
                  continue enumeration;
                }
              }
              ret2.push(key);
            }
          }
        return ret2;
      };
    }
  }();
  var thisAssignmentPattern = /this\s*\.\s*\S+\s*=/;
  var rident = /^[a-z$_][a-z$_0-9]*$/i;
  var ensureErrorObject = function() {
    if (!("stack" in new Error)) {
      return function(value) {
        if (canAttachTrace(value))
          return value;
        try {
          throw new Error(safeToString(value));
        } catch (err) {
          return err;
        }
      };
    } else {
      return function(value) {
        if (canAttachTrace(value))
          return value;
        return new Error(safeToString(value));
      };
    }
  }();
  var asArray = function(v) {
    if (es5.isArray(v)) {
      return v;
    }
    return null;
  };
  if (typeof Symbol !== "undefined" && Symbol.iterator) {
    ArrayFrom = typeof Array.from === "function" ? function(v) {
      return Array.from(v);
    } : function(v) {
      var ret2 = [];
      var it = v[Symbol.iterator]();
      var itResult;
      while (!(itResult = it.next()).done) {
        ret2.push(itResult.value);
      }
      return ret2;
    };
    asArray = function(v) {
      if (es5.isArray(v)) {
        return v;
      } else if (v != null && typeof v[Symbol.iterator] === "function") {
        return ArrayFrom(v);
      }
      return null;
    };
  }
  var ArrayFrom;
  var isNode = typeof process !== "undefined" && classString(process).toLowerCase() === "[object process]";
  var hasEnvVariables = typeof process !== "undefined" && typeof process.env !== "undefined";
  var reflectHandler;
  var ret = {
    setReflectHandler: function(fn) {
      reflectHandler = fn;
    },
    isClass,
    isIdentifier,
    inheritedDataKeys,
    getDataPropertyOrDefault,
    thrower,
    isArray: es5.isArray,
    asArray,
    notEnumerableProp,
    isPrimitive,
    isObject: isObject2,
    isError,
    canEvaluate,
    errorObj,
    tryCatch,
    inherits: inherits2,
    withAppended,
    maybeWrapAsError,
    toFastProperties,
    filledRange,
    toString: safeToString,
    canAttachTrace,
    ensureErrorObject,
    originatesFromRejection,
    markAsOriginatingFromRejection,
    classString,
    copyDescriptors,
    isNode,
    hasEnvVariables,
    env,
    global: globalObject,
    getNativePromise,
    contextBind
  };
  ret.isRecentNode = ret.isNode && function() {
    var version;
    if (process.versions && process.versions.node) {
      version = process.versions.node.split(".").map(Number);
    } else if (process.version) {
      version = process.version.split(".").map(Number);
    }
    return version[0] === 0 && version[1] > 10 || version[0] > 0;
  }();
  ret.nodeSupportsAsyncResource = ret.isNode && function() {
    var supportsAsync = false;
    try {
      var res = __require("async_hooks").AsyncResource;
      supportsAsync = typeof res.prototype.runInAsyncScope === "function";
    } catch (e) {
      supportsAsync = false;
    }
    return supportsAsync;
  }();
  if (ret.isNode)
    ret.toFastProperties(process);
  try {
    throw new Error;
  } catch (e) {
    ret.lastLineError = e;
  }
  module.exports = ret;
});

// node_modules/bluebird/js/release/schedule.js
var require_schedule = __commonJS((exports, module) => {
  var util2 = require_util2();
  var schedule;
  var noAsyncScheduler = function() {
    throw new Error(`No async scheduler available

    See http://goo.gl/MqrFmX
`);
  };
  var NativePromise = util2.getNativePromise();
  if (util2.isNode && typeof MutationObserver === "undefined") {
    GlobalSetImmediate = global.setImmediate;
    ProcessNextTick = process.nextTick;
    schedule = util2.isRecentNode ? function(fn) {
      GlobalSetImmediate.call(global, fn);
    } : function(fn) {
      ProcessNextTick.call(process, fn);
    };
  } else if (typeof NativePromise === "function" && typeof NativePromise.resolve === "function") {
    nativePromise = NativePromise.resolve();
    schedule = function(fn) {
      nativePromise.then(fn);
    };
  } else if (typeof MutationObserver !== "undefined" && !(typeof window !== "undefined" && window.navigator && (window.navigator.standalone || window.cordova)) && ("classList" in document.documentElement)) {
    schedule = function() {
      var div = document.createElement("div");
      var opts = { attributes: true };
      var toggleScheduled = false;
      var div2 = document.createElement("div");
      var o2 = new MutationObserver(function() {
        div.classList.toggle("foo");
        toggleScheduled = false;
      });
      o2.observe(div2, opts);
      var scheduleToggle = function() {
        if (toggleScheduled)
          return;
        toggleScheduled = true;
        div2.classList.toggle("foo");
      };
      return function schedule(fn) {
        var o = new MutationObserver(function() {
          o.disconnect();
          fn();
        });
        o.observe(div, opts);
        scheduleToggle();
      };
    }();
  } else if (typeof setImmediate !== "undefined") {
    schedule = function(fn) {
      setImmediate(fn);
    };
  } else if (typeof setTimeout !== "undefined") {
    schedule = function(fn) {
      setTimeout(fn, 0);
    };
  } else {
    schedule = noAsyncScheduler;
  }
  var GlobalSetImmediate;
  var ProcessNextTick;
  var nativePromise;
  module.exports = schedule;
});

// node_modules/bluebird/js/release/queue.js
var require_queue = __commonJS((exports, module) => {
  var arrayMove = function(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0;j < len; ++j) {
      dst[j + dstIndex] = src[j + srcIndex];
      src[j + srcIndex] = undefined;
    }
  };
  var Queue = function(capacity) {
    this._capacity = capacity;
    this._length = 0;
    this._front = 0;
  };
  Queue.prototype._willBeOverCapacity = function(size) {
    return this._capacity < size;
  };
  Queue.prototype._pushOne = function(arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = this._front + length & this._capacity - 1;
    this[i] = arg;
    this._length = length + 1;
  };
  Queue.prototype.push = function(fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
      this._pushOne(fn);
      this._pushOne(receiver);
      this._pushOne(arg);
      return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[j + 0 & wrapMask] = fn;
    this[j + 1 & wrapMask] = receiver;
    this[j + 2 & wrapMask] = arg;
    this._length = length;
  };
  Queue.prototype.shift = function() {
    var front = this._front, ret = this[front];
    this[front] = undefined;
    this._front = front + 1 & this._capacity - 1;
    this._length--;
    return ret;
  };
  Queue.prototype.length = function() {
    return this._length;
  };
  Queue.prototype._checkCapacity = function(size) {
    if (this._capacity < size) {
      this._resizeTo(this._capacity << 1);
    }
  };
  Queue.prototype._resizeTo = function(capacity) {
    var oldCapacity = this._capacity;
    this._capacity = capacity;
    var front = this._front;
    var length = this._length;
    var moveItemsCount = front + length & oldCapacity - 1;
    arrayMove(this, 0, this, oldCapacity, moveItemsCount);
  };
  module.exports = Queue;
});

// node_modules/bluebird/js/release/async.js
var require_async2 = __commonJS((exports, module) => {
  var Async = function() {
    this._customScheduler = false;
    this._isTickUsed = false;
    this._lateQueue = new Queue(16);
    this._normalQueue = new Queue(16);
    this._haveDrainedQueues = false;
    var self2 = this;
    this.drainQueues = function() {
      self2._drainQueues();
    };
    this._schedule = schedule;
  };
  var AsyncInvokeLater = function(fn, receiver, arg) {
    this._lateQueue.push(fn, receiver, arg);
    this._queueTick();
  };
  var AsyncInvoke = function(fn, receiver, arg) {
    this._normalQueue.push(fn, receiver, arg);
    this._queueTick();
  };
  var AsyncSettlePromises = function(promise) {
    this._normalQueue._pushOne(promise);
    this._queueTick();
  };
  var _drainQueue = function(queue) {
    while (queue.length() > 0) {
      _drainQueueStep(queue);
    }
  };
  var _drainQueueStep = function(queue) {
    var fn = queue.shift();
    if (typeof fn !== "function") {
      fn._settlePromises();
    } else {
      var receiver = queue.shift();
      var arg = queue.shift();
      fn.call(receiver, arg);
    }
  };
  var firstLineError;
  try {
    throw new Error;
  } catch (e) {
    firstLineError = e;
  }
  var schedule = require_schedule();
  var Queue = require_queue();
  Async.prototype.setScheduler = function(fn) {
    var prev = this._schedule;
    this._schedule = fn;
    this._customScheduler = true;
    return prev;
  };
  Async.prototype.hasCustomScheduler = function() {
    return this._customScheduler;
  };
  Async.prototype.haveItemsQueued = function() {
    return this._isTickUsed || this._haveDrainedQueues;
  };
  Async.prototype.fatalError = function(e, isNode) {
    if (isNode) {
      process.stderr.write("Fatal " + (e instanceof Error ? e.stack : e) + "\n");
      process.exit(2);
    } else {
      this.throwLater(e);
    }
  };
  Async.prototype.throwLater = function(fn, arg) {
    if (arguments.length === 1) {
      arg = fn;
      fn = function() {
        throw arg;
      };
    }
    if (typeof setTimeout !== "undefined") {
      setTimeout(function() {
        fn(arg);
      }, 0);
    } else
      try {
        this._schedule(function() {
          fn(arg);
        });
      } catch (e) {
        throw new Error(`No async scheduler available

    See http://goo.gl/MqrFmX
`);
      }
  };
  Async.prototype.invokeLater = AsyncInvokeLater;
  Async.prototype.invoke = AsyncInvoke;
  Async.prototype.settlePromises = AsyncSettlePromises;
  Async.prototype._drainQueues = function() {
    _drainQueue(this._normalQueue);
    this._reset();
    this._haveDrainedQueues = true;
    _drainQueue(this._lateQueue);
  };
  Async.prototype._queueTick = function() {
    if (!this._isTickUsed) {
      this._isTickUsed = true;
      this._schedule(this.drainQueues);
    }
  };
  Async.prototype._reset = function() {
    this._isTickUsed = false;
  };
  module.exports = Async;
  module.exports.firstLineError = firstLineError;
});

// node_modules/bluebird/js/release/errors.js
var require_errors2 = __commonJS((exports, module) => {
  var subError = function(nameProperty, defaultMessage) {
    function SubError(message) {
      if (!(this instanceof SubError))
        return new SubError(message);
      notEnumerableProp(this, "message", typeof message === "string" ? message : defaultMessage);
      notEnumerableProp(this, "name", nameProperty);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      } else {
        Error.call(this);
      }
    }
    inherits2(SubError, Error);
    return SubError;
  };
  var OperationalError = function(message) {
    if (!(this instanceof OperationalError))
      return new OperationalError(message);
    notEnumerableProp(this, "name", "OperationalError");
    notEnumerableProp(this, "message", message);
    this.cause = message;
    this["isOperational"] = true;
    if (message instanceof Error) {
      notEnumerableProp(this, "message", message.message);
      notEnumerableProp(this, "stack", message.stack);
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  };
  var es5 = require_es5();
  var Objectfreeze = es5.freeze;
  var util2 = require_util2();
  var inherits2 = util2.inherits;
  var notEnumerableProp = util2.notEnumerableProp;
  var _TypeError;
  var _RangeError;
  var Warning = subError("Warning", "warning");
  var CancellationError = subError("CancellationError", "cancellation error");
  var TimeoutError = subError("TimeoutError", "timeout error");
  var AggregateError = subError("AggregateError", "aggregate error");
  try {
    _TypeError = TypeError;
    _RangeError = RangeError;
  } catch (e) {
    _TypeError = subError("TypeError", "type error");
    _RangeError = subError("RangeError", "range error");
  }
  var methods = "join pop push shift unshift slice filter forEach some every map indexOf lastIndexOf reduce reduceRight sort reverse".split(" ");
  for (i = 0;i < methods.length; ++i) {
    if (typeof Array.prototype[methods[i]] === "function") {
      AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
    }
  }
  var i;
  es5.defineProperty(AggregateError.prototype, "length", {
    value: 0,
    configurable: false,
    writable: true,
    enumerable: true
  });
  AggregateError.prototype["isOperational"] = true;
  var level = 0;
  AggregateError.prototype.toString = function() {
    var indent = Array(level * 4 + 1).join(" ");
    var ret = "\n" + indent + "AggregateError of:\n";
    level++;
    indent = Array(level * 4 + 1).join(" ");
    for (var i2 = 0;i2 < this.length; ++i2) {
      var str = this[i2] === this ? "[Circular AggregateError]" : this[i2] + "";
      var lines = str.split("\n");
      for (var j = 0;j < lines.length; ++j) {
        lines[j] = indent + lines[j];
      }
      str = lines.join("\n");
      ret += str + "\n";
    }
    level--;
    return ret;
  };
  inherits2(OperationalError, Error);
  var errorTypes = Error["__BluebirdErrorTypes__"];
  if (!errorTypes) {
    errorTypes = Objectfreeze({
      CancellationError,
      TimeoutError,
      OperationalError,
      RejectionError: OperationalError,
      AggregateError
    });
    es5.defineProperty(Error, "__BluebirdErrorTypes__", {
      value: errorTypes,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
  module.exports = {
    Error,
    TypeError: _TypeError,
    RangeError: _RangeError,
    CancellationError: errorTypes.CancellationError,
    OperationalError: errorTypes.OperationalError,
    TimeoutError: errorTypes.TimeoutError,
    AggregateError: errorTypes.AggregateError,
    Warning
  };
});

// node_modules/bluebird/js/release/thenables.js
var require_thenables = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL) {
    var util2 = require_util2();
    var errorObj = util2.errorObj;
    var isObject2 = util2.isObject;
    function tryConvertToPromise(obj, context) {
      if (isObject2(obj)) {
        if (obj instanceof Promise2)
          return obj;
        var then = getThen(obj);
        if (then === errorObj) {
          if (context)
            context._pushContext();
          var ret = Promise2.reject(then.e);
          if (context)
            context._popContext();
          return ret;
        } else if (typeof then === "function") {
          if (isAnyBluebirdPromise(obj)) {
            var ret = new Promise2(INTERNAL);
            obj._then(ret._fulfill, ret._reject, undefined, ret, null);
            return ret;
          }
          return doThenable(obj, then, context);
        }
      }
      return obj;
    }
    function doGetThen(obj) {
      return obj.then;
    }
    function getThen(obj) {
      try {
        return doGetThen(obj);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    }
    var hasProp = {}.hasOwnProperty;
    function isAnyBluebirdPromise(obj) {
      try {
        return hasProp.call(obj, "_promise0");
      } catch (e) {
        return false;
      }
    }
    function doThenable(x, then, context) {
      var promise = new Promise2(INTERNAL);
      var ret = promise;
      if (context)
        context._pushContext();
      promise._captureStackTrace();
      if (context)
        context._popContext();
      var synchronous = true;
      var result = util2.tryCatch(then).call(x, resolve, reject);
      synchronous = false;
      if (promise && result === errorObj) {
        promise._rejectCallback(result.e, true, true);
        promise = null;
      }
      function resolve(value) {
        if (!promise)
          return;
        promise._resolveCallback(value);
        promise = null;
      }
      function reject(reason) {
        if (!promise)
          return;
        promise._rejectCallback(reason, synchronous, true);
        promise = null;
      }
      return ret;
    }
    return tryConvertToPromise;
  };
});

// node_modules/bluebird/js/release/promise_array.js
var require_promise_array = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL, tryConvertToPromise, apiRejection, Proxyable) {
    var util2 = require_util2();
    var isArray2 = util2.isArray;
    function toResolutionValue(val) {
      switch (val) {
        case -2:
          return [];
        case -3:
          return {};
        case -6:
          return new Map;
      }
    }
    function PromiseArray(values) {
      var promise = this._promise = new Promise2(INTERNAL);
      if (values instanceof Promise2) {
        promise._propagateFrom(values, 3);
        values.suppressUnhandledRejections();
      }
      promise._setOnCancel(this);
      this._values = values;
      this._length = 0;
      this._totalResolved = 0;
      this._init(undefined, -2);
    }
    util2.inherits(PromiseArray, Proxyable);
    PromiseArray.prototype.length = function() {
      return this._length;
    };
    PromiseArray.prototype.promise = function() {
      return this._promise;
    };
    PromiseArray.prototype._init = function init(_, resolveValueIfEmpty) {
      var values = tryConvertToPromise(this._values, this._promise);
      if (values instanceof Promise2) {
        values = values._target();
        var bitField = values._bitField;
        this._values = values;
        if ((bitField & 50397184) === 0) {
          this._promise._setAsyncGuaranteed();
          return values._then(init, this._reject, undefined, this, resolveValueIfEmpty);
        } else if ((bitField & 33554432) !== 0) {
          values = values._value();
        } else if ((bitField & 16777216) !== 0) {
          return this._reject(values._reason());
        } else {
          return this._cancel();
        }
      }
      values = util2.asArray(values);
      if (values === null) {
        var err = apiRejection("expecting an array or an iterable object but got " + util2.classString(values)).reason();
        this._promise._rejectCallback(err, false);
        return;
      }
      if (values.length === 0) {
        if (resolveValueIfEmpty === -5) {
          this._resolveEmptyArray();
        } else {
          this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
      }
      this._iterate(values);
    };
    PromiseArray.prototype._iterate = function(values) {
      var len = this.getActualLength(values.length);
      this._length = len;
      this._values = this.shouldCopyValues() ? new Array(len) : this._values;
      var result = this._promise;
      var isResolved = false;
      var bitField = null;
      for (var i = 0;i < len; ++i) {
        var maybePromise = tryConvertToPromise(values[i], result);
        if (maybePromise instanceof Promise2) {
          maybePromise = maybePromise._target();
          bitField = maybePromise._bitField;
        } else {
          bitField = null;
        }
        if (isResolved) {
          if (bitField !== null) {
            maybePromise.suppressUnhandledRejections();
          }
        } else if (bitField !== null) {
          if ((bitField & 50397184) === 0) {
            maybePromise._proxy(this, i);
            this._values[i] = maybePromise;
          } else if ((bitField & 33554432) !== 0) {
            isResolved = this._promiseFulfilled(maybePromise._value(), i);
          } else if ((bitField & 16777216) !== 0) {
            isResolved = this._promiseRejected(maybePromise._reason(), i);
          } else {
            isResolved = this._promiseCancelled(i);
          }
        } else {
          isResolved = this._promiseFulfilled(maybePromise, i);
        }
      }
      if (!isResolved)
        result._setAsyncGuaranteed();
    };
    PromiseArray.prototype._isResolved = function() {
      return this._values === null;
    };
    PromiseArray.prototype._resolve = function(value) {
      this._values = null;
      this._promise._fulfill(value);
    };
    PromiseArray.prototype._cancel = function() {
      if (this._isResolved() || !this._promise._isCancellable())
        return;
      this._values = null;
      this._promise._cancel();
    };
    PromiseArray.prototype._reject = function(reason) {
      this._values = null;
      this._promise._rejectCallback(reason, false);
    };
    PromiseArray.prototype._promiseFulfilled = function(value, index) {
      this._values[index] = value;
      var totalResolved = ++this._totalResolved;
      if (totalResolved >= this._length) {
        this._resolve(this._values);
        return true;
      }
      return false;
    };
    PromiseArray.prototype._promiseCancelled = function() {
      this._cancel();
      return true;
    };
    PromiseArray.prototype._promiseRejected = function(reason) {
      this._totalResolved++;
      this._reject(reason);
      return true;
    };
    PromiseArray.prototype._resultCancelled = function() {
      if (this._isResolved())
        return;
      var values = this._values;
      this._cancel();
      if (values instanceof Promise2) {
        values.cancel();
      } else {
        for (var i = 0;i < values.length; ++i) {
          if (values[i] instanceof Promise2) {
            values[i].cancel();
          }
        }
      }
    };
    PromiseArray.prototype.shouldCopyValues = function() {
      return true;
    };
    PromiseArray.prototype.getActualLength = function(len) {
      return len;
    };
    return PromiseArray;
  };
});

// node_modules/bluebird/js/release/context.js
var require_context = __commonJS((exports, module) => {
  module.exports = function(Promise2) {
    var longStackTraces = false;
    var contextStack = [];
    Promise2.prototype._promiseCreated = function() {
    };
    Promise2.prototype._pushContext = function() {
    };
    Promise2.prototype._popContext = function() {
      return null;
    };
    Promise2._peekContext = Promise2.prototype._peekContext = function() {
    };
    function Context() {
      this._trace = new Context.CapturedTrace(peekContext());
    }
    Context.prototype._pushContext = function() {
      if (this._trace !== undefined) {
        this._trace._promiseCreated = null;
        contextStack.push(this._trace);
      }
    };
    Context.prototype._popContext = function() {
      if (this._trace !== undefined) {
        var trace = contextStack.pop();
        var ret = trace._promiseCreated;
        trace._promiseCreated = null;
        return ret;
      }
      return null;
    };
    function createContext() {
      if (longStackTraces)
        return new Context;
    }
    function peekContext() {
      var lastIndex = contextStack.length - 1;
      if (lastIndex >= 0) {
        return contextStack[lastIndex];
      }
      return;
    }
    Context.CapturedTrace = null;
    Context.create = createContext;
    Context.deactivateLongStackTraces = function() {
    };
    Context.activateLongStackTraces = function() {
      var Promise_pushContext = Promise2.prototype._pushContext;
      var Promise_popContext = Promise2.prototype._popContext;
      var Promise_PeekContext = Promise2._peekContext;
      var Promise_peekContext = Promise2.prototype._peekContext;
      var Promise_promiseCreated = Promise2.prototype._promiseCreated;
      Context.deactivateLongStackTraces = function() {
        Promise2.prototype._pushContext = Promise_pushContext;
        Promise2.prototype._popContext = Promise_popContext;
        Promise2._peekContext = Promise_PeekContext;
        Promise2.prototype._peekContext = Promise_peekContext;
        Promise2.prototype._promiseCreated = Promise_promiseCreated;
        longStackTraces = false;
      };
      longStackTraces = true;
      Promise2.prototype._pushContext = Context.prototype._pushContext;
      Promise2.prototype._popContext = Context.prototype._popContext;
      Promise2._peekContext = Promise2.prototype._peekContext = peekContext;
      Promise2.prototype._promiseCreated = function() {
        var ctx = this._peekContext();
        if (ctx && ctx._promiseCreated == null)
          ctx._promiseCreated = this;
      };
    };
    return Context;
  };
});

// node_modules/bluebird/js/release/debuggability.js
var require_debuggability = __commonJS((exports, module) => {
  module.exports = function(Promise2, Context, enableAsyncHooks, disableAsyncHooks) {
    var async = Promise2._async;
    var Warning = require_errors2().Warning;
    var util2 = require_util2();
    var es5 = require_es5();
    var canAttachTrace = util2.canAttachTrace;
    var unhandledRejectionHandled;
    var possiblyUnhandledRejection;
    var bluebirdFramePattern = /[\\\/]bluebird[\\\/]js[\\\/](release|debug|instrumented)/;
    var nodeFramePattern = /\((?:timers\.js):\d+:\d+\)/;
    var parseLinePattern = /[\/<\(](.+?):(\d+):(\d+)\)?\s*$/;
    var stackFramePattern = null;
    var formatStack = null;
    var indentStackFrames = false;
    var printWarning;
    var debugging = !!(util2.env("BLUEBIRD_DEBUG") != 0 && (util2.env("BLUEBIRD_DEBUG") || util2.env("NODE_ENV") === "development"));
    var warnings = !!(util2.env("BLUEBIRD_WARNINGS") != 0 && (debugging || util2.env("BLUEBIRD_WARNINGS")));
    var longStackTraces = !!(util2.env("BLUEBIRD_LONG_STACK_TRACES") != 0 && (debugging || util2.env("BLUEBIRD_LONG_STACK_TRACES")));
    var wForgottenReturn = util2.env("BLUEBIRD_W_FORGOTTEN_RETURN") != 0 && (warnings || !!util2.env("BLUEBIRD_W_FORGOTTEN_RETURN"));
    var deferUnhandledRejectionCheck;
    (function() {
      var promises = [];
      function unhandledRejectionCheck() {
        for (var i = 0;i < promises.length; ++i) {
          promises[i]._notifyUnhandledRejection();
        }
        unhandledRejectionClear();
      }
      function unhandledRejectionClear() {
        promises.length = 0;
      }
      deferUnhandledRejectionCheck = function(promise) {
        promises.push(promise);
        setTimeout(unhandledRejectionCheck, 1);
      };
      es5.defineProperty(Promise2, "_unhandledRejectionCheck", {
        value: unhandledRejectionCheck
      });
      es5.defineProperty(Promise2, "_unhandledRejectionClear", {
        value: unhandledRejectionClear
      });
    })();
    Promise2.prototype.suppressUnhandledRejections = function() {
      var target = this._target();
      target._bitField = target._bitField & ~1048576 | 524288;
    };
    Promise2.prototype._ensurePossibleRejectionHandled = function() {
      if ((this._bitField & 524288) !== 0)
        return;
      this._setRejectionIsUnhandled();
      deferUnhandledRejectionCheck(this);
    };
    Promise2.prototype._notifyUnhandledRejectionIsHandled = function() {
      fireRejectionEvent("rejectionHandled", unhandledRejectionHandled, undefined, this);
    };
    Promise2.prototype._setReturnedNonUndefined = function() {
      this._bitField = this._bitField | 268435456;
    };
    Promise2.prototype._returnedNonUndefined = function() {
      return (this._bitField & 268435456) !== 0;
    };
    Promise2.prototype._notifyUnhandledRejection = function() {
      if (this._isRejectionUnhandled()) {
        var reason = this._settledValue();
        this._setUnhandledRejectionIsNotified();
        fireRejectionEvent("unhandledRejection", possiblyUnhandledRejection, reason, this);
      }
    };
    Promise2.prototype._setUnhandledRejectionIsNotified = function() {
      this._bitField = this._bitField | 262144;
    };
    Promise2.prototype._unsetUnhandledRejectionIsNotified = function() {
      this._bitField = this._bitField & ~262144;
    };
    Promise2.prototype._isUnhandledRejectionNotified = function() {
      return (this._bitField & 262144) > 0;
    };
    Promise2.prototype._setRejectionIsUnhandled = function() {
      this._bitField = this._bitField | 1048576;
    };
    Promise2.prototype._unsetRejectionIsUnhandled = function() {
      this._bitField = this._bitField & ~1048576;
      if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
      }
    };
    Promise2.prototype._isRejectionUnhandled = function() {
      return (this._bitField & 1048576) > 0;
    };
    Promise2.prototype._warn = function(message, shouldUseOwnTrace, promise) {
      return warn(message, shouldUseOwnTrace, promise || this);
    };
    Promise2.onPossiblyUnhandledRejection = function(fn) {
      var context = Promise2._getContext();
      possiblyUnhandledRejection = util2.contextBind(context, fn);
    };
    Promise2.onUnhandledRejectionHandled = function(fn) {
      var context = Promise2._getContext();
      unhandledRejectionHandled = util2.contextBind(context, fn);
    };
    var disableLongStackTraces = function() {
    };
    Promise2.longStackTraces = function() {
      if (async.haveItemsQueued() && !config.longStackTraces) {
        throw new Error(`cannot enable long stack traces after promises have been created

    See http://goo.gl/MqrFmX
`);
      }
      if (!config.longStackTraces && longStackTracesIsSupported()) {
        var Promise_captureStackTrace = Promise2.prototype._captureStackTrace;
        var Promise_attachExtraTrace = Promise2.prototype._attachExtraTrace;
        var Promise_dereferenceTrace = Promise2.prototype._dereferenceTrace;
        config.longStackTraces = true;
        disableLongStackTraces = function() {
          if (async.haveItemsQueued() && !config.longStackTraces) {
            throw new Error(`cannot enable long stack traces after promises have been created

    See http://goo.gl/MqrFmX
`);
          }
          Promise2.prototype._captureStackTrace = Promise_captureStackTrace;
          Promise2.prototype._attachExtraTrace = Promise_attachExtraTrace;
          Promise2.prototype._dereferenceTrace = Promise_dereferenceTrace;
          Context.deactivateLongStackTraces();
          config.longStackTraces = false;
        };
        Promise2.prototype._captureStackTrace = longStackTracesCaptureStackTrace;
        Promise2.prototype._attachExtraTrace = longStackTracesAttachExtraTrace;
        Promise2.prototype._dereferenceTrace = longStackTracesDereferenceTrace;
        Context.activateLongStackTraces();
      }
    };
    Promise2.hasLongStackTraces = function() {
      return config.longStackTraces && longStackTracesIsSupported();
    };
    var legacyHandlers = {
      unhandledrejection: {
        before: function() {
          var ret = util2.global.onunhandledrejection;
          util2.global.onunhandledrejection = null;
          return ret;
        },
        after: function(fn) {
          util2.global.onunhandledrejection = fn;
        }
      },
      rejectionhandled: {
        before: function() {
          var ret = util2.global.onrejectionhandled;
          util2.global.onrejectionhandled = null;
          return ret;
        },
        after: function(fn) {
          util2.global.onrejectionhandled = fn;
        }
      }
    };
    var fireDomEvent = function() {
      var dispatch = function(legacy, e) {
        if (legacy) {
          var fn;
          try {
            fn = legacy.before();
            return !util2.global.dispatchEvent(e);
          } finally {
            legacy.after(fn);
          }
        } else {
          return !util2.global.dispatchEvent(e);
        }
      };
      try {
        if (typeof CustomEvent === "function") {
          var event = new CustomEvent("CustomEvent");
          util2.global.dispatchEvent(event);
          return function(name, event2) {
            name = name.toLowerCase();
            var eventData = {
              detail: event2,
              cancelable: true
            };
            var domEvent = new CustomEvent(name, eventData);
            es5.defineProperty(domEvent, "promise", { value: event2.promise });
            es5.defineProperty(domEvent, "reason", { value: event2.reason });
            return dispatch(legacyHandlers[name], domEvent);
          };
        } else if (typeof Event === "function") {
          var event = new Event("CustomEvent");
          util2.global.dispatchEvent(event);
          return function(name, event2) {
            name = name.toLowerCase();
            var domEvent = new Event(name, {
              cancelable: true
            });
            domEvent.detail = event2;
            es5.defineProperty(domEvent, "promise", { value: event2.promise });
            es5.defineProperty(domEvent, "reason", { value: event2.reason });
            return dispatch(legacyHandlers[name], domEvent);
          };
        } else {
          var event = document.createEvent("CustomEvent");
          event.initCustomEvent("testingtheevent", false, true, {});
          util2.global.dispatchEvent(event);
          return function(name, event2) {
            name = name.toLowerCase();
            var domEvent = document.createEvent("CustomEvent");
            domEvent.initCustomEvent(name, false, true, event2);
            return dispatch(legacyHandlers[name], domEvent);
          };
        }
      } catch (e) {
      }
      return function() {
        return false;
      };
    }();
    var fireGlobalEvent = function() {
      if (util2.isNode) {
        return function() {
          return process.emit.apply(process, arguments);
        };
      } else {
        if (!util2.global) {
          return function() {
            return false;
          };
        }
        return function(name) {
          var methodName = "on" + name.toLowerCase();
          var method = util2.global[methodName];
          if (!method)
            return false;
          method.apply(util2.global, [].slice.call(arguments, 1));
          return true;
        };
      }
    }();
    function generatePromiseLifecycleEventObject(name, promise) {
      return { promise };
    }
    var eventToObjectGenerator = {
      promiseCreated: generatePromiseLifecycleEventObject,
      promiseFulfilled: generatePromiseLifecycleEventObject,
      promiseRejected: generatePromiseLifecycleEventObject,
      promiseResolved: generatePromiseLifecycleEventObject,
      promiseCancelled: generatePromiseLifecycleEventObject,
      promiseChained: function(name, promise, child) {
        return { promise, child };
      },
      warning: function(name, warning) {
        return { warning };
      },
      unhandledRejection: function(name, reason, promise) {
        return { reason, promise };
      },
      rejectionHandled: generatePromiseLifecycleEventObject
    };
    var activeFireEvent = function(name) {
      var globalEventFired = false;
      try {
        globalEventFired = fireGlobalEvent.apply(null, arguments);
      } catch (e) {
        async.throwLater(e);
        globalEventFired = true;
      }
      var domEventFired = false;
      try {
        domEventFired = fireDomEvent(name, eventToObjectGenerator[name].apply(null, arguments));
      } catch (e) {
        async.throwLater(e);
        domEventFired = true;
      }
      return domEventFired || globalEventFired;
    };
    Promise2.config = function(opts) {
      opts = Object(opts);
      if ("longStackTraces" in opts) {
        if (opts.longStackTraces) {
          Promise2.longStackTraces();
        } else if (!opts.longStackTraces && Promise2.hasLongStackTraces()) {
          disableLongStackTraces();
        }
      }
      if ("warnings" in opts) {
        var warningsOption = opts.warnings;
        config.warnings = !!warningsOption;
        wForgottenReturn = config.warnings;
        if (util2.isObject(warningsOption)) {
          if ("wForgottenReturn" in warningsOption) {
            wForgottenReturn = !!warningsOption.wForgottenReturn;
          }
        }
      }
      if (("cancellation" in opts) && opts.cancellation && !config.cancellation) {
        if (async.haveItemsQueued()) {
          throw new Error("cannot enable cancellation after promises are in use");
        }
        Promise2.prototype._clearCancellationData = cancellationClearCancellationData;
        Promise2.prototype._propagateFrom = cancellationPropagateFrom;
        Promise2.prototype._onCancel = cancellationOnCancel;
        Promise2.prototype._setOnCancel = cancellationSetOnCancel;
        Promise2.prototype._attachCancellationCallback = cancellationAttachCancellationCallback;
        Promise2.prototype._execute = cancellationExecute;
        propagateFromFunction = cancellationPropagateFrom;
        config.cancellation = true;
      }
      if ("monitoring" in opts) {
        if (opts.monitoring && !config.monitoring) {
          config.monitoring = true;
          Promise2.prototype._fireEvent = activeFireEvent;
        } else if (!opts.monitoring && config.monitoring) {
          config.monitoring = false;
          Promise2.prototype._fireEvent = defaultFireEvent;
        }
      }
      if (("asyncHooks" in opts) && util2.nodeSupportsAsyncResource) {
        var prev = config.asyncHooks;
        var cur = !!opts.asyncHooks;
        if (prev !== cur) {
          config.asyncHooks = cur;
          if (cur) {
            enableAsyncHooks();
          } else {
            disableAsyncHooks();
          }
        }
      }
      return Promise2;
    };
    function defaultFireEvent() {
      return false;
    }
    Promise2.prototype._fireEvent = defaultFireEvent;
    Promise2.prototype._execute = function(executor, resolve, reject) {
      try {
        executor(resolve, reject);
      } catch (e) {
        return e;
      }
    };
    Promise2.prototype._onCancel = function() {
    };
    Promise2.prototype._setOnCancel = function(handler) {
    };
    Promise2.prototype._attachCancellationCallback = function(onCancel) {
    };
    Promise2.prototype._captureStackTrace = function() {
    };
    Promise2.prototype._attachExtraTrace = function() {
    };
    Promise2.prototype._dereferenceTrace = function() {
    };
    Promise2.prototype._clearCancellationData = function() {
    };
    Promise2.prototype._propagateFrom = function(parent, flags) {
    };
    function cancellationExecute(executor, resolve, reject) {
      var promise = this;
      try {
        executor(resolve, reject, function(onCancel) {
          if (typeof onCancel !== "function") {
            throw new TypeError("onCancel must be a function, got: " + util2.toString(onCancel));
          }
          promise._attachCancellationCallback(onCancel);
        });
      } catch (e) {
        return e;
      }
    }
    function cancellationAttachCancellationCallback(onCancel) {
      if (!this._isCancellable())
        return this;
      var previousOnCancel = this._onCancel();
      if (previousOnCancel !== undefined) {
        if (util2.isArray(previousOnCancel)) {
          previousOnCancel.push(onCancel);
        } else {
          this._setOnCancel([previousOnCancel, onCancel]);
        }
      } else {
        this._setOnCancel(onCancel);
      }
    }
    function cancellationOnCancel() {
      return this._onCancelField;
    }
    function cancellationSetOnCancel(onCancel) {
      this._onCancelField = onCancel;
    }
    function cancellationClearCancellationData() {
      this._cancellationParent = undefined;
      this._onCancelField = undefined;
    }
    function cancellationPropagateFrom(parent, flags) {
      if ((flags & 1) !== 0) {
        this._cancellationParent = parent;
        var branchesRemainingToCancel = parent._branchesRemainingToCancel;
        if (branchesRemainingToCancel === undefined) {
          branchesRemainingToCancel = 0;
        }
        parent._branchesRemainingToCancel = branchesRemainingToCancel + 1;
      }
      if ((flags & 2) !== 0 && parent._isBound()) {
        this._setBoundTo(parent._boundTo);
      }
    }
    function bindingPropagateFrom(parent, flags) {
      if ((flags & 2) !== 0 && parent._isBound()) {
        this._setBoundTo(parent._boundTo);
      }
    }
    var propagateFromFunction = bindingPropagateFrom;
    function boundValueFunction() {
      var ret = this._boundTo;
      if (ret !== undefined) {
        if (ret instanceof Promise2) {
          if (ret.isFulfilled()) {
            return ret.value();
          } else {
            return;
          }
        }
      }
      return ret;
    }
    function longStackTracesCaptureStackTrace() {
      this._trace = new CapturedTrace(this._peekContext());
    }
    function longStackTracesAttachExtraTrace(error, ignoreSelf) {
      if (canAttachTrace(error)) {
        var trace = this._trace;
        if (trace !== undefined) {
          if (ignoreSelf)
            trace = trace._parent;
        }
        if (trace !== undefined) {
          trace.attachExtraTrace(error);
        } else if (!error.__stackCleaned__) {
          var parsed = parseStackAndMessage(error);
          util2.notEnumerableProp(error, "stack", parsed.message + "\n" + parsed.stack.join("\n"));
          util2.notEnumerableProp(error, "__stackCleaned__", true);
        }
      }
    }
    function longStackTracesDereferenceTrace() {
      this._trace = undefined;
    }
    function checkForgottenReturns(returnValue, promiseCreated, name, promise, parent) {
      if (returnValue === undefined && promiseCreated !== null && wForgottenReturn) {
        if (parent !== undefined && parent._returnedNonUndefined())
          return;
        if ((promise._bitField & 65535) === 0)
          return;
        if (name)
          name = name + " ";
        var handlerLine = "";
        var creatorLine = "";
        if (promiseCreated._trace) {
          var traceLines = promiseCreated._trace.stack.split("\n");
          var stack = cleanStack(traceLines);
          for (var i = stack.length - 1;i >= 0; --i) {
            var line = stack[i];
            if (!nodeFramePattern.test(line)) {
              var lineMatches = line.match(parseLinePattern);
              if (lineMatches) {
                handlerLine = "at " + lineMatches[1] + ":" + lineMatches[2] + ":" + lineMatches[3] + " ";
              }
              break;
            }
          }
          if (stack.length > 0) {
            var firstUserLine = stack[0];
            for (var i = 0;i < traceLines.length; ++i) {
              if (traceLines[i] === firstUserLine) {
                if (i > 0) {
                  creatorLine = "\n" + traceLines[i - 1];
                }
                break;
              }
            }
          }
        }
        var msg = "a promise was created in a " + name + "handler " + handlerLine + "but was not returned from it, see http://goo.gl/rRqMUw" + creatorLine;
        promise._warn(msg, true, promiseCreated);
      }
    }
    function deprecated(name, replacement) {
      var message = name + " is deprecated and will be removed in a future version.";
      if (replacement)
        message += " Use " + replacement + " instead.";
      return warn(message);
    }
    function warn(message, shouldUseOwnTrace, promise) {
      if (!config.warnings)
        return;
      var warning = new Warning(message);
      var ctx;
      if (shouldUseOwnTrace) {
        promise._attachExtraTrace(warning);
      } else if (config.longStackTraces && (ctx = Promise2._peekContext())) {
        ctx.attachExtraTrace(warning);
      } else {
        var parsed = parseStackAndMessage(warning);
        warning.stack = parsed.message + "\n" + parsed.stack.join("\n");
      }
      if (!activeFireEvent("warning", warning)) {
        formatAndLogError(warning, "", true);
      }
    }
    function reconstructStack(message, stacks) {
      for (var i = 0;i < stacks.length - 1; ++i) {
        stacks[i].push("From previous event:");
        stacks[i] = stacks[i].join("\n");
      }
      if (i < stacks.length) {
        stacks[i] = stacks[i].join("\n");
      }
      return message + "\n" + stacks.join("\n");
    }
    function removeDuplicateOrEmptyJumps(stacks) {
      for (var i = 0;i < stacks.length; ++i) {
        if (stacks[i].length === 0 || i + 1 < stacks.length && stacks[i][0] === stacks[i + 1][0]) {
          stacks.splice(i, 1);
          i--;
        }
      }
    }
    function removeCommonRoots(stacks) {
      var current = stacks[0];
      for (var i = 1;i < stacks.length; ++i) {
        var prev = stacks[i];
        var currentLastIndex = current.length - 1;
        var currentLastLine = current[currentLastIndex];
        var commonRootMeetPoint = -1;
        for (var j = prev.length - 1;j >= 0; --j) {
          if (prev[j] === currentLastLine) {
            commonRootMeetPoint = j;
            break;
          }
        }
        for (var j = commonRootMeetPoint;j >= 0; --j) {
          var line = prev[j];
          if (current[currentLastIndex] === line) {
            current.pop();
            currentLastIndex--;
          } else {
            break;
          }
        }
        current = prev;
      }
    }
    function cleanStack(stack) {
      var ret = [];
      for (var i = 0;i < stack.length; ++i) {
        var line = stack[i];
        var isTraceLine = line === "    (No stack trace)" || stackFramePattern.test(line);
        var isInternalFrame = isTraceLine && shouldIgnore(line);
        if (isTraceLine && !isInternalFrame) {
          if (indentStackFrames && line.charAt(0) !== " ") {
            line = "    " + line;
          }
          ret.push(line);
        }
      }
      return ret;
    }
    function stackFramesAsArray(error) {
      var stack = error.stack.replace(/\s+$/g, "").split("\n");
      for (var i = 0;i < stack.length; ++i) {
        var line = stack[i];
        if (line === "    (No stack trace)" || stackFramePattern.test(line)) {
          break;
        }
      }
      if (i > 0 && error.name != "SyntaxError") {
        stack = stack.slice(i);
      }
      return stack;
    }
    function parseStackAndMessage(error) {
      var stack = error.stack;
      var message = error.toString();
      stack = typeof stack === "string" && stack.length > 0 ? stackFramesAsArray(error) : ["    (No stack trace)"];
      return {
        message,
        stack: error.name == "SyntaxError" ? stack : cleanStack(stack)
      };
    }
    function formatAndLogError(error, title, isSoft) {
      if (typeof console !== "undefined") {
        var message;
        if (util2.isObject(error)) {
          var stack = error.stack;
          message = title + formatStack(stack, error);
        } else {
          message = title + String(error);
        }
        if (typeof printWarning === "function") {
          printWarning(message, isSoft);
        } else if (typeof console.log === "function" || typeof console.log === "object") {
          console.log(message);
        }
      }
    }
    function fireRejectionEvent(name, localHandler, reason, promise) {
      var localEventFired = false;
      try {
        if (typeof localHandler === "function") {
          localEventFired = true;
          if (name === "rejectionHandled") {
            localHandler(promise);
          } else {
            localHandler(reason, promise);
          }
        }
      } catch (e) {
        async.throwLater(e);
      }
      if (name === "unhandledRejection") {
        if (!activeFireEvent(name, reason, promise) && !localEventFired) {
          formatAndLogError(reason, "Unhandled rejection ");
        }
      } else {
        activeFireEvent(name, promise);
      }
    }
    function formatNonError(obj) {
      var str;
      if (typeof obj === "function") {
        str = "[function " + (obj.name || "anonymous") + "]";
      } else {
        str = obj && typeof obj.toString === "function" ? obj.toString() : util2.toString(obj);
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
          try {
            var newStr = JSON.stringify(obj);
            str = newStr;
          } catch (e) {
          }
        }
        if (str.length === 0) {
          str = "(empty array)";
        }
      }
      return "(<" + snip(str) + ">, no stack trace)";
    }
    function snip(str) {
      var maxChars = 41;
      if (str.length < maxChars) {
        return str;
      }
      return str.substr(0, maxChars - 3) + "...";
    }
    function longStackTracesIsSupported() {
      return typeof captureStackTrace === "function";
    }
    var shouldIgnore = function() {
      return false;
    };
    var parseLineInfoRegex = /[\/<\(]([^:\/]+):(\d+):(?:\d+)\)?\s*$/;
    function parseLineInfo(line) {
      var matches = line.match(parseLineInfoRegex);
      if (matches) {
        return {
          fileName: matches[1],
          line: parseInt(matches[2], 10)
        };
      }
    }
    function setBounds(firstLineError, lastLineError) {
      if (!longStackTracesIsSupported())
        return;
      var firstStackLines = (firstLineError.stack || "").split("\n");
      var lastStackLines = (lastLineError.stack || "").split("\n");
      var firstIndex = -1;
      var lastIndex = -1;
      var firstFileName;
      var lastFileName;
      for (var i = 0;i < firstStackLines.length; ++i) {
        var result = parseLineInfo(firstStackLines[i]);
        if (result) {
          firstFileName = result.fileName;
          firstIndex = result.line;
          break;
        }
      }
      for (var i = 0;i < lastStackLines.length; ++i) {
        var result = parseLineInfo(lastStackLines[i]);
        if (result) {
          lastFileName = result.fileName;
          lastIndex = result.line;
          break;
        }
      }
      if (firstIndex < 0 || lastIndex < 0 || !firstFileName || !lastFileName || firstFileName !== lastFileName || firstIndex >= lastIndex) {
        return;
      }
      shouldIgnore = function(line) {
        if (bluebirdFramePattern.test(line))
          return true;
        var info = parseLineInfo(line);
        if (info) {
          if (info.fileName === firstFileName && (firstIndex <= info.line && info.line <= lastIndex)) {
            return true;
          }
        }
        return false;
      };
    }
    function CapturedTrace(parent) {
      this._parent = parent;
      this._promisesCreated = 0;
      var length = this._length = 1 + (parent === undefined ? 0 : parent._length);
      captureStackTrace(this, CapturedTrace);
      if (length > 32)
        this.uncycle();
    }
    util2.inherits(CapturedTrace, Error);
    Context.CapturedTrace = CapturedTrace;
    CapturedTrace.prototype.uncycle = function() {
      var length = this._length;
      if (length < 2)
        return;
      var nodes = [];
      var stackToIndex = {};
      for (var i = 0, node2 = this;node2 !== undefined; ++i) {
        nodes.push(node2);
        node2 = node2._parent;
      }
      length = this._length = i;
      for (var i = length - 1;i >= 0; --i) {
        var stack = nodes[i].stack;
        if (stackToIndex[stack] === undefined) {
          stackToIndex[stack] = i;
        }
      }
      for (var i = 0;i < length; ++i) {
        var currentStack = nodes[i].stack;
        var index = stackToIndex[currentStack];
        if (index !== undefined && index !== i) {
          if (index > 0) {
            nodes[index - 1]._parent = undefined;
            nodes[index - 1]._length = 1;
          }
          nodes[i]._parent = undefined;
          nodes[i]._length = 1;
          var cycleEdgeNode = i > 0 ? nodes[i - 1] : this;
          if (index < length - 1) {
            cycleEdgeNode._parent = nodes[index + 1];
            cycleEdgeNode._parent.uncycle();
            cycleEdgeNode._length = cycleEdgeNode._parent._length + 1;
          } else {
            cycleEdgeNode._parent = undefined;
            cycleEdgeNode._length = 1;
          }
          var currentChildLength = cycleEdgeNode._length + 1;
          for (var j = i - 2;j >= 0; --j) {
            nodes[j]._length = currentChildLength;
            currentChildLength++;
          }
          return;
        }
      }
    };
    CapturedTrace.prototype.attachExtraTrace = function(error) {
      if (error.__stackCleaned__)
        return;
      this.uncycle();
      var parsed = parseStackAndMessage(error);
      var message = parsed.message;
      var stacks = [parsed.stack];
      var trace = this;
      while (trace !== undefined) {
        stacks.push(cleanStack(trace.stack.split("\n")));
        trace = trace._parent;
      }
      removeCommonRoots(stacks);
      removeDuplicateOrEmptyJumps(stacks);
      util2.notEnumerableProp(error, "stack", reconstructStack(message, stacks));
      util2.notEnumerableProp(error, "__stackCleaned__", true);
    };
    var captureStackTrace = function stackDetection() {
      var v8stackFramePattern = /^\s*at\s*/;
      var v8stackFormatter = function(stack, error) {
        if (typeof stack === "string")
          return stack;
        if (error.name !== undefined && error.message !== undefined) {
          return error.toString();
        }
        return formatNonError(error);
      };
      if (typeof Error.stackTraceLimit === "number" && typeof Error.captureStackTrace === "function") {
        Error.stackTraceLimit += 6;
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        var captureStackTrace2 = Error.captureStackTrace;
        shouldIgnore = function(line) {
          return bluebirdFramePattern.test(line);
        };
        return function(receiver, ignoreUntil) {
          Error.stackTraceLimit += 6;
          captureStackTrace2(receiver, ignoreUntil);
          Error.stackTraceLimit -= 6;
        };
      }
      var err = new Error;
      if (typeof err.stack === "string" && err.stack.split("\n")[0].indexOf("stackDetection@") >= 0) {
        stackFramePattern = /@/;
        formatStack = v8stackFormatter;
        indentStackFrames = true;
        return function captureStackTrace(o) {
          o.stack = new Error().stack;
        };
      }
      var hasStackAfterThrow;
      try {
        throw new Error;
      } catch (e) {
        hasStackAfterThrow = ("stack" in e);
      }
      if (!("stack" in err) && hasStackAfterThrow && typeof Error.stackTraceLimit === "number") {
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        return function captureStackTrace(o) {
          Error.stackTraceLimit += 6;
          try {
            throw new Error;
          } catch (e) {
            o.stack = e.stack;
          }
          Error.stackTraceLimit -= 6;
        };
      }
      formatStack = function(stack, error) {
        if (typeof stack === "string")
          return stack;
        if ((typeof error === "object" || typeof error === "function") && error.name !== undefined && error.message !== undefined) {
          return error.toString();
        }
        return formatNonError(error);
      };
      return null;
    }([]);
    if (typeof console !== "undefined" && typeof console.warn !== "undefined") {
      printWarning = function(message) {
        console.warn(message);
      };
      if (util2.isNode && process.stderr.isTTY) {
        printWarning = function(message, isSoft) {
          var color = isSoft ? "\x1B[33m" : "\x1B[31m";
          console.warn(color + message + `\x1B[0m
`);
        };
      } else if (!util2.isNode && typeof new Error().stack === "string") {
        printWarning = function(message, isSoft) {
          console.warn("%c" + message, isSoft ? "color: darkorange" : "color: red");
        };
      }
    }
    var config = {
      warnings,
      longStackTraces: false,
      cancellation: false,
      monitoring: false,
      asyncHooks: false
    };
    if (longStackTraces)
      Promise2.longStackTraces();
    return {
      asyncHooks: function() {
        return config.asyncHooks;
      },
      longStackTraces: function() {
        return config.longStackTraces;
      },
      warnings: function() {
        return config.warnings;
      },
      cancellation: function() {
        return config.cancellation;
      },
      monitoring: function() {
        return config.monitoring;
      },
      propagateFromFunction: function() {
        return propagateFromFunction;
      },
      boundValueFunction: function() {
        return boundValueFunction;
      },
      checkForgottenReturns,
      setBounds,
      warn,
      deprecated,
      CapturedTrace,
      fireDomEvent,
      fireGlobalEvent
    };
  };
});

// node_modules/bluebird/js/release/catch_filter.js
var require_catch_filter = __commonJS((exports, module) => {
  module.exports = function(NEXT_FILTER) {
    var util2 = require_util2();
    var getKeys = require_es5().keys;
    var tryCatch = util2.tryCatch;
    var errorObj = util2.errorObj;
    function catchFilter(instances, cb, promise) {
      return function(e) {
        var boundTo = promise._boundValue();
        predicateLoop:
          for (var i = 0;i < instances.length; ++i) {
            var item = instances[i];
            if (item === Error || item != null && item.prototype instanceof Error) {
              if (e instanceof item) {
                return tryCatch(cb).call(boundTo, e);
              }
            } else if (typeof item === "function") {
              var matchesPredicate = tryCatch(item).call(boundTo, e);
              if (matchesPredicate === errorObj) {
                return matchesPredicate;
              } else if (matchesPredicate) {
                return tryCatch(cb).call(boundTo, e);
              }
            } else if (util2.isObject(e)) {
              var keys = getKeys(item);
              for (var j = 0;j < keys.length; ++j) {
                var key = keys[j];
                if (item[key] != e[key]) {
                  continue predicateLoop;
                }
              }
              return tryCatch(cb).call(boundTo, e);
            }
          }
        return NEXT_FILTER;
      };
    }
    return catchFilter;
  };
});

// node_modules/bluebird/js/release/finally.js
var require_finally = __commonJS((exports, module) => {
  module.exports = function(Promise2, tryConvertToPromise, NEXT_FILTER) {
    var util2 = require_util2();
    var CancellationError = Promise2.CancellationError;
    var errorObj = util2.errorObj;
    var catchFilter = require_catch_filter()(NEXT_FILTER);
    function PassThroughHandlerContext(promise, type, handler) {
      this.promise = promise;
      this.type = type;
      this.handler = handler;
      this.called = false;
      this.cancelPromise = null;
    }
    PassThroughHandlerContext.prototype.isFinallyHandler = function() {
      return this.type === 0;
    };
    function FinallyHandlerCancelReaction(finallyHandler2) {
      this.finallyHandler = finallyHandler2;
    }
    FinallyHandlerCancelReaction.prototype._resultCancelled = function() {
      checkCancel(this.finallyHandler);
    };
    function checkCancel(ctx, reason) {
      if (ctx.cancelPromise != null) {
        if (arguments.length > 1) {
          ctx.cancelPromise._reject(reason);
        } else {
          ctx.cancelPromise._cancel();
        }
        ctx.cancelPromise = null;
        return true;
      }
      return false;
    }
    function succeed() {
      return finallyHandler.call(this, this.promise._target()._settledValue());
    }
    function fail(reason) {
      if (checkCancel(this, reason))
        return;
      errorObj.e = reason;
      return errorObj;
    }
    function finallyHandler(reasonOrValue) {
      var promise = this.promise;
      var handler = this.handler;
      if (!this.called) {
        this.called = true;
        var ret = this.isFinallyHandler() ? handler.call(promise._boundValue()) : handler.call(promise._boundValue(), reasonOrValue);
        if (ret === NEXT_FILTER) {
          return ret;
        } else if (ret !== undefined) {
          promise._setReturnedNonUndefined();
          var maybePromise = tryConvertToPromise(ret, promise);
          if (maybePromise instanceof Promise2) {
            if (this.cancelPromise != null) {
              if (maybePromise._isCancelled()) {
                var reason = new CancellationError("late cancellation observer");
                promise._attachExtraTrace(reason);
                errorObj.e = reason;
                return errorObj;
              } else if (maybePromise.isPending()) {
                maybePromise._attachCancellationCallback(new FinallyHandlerCancelReaction(this));
              }
            }
            return maybePromise._then(succeed, fail, undefined, this, undefined);
          }
        }
      }
      if (promise.isRejected()) {
        checkCancel(this);
        errorObj.e = reasonOrValue;
        return errorObj;
      } else {
        checkCancel(this);
        return reasonOrValue;
      }
    }
    Promise2.prototype._passThrough = function(handler, type, success, fail2) {
      if (typeof handler !== "function")
        return this.then();
      return this._then(success, fail2, undefined, new PassThroughHandlerContext(this, type, handler), undefined);
    };
    Promise2.prototype.lastly = Promise2.prototype["finally"] = function(handler) {
      return this._passThrough(handler, 0, finallyHandler, finallyHandler);
    };
    Promise2.prototype.tap = function(handler) {
      return this._passThrough(handler, 1, finallyHandler);
    };
    Promise2.prototype.tapCatch = function(handlerOrPredicate) {
      var len = arguments.length;
      if (len === 1) {
        return this._passThrough(handlerOrPredicate, 1, undefined, finallyHandler);
      } else {
        var catchInstances = new Array(len - 1), j = 0, i;
        for (i = 0;i < len - 1; ++i) {
          var item = arguments[i];
          if (util2.isObject(item)) {
            catchInstances[j++] = item;
          } else {
            return Promise2.reject(new TypeError("tapCatch statement predicate: expecting an object but got " + util2.classString(item)));
          }
        }
        catchInstances.length = j;
        var handler = arguments[i];
        return this._passThrough(catchFilter(catchInstances, handler, this), 1, undefined, finallyHandler);
      }
    };
    return PassThroughHandlerContext;
  };
});

// node_modules/bluebird/js/release/nodeback.js
var require_nodeback = __commonJS((exports, module) => {
  var isUntypedError = function(obj) {
    return obj instanceof Error && es5.getPrototypeOf(obj) === Error.prototype;
  };
  var wrapAsOperationalError = function(obj) {
    var ret;
    if (isUntypedError(obj)) {
      ret = new OperationalError(obj);
      ret.name = obj.name;
      ret.message = obj.message;
      ret.stack = obj.stack;
      var keys = es5.keys(obj);
      for (var i = 0;i < keys.length; ++i) {
        var key = keys[i];
        if (!rErrorKey.test(key)) {
          ret[key] = obj[key];
        }
      }
      return ret;
    }
    util2.markAsOriginatingFromRejection(obj);
    return obj;
  };
  var nodebackForPromise = function(promise, multiArgs) {
    return function(err, value) {
      if (promise === null)
        return;
      if (err) {
        var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
        promise._attachExtraTrace(wrapped);
        promise._reject(wrapped);
      } else if (!multiArgs) {
        promise._fulfill(value);
      } else {
        var $_len = arguments.length;
        var args = new Array(Math.max($_len - 1, 0));
        for (var $_i = 1;$_i < $_len; ++$_i) {
          args[$_i - 1] = arguments[$_i];
        }
        promise._fulfill(args);
      }
      promise = null;
    };
  };
  var util2 = require_util2();
  var maybeWrapAsError = util2.maybeWrapAsError;
  var errors = require_errors2();
  var OperationalError = errors.OperationalError;
  var es5 = require_es5();
  var rErrorKey = /^(?:name|message|stack|cause)$/;
  module.exports = nodebackForPromise;
});

// node_modules/bluebird/js/release/method.js
var require_method = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL, tryConvertToPromise, apiRejection, debug) {
    var util2 = require_util2();
    var tryCatch = util2.tryCatch;
    Promise2.method = function(fn) {
      if (typeof fn !== "function") {
        throw new Promise2.TypeError("expecting a function but got " + util2.classString(fn));
      }
      return function() {
        var ret = new Promise2(INTERNAL);
        ret._captureStackTrace();
        ret._pushContext();
        var value = tryCatch(fn).apply(this, arguments);
        var promiseCreated = ret._popContext();
        debug.checkForgottenReturns(value, promiseCreated, "Promise.method", ret);
        ret._resolveFromSyncValue(value);
        return ret;
      };
    };
    Promise2.attempt = Promise2["try"] = function(fn) {
      if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util2.classString(fn));
      }
      var ret = new Promise2(INTERNAL);
      ret._captureStackTrace();
      ret._pushContext();
      var value;
      if (arguments.length > 1) {
        debug.deprecated("calling Promise.try with more than 1 argument");
        var arg = arguments[1];
        var ctx = arguments[2];
        value = util2.isArray(arg) ? tryCatch(fn).apply(ctx, arg) : tryCatch(fn).call(ctx, arg);
      } else {
        value = tryCatch(fn)();
      }
      var promiseCreated = ret._popContext();
      debug.checkForgottenReturns(value, promiseCreated, "Promise.try", ret);
      ret._resolveFromSyncValue(value);
      return ret;
    };
    Promise2.prototype._resolveFromSyncValue = function(value) {
      if (value === util2.errorObj) {
        this._rejectCallback(value.e, false);
      } else {
        this._resolveCallback(value, true);
      }
    };
  };
});

// node_modules/bluebird/js/release/bind.js
var require_bind = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL, tryConvertToPromise, debug) {
    var calledBind = false;
    var rejectThis = function(_, e) {
      this._reject(e);
    };
    var targetRejected = function(e, context) {
      context.promiseRejectionQueued = true;
      context.bindingPromise._then(rejectThis, rejectThis, null, this, e);
    };
    var bindingResolved = function(thisArg, context) {
      if ((this._bitField & 50397184) === 0) {
        this._resolveCallback(context.target);
      }
    };
    var bindingRejected = function(e, context) {
      if (!context.promiseRejectionQueued)
        this._reject(e);
    };
    Promise2.prototype.bind = function(thisArg) {
      if (!calledBind) {
        calledBind = true;
        Promise2.prototype._propagateFrom = debug.propagateFromFunction();
        Promise2.prototype._boundValue = debug.boundValueFunction();
      }
      var maybePromise = tryConvertToPromise(thisArg);
      var ret = new Promise2(INTERNAL);
      ret._propagateFrom(this, 1);
      var target = this._target();
      ret._setBoundTo(maybePromise);
      if (maybePromise instanceof Promise2) {
        var context = {
          promiseRejectionQueued: false,
          promise: ret,
          target,
          bindingPromise: maybePromise
        };
        target._then(INTERNAL, targetRejected, undefined, ret, context);
        maybePromise._then(bindingResolved, bindingRejected, undefined, ret, context);
        ret._setOnCancel(maybePromise);
      } else {
        ret._resolveCallback(target);
      }
      return ret;
    };
    Promise2.prototype._setBoundTo = function(obj) {
      if (obj !== undefined) {
        this._bitField = this._bitField | 2097152;
        this._boundTo = obj;
      } else {
        this._bitField = this._bitField & ~2097152;
      }
    };
    Promise2.prototype._isBound = function() {
      return (this._bitField & 2097152) === 2097152;
    };
    Promise2.bind = function(thisArg, value) {
      return Promise2.resolve(value).bind(thisArg);
    };
  };
});

// node_modules/bluebird/js/release/cancel.js
var require_cancel = __commonJS((exports, module) => {
  module.exports = function(Promise2, PromiseArray, apiRejection, debug) {
    var util2 = require_util2();
    var tryCatch = util2.tryCatch;
    var errorObj = util2.errorObj;
    var async = Promise2._async;
    Promise2.prototype["break"] = Promise2.prototype.cancel = function() {
      if (!debug.cancellation())
        return this._warn("cancellation is disabled");
      var promise = this;
      var child = promise;
      while (promise._isCancellable()) {
        if (!promise._cancelBy(child)) {
          if (child._isFollowing()) {
            child._followee().cancel();
          } else {
            child._cancelBranched();
          }
          break;
        }
        var parent = promise._cancellationParent;
        if (parent == null || !parent._isCancellable()) {
          if (promise._isFollowing()) {
            promise._followee().cancel();
          } else {
            promise._cancelBranched();
          }
          break;
        } else {
          if (promise._isFollowing())
            promise._followee().cancel();
          promise._setWillBeCancelled();
          child = promise;
          promise = parent;
        }
      }
    };
    Promise2.prototype._branchHasCancelled = function() {
      this._branchesRemainingToCancel--;
    };
    Promise2.prototype._enoughBranchesHaveCancelled = function() {
      return this._branchesRemainingToCancel === undefined || this._branchesRemainingToCancel <= 0;
    };
    Promise2.prototype._cancelBy = function(canceller) {
      if (canceller === this) {
        this._branchesRemainingToCancel = 0;
        this._invokeOnCancel();
        return true;
      } else {
        this._branchHasCancelled();
        if (this._enoughBranchesHaveCancelled()) {
          this._invokeOnCancel();
          return true;
        }
      }
      return false;
    };
    Promise2.prototype._cancelBranched = function() {
      if (this._enoughBranchesHaveCancelled()) {
        this._cancel();
      }
    };
    Promise2.prototype._cancel = function() {
      if (!this._isCancellable())
        return;
      this._setCancelled();
      async.invoke(this._cancelPromises, this, undefined);
    };
    Promise2.prototype._cancelPromises = function() {
      if (this._length() > 0)
        this._settlePromises();
    };
    Promise2.prototype._unsetOnCancel = function() {
      this._onCancelField = undefined;
    };
    Promise2.prototype._isCancellable = function() {
      return this.isPending() && !this._isCancelled();
    };
    Promise2.prototype.isCancellable = function() {
      return this.isPending() && !this.isCancelled();
    };
    Promise2.prototype._doInvokeOnCancel = function(onCancelCallback, internalOnly) {
      if (util2.isArray(onCancelCallback)) {
        for (var i = 0;i < onCancelCallback.length; ++i) {
          this._doInvokeOnCancel(onCancelCallback[i], internalOnly);
        }
      } else if (onCancelCallback !== undefined) {
        if (typeof onCancelCallback === "function") {
          if (!internalOnly) {
            var e = tryCatch(onCancelCallback).call(this._boundValue());
            if (e === errorObj) {
              this._attachExtraTrace(e.e);
              async.throwLater(e.e);
            }
          }
        } else {
          onCancelCallback._resultCancelled(this);
        }
      }
    };
    Promise2.prototype._invokeOnCancel = function() {
      var onCancelCallback = this._onCancel();
      this._unsetOnCancel();
      async.invoke(this._doInvokeOnCancel, this, onCancelCallback);
    };
    Promise2.prototype._invokeInternalOnCancel = function() {
      if (this._isCancellable()) {
        this._doInvokeOnCancel(this._onCancel(), true);
        this._unsetOnCancel();
      }
    };
    Promise2.prototype._resultCancelled = function() {
      this.cancel();
    };
  };
});

// node_modules/bluebird/js/release/direct_resolve.js
var require_direct_resolve = __commonJS((exports, module) => {
  module.exports = function(Promise2) {
    function returner() {
      return this.value;
    }
    function thrower() {
      throw this.reason;
    }
    Promise2.prototype["return"] = Promise2.prototype.thenReturn = function(value) {
      if (value instanceof Promise2)
        value.suppressUnhandledRejections();
      return this._then(returner, undefined, undefined, { value }, undefined);
    };
    Promise2.prototype["throw"] = Promise2.prototype.thenThrow = function(reason) {
      return this._then(thrower, undefined, undefined, { reason }, undefined);
    };
    Promise2.prototype.catchThrow = function(reason) {
      if (arguments.length <= 1) {
        return this._then(undefined, thrower, undefined, { reason }, undefined);
      } else {
        var _reason = arguments[1];
        var handler = function() {
          throw _reason;
        };
        return this.caught(reason, handler);
      }
    };
    Promise2.prototype.catchReturn = function(value) {
      if (arguments.length <= 1) {
        if (value instanceof Promise2)
          value.suppressUnhandledRejections();
        return this._then(undefined, returner, undefined, { value }, undefined);
      } else {
        var _value = arguments[1];
        if (_value instanceof Promise2)
          _value.suppressUnhandledRejections();
        var handler = function() {
          return _value;
        };
        return this.caught(value, handler);
      }
    };
  };
});

// node_modules/bluebird/js/release/synchronous_inspection.js
var require_synchronous_inspection = __commonJS((exports, module) => {
  module.exports = function(Promise2) {
    function PromiseInspection(promise) {
      if (promise !== undefined) {
        promise = promise._target();
        this._bitField = promise._bitField;
        this._settledValueField = promise._isFateSealed() ? promise._settledValue() : undefined;
      } else {
        this._bitField = 0;
        this._settledValueField = undefined;
      }
    }
    PromiseInspection.prototype._settledValue = function() {
      return this._settledValueField;
    };
    var value = PromiseInspection.prototype.value = function() {
      if (!this.isFulfilled()) {
        throw new TypeError(`cannot get fulfillment value of a non-fulfilled promise

    See http://goo.gl/MqrFmX
`);
      }
      return this._settledValue();
    };
    var reason = PromiseInspection.prototype.error = PromiseInspection.prototype.reason = function() {
      if (!this.isRejected()) {
        throw new TypeError(`cannot get rejection reason of a non-rejected promise

    See http://goo.gl/MqrFmX
`);
      }
      return this._settledValue();
    };
    var isFulfilled = PromiseInspection.prototype.isFulfilled = function() {
      return (this._bitField & 33554432) !== 0;
    };
    var isRejected = PromiseInspection.prototype.isRejected = function() {
      return (this._bitField & 16777216) !== 0;
    };
    var isPending = PromiseInspection.prototype.isPending = function() {
      return (this._bitField & 50397184) === 0;
    };
    var isResolved = PromiseInspection.prototype.isResolved = function() {
      return (this._bitField & 50331648) !== 0;
    };
    PromiseInspection.prototype.isCancelled = function() {
      return (this._bitField & 8454144) !== 0;
    };
    Promise2.prototype.__isCancelled = function() {
      return (this._bitField & 65536) === 65536;
    };
    Promise2.prototype._isCancelled = function() {
      return this._target().__isCancelled();
    };
    Promise2.prototype.isCancelled = function() {
      return (this._target()._bitField & 8454144) !== 0;
    };
    Promise2.prototype.isPending = function() {
      return isPending.call(this._target());
    };
    Promise2.prototype.isRejected = function() {
      return isRejected.call(this._target());
    };
    Promise2.prototype.isFulfilled = function() {
      return isFulfilled.call(this._target());
    };
    Promise2.prototype.isResolved = function() {
      return isResolved.call(this._target());
    };
    Promise2.prototype.value = function() {
      return value.call(this._target());
    };
    Promise2.prototype.reason = function() {
      var target = this._target();
      target._unsetRejectionIsUnhandled();
      return reason.call(target);
    };
    Promise2.prototype._value = function() {
      return this._settledValue();
    };
    Promise2.prototype._reason = function() {
      this._unsetRejectionIsUnhandled();
      return this._settledValue();
    };
    Promise2.PromiseInspection = PromiseInspection;
  };
});

// node_modules/bluebird/js/release/join.js
var require_join = __commonJS((exports, module) => {
  module.exports = function(Promise2, PromiseArray, tryConvertToPromise, INTERNAL, async) {
    var util2 = require_util2();
    var canEvaluate = util2.canEvaluate;
    var tryCatch = util2.tryCatch;
    var errorObj = util2.errorObj;
    var reject;
    if (true) {
      if (canEvaluate) {
        var thenCallback = function(i2) {
          return new Function("value", "holder", `                             
            'use strict';                                                    
            holder.pIndex = value;                                           
            holder.checkFulfillment(this);                                   
            `.replace(/Index/g, i2));
        };
        var promiseSetter = function(i2) {
          return new Function("promise", "holder", `                           
            'use strict';                                                    
            holder.pIndex = promise;                                         
            `.replace(/Index/g, i2));
        };
        var generateHolderClass = function(total) {
          var props = new Array(total);
          for (var i2 = 0;i2 < props.length; ++i2) {
            props[i2] = "this.p" + (i2 + 1);
          }
          var assignment = props.join(" = ") + " = null;";
          var cancellationCode = "var promise;\n" + props.map(function(prop) {
            return `                                                         
                promise = ` + prop + `;                                      
                if (promise instanceof Promise) {                            
                    promise.cancel();                                        
                }                                                            
            `;
          }).join("\n");
          var passedArguments = props.join(", ");
          var name = "Holder$" + total;
          var code = `return function(tryCatch, errorObj, Promise, async) {    
            'use strict';                                                    
            function [TheName](fn) {                                         
                [TheProperties]                                              
                this.fn = fn;                                                
                this.asyncNeeded = true;                                     
                this.now = 0;                                                
            }                                                                
                                                                             
            [TheName].prototype._callFunction = function(promise) {          
                promise._pushContext();                                      
                var ret = tryCatch(this.fn)([ThePassedArguments]);           
                promise._popContext();                                       
                if (ret === errorObj) {                                      
                    promise._rejectCallback(ret.e, false);                   
                } else {                                                     
                    promise._resolveCallback(ret);                           
                }                                                            
            };                                                               
                                                                             
            [TheName].prototype.checkFulfillment = function(promise) {       
                var now = ++this.now;                                        
                if (now === [TheTotal]) {                                    
                    if (this.asyncNeeded) {                                  
                        async.invoke(this._callFunction, this, promise);     
                    } else {                                                 
                        this._callFunction(promise);                         
                    }                                                        
                                                                             
                }                                                            
            };                                                               
                                                                             
            [TheName].prototype._resultCancelled = function() {              
                [CancellationCode]                                           
            };                                                               
                                                                             
            return [TheName];                                                
        }(tryCatch, errorObj, Promise, async);                               
        `;
          code = code.replace(/\[TheName\]/g, name).replace(/\[TheTotal\]/g, total).replace(/\[ThePassedArguments\]/g, passedArguments).replace(/\[TheProperties\]/g, assignment).replace(/\[CancellationCode\]/g, cancellationCode);
          return new Function("tryCatch", "errorObj", "Promise", "async", code)(tryCatch, errorObj, Promise2, async);
        };
        var holderClasses = [];
        var thenCallbacks = [];
        var promiseSetters = [];
        for (var i = 0;i < 8; ++i) {
          holderClasses.push(generateHolderClass(i + 1));
          thenCallbacks.push(thenCallback(i + 1));
          promiseSetters.push(promiseSetter(i + 1));
        }
        reject = function(reason) {
          this._reject(reason);
        };
      }
    }
    Promise2.join = function() {
      var last = arguments.length - 1;
      var fn;
      if (last > 0 && typeof arguments[last] === "function") {
        fn = arguments[last];
        if (true) {
          if (last <= 8 && canEvaluate) {
            var ret = new Promise2(INTERNAL);
            ret._captureStackTrace();
            var HolderClass = holderClasses[last - 1];
            var holder = new HolderClass(fn);
            var callbacks = thenCallbacks;
            for (var i2 = 0;i2 < last; ++i2) {
              var maybePromise = tryConvertToPromise(arguments[i2], ret);
              if (maybePromise instanceof Promise2) {
                maybePromise = maybePromise._target();
                var bitField = maybePromise._bitField;
                if ((bitField & 50397184) === 0) {
                  maybePromise._then(callbacks[i2], reject, undefined, ret, holder);
                  promiseSetters[i2](maybePromise, holder);
                  holder.asyncNeeded = false;
                } else if ((bitField & 33554432) !== 0) {
                  callbacks[i2].call(ret, maybePromise._value(), holder);
                } else if ((bitField & 16777216) !== 0) {
                  ret._reject(maybePromise._reason());
                } else {
                  ret._cancel();
                }
              } else {
                callbacks[i2].call(ret, maybePromise, holder);
              }
            }
            if (!ret._isFateSealed()) {
              if (holder.asyncNeeded) {
                var context = Promise2._getContext();
                holder.fn = util2.contextBind(context, holder.fn);
              }
              ret._setAsyncGuaranteed();
              ret._setOnCancel(holder);
            }
            return ret;
          }
        }
      }
      var $_len = arguments.length;
      var args = new Array($_len);
      for (var $_i = 0;$_i < $_len; ++$_i) {
        args[$_i] = arguments[$_i];
      }
      if (fn)
        args.pop();
      var ret = new PromiseArray(args).promise();
      return fn !== undefined ? ret.spread(fn) : ret;
    };
  };
});

// node_modules/bluebird/js/release/call_get.js
var require_call_get = __commonJS((exports, module) => {
  var cr = Object.create;
  if (cr) {
    callerCache = cr(null);
    getterCache = cr(null);
    callerCache[" size"] = getterCache[" size"] = 0;
  }
  var callerCache;
  var getterCache;
  module.exports = function(Promise2) {
    var util2 = require_util2();
    var canEvaluate = util2.canEvaluate;
    var isIdentifier = util2.isIdentifier;
    var getMethodCaller;
    var getGetter;
    if (true) {
      var makeMethodCaller = function(methodName) {
        return new Function("ensureMethod", `                                    
        return function(obj) {                                               
            'use strict'                                                     
            var len = this.length;                                           
            ensureMethod(obj, 'methodName');                                 
            switch(len) {                                                    
                case 1: return obj.methodName(this[0]);                      
                case 2: return obj.methodName(this[0], this[1]);             
                case 3: return obj.methodName(this[0], this[1], this[2]);    
                case 0: return obj.methodName();                             
                default:                                                     
                    return obj.methodName.apply(obj, this);                  
            }                                                                
        };                                                                   
        `.replace(/methodName/g, methodName))(ensureMethod);
      };
      var makeGetter = function(propertyName) {
        return new Function("obj", `                                             
        'use strict';                                                        
        return obj.propertyName;                                             
        `.replace("propertyName", propertyName));
      };
      var getCompiled = function(name, compiler, cache) {
        var ret = cache[name];
        if (typeof ret !== "function") {
          if (!isIdentifier(name)) {
            return null;
          }
          ret = compiler(name);
          cache[name] = ret;
          cache[" size"]++;
          if (cache[" size"] > 512) {
            var keys = Object.keys(cache);
            for (var i = 0;i < 256; ++i)
              delete cache[keys[i]];
            cache[" size"] = keys.length - 256;
          }
        }
        return ret;
      };
      getMethodCaller = function(name) {
        return getCompiled(name, makeMethodCaller, callerCache);
      };
      getGetter = function(name) {
        return getCompiled(name, makeGetter, getterCache);
      };
    }
    function ensureMethod(obj, methodName) {
      var fn;
      if (obj != null)
        fn = obj[methodName];
      if (typeof fn !== "function") {
        var message = "Object " + util2.classString(obj) + " has no method '" + util2.toString(methodName) + "'";
        throw new Promise2.TypeError(message);
      }
      return fn;
    }
    function caller(obj) {
      var methodName = this.pop();
      var fn = ensureMethod(obj, methodName);
      return fn.apply(obj, this);
    }
    Promise2.prototype.call = function(methodName) {
      var $_len = arguments.length;
      var args = new Array(Math.max($_len - 1, 0));
      for (var $_i = 1;$_i < $_len; ++$_i) {
        args[$_i - 1] = arguments[$_i];
      }
      if (true) {
        if (canEvaluate) {
          var maybeCaller = getMethodCaller(methodName);
          if (maybeCaller !== null) {
            return this._then(maybeCaller, undefined, undefined, args, undefined);
          }
        }
      }
      args.push(methodName);
      return this._then(caller, undefined, undefined, args, undefined);
    };
    function namedGetter(obj) {
      return obj[this];
    }
    function indexedGetter(obj) {
      var index = +this;
      if (index < 0)
        index = Math.max(0, index + obj.length);
      return obj[index];
    }
    Promise2.prototype.get = function(propertyName) {
      var isIndex = typeof propertyName === "number";
      var getter;
      if (!isIndex) {
        if (canEvaluate) {
          var maybeGetter = getGetter(propertyName);
          getter = maybeGetter !== null ? maybeGetter : namedGetter;
        } else {
          getter = namedGetter;
        }
      } else {
        getter = indexedGetter;
      }
      return this._then(getter, undefined, undefined, propertyName, undefined);
    };
  };
});

// node_modules/bluebird/js/release/generators.js
var require_generators = __commonJS((exports, module) => {
  module.exports = function(Promise2, apiRejection, INTERNAL, tryConvertToPromise, Proxyable, debug) {
    var errors = require_errors2();
    var TypeError2 = errors.TypeError;
    var util2 = require_util2();
    var errorObj = util2.errorObj;
    var tryCatch = util2.tryCatch;
    var yieldHandlers = [];
    function promiseFromYieldHandler(value, yieldHandlers2, traceParent) {
      for (var i = 0;i < yieldHandlers2.length; ++i) {
        traceParent._pushContext();
        var result = tryCatch(yieldHandlers2[i])(value);
        traceParent._popContext();
        if (result === errorObj) {
          traceParent._pushContext();
          var ret = Promise2.reject(errorObj.e);
          traceParent._popContext();
          return ret;
        }
        var maybePromise = tryConvertToPromise(result, traceParent);
        if (maybePromise instanceof Promise2)
          return maybePromise;
      }
      return null;
    }
    function PromiseSpawn(generatorFunction, receiver, yieldHandler, stack) {
      if (debug.cancellation()) {
        var internal = new Promise2(INTERNAL);
        var _finallyPromise = this._finallyPromise = new Promise2(INTERNAL);
        this._promise = internal.lastly(function() {
          return _finallyPromise;
        });
        internal._captureStackTrace();
        internal._setOnCancel(this);
      } else {
        var promise = this._promise = new Promise2(INTERNAL);
        promise._captureStackTrace();
      }
      this._stack = stack;
      this._generatorFunction = generatorFunction;
      this._receiver = receiver;
      this._generator = undefined;
      this._yieldHandlers = typeof yieldHandler === "function" ? [yieldHandler].concat(yieldHandlers) : yieldHandlers;
      this._yieldedPromise = null;
      this._cancellationPhase = false;
    }
    util2.inherits(PromiseSpawn, Proxyable);
    PromiseSpawn.prototype._isResolved = function() {
      return this._promise === null;
    };
    PromiseSpawn.prototype._cleanup = function() {
      this._promise = this._generator = null;
      if (debug.cancellation() && this._finallyPromise !== null) {
        this._finallyPromise._fulfill();
        this._finallyPromise = null;
      }
    };
    PromiseSpawn.prototype._promiseCancelled = function() {
      if (this._isResolved())
        return;
      var implementsReturn = typeof this._generator["return"] !== "undefined";
      var result;
      if (!implementsReturn) {
        var reason = new Promise2.CancellationError("generator .return() sentinel");
        Promise2.coroutine.returnSentinel = reason;
        this._promise._attachExtraTrace(reason);
        this._promise._pushContext();
        result = tryCatch(this._generator["throw"]).call(this._generator, reason);
        this._promise._popContext();
      } else {
        this._promise._pushContext();
        result = tryCatch(this._generator["return"]).call(this._generator, undefined);
        this._promise._popContext();
      }
      this._cancellationPhase = true;
      this._yieldedPromise = null;
      this._continue(result);
    };
    PromiseSpawn.prototype._promiseFulfilled = function(value) {
      this._yieldedPromise = null;
      this._promise._pushContext();
      var result = tryCatch(this._generator.next).call(this._generator, value);
      this._promise._popContext();
      this._continue(result);
    };
    PromiseSpawn.prototype._promiseRejected = function(reason) {
      this._yieldedPromise = null;
      this._promise._attachExtraTrace(reason);
      this._promise._pushContext();
      var result = tryCatch(this._generator["throw"]).call(this._generator, reason);
      this._promise._popContext();
      this._continue(result);
    };
    PromiseSpawn.prototype._resultCancelled = function() {
      if (this._yieldedPromise instanceof Promise2) {
        var promise = this._yieldedPromise;
        this._yieldedPromise = null;
        promise.cancel();
      }
    };
    PromiseSpawn.prototype.promise = function() {
      return this._promise;
    };
    PromiseSpawn.prototype._run = function() {
      this._generator = this._generatorFunction.call(this._receiver);
      this._receiver = this._generatorFunction = undefined;
      this._promiseFulfilled(undefined);
    };
    PromiseSpawn.prototype._continue = function(result) {
      var promise = this._promise;
      if (result === errorObj) {
        this._cleanup();
        if (this._cancellationPhase) {
          return promise.cancel();
        } else {
          return promise._rejectCallback(result.e, false);
        }
      }
      var value = result.value;
      if (result.done === true) {
        this._cleanup();
        if (this._cancellationPhase) {
          return promise.cancel();
        } else {
          return promise._resolveCallback(value);
        }
      } else {
        var maybePromise = tryConvertToPromise(value, this._promise);
        if (!(maybePromise instanceof Promise2)) {
          maybePromise = promiseFromYieldHandler(maybePromise, this._yieldHandlers, this._promise);
          if (maybePromise === null) {
            this._promiseRejected(new TypeError2(`A value %s was yielded that could not be treated as a promise

    See http://goo.gl/MqrFmX

`.replace("%s", String(value)) + `From coroutine:
` + this._stack.split("\n").slice(1, -7).join("\n")));
            return;
          }
        }
        maybePromise = maybePromise._target();
        var bitField = maybePromise._bitField;
        if ((bitField & 50397184) === 0) {
          this._yieldedPromise = maybePromise;
          maybePromise._proxy(this, null);
        } else if ((bitField & 33554432) !== 0) {
          Promise2._async.invoke(this._promiseFulfilled, this, maybePromise._value());
        } else if ((bitField & 16777216) !== 0) {
          Promise2._async.invoke(this._promiseRejected, this, maybePromise._reason());
        } else {
          this._promiseCancelled();
        }
      }
    };
    Promise2.coroutine = function(generatorFunction, options) {
      if (typeof generatorFunction !== "function") {
        throw new TypeError2(`generatorFunction must be a function

    See http://goo.gl/MqrFmX
`);
      }
      var yieldHandler = Object(options).yieldHandler;
      var PromiseSpawn$ = PromiseSpawn;
      var stack = new Error().stack;
      return function() {
        var generator = generatorFunction.apply(this, arguments);
        var spawn = new PromiseSpawn$(undefined, undefined, yieldHandler, stack);
        var ret = spawn.promise();
        spawn._generator = generator;
        spawn._promiseFulfilled(undefined);
        return ret;
      };
    };
    Promise2.coroutine.addYieldHandler = function(fn) {
      if (typeof fn !== "function") {
        throw new TypeError2("expecting a function but got " + util2.classString(fn));
      }
      yieldHandlers.push(fn);
    };
    Promise2.spawn = function(generatorFunction) {
      debug.deprecated("Promise.spawn()", "Promise.coroutine()");
      if (typeof generatorFunction !== "function") {
        return apiRejection(`generatorFunction must be a function

    See http://goo.gl/MqrFmX
`);
      }
      var spawn = new PromiseSpawn(generatorFunction, this);
      var ret = spawn.promise();
      spawn._run(Promise2.spawn);
      return ret;
    };
  };
});

// node_modules/bluebird/js/release/map.js
var require_map = __commonJS((exports, module) => {
  module.exports = function(Promise2, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL, debug) {
    var util2 = require_util2();
    var tryCatch = util2.tryCatch;
    var errorObj = util2.errorObj;
    var async = Promise2._async;
    function MappingPromiseArray(promises, fn, limit, _filter) {
      this.constructor$(promises);
      this._promise._captureStackTrace();
      var context = Promise2._getContext();
      this._callback = util2.contextBind(context, fn);
      this._preservedValues = _filter === INTERNAL ? new Array(this.length()) : null;
      this._limit = limit;
      this._inFlight = 0;
      this._queue = [];
      async.invoke(this._asyncInit, this, undefined);
      if (util2.isArray(promises)) {
        for (var i = 0;i < promises.length; ++i) {
          var maybePromise = promises[i];
          if (maybePromise instanceof Promise2) {
            maybePromise.suppressUnhandledRejections();
          }
        }
      }
    }
    util2.inherits(MappingPromiseArray, PromiseArray);
    MappingPromiseArray.prototype._asyncInit = function() {
      this._init$(undefined, -2);
    };
    MappingPromiseArray.prototype._init = function() {
    };
    MappingPromiseArray.prototype._promiseFulfilled = function(value, index) {
      var values = this._values;
      var length = this.length();
      var preservedValues = this._preservedValues;
      var limit = this._limit;
      if (index < 0) {
        index = index * -1 - 1;
        values[index] = value;
        if (limit >= 1) {
          this._inFlight--;
          this._drainQueue();
          if (this._isResolved())
            return true;
        }
      } else {
        if (limit >= 1 && this._inFlight >= limit) {
          values[index] = value;
          this._queue.push(index);
          return false;
        }
        if (preservedValues !== null)
          preservedValues[index] = value;
        var promise = this._promise;
        var callback = this._callback;
        var receiver = promise._boundValue();
        promise._pushContext();
        var ret = tryCatch(callback).call(receiver, value, index, length);
        var promiseCreated = promise._popContext();
        debug.checkForgottenReturns(ret, promiseCreated, preservedValues !== null ? "Promise.filter" : "Promise.map", promise);
        if (ret === errorObj) {
          this._reject(ret.e);
          return true;
        }
        var maybePromise = tryConvertToPromise(ret, this._promise);
        if (maybePromise instanceof Promise2) {
          maybePromise = maybePromise._target();
          var bitField = maybePromise._bitField;
          if ((bitField & 50397184) === 0) {
            if (limit >= 1)
              this._inFlight++;
            values[index] = maybePromise;
            maybePromise._proxy(this, (index + 1) * -1);
            return false;
          } else if ((bitField & 33554432) !== 0) {
            ret = maybePromise._value();
          } else if ((bitField & 16777216) !== 0) {
            this._reject(maybePromise._reason());
            return true;
          } else {
            this._cancel();
            return true;
          }
        }
        values[index] = ret;
      }
      var totalResolved = ++this._totalResolved;
      if (totalResolved >= length) {
        if (preservedValues !== null) {
          this._filter(values, preservedValues);
        } else {
          this._resolve(values);
        }
        return true;
      }
      return false;
    };
    MappingPromiseArray.prototype._drainQueue = function() {
      var queue = this._queue;
      var limit = this._limit;
      var values = this._values;
      while (queue.length > 0 && this._inFlight < limit) {
        if (this._isResolved())
          return;
        var index = queue.pop();
        this._promiseFulfilled(values[index], index);
      }
    };
    MappingPromiseArray.prototype._filter = function(booleans, values) {
      var len = values.length;
      var ret = new Array(len);
      var j = 0;
      for (var i = 0;i < len; ++i) {
        if (booleans[i])
          ret[j++] = values[i];
      }
      ret.length = j;
      this._resolve(ret);
    };
    MappingPromiseArray.prototype.preservedValues = function() {
      return this._preservedValues;
    };
    function map(promises, fn, options, _filter) {
      if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util2.classString(fn));
      }
      var limit = 0;
      if (options !== undefined) {
        if (typeof options === "object" && options !== null) {
          if (typeof options.concurrency !== "number") {
            return Promise2.reject(new TypeError("'concurrency' must be a number but it is " + util2.classString(options.concurrency)));
          }
          limit = options.concurrency;
        } else {
          return Promise2.reject(new TypeError("options argument must be an object but it is " + util2.classString(options)));
        }
      }
      limit = typeof limit === "number" && isFinite(limit) && limit >= 1 ? limit : 0;
      return new MappingPromiseArray(promises, fn, limit, _filter).promise();
    }
    Promise2.prototype.map = function(fn, options) {
      return map(this, fn, options, null);
    };
    Promise2.map = function(promises, fn, options, _filter) {
      return map(promises, fn, options, _filter);
    };
  };
});

// node_modules/bluebird/js/release/nodeify.js
var require_nodeify = __commonJS((exports, module) => {
  module.exports = function(Promise2) {
    var util2 = require_util2();
    var async = Promise2._async;
    var tryCatch = util2.tryCatch;
    var errorObj = util2.errorObj;
    function spreadAdapter(val, nodeback) {
      var promise = this;
      if (!util2.isArray(val))
        return successAdapter.call(promise, val, nodeback);
      var ret = tryCatch(nodeback).apply(promise._boundValue(), [null].concat(val));
      if (ret === errorObj) {
        async.throwLater(ret.e);
      }
    }
    function successAdapter(val, nodeback) {
      var promise = this;
      var receiver = promise._boundValue();
      var ret = val === undefined ? tryCatch(nodeback).call(receiver, null) : tryCatch(nodeback).call(receiver, null, val);
      if (ret === errorObj) {
        async.throwLater(ret.e);
      }
    }
    function errorAdapter(reason, nodeback) {
      var promise = this;
      if (!reason) {
        var newReason = new Error(reason + "");
        newReason.cause = reason;
        reason = newReason;
      }
      var ret = tryCatch(nodeback).call(promise._boundValue(), reason);
      if (ret === errorObj) {
        async.throwLater(ret.e);
      }
    }
    Promise2.prototype.asCallback = Promise2.prototype.nodeify = function(nodeback, options) {
      if (typeof nodeback == "function") {
        var adapter = successAdapter;
        if (options !== undefined && Object(options).spread) {
          adapter = spreadAdapter;
        }
        this._then(adapter, errorAdapter, undefined, this, nodeback);
      }
      return this;
    };
  };
});

// node_modules/bluebird/js/release/promisify.js
var require_promisify = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL) {
    var THIS = {};
    var util2 = require_util2();
    var nodebackForPromise = require_nodeback();
    var withAppended = util2.withAppended;
    var maybeWrapAsError = util2.maybeWrapAsError;
    var canEvaluate = util2.canEvaluate;
    var TypeError2 = require_errors2().TypeError;
    var defaultSuffix = "Async";
    var defaultPromisified = { __isPromisified__: true };
    var noCopyProps = [
      "arity",
      "length",
      "name",
      "arguments",
      "caller",
      "callee",
      "prototype",
      "__isPromisified__"
    ];
    var noCopyPropsPattern = new RegExp("^(?:" + noCopyProps.join("|") + ")$");
    var defaultFilter = function(name) {
      return util2.isIdentifier(name) && name.charAt(0) !== "_" && name !== "constructor";
    };
    function propsFilter(key) {
      return !noCopyPropsPattern.test(key);
    }
    function isPromisified(fn) {
      try {
        return fn.__isPromisified__ === true;
      } catch (e) {
        return false;
      }
    }
    function hasPromisified(obj, key, suffix) {
      var val = util2.getDataPropertyOrDefault(obj, key + suffix, defaultPromisified);
      return val ? isPromisified(val) : false;
    }
    function checkValid(ret, suffix, suffixRegexp) {
      for (var i = 0;i < ret.length; i += 2) {
        var key = ret[i];
        if (suffixRegexp.test(key)) {
          var keyWithoutAsyncSuffix = key.replace(suffixRegexp, "");
          for (var j = 0;j < ret.length; j += 2) {
            if (ret[j] === keyWithoutAsyncSuffix) {
              throw new TypeError2(`Cannot promisify an API that has normal methods with '%s'-suffix

    See http://goo.gl/MqrFmX
`.replace("%s", suffix));
            }
          }
        }
      }
    }
    function promisifiableMethods(obj, suffix, suffixRegexp, filter2) {
      var keys = util2.inheritedDataKeys(obj);
      var ret = [];
      for (var i = 0;i < keys.length; ++i) {
        var key = keys[i];
        var value = obj[key];
        var passesDefaultFilter = filter2 === defaultFilter ? true : defaultFilter(key, value, obj);
        if (typeof value === "function" && !isPromisified(value) && !hasPromisified(obj, key, suffix) && filter2(key, value, obj, passesDefaultFilter)) {
          ret.push(key, value);
        }
      }
      checkValid(ret, suffix, suffixRegexp);
      return ret;
    }
    var escapeIdentRegex = function(str) {
      return str.replace(/([$])/, "\\$");
    };
    var makeNodePromisifiedEval;
    if (true) {
      var switchCaseArgumentOrder = function(likelyArgumentCount) {
        var ret = [likelyArgumentCount];
        var min = Math.max(0, likelyArgumentCount - 1 - 3);
        for (var i = likelyArgumentCount - 1;i >= min; --i) {
          ret.push(i);
        }
        for (var i = likelyArgumentCount + 1;i <= 3; ++i) {
          ret.push(i);
        }
        return ret;
      };
      var argumentSequence = function(argumentCount) {
        return util2.filledRange(argumentCount, "_arg", "");
      };
      var parameterDeclaration = function(parameterCount2) {
        return util2.filledRange(Math.max(parameterCount2, 3), "_arg", "");
      };
      var parameterCount = function(fn) {
        if (typeof fn.length === "number") {
          return Math.max(Math.min(fn.length, 1023 + 1), 0);
        }
        return 0;
      };
      makeNodePromisifiedEval = function(callback, receiver, originalName, fn, _, multiArgs) {
        var newParameterCount = Math.max(0, parameterCount(fn) - 1);
        var argumentOrder = switchCaseArgumentOrder(newParameterCount);
        var shouldProxyThis = typeof callback === "string" || receiver === THIS;
        function generateCallForArgumentCount(count) {
          var args = argumentSequence(count).join(", ");
          var comma = count > 0 ? ", " : "";
          var ret;
          if (shouldProxyThis) {
            ret = "ret = callback.call(this, {{args}}, nodeback); break;\n";
          } else {
            ret = receiver === undefined ? "ret = callback({{args}}, nodeback); break;\n" : "ret = callback.call(receiver, {{args}}, nodeback); break;\n";
          }
          return ret.replace("{{args}}", args).replace(", ", comma);
        }
        function generateArgumentSwitchCase() {
          var ret = "";
          for (var i = 0;i < argumentOrder.length; ++i) {
            ret += "case " + argumentOrder[i] + ":" + generateCallForArgumentCount(argumentOrder[i]);
          }
          ret += `                                                             
        default:                                                             
            var args = new Array(len + 1);                                   
            var i = 0;                                                       
            for (var i = 0; i < len; ++i) {                                  
               args[i] = arguments[i];                                       
            }                                                                
            args[i] = nodeback;                                              
            [CodeForCall]                                                    
            break;                                                           
        `.replace("[CodeForCall]", shouldProxyThis ? "ret = callback.apply(this, args);\n" : "ret = callback.apply(receiver, args);\n");
          return ret;
        }
        var getFunctionCode = typeof callback === "string" ? "this != null ? this['" + callback + "'] : fn" : "fn";
        var body = `'use strict';                                                
        var ret = function (Parameters) {                                    
            'use strict';                                                    
            var len = arguments.length;                                      
            var promise = new Promise(INTERNAL);                             
            promise._captureStackTrace();                                    
            var nodeback = nodebackForPromise(promise, ` + multiArgs + `);   
            var ret;                                                         
            var callback = tryCatch([GetFunctionCode]);                      
            switch(len) {                                                    
                [CodeForSwitchCase]                                          
            }                                                                
            if (ret === errorObj) {                                          
                promise._rejectCallback(maybeWrapAsError(ret.e), true, true);
            }                                                                
            if (!promise._isFateSealed()) promise._setAsyncGuaranteed();     
            return promise;                                                  
        };                                                                   
        notEnumerableProp(ret, '__isPromisified__', true);                   
        return ret;                                                          
    `.replace("[CodeForSwitchCase]", generateArgumentSwitchCase()).replace("[GetFunctionCode]", getFunctionCode);
        body = body.replace("Parameters", parameterDeclaration(newParameterCount));
        return new Function("Promise", "fn", "receiver", "withAppended", "maybeWrapAsError", "nodebackForPromise", "tryCatch", "errorObj", "notEnumerableProp", "INTERNAL", body)(Promise2, fn, receiver, withAppended, maybeWrapAsError, nodebackForPromise, util2.tryCatch, util2.errorObj, util2.notEnumerableProp, INTERNAL);
      };
    }
    function makeNodePromisifiedClosure(callback, receiver, _, fn, __, multiArgs) {
      var defaultThis = function() {
        return this;
      }();
      var method = callback;
      if (typeof method === "string") {
        callback = fn;
      }
      function promisified() {
        var _receiver = receiver;
        if (receiver === THIS)
          _receiver = this;
        var promise = new Promise2(INTERNAL);
        promise._captureStackTrace();
        var cb = typeof method === "string" && this !== defaultThis ? this[method] : callback;
        var fn2 = nodebackForPromise(promise, multiArgs);
        try {
          cb.apply(_receiver, withAppended(arguments, fn2));
        } catch (e) {
          promise._rejectCallback(maybeWrapAsError(e), true, true);
        }
        if (!promise._isFateSealed())
          promise._setAsyncGuaranteed();
        return promise;
      }
      util2.notEnumerableProp(promisified, "__isPromisified__", true);
      return promisified;
    }
    var makeNodePromisified = canEvaluate ? makeNodePromisifiedEval : makeNodePromisifiedClosure;
    function promisifyAll(obj, suffix, filter2, promisifier, multiArgs) {
      var suffixRegexp = new RegExp(escapeIdentRegex(suffix) + "$");
      var methods = promisifiableMethods(obj, suffix, suffixRegexp, filter2);
      for (var i = 0, len = methods.length;i < len; i += 2) {
        var key = methods[i];
        var fn = methods[i + 1];
        var promisifiedKey = key + suffix;
        if (promisifier === makeNodePromisified) {
          obj[promisifiedKey] = makeNodePromisified(key, THIS, key, fn, suffix, multiArgs);
        } else {
          var promisified = promisifier(fn, function() {
            return makeNodePromisified(key, THIS, key, fn, suffix, multiArgs);
          });
          util2.notEnumerableProp(promisified, "__isPromisified__", true);
          obj[promisifiedKey] = promisified;
        }
      }
      util2.toFastProperties(obj);
      return obj;
    }
    function promisify(callback, receiver, multiArgs) {
      return makeNodePromisified(callback, receiver, undefined, callback, null, multiArgs);
    }
    Promise2.promisify = function(fn, options) {
      if (typeof fn !== "function") {
        throw new TypeError2("expecting a function but got " + util2.classString(fn));
      }
      if (isPromisified(fn)) {
        return fn;
      }
      options = Object(options);
      var receiver = options.context === undefined ? THIS : options.context;
      var multiArgs = !!options.multiArgs;
      var ret = promisify(fn, receiver, multiArgs);
      util2.copyDescriptors(fn, ret, propsFilter);
      return ret;
    };
    Promise2.promisifyAll = function(target, options) {
      if (typeof target !== "function" && typeof target !== "object") {
        throw new TypeError2(`the target of promisifyAll must be an object or a function

    See http://goo.gl/MqrFmX
`);
      }
      options = Object(options);
      var multiArgs = !!options.multiArgs;
      var suffix = options.suffix;
      if (typeof suffix !== "string")
        suffix = defaultSuffix;
      var filter2 = options.filter;
      if (typeof filter2 !== "function")
        filter2 = defaultFilter;
      var promisifier = options.promisifier;
      if (typeof promisifier !== "function")
        promisifier = makeNodePromisified;
      if (!util2.isIdentifier(suffix)) {
        throw new RangeError(`suffix must be a valid identifier

    See http://goo.gl/MqrFmX
`);
      }
      var keys = util2.inheritedDataKeys(target);
      for (var i = 0;i < keys.length; ++i) {
        var value = target[keys[i]];
        if (keys[i] !== "constructor" && util2.isClass(value)) {
          promisifyAll(value.prototype, suffix, filter2, promisifier, multiArgs);
          promisifyAll(value, suffix, filter2, promisifier, multiArgs);
        }
      }
      return promisifyAll(target, suffix, filter2, promisifier, multiArgs);
    };
  };
});

// node_modules/bluebird/js/release/props.js
var require_props = __commonJS((exports, module) => {
  module.exports = function(Promise2, PromiseArray, tryConvertToPromise, apiRejection) {
    var util2 = require_util2();
    var isObject2 = util2.isObject;
    var es5 = require_es5();
    var Es6Map;
    if (typeof Map === "function")
      Es6Map = Map;
    var mapToEntries = function() {
      var index = 0;
      var size = 0;
      function extractEntry(value, key) {
        this[index] = value;
        this[index + size] = key;
        index++;
      }
      return function mapToEntries(map) {
        size = map.size;
        index = 0;
        var ret = new Array(map.size * 2);
        map.forEach(extractEntry, ret);
        return ret;
      };
    }();
    var entriesToMap = function(entries) {
      var ret = new Es6Map;
      var length = entries.length / 2 | 0;
      for (var i = 0;i < length; ++i) {
        var key = entries[length + i];
        var value = entries[i];
        ret.set(key, value);
      }
      return ret;
    };
    function PropertiesPromiseArray(obj) {
      var isMap = false;
      var entries;
      if (Es6Map !== undefined && obj instanceof Es6Map) {
        entries = mapToEntries(obj);
        isMap = true;
      } else {
        var keys = es5.keys(obj);
        var len = keys.length;
        entries = new Array(len * 2);
        for (var i = 0;i < len; ++i) {
          var key = keys[i];
          entries[i] = obj[key];
          entries[i + len] = key;
        }
      }
      this.constructor$(entries);
      this._isMap = isMap;
      this._init$(undefined, isMap ? -6 : -3);
    }
    util2.inherits(PropertiesPromiseArray, PromiseArray);
    PropertiesPromiseArray.prototype._init = function() {
    };
    PropertiesPromiseArray.prototype._promiseFulfilled = function(value, index) {
      this._values[index] = value;
      var totalResolved = ++this._totalResolved;
      if (totalResolved >= this._length) {
        var val;
        if (this._isMap) {
          val = entriesToMap(this._values);
        } else {
          val = {};
          var keyOffset = this.length();
          for (var i = 0, len = this.length();i < len; ++i) {
            val[this._values[i + keyOffset]] = this._values[i];
          }
        }
        this._resolve(val);
        return true;
      }
      return false;
    };
    PropertiesPromiseArray.prototype.shouldCopyValues = function() {
      return false;
    };
    PropertiesPromiseArray.prototype.getActualLength = function(len) {
      return len >> 1;
    };
    function props(promises) {
      var ret;
      var castValue = tryConvertToPromise(promises);
      if (!isObject2(castValue)) {
        return apiRejection(`cannot await properties of a non-object

    See http://goo.gl/MqrFmX
`);
      } else if (castValue instanceof Promise2) {
        ret = castValue._then(Promise2.props, undefined, undefined, undefined, undefined);
      } else {
        ret = new PropertiesPromiseArray(castValue).promise();
      }
      if (castValue instanceof Promise2) {
        ret._propagateFrom(castValue, 2);
      }
      return ret;
    }
    Promise2.prototype.props = function() {
      return props(this);
    };
    Promise2.props = function(promises) {
      return props(promises);
    };
  };
});

// node_modules/bluebird/js/release/race.js
var require_race = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL, tryConvertToPromise, apiRejection) {
    var util2 = require_util2();
    var raceLater = function(promise) {
      return promise.then(function(array) {
        return race(array, promise);
      });
    };
    function race(promises, parent) {
      var maybePromise = tryConvertToPromise(promises);
      if (maybePromise instanceof Promise2) {
        return raceLater(maybePromise);
      } else {
        promises = util2.asArray(promises);
        if (promises === null)
          return apiRejection("expecting an array or an iterable object but got " + util2.classString(promises));
      }
      var ret = new Promise2(INTERNAL);
      if (parent !== undefined) {
        ret._propagateFrom(parent, 3);
      }
      var fulfill = ret._fulfill;
      var reject = ret._reject;
      for (var i = 0, len = promises.length;i < len; ++i) {
        var val = promises[i];
        if (val === undefined && !(i in promises)) {
          continue;
        }
        Promise2.cast(val)._then(fulfill, reject, undefined, ret, null);
      }
      return ret;
    }
    Promise2.race = function(promises) {
      return race(promises, undefined);
    };
    Promise2.prototype.race = function() {
      return race(this, undefined);
    };
  };
});

// node_modules/bluebird/js/release/reduce.js
var require_reduce = __commonJS((exports, module) => {
  module.exports = function(Promise2, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL, debug) {
    var util2 = require_util2();
    var tryCatch = util2.tryCatch;
    function ReductionPromiseArray(promises, fn, initialValue, _each) {
      this.constructor$(promises);
      var context = Promise2._getContext();
      this._fn = util2.contextBind(context, fn);
      if (initialValue !== undefined) {
        initialValue = Promise2.resolve(initialValue);
        initialValue._attachCancellationCallback(this);
      }
      this._initialValue = initialValue;
      this._currentCancellable = null;
      if (_each === INTERNAL) {
        this._eachValues = Array(this._length);
      } else if (_each === 0) {
        this._eachValues = null;
      } else {
        this._eachValues = undefined;
      }
      this._promise._captureStackTrace();
      this._init$(undefined, -5);
    }
    util2.inherits(ReductionPromiseArray, PromiseArray);
    ReductionPromiseArray.prototype._gotAccum = function(accum) {
      if (this._eachValues !== undefined && this._eachValues !== null && accum !== INTERNAL) {
        this._eachValues.push(accum);
      }
    };
    ReductionPromiseArray.prototype._eachComplete = function(value) {
      if (this._eachValues !== null) {
        this._eachValues.push(value);
      }
      return this._eachValues;
    };
    ReductionPromiseArray.prototype._init = function() {
    };
    ReductionPromiseArray.prototype._resolveEmptyArray = function() {
      this._resolve(this._eachValues !== undefined ? this._eachValues : this._initialValue);
    };
    ReductionPromiseArray.prototype.shouldCopyValues = function() {
      return false;
    };
    ReductionPromiseArray.prototype._resolve = function(value) {
      this._promise._resolveCallback(value);
      this._values = null;
    };
    ReductionPromiseArray.prototype._resultCancelled = function(sender) {
      if (sender === this._initialValue)
        return this._cancel();
      if (this._isResolved())
        return;
      this._resultCancelled$();
      if (this._currentCancellable instanceof Promise2) {
        this._currentCancellable.cancel();
      }
      if (this._initialValue instanceof Promise2) {
        this._initialValue.cancel();
      }
    };
    ReductionPromiseArray.prototype._iterate = function(values) {
      this._values = values;
      var value;
      var i;
      var length = values.length;
      if (this._initialValue !== undefined) {
        value = this._initialValue;
        i = 0;
      } else {
        value = Promise2.resolve(values[0]);
        i = 1;
      }
      this._currentCancellable = value;
      for (var j = i;j < length; ++j) {
        var maybePromise = values[j];
        if (maybePromise instanceof Promise2) {
          maybePromise.suppressUnhandledRejections();
        }
      }
      if (!value.isRejected()) {
        for (;i < length; ++i) {
          var ctx = {
            accum: null,
            value: values[i],
            index: i,
            length,
            array: this
          };
          value = value._then(gotAccum, undefined, undefined, ctx, undefined);
          if ((i & 127) === 0) {
            value._setNoAsyncGuarantee();
          }
        }
      }
      if (this._eachValues !== undefined) {
        value = value._then(this._eachComplete, undefined, undefined, this, undefined);
      }
      value._then(completed, completed, undefined, value, this);
    };
    Promise2.prototype.reduce = function(fn, initialValue) {
      return reduce(this, fn, initialValue, null);
    };
    Promise2.reduce = function(promises, fn, initialValue, _each) {
      return reduce(promises, fn, initialValue, _each);
    };
    function completed(valueOrReason, array) {
      if (this.isFulfilled()) {
        array._resolve(valueOrReason);
      } else {
        array._reject(valueOrReason);
      }
    }
    function reduce(promises, fn, initialValue, _each) {
      if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util2.classString(fn));
      }
      var array = new ReductionPromiseArray(promises, fn, initialValue, _each);
      return array.promise();
    }
    function gotAccum(accum) {
      this.accum = accum;
      this.array._gotAccum(accum);
      var value = tryConvertToPromise(this.value, this.array._promise);
      if (value instanceof Promise2) {
        this.array._currentCancellable = value;
        return value._then(gotValue, undefined, undefined, this, undefined);
      } else {
        return gotValue.call(this, value);
      }
    }
    function gotValue(value) {
      var array = this.array;
      var promise = array._promise;
      var fn = tryCatch(array._fn);
      promise._pushContext();
      var ret;
      if (array._eachValues !== undefined) {
        ret = fn.call(promise._boundValue(), value, this.index, this.length);
      } else {
        ret = fn.call(promise._boundValue(), this.accum, value, this.index, this.length);
      }
      if (ret instanceof Promise2) {
        array._currentCancellable = ret;
      }
      var promiseCreated = promise._popContext();
      debug.checkForgottenReturns(ret, promiseCreated, array._eachValues !== undefined ? "Promise.each" : "Promise.reduce", promise);
      return ret;
    }
  };
});

// node_modules/bluebird/js/release/settle.js
var require_settle = __commonJS((exports, module) => {
  module.exports = function(Promise2, PromiseArray, debug) {
    var PromiseInspection = Promise2.PromiseInspection;
    var util2 = require_util2();
    function SettledPromiseArray(values) {
      this.constructor$(values);
    }
    util2.inherits(SettledPromiseArray, PromiseArray);
    SettledPromiseArray.prototype._promiseResolved = function(index, inspection) {
      this._values[index] = inspection;
      var totalResolved = ++this._totalResolved;
      if (totalResolved >= this._length) {
        this._resolve(this._values);
        return true;
      }
      return false;
    };
    SettledPromiseArray.prototype._promiseFulfilled = function(value, index) {
      var ret = new PromiseInspection;
      ret._bitField = 33554432;
      ret._settledValueField = value;
      return this._promiseResolved(index, ret);
    };
    SettledPromiseArray.prototype._promiseRejected = function(reason, index) {
      var ret = new PromiseInspection;
      ret._bitField = 16777216;
      ret._settledValueField = reason;
      return this._promiseResolved(index, ret);
    };
    Promise2.settle = function(promises) {
      debug.deprecated(".settle()", ".reflect()");
      return new SettledPromiseArray(promises).promise();
    };
    Promise2.allSettled = function(promises) {
      return new SettledPromiseArray(promises).promise();
    };
    Promise2.prototype.settle = function() {
      return Promise2.settle(this);
    };
  };
});

// node_modules/bluebird/js/release/some.js
var require_some = __commonJS((exports, module) => {
  module.exports = function(Promise2, PromiseArray, apiRejection) {
    var util2 = require_util2();
    var RangeError2 = require_errors2().RangeError;
    var AggregateError = require_errors2().AggregateError;
    var isArray2 = util2.isArray;
    var CANCELLATION = {};
    function SomePromiseArray(values) {
      this.constructor$(values);
      this._howMany = 0;
      this._unwrap = false;
      this._initialized = false;
    }
    util2.inherits(SomePromiseArray, PromiseArray);
    SomePromiseArray.prototype._init = function() {
      if (!this._initialized) {
        return;
      }
      if (this._howMany === 0) {
        this._resolve([]);
        return;
      }
      this._init$(undefined, -5);
      var isArrayResolved = isArray2(this._values);
      if (!this._isResolved() && isArrayResolved && this._howMany > this._canPossiblyFulfill()) {
        this._reject(this._getRangeError(this.length()));
      }
    };
    SomePromiseArray.prototype.init = function() {
      this._initialized = true;
      this._init();
    };
    SomePromiseArray.prototype.setUnwrap = function() {
      this._unwrap = true;
    };
    SomePromiseArray.prototype.howMany = function() {
      return this._howMany;
    };
    SomePromiseArray.prototype.setHowMany = function(count) {
      this._howMany = count;
    };
    SomePromiseArray.prototype._promiseFulfilled = function(value) {
      this._addFulfilled(value);
      if (this._fulfilled() === this.howMany()) {
        this._values.length = this.howMany();
        if (this.howMany() === 1 && this._unwrap) {
          this._resolve(this._values[0]);
        } else {
          this._resolve(this._values);
        }
        return true;
      }
      return false;
    };
    SomePromiseArray.prototype._promiseRejected = function(reason) {
      this._addRejected(reason);
      return this._checkOutcome();
    };
    SomePromiseArray.prototype._promiseCancelled = function() {
      if (this._values instanceof Promise2 || this._values == null) {
        return this._cancel();
      }
      this._addRejected(CANCELLATION);
      return this._checkOutcome();
    };
    SomePromiseArray.prototype._checkOutcome = function() {
      if (this.howMany() > this._canPossiblyFulfill()) {
        var e = new AggregateError;
        for (var i = this.length();i < this._values.length; ++i) {
          if (this._values[i] !== CANCELLATION) {
            e.push(this._values[i]);
          }
        }
        if (e.length > 0) {
          this._reject(e);
        } else {
          this._cancel();
        }
        return true;
      }
      return false;
    };
    SomePromiseArray.prototype._fulfilled = function() {
      return this._totalResolved;
    };
    SomePromiseArray.prototype._rejected = function() {
      return this._values.length - this.length();
    };
    SomePromiseArray.prototype._addRejected = function(reason) {
      this._values.push(reason);
    };
    SomePromiseArray.prototype._addFulfilled = function(value) {
      this._values[this._totalResolved++] = value;
    };
    SomePromiseArray.prototype._canPossiblyFulfill = function() {
      return this.length() - this._rejected();
    };
    SomePromiseArray.prototype._getRangeError = function(count) {
      var message = "Input array must contain at least " + this._howMany + " items but contains only " + count + " items";
      return new RangeError2(message);
    };
    SomePromiseArray.prototype._resolveEmptyArray = function() {
      this._reject(this._getRangeError(0));
    };
    function some(promises, howMany) {
      if ((howMany | 0) !== howMany || howMany < 0) {
        return apiRejection(`expecting a positive integer

    See http://goo.gl/MqrFmX
`);
      }
      var ret = new SomePromiseArray(promises);
      var promise = ret.promise();
      ret.setHowMany(howMany);
      ret.init();
      return promise;
    }
    Promise2.some = function(promises, howMany) {
      return some(promises, howMany);
    };
    Promise2.prototype.some = function(howMany) {
      return some(this, howMany);
    };
    Promise2._SomePromiseArray = SomePromiseArray;
  };
});

// node_modules/bluebird/js/release/timers.js
var require_timers = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL, debug) {
    var util2 = require_util2();
    var TimeoutError = Promise2.TimeoutError;
    function HandleWrapper(handle) {
      this.handle = handle;
    }
    HandleWrapper.prototype._resultCancelled = function() {
      clearTimeout(this.handle);
    };
    var afterValue = function(value) {
      return delay(+this).thenReturn(value);
    };
    var delay = Promise2.delay = function(ms, value) {
      var ret;
      var handle;
      if (value !== undefined) {
        ret = Promise2.resolve(value)._then(afterValue, null, null, ms, undefined);
        if (debug.cancellation() && value instanceof Promise2) {
          ret._setOnCancel(value);
        }
      } else {
        ret = new Promise2(INTERNAL);
        handle = setTimeout(function() {
          ret._fulfill();
        }, +ms);
        if (debug.cancellation()) {
          ret._setOnCancel(new HandleWrapper(handle));
        }
        ret._captureStackTrace();
      }
      ret._setAsyncGuaranteed();
      return ret;
    };
    Promise2.prototype.delay = function(ms) {
      return delay(ms, this);
    };
    var afterTimeout = function(promise, message, parent) {
      var err;
      if (typeof message !== "string") {
        if (message instanceof Error) {
          err = message;
        } else {
          err = new TimeoutError("operation timed out");
        }
      } else {
        err = new TimeoutError(message);
      }
      util2.markAsOriginatingFromRejection(err);
      promise._attachExtraTrace(err);
      promise._reject(err);
      if (parent != null) {
        parent.cancel();
      }
    };
    function successClear(value) {
      clearTimeout(this.handle);
      return value;
    }
    function failureClear(reason) {
      clearTimeout(this.handle);
      throw reason;
    }
    Promise2.prototype.timeout = function(ms, message) {
      ms = +ms;
      var ret, parent;
      var handleWrapper = new HandleWrapper(setTimeout(function timeoutTimeout() {
        if (ret.isPending()) {
          afterTimeout(ret, message, parent);
        }
      }, ms));
      if (debug.cancellation()) {
        parent = this.then();
        ret = parent._then(successClear, failureClear, undefined, handleWrapper, undefined);
        ret._setOnCancel(handleWrapper);
      } else {
        ret = this._then(successClear, failureClear, undefined, handleWrapper, undefined);
      }
      return ret;
    };
  };
});

// node_modules/bluebird/js/release/using.js
var require_using = __commonJS((exports, module) => {
  module.exports = function(Promise2, apiRejection, tryConvertToPromise, createContext, INTERNAL, debug) {
    var util2 = require_util2();
    var TypeError2 = require_errors2().TypeError;
    var inherits2 = require_util2().inherits;
    var errorObj = util2.errorObj;
    var tryCatch = util2.tryCatch;
    var NULL = {};
    function thrower(e) {
      setTimeout(function() {
        throw e;
      }, 0);
    }
    function castPreservingDisposable(thenable) {
      var maybePromise = tryConvertToPromise(thenable);
      if (maybePromise !== thenable && typeof thenable._isDisposable === "function" && typeof thenable._getDisposer === "function" && thenable._isDisposable()) {
        maybePromise._setDisposable(thenable._getDisposer());
      }
      return maybePromise;
    }
    function dispose(resources, inspection) {
      var i = 0;
      var len = resources.length;
      var ret = new Promise2(INTERNAL);
      function iterator() {
        if (i >= len)
          return ret._fulfill();
        var maybePromise = castPreservingDisposable(resources[i++]);
        if (maybePromise instanceof Promise2 && maybePromise._isDisposable()) {
          try {
            maybePromise = tryConvertToPromise(maybePromise._getDisposer().tryDispose(inspection), resources.promise);
          } catch (e) {
            return thrower(e);
          }
          if (maybePromise instanceof Promise2) {
            return maybePromise._then(iterator, thrower, null, null, null);
          }
        }
        iterator();
      }
      iterator();
      return ret;
    }
    function Disposer(data4, promise, context) {
      this._data = data4;
      this._promise = promise;
      this._context = context;
    }
    Disposer.prototype.data = function() {
      return this._data;
    };
    Disposer.prototype.promise = function() {
      return this._promise;
    };
    Disposer.prototype.resource = function() {
      if (this.promise().isFulfilled()) {
        return this.promise().value();
      }
      return NULL;
    };
    Disposer.prototype.tryDispose = function(inspection) {
      var resource = this.resource();
      var context = this._context;
      if (context !== undefined)
        context._pushContext();
      var ret = resource !== NULL ? this.doDispose(resource, inspection) : null;
      if (context !== undefined)
        context._popContext();
      this._promise._unsetDisposable();
      this._data = null;
      return ret;
    };
    Disposer.isDisposer = function(d) {
      return d != null && typeof d.resource === "function" && typeof d.tryDispose === "function";
    };
    function FunctionDisposer(fn, promise, context) {
      this.constructor$(fn, promise, context);
    }
    inherits2(FunctionDisposer, Disposer);
    FunctionDisposer.prototype.doDispose = function(resource, inspection) {
      var fn = this.data();
      return fn.call(resource, resource, inspection);
    };
    function maybeUnwrapDisposer(value) {
      if (Disposer.isDisposer(value)) {
        this.resources[this.index]._setDisposable(value);
        return value.promise();
      }
      return value;
    }
    function ResourceList(length) {
      this.length = length;
      this.promise = null;
      this[length - 1] = null;
    }
    ResourceList.prototype._resultCancelled = function() {
      var len = this.length;
      for (var i = 0;i < len; ++i) {
        var item = this[i];
        if (item instanceof Promise2) {
          item.cancel();
        }
      }
    };
    Promise2.using = function() {
      var len = arguments.length;
      if (len < 2)
        return apiRejection("you must pass at least 2 arguments to Promise.using");
      var fn = arguments[len - 1];
      if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util2.classString(fn));
      }
      var input;
      var spreadArgs = true;
      if (len === 2 && Array.isArray(arguments[0])) {
        input = arguments[0];
        len = input.length;
        spreadArgs = false;
      } else {
        input = arguments;
        len--;
      }
      var resources = new ResourceList(len);
      for (var i = 0;i < len; ++i) {
        var resource = input[i];
        if (Disposer.isDisposer(resource)) {
          var disposer = resource;
          resource = resource.promise();
          resource._setDisposable(disposer);
        } else {
          var maybePromise = tryConvertToPromise(resource);
          if (maybePromise instanceof Promise2) {
            resource = maybePromise._then(maybeUnwrapDisposer, null, null, {
              resources,
              index: i
            }, undefined);
          }
        }
        resources[i] = resource;
      }
      var reflectedResources = new Array(resources.length);
      for (var i = 0;i < reflectedResources.length; ++i) {
        reflectedResources[i] = Promise2.resolve(resources[i]).reflect();
      }
      var resultPromise = Promise2.all(reflectedResources).then(function(inspections) {
        for (var i2 = 0;i2 < inspections.length; ++i2) {
          var inspection = inspections[i2];
          if (inspection.isRejected()) {
            errorObj.e = inspection.error();
            return errorObj;
          } else if (!inspection.isFulfilled()) {
            resultPromise.cancel();
            return;
          }
          inspections[i2] = inspection.value();
        }
        promise._pushContext();
        fn = tryCatch(fn);
        var ret = spreadArgs ? fn.apply(undefined, inspections) : fn(inspections);
        var promiseCreated = promise._popContext();
        debug.checkForgottenReturns(ret, promiseCreated, "Promise.using", promise);
        return ret;
      });
      var promise = resultPromise.lastly(function() {
        var inspection = new Promise2.PromiseInspection(resultPromise);
        return dispose(resources, inspection);
      });
      resources.promise = promise;
      promise._setOnCancel(resources);
      return promise;
    };
    Promise2.prototype._setDisposable = function(disposer) {
      this._bitField = this._bitField | 131072;
      this._disposer = disposer;
    };
    Promise2.prototype._isDisposable = function() {
      return (this._bitField & 131072) > 0;
    };
    Promise2.prototype._getDisposer = function() {
      return this._disposer;
    };
    Promise2.prototype._unsetDisposable = function() {
      this._bitField = this._bitField & ~131072;
      this._disposer = undefined;
    };
    Promise2.prototype.disposer = function(fn) {
      if (typeof fn === "function") {
        return new FunctionDisposer(fn, this, createContext());
      }
      throw new TypeError2;
    };
  };
});

// node_modules/bluebird/js/release/any.js
var require_any = __commonJS((exports, module) => {
  module.exports = function(Promise2) {
    var SomePromiseArray = Promise2._SomePromiseArray;
    function any(promises) {
      var ret = new SomePromiseArray(promises);
      var promise = ret.promise();
      ret.setHowMany(1);
      ret.setUnwrap();
      ret.init();
      return promise;
    }
    Promise2.any = function(promises) {
      return any(promises);
    };
    Promise2.prototype.any = function() {
      return any(this);
    };
  };
});

// node_modules/bluebird/js/release/each.js
var require_each = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL) {
    var PromiseReduce = Promise2.reduce;
    var PromiseAll = Promise2.all;
    function promiseAllThis() {
      return PromiseAll(this);
    }
    function PromiseMapSeries(promises, fn) {
      return PromiseReduce(promises, fn, INTERNAL, INTERNAL);
    }
    Promise2.prototype.each = function(fn) {
      return PromiseReduce(this, fn, INTERNAL, 0)._then(promiseAllThis, undefined, undefined, this, undefined);
    };
    Promise2.prototype.mapSeries = function(fn) {
      return PromiseReduce(this, fn, INTERNAL, INTERNAL);
    };
    Promise2.each = function(promises, fn) {
      return PromiseReduce(promises, fn, INTERNAL, 0)._then(promiseAllThis, undefined, undefined, promises, undefined);
    };
    Promise2.mapSeries = PromiseMapSeries;
  };
});

// node_modules/bluebird/js/release/filter.js
var require_filter = __commonJS((exports, module) => {
  module.exports = function(Promise2, INTERNAL) {
    var PromiseMap = Promise2.map;
    Promise2.prototype.filter = function(fn, options) {
      return PromiseMap(this, fn, options, INTERNAL);
    };
    Promise2.filter = function(promises, fn, options) {
      return PromiseMap(promises, fn, options, INTERNAL);
    };
  };
});

// node_modules/bluebird/js/release/promise.js
var require_promise = __commonJS((exports, module) => {
  module.exports = function() {
    var makeSelfResolutionError = function() {
      return new TypeError2(`circular promise resolution chain

    See http://goo.gl/MqrFmX
`);
    };
    var reflectHandler = function() {
      return new Promise2.PromiseInspection(this._target());
    };
    var apiRejection = function(msg) {
      return Promise2.reject(new TypeError2(msg));
    };
    function Proxyable() {
    }
    var UNDEFINED_BINDING = {};
    var util2 = require_util2();
    util2.setReflectHandler(reflectHandler);
    var getDomain = function() {
      var domain = process.domain;
      if (domain === undefined) {
        return null;
      }
      return domain;
    };
    var getContextDefault = function() {
      return null;
    };
    var getContextDomain = function() {
      return {
        domain: getDomain(),
        async: null
      };
    };
    var AsyncResource = util2.isNode && util2.nodeSupportsAsyncResource ? __require("async_hooks").AsyncResource : null;
    var getContextAsyncHooks = function() {
      return {
        domain: getDomain(),
        async: new AsyncResource("Bluebird::Promise")
      };
    };
    var getContext = util2.isNode ? getContextDomain : getContextDefault;
    util2.notEnumerableProp(Promise2, "_getContext", getContext);
    var enableAsyncHooks = function() {
      getContext = getContextAsyncHooks;
      util2.notEnumerableProp(Promise2, "_getContext", getContextAsyncHooks);
    };
    var disableAsyncHooks = function() {
      getContext = getContextDomain;
      util2.notEnumerableProp(Promise2, "_getContext", getContextDomain);
    };
    var es5 = require_es5();
    var Async = require_async2();
    var async = new Async;
    es5.defineProperty(Promise2, "_async", { value: async });
    var errors = require_errors2();
    var TypeError2 = Promise2.TypeError = errors.TypeError;
    Promise2.RangeError = errors.RangeError;
    var CancellationError = Promise2.CancellationError = errors.CancellationError;
    Promise2.TimeoutError = errors.TimeoutError;
    Promise2.OperationalError = errors.OperationalError;
    Promise2.RejectionError = errors.OperationalError;
    Promise2.AggregateError = errors.AggregateError;
    var INTERNAL = function() {
    };
    var APPLY = {};
    var NEXT_FILTER = {};
    var tryConvertToPromise = require_thenables()(Promise2, INTERNAL);
    var PromiseArray = require_promise_array()(Promise2, INTERNAL, tryConvertToPromise, apiRejection, Proxyable);
    var Context = require_context()(Promise2);
    var createContext = Context.create;
    var debug = require_debuggability()(Promise2, Context, enableAsyncHooks, disableAsyncHooks);
    var CapturedTrace = debug.CapturedTrace;
    var PassThroughHandlerContext = require_finally()(Promise2, tryConvertToPromise, NEXT_FILTER);
    var catchFilter = require_catch_filter()(NEXT_FILTER);
    var nodebackForPromise = require_nodeback();
    var errorObj = util2.errorObj;
    var tryCatch = util2.tryCatch;
    function check(self2, executor) {
      if (self2 == null || self2.constructor !== Promise2) {
        throw new TypeError2(`the promise constructor cannot be invoked directly

    See http://goo.gl/MqrFmX
`);
      }
      if (typeof executor !== "function") {
        throw new TypeError2("expecting a function but got " + util2.classString(executor));
      }
    }
    function Promise2(executor) {
      if (executor !== INTERNAL) {
        check(this, executor);
      }
      this._bitField = 0;
      this._fulfillmentHandler0 = undefined;
      this._rejectionHandler0 = undefined;
      this._promise0 = undefined;
      this._receiver0 = undefined;
      this._resolveFromExecutor(executor);
      this._promiseCreated();
      this._fireEvent("promiseCreated", this);
    }
    Promise2.prototype.toString = function() {
      return "[object Promise]";
    };
    Promise2.prototype.caught = Promise2.prototype["catch"] = function(fn) {
      var len = arguments.length;
      if (len > 1) {
        var catchInstances = new Array(len - 1), j = 0, i;
        for (i = 0;i < len - 1; ++i) {
          var item = arguments[i];
          if (util2.isObject(item)) {
            catchInstances[j++] = item;
          } else {
            return apiRejection("Catch statement predicate: expecting an object but got " + util2.classString(item));
          }
        }
        catchInstances.length = j;
        fn = arguments[i];
        if (typeof fn !== "function") {
          throw new TypeError2("The last argument to .catch() must be a function, got " + util2.toString(fn));
        }
        return this.then(undefined, catchFilter(catchInstances, fn, this));
      }
      return this.then(undefined, fn);
    };
    Promise2.prototype.reflect = function() {
      return this._then(reflectHandler, reflectHandler, undefined, this, undefined);
    };
    Promise2.prototype.then = function(didFulfill, didReject) {
      if (debug.warnings() && arguments.length > 0 && typeof didFulfill !== "function" && typeof didReject !== "function") {
        var msg = ".then() only accepts functions but was passed: " + util2.classString(didFulfill);
        if (arguments.length > 1) {
          msg += ", " + util2.classString(didReject);
        }
        this._warn(msg);
      }
      return this._then(didFulfill, didReject, undefined, undefined, undefined);
    };
    Promise2.prototype.done = function(didFulfill, didReject) {
      var promise = this._then(didFulfill, didReject, undefined, undefined, undefined);
      promise._setIsFinal();
    };
    Promise2.prototype.spread = function(fn) {
      if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util2.classString(fn));
      }
      return this.all()._then(fn, undefined, undefined, APPLY, undefined);
    };
    Promise2.prototype.toJSON = function() {
      var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: undefined,
        rejectionReason: undefined
      };
      if (this.isFulfilled()) {
        ret.fulfillmentValue = this.value();
        ret.isFulfilled = true;
      } else if (this.isRejected()) {
        ret.rejectionReason = this.reason();
        ret.isRejected = true;
      }
      return ret;
    };
    Promise2.prototype.all = function() {
      if (arguments.length > 0) {
        this._warn(".all() was passed arguments but it does not take any");
      }
      return new PromiseArray(this).promise();
    };
    Promise2.prototype.error = function(fn) {
      return this.caught(util2.originatesFromRejection, fn);
    };
    Promise2.getNewLibraryCopy = module.exports;
    Promise2.is = function(val) {
      return val instanceof Promise2;
    };
    Promise2.fromNode = Promise2.fromCallback = function(fn) {
      var ret = new Promise2(INTERNAL);
      ret._captureStackTrace();
      var multiArgs = arguments.length > 1 ? !!Object(arguments[1]).multiArgs : false;
      var result = tryCatch(fn)(nodebackForPromise(ret, multiArgs));
      if (result === errorObj) {
        ret._rejectCallback(result.e, true);
      }
      if (!ret._isFateSealed())
        ret._setAsyncGuaranteed();
      return ret;
    };
    Promise2.all = function(promises) {
      return new PromiseArray(promises).promise();
    };
    Promise2.cast = function(obj) {
      var ret = tryConvertToPromise(obj);
      if (!(ret instanceof Promise2)) {
        ret = new Promise2(INTERNAL);
        ret._captureStackTrace();
        ret._setFulfilled();
        ret._rejectionHandler0 = obj;
      }
      return ret;
    };
    Promise2.resolve = Promise2.fulfilled = Promise2.cast;
    Promise2.reject = Promise2.rejected = function(reason) {
      var ret = new Promise2(INTERNAL);
      ret._captureStackTrace();
      ret._rejectCallback(reason, true);
      return ret;
    };
    Promise2.setScheduler = function(fn) {
      if (typeof fn !== "function") {
        throw new TypeError2("expecting a function but got " + util2.classString(fn));
      }
      return async.setScheduler(fn);
    };
    Promise2.prototype._then = function(didFulfill, didReject, _, receiver, internalData) {
      var haveInternalData = internalData !== undefined;
      var promise = haveInternalData ? internalData : new Promise2(INTERNAL);
      var target = this._target();
      var bitField = target._bitField;
      if (!haveInternalData) {
        promise._propagateFrom(this, 3);
        promise._captureStackTrace();
        if (receiver === undefined && (this._bitField & 2097152) !== 0) {
          if (!((bitField & 50397184) === 0)) {
            receiver = this._boundValue();
          } else {
            receiver = target === this ? undefined : this._boundTo;
          }
        }
        this._fireEvent("promiseChained", this, promise);
      }
      var context = getContext();
      if (!((bitField & 50397184) === 0)) {
        var handler, value, settler = target._settlePromiseCtx;
        if ((bitField & 33554432) !== 0) {
          value = target._rejectionHandler0;
          handler = didFulfill;
        } else if ((bitField & 16777216) !== 0) {
          value = target._fulfillmentHandler0;
          handler = didReject;
          target._unsetRejectionIsUnhandled();
        } else {
          settler = target._settlePromiseLateCancellationObserver;
          value = new CancellationError("late cancellation observer");
          target._attachExtraTrace(value);
          handler = didReject;
        }
        async.invoke(settler, target, {
          handler: util2.contextBind(context, handler),
          promise,
          receiver,
          value
        });
      } else {
        target._addCallbacks(didFulfill, didReject, promise, receiver, context);
      }
      return promise;
    };
    Promise2.prototype._length = function() {
      return this._bitField & 65535;
    };
    Promise2.prototype._isFateSealed = function() {
      return (this._bitField & 117506048) !== 0;
    };
    Promise2.prototype._isFollowing = function() {
      return (this._bitField & 67108864) === 67108864;
    };
    Promise2.prototype._setLength = function(len) {
      this._bitField = this._bitField & -65536 | len & 65535;
    };
    Promise2.prototype._setFulfilled = function() {
      this._bitField = this._bitField | 33554432;
      this._fireEvent("promiseFulfilled", this);
    };
    Promise2.prototype._setRejected = function() {
      this._bitField = this._bitField | 16777216;
      this._fireEvent("promiseRejected", this);
    };
    Promise2.prototype._setFollowing = function() {
      this._bitField = this._bitField | 67108864;
      this._fireEvent("promiseResolved", this);
    };
    Promise2.prototype._setIsFinal = function() {
      this._bitField = this._bitField | 4194304;
    };
    Promise2.prototype._isFinal = function() {
      return (this._bitField & 4194304) > 0;
    };
    Promise2.prototype._unsetCancelled = function() {
      this._bitField = this._bitField & ~65536;
    };
    Promise2.prototype._setCancelled = function() {
      this._bitField = this._bitField | 65536;
      this._fireEvent("promiseCancelled", this);
    };
    Promise2.prototype._setWillBeCancelled = function() {
      this._bitField = this._bitField | 8388608;
    };
    Promise2.prototype._setAsyncGuaranteed = function() {
      if (async.hasCustomScheduler())
        return;
      var bitField = this._bitField;
      this._bitField = bitField | (bitField & 536870912) >> 2 ^ 134217728;
    };
    Promise2.prototype._setNoAsyncGuarantee = function() {
      this._bitField = (this._bitField | 536870912) & ~134217728;
    };
    Promise2.prototype._receiverAt = function(index) {
      var ret = index === 0 ? this._receiver0 : this[index * 4 - 4 + 3];
      if (ret === UNDEFINED_BINDING) {
        return;
      } else if (ret === undefined && this._isBound()) {
        return this._boundValue();
      }
      return ret;
    };
    Promise2.prototype._promiseAt = function(index) {
      return this[index * 4 - 4 + 2];
    };
    Promise2.prototype._fulfillmentHandlerAt = function(index) {
      return this[index * 4 - 4 + 0];
    };
    Promise2.prototype._rejectionHandlerAt = function(index) {
      return this[index * 4 - 4 + 1];
    };
    Promise2.prototype._boundValue = function() {
    };
    Promise2.prototype._migrateCallback0 = function(follower) {
      var bitField = follower._bitField;
      var fulfill = follower._fulfillmentHandler0;
      var reject = follower._rejectionHandler0;
      var promise = follower._promise0;
      var receiver = follower._receiverAt(0);
      if (receiver === undefined)
        receiver = UNDEFINED_BINDING;
      this._addCallbacks(fulfill, reject, promise, receiver, null);
    };
    Promise2.prototype._migrateCallbackAt = function(follower, index) {
      var fulfill = follower._fulfillmentHandlerAt(index);
      var reject = follower._rejectionHandlerAt(index);
      var promise = follower._promiseAt(index);
      var receiver = follower._receiverAt(index);
      if (receiver === undefined)
        receiver = UNDEFINED_BINDING;
      this._addCallbacks(fulfill, reject, promise, receiver, null);
    };
    Promise2.prototype._addCallbacks = function(fulfill, reject, promise, receiver, context) {
      var index = this._length();
      if (index >= 65535 - 4) {
        index = 0;
        this._setLength(0);
      }
      if (index === 0) {
        this._promise0 = promise;
        this._receiver0 = receiver;
        if (typeof fulfill === "function") {
          this._fulfillmentHandler0 = util2.contextBind(context, fulfill);
        }
        if (typeof reject === "function") {
          this._rejectionHandler0 = util2.contextBind(context, reject);
        }
      } else {
        var base = index * 4 - 4;
        this[base + 2] = promise;
        this[base + 3] = receiver;
        if (typeof fulfill === "function") {
          this[base + 0] = util2.contextBind(context, fulfill);
        }
        if (typeof reject === "function") {
          this[base + 1] = util2.contextBind(context, reject);
        }
      }
      this._setLength(index + 1);
      return index;
    };
    Promise2.prototype._proxy = function(proxyable, arg) {
      this._addCallbacks(undefined, undefined, arg, proxyable, null);
    };
    Promise2.prototype._resolveCallback = function(value, shouldBind) {
      if ((this._bitField & 117506048) !== 0)
        return;
      if (value === this)
        return this._rejectCallback(makeSelfResolutionError(), false);
      var maybePromise = tryConvertToPromise(value, this);
      if (!(maybePromise instanceof Promise2))
        return this._fulfill(value);
      if (shouldBind)
        this._propagateFrom(maybePromise, 2);
      var promise = maybePromise._target();
      if (promise === this) {
        this._reject(makeSelfResolutionError());
        return;
      }
      var bitField = promise._bitField;
      if ((bitField & 50397184) === 0) {
        var len = this._length();
        if (len > 0)
          promise._migrateCallback0(this);
        for (var i = 1;i < len; ++i) {
          promise._migrateCallbackAt(this, i);
        }
        this._setFollowing();
        this._setLength(0);
        this._setFollowee(maybePromise);
      } else if ((bitField & 33554432) !== 0) {
        this._fulfill(promise._value());
      } else if ((bitField & 16777216) !== 0) {
        this._reject(promise._reason());
      } else {
        var reason = new CancellationError("late cancellation observer");
        promise._attachExtraTrace(reason);
        this._reject(reason);
      }
    };
    Promise2.prototype._rejectCallback = function(reason, synchronous, ignoreNonErrorWarnings) {
      var trace = util2.ensureErrorObject(reason);
      var hasStack = trace === reason;
      if (!hasStack && !ignoreNonErrorWarnings && debug.warnings()) {
        var message = "a promise was rejected with a non-error: " + util2.classString(reason);
        this._warn(message, true);
      }
      this._attachExtraTrace(trace, synchronous ? hasStack : false);
      this._reject(reason);
    };
    Promise2.prototype._resolveFromExecutor = function(executor) {
      if (executor === INTERNAL)
        return;
      var promise = this;
      this._captureStackTrace();
      this._pushContext();
      var synchronous = true;
      var r = this._execute(executor, function(value) {
        promise._resolveCallback(value);
      }, function(reason) {
        promise._rejectCallback(reason, synchronous);
      });
      synchronous = false;
      this._popContext();
      if (r !== undefined) {
        promise._rejectCallback(r, true);
      }
    };
    Promise2.prototype._settlePromiseFromHandler = function(handler, receiver, value, promise) {
      var bitField = promise._bitField;
      if ((bitField & 65536) !== 0)
        return;
      promise._pushContext();
      var x;
      if (receiver === APPLY) {
        if (!value || typeof value.length !== "number") {
          x = errorObj;
          x.e = new TypeError2("cannot .spread() a non-array: " + util2.classString(value));
        } else {
          x = tryCatch(handler).apply(this._boundValue(), value);
        }
      } else {
        x = tryCatch(handler).call(receiver, value);
      }
      var promiseCreated = promise._popContext();
      bitField = promise._bitField;
      if ((bitField & 65536) !== 0)
        return;
      if (x === NEXT_FILTER) {
        promise._reject(value);
      } else if (x === errorObj) {
        promise._rejectCallback(x.e, false);
      } else {
        debug.checkForgottenReturns(x, promiseCreated, "", promise, this);
        promise._resolveCallback(x);
      }
    };
    Promise2.prototype._target = function() {
      var ret = this;
      while (ret._isFollowing())
        ret = ret._followee();
      return ret;
    };
    Promise2.prototype._followee = function() {
      return this._rejectionHandler0;
    };
    Promise2.prototype._setFollowee = function(promise) {
      this._rejectionHandler0 = promise;
    };
    Promise2.prototype._settlePromise = function(promise, handler, receiver, value) {
      var isPromise = promise instanceof Promise2;
      var bitField = this._bitField;
      var asyncGuaranteed = (bitField & 134217728) !== 0;
      if ((bitField & 65536) !== 0) {
        if (isPromise)
          promise._invokeInternalOnCancel();
        if (receiver instanceof PassThroughHandlerContext && receiver.isFinallyHandler()) {
          receiver.cancelPromise = promise;
          if (tryCatch(handler).call(receiver, value) === errorObj) {
            promise._reject(errorObj.e);
          }
        } else if (handler === reflectHandler) {
          promise._fulfill(reflectHandler.call(receiver));
        } else if (receiver instanceof Proxyable) {
          receiver._promiseCancelled(promise);
        } else if (isPromise || promise instanceof PromiseArray) {
          promise._cancel();
        } else {
          receiver.cancel();
        }
      } else if (typeof handler === "function") {
        if (!isPromise) {
          handler.call(receiver, value, promise);
        } else {
          if (asyncGuaranteed)
            promise._setAsyncGuaranteed();
          this._settlePromiseFromHandler(handler, receiver, value, promise);
        }
      } else if (receiver instanceof Proxyable) {
        if (!receiver._isResolved()) {
          if ((bitField & 33554432) !== 0) {
            receiver._promiseFulfilled(value, promise);
          } else {
            receiver._promiseRejected(value, promise);
          }
        }
      } else if (isPromise) {
        if (asyncGuaranteed)
          promise._setAsyncGuaranteed();
        if ((bitField & 33554432) !== 0) {
          promise._fulfill(value);
        } else {
          promise._reject(value);
        }
      }
    };
    Promise2.prototype._settlePromiseLateCancellationObserver = function(ctx) {
      var handler = ctx.handler;
      var promise = ctx.promise;
      var receiver = ctx.receiver;
      var value = ctx.value;
      if (typeof handler === "function") {
        if (!(promise instanceof Promise2)) {
          handler.call(receiver, value, promise);
        } else {
          this._settlePromiseFromHandler(handler, receiver, value, promise);
        }
      } else if (promise instanceof Promise2) {
        promise._reject(value);
      }
    };
    Promise2.prototype._settlePromiseCtx = function(ctx) {
      this._settlePromise(ctx.promise, ctx.handler, ctx.receiver, ctx.value);
    };
    Promise2.prototype._settlePromise0 = function(handler, value, bitField) {
      var promise = this._promise0;
      var receiver = this._receiverAt(0);
      this._promise0 = undefined;
      this._receiver0 = undefined;
      this._settlePromise(promise, handler, receiver, value);
    };
    Promise2.prototype._clearCallbackDataAtIndex = function(index) {
      var base = index * 4 - 4;
      this[base + 2] = this[base + 3] = this[base + 0] = this[base + 1] = undefined;
    };
    Promise2.prototype._fulfill = function(value) {
      var bitField = this._bitField;
      if ((bitField & 117506048) >>> 16)
        return;
      if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._reject(err);
      }
      this._setFulfilled();
      this._rejectionHandler0 = value;
      if ((bitField & 65535) > 0) {
        if ((bitField & 134217728) !== 0) {
          this._settlePromises();
        } else {
          async.settlePromises(this);
        }
        this._dereferenceTrace();
      }
    };
    Promise2.prototype._reject = function(reason) {
      var bitField = this._bitField;
      if ((bitField & 117506048) >>> 16)
        return;
      this._setRejected();
      this._fulfillmentHandler0 = reason;
      if (this._isFinal()) {
        return async.fatalError(reason, util2.isNode);
      }
      if ((bitField & 65535) > 0) {
        async.settlePromises(this);
      } else {
        this._ensurePossibleRejectionHandled();
      }
    };
    Promise2.prototype._fulfillPromises = function(len, value) {
      for (var i = 1;i < len; i++) {
        var handler = this._fulfillmentHandlerAt(i);
        var promise = this._promiseAt(i);
        var receiver = this._receiverAt(i);
        this._clearCallbackDataAtIndex(i);
        this._settlePromise(promise, handler, receiver, value);
      }
    };
    Promise2.prototype._rejectPromises = function(len, reason) {
      for (var i = 1;i < len; i++) {
        var handler = this._rejectionHandlerAt(i);
        var promise = this._promiseAt(i);
        var receiver = this._receiverAt(i);
        this._clearCallbackDataAtIndex(i);
        this._settlePromise(promise, handler, receiver, reason);
      }
    };
    Promise2.prototype._settlePromises = function() {
      var bitField = this._bitField;
      var len = bitField & 65535;
      if (len > 0) {
        if ((bitField & 16842752) !== 0) {
          var reason = this._fulfillmentHandler0;
          this._settlePromise0(this._rejectionHandler0, reason, bitField);
          this._rejectPromises(len, reason);
        } else {
          var value = this._rejectionHandler0;
          this._settlePromise0(this._fulfillmentHandler0, value, bitField);
          this._fulfillPromises(len, value);
        }
        this._setLength(0);
      }
      this._clearCancellationData();
    };
    Promise2.prototype._settledValue = function() {
      var bitField = this._bitField;
      if ((bitField & 33554432) !== 0) {
        return this._rejectionHandler0;
      } else if ((bitField & 16777216) !== 0) {
        return this._fulfillmentHandler0;
      }
    };
    if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
      es5.defineProperty(Promise2.prototype, Symbol.toStringTag, {
        get: function() {
          return "Object";
        }
      });
    }
    function deferResolve(v) {
      this.promise._resolveCallback(v);
    }
    function deferReject(v) {
      this.promise._rejectCallback(v, false);
    }
    Promise2.defer = Promise2.pending = function() {
      debug.deprecated("Promise.defer", "new Promise");
      var promise = new Promise2(INTERNAL);
      return {
        promise,
        resolve: deferResolve,
        reject: deferReject
      };
    };
    util2.notEnumerableProp(Promise2, "_makeSelfResolutionError", makeSelfResolutionError);
    require_method()(Promise2, INTERNAL, tryConvertToPromise, apiRejection, debug);
    require_bind()(Promise2, INTERNAL, tryConvertToPromise, debug);
    require_cancel()(Promise2, PromiseArray, apiRejection, debug);
    require_direct_resolve()(Promise2);
    require_synchronous_inspection()(Promise2);
    require_join()(Promise2, PromiseArray, tryConvertToPromise, INTERNAL, async);
    Promise2.Promise = Promise2;
    Promise2.version = "3.7.2";
    require_call_get()(Promise2);
    require_generators()(Promise2, apiRejection, INTERNAL, tryConvertToPromise, Proxyable, debug);
    require_map()(Promise2, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL, debug);
    require_nodeify()(Promise2);
    require_promisify()(Promise2, INTERNAL);
    require_props()(Promise2, PromiseArray, tryConvertToPromise, apiRejection);
    require_race()(Promise2, INTERNAL, tryConvertToPromise, apiRejection);
    require_reduce()(Promise2, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL, debug);
    require_settle()(Promise2, PromiseArray, debug);
    require_some()(Promise2, PromiseArray, apiRejection);
    require_timers()(Promise2, INTERNAL, debug);
    require_using()(Promise2, apiRejection, tryConvertToPromise, createContext, INTERNAL, debug);
    require_any()(Promise2);
    require_each()(Promise2, INTERNAL);
    require_filter()(Promise2, INTERNAL);
    util2.toFastProperties(Promise2);
    util2.toFastProperties(Promise2.prototype);
    function fillTypes(value) {
      var p = new Promise2(INTERNAL);
      p._fulfillmentHandler0 = value;
      p._rejectionHandler0 = value;
      p._promise0 = value;
      p._receiver0 = value;
    }
    fillTypes({ a: 1 });
    fillTypes({ b: 2 });
    fillTypes({ c: 3 });
    fillTypes(1);
    fillTypes(function() {
    });
    fillTypes(undefined);
    fillTypes(false);
    fillTypes(new Promise2(INTERNAL));
    debug.setBounds(Async.firstLineError, util2.lastLineError);
    return Promise2;
  };
});

// node_modules/bluebird/js/release/bluebird.js
var require_bluebird = __commonJS((exports, module) => {
  var noConflict = function() {
    try {
      if (Promise === bluebird)
        Promise = old;
    } catch (e) {
    }
    return bluebird;
  };
  var old;
  if (typeof Promise !== "undefined")
    old = Promise;
  var bluebird = require_promise()();
  bluebird.noConflict = noConflict;
  module.exports = bluebird;
});

// node_modules/csvtojson/v2/Processor.js
var require_Processor = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var Processor = function() {
    function Processor2(converter) {
      this.converter = converter;
      this.params = converter.parseParam;
      this.runtime = converter.parseRuntime;
    }
    return Processor2;
  }();
  exports.Processor = Processor;
});

// node_modules/is-utf8/is-utf8.js
var require_is_utf8 = __commonJS((exports, module) => {
  exports = module.exports = function(bytes) {
    var i = 0;
    while (i < bytes.length) {
      if (bytes[i] == 9 || bytes[i] == 10 || bytes[i] == 13 || 32 <= bytes[i] && bytes[i] <= 126) {
        i += 1;
        continue;
      }
      if (194 <= bytes[i] && bytes[i] <= 223 && (128 <= bytes[i + 1] && bytes[i + 1] <= 191)) {
        i += 2;
        continue;
      }
      if (bytes[i] == 224 && (160 <= bytes[i + 1] && bytes[i + 1] <= 191) && (128 <= bytes[i + 2] && bytes[i + 2] <= 191) || (225 <= bytes[i] && bytes[i] <= 236 || bytes[i] == 238 || bytes[i] == 239) && (128 <= bytes[i + 1] && bytes[i + 1] <= 191) && (128 <= bytes[i + 2] && bytes[i + 2] <= 191) || bytes[i] == 237 && (128 <= bytes[i + 1] && bytes[i + 1] <= 159) && (128 <= bytes[i + 2] && bytes[i + 2] <= 191)) {
        i += 3;
        continue;
      }
      if (bytes[i] == 240 && (144 <= bytes[i + 1] && bytes[i + 1] <= 191) && (128 <= bytes[i + 2] && bytes[i + 2] <= 191) && (128 <= bytes[i + 3] && bytes[i + 3] <= 191) || 241 <= bytes[i] && bytes[i] <= 243 && (128 <= bytes[i + 1] && bytes[i + 1] <= 191) && (128 <= bytes[i + 2] && bytes[i + 2] <= 191) && (128 <= bytes[i + 3] && bytes[i + 3] <= 191) || bytes[i] == 244 && (128 <= bytes[i + 1] && bytes[i + 1] <= 143) && (128 <= bytes[i + 2] && bytes[i + 2] <= 191) && (128 <= bytes[i + 3] && bytes[i + 3] <= 191)) {
        i += 4;
        continue;
      }
      return false;
    }
    return true;
  };
});

// node_modules/strip-bom/index.js
var require_strip_bom = __commonJS((exports, module) => {
  var isUtf8 = require_is_utf8();
  module.exports = function(x) {
    if (typeof x === "string" && x.charCodeAt(0) === 65279) {
      return x.slice(1);
    }
    if (Buffer.isBuffer(x) && isUtf8(x) && x[0] === 239 && x[1] === 187 && x[2] === 191) {
      return x.slice(3);
    }
    return x;
  };
});

// node_modules/csvtojson/v2/dataClean.js
var require_dataClean = __commonJS((exports) => {
  var prepareData = function(chunk, runtime) {
    var workChunk = concatLeftChunk(chunk, runtime);
    runtime.csvLineBuffer = undefined;
    var cleanCSVString = cleanUtf8Split(workChunk, runtime).toString("utf8");
    if (runtime.started === false) {
      return strip_bom_1.default(cleanCSVString);
    } else {
      return cleanCSVString;
    }
  };
  var concatLeftChunk = function(chunk, runtime) {
    if (runtime.csvLineBuffer && runtime.csvLineBuffer.length > 0) {
      return Buffer.concat([runtime.csvLineBuffer, chunk]);
    } else {
      return chunk;
    }
  };
  var cleanUtf8Split = function(chunk, runtime) {
    var idx = chunk.length - 1;
    if ((chunk[idx] & 1 << 7) != 0) {
      while ((chunk[idx] & 3 << 6) === 128) {
        idx--;
      }
      idx--;
    }
    if (idx != chunk.length - 1) {
      runtime.csvLineBuffer = chunk.slice(idx + 1);
      return chunk.slice(0, idx + 1);
    } else {
      return chunk;
    }
  };
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var strip_bom_1 = __importDefault(require_strip_bom());
  exports.prepareData = prepareData;
});

// node_modules/csvtojson/v2/getEol.js
var require_getEol = __commonJS((exports) => {
  var default_1 = function(data4, param) {
    if (!param.eol && data4) {
      for (var i = 0, len = data4.length;i < len; i++) {
        if (data4[i] === "\r") {
          if (data4[i + 1] === "\n") {
            param.eol = "\r\n";
            break;
          } else if (data4[i + 1]) {
            param.eol = "\r";
            break;
          }
        } else if (data4[i] === "\n") {
          param.eol = "\n";
          break;
        }
      }
    }
    return param.eol || "\n";
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.default = default_1;
});

// node_modules/csvtojson/v2/fileline.js
var require_fileline = __commonJS((exports) => {
  var stringToLines = function(data4, param) {
    var eol = getEol_1.default(data4, param);
    var lines = data4.split(eol);
    var partial = lines.pop() || "";
    return { lines, partial };
  };
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var getEol_1 = __importDefault(require_getEol());
  exports.stringToLines = stringToLines;
});

// node_modules/csvtojson/v2/util.js
var require_util3 = __commonJS((exports) => {
  var bufFromString = function(str) {
    var length = Buffer.byteLength(str);
    var buffer = Buffer.allocUnsafe ? Buffer.allocUnsafe(length) : new Buffer(length);
    buffer.write(str);
    return buffer;
  };
  var emptyBuffer = function() {
    var buffer = Buffer.allocUnsafe ? Buffer.allocUnsafe(0) : new Buffer(0);
    return buffer;
  };
  var filterArray = function(arr, filter2) {
    var rtn = [];
    for (var i = 0;i < arr.length; i++) {
      if (filter2.indexOf(i) > -1) {
        rtn.push(arr[i]);
      }
    }
    return rtn;
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.bufFromString = bufFromString;
  exports.emptyBuffer = emptyBuffer;
  exports.filterArray = filterArray;
  exports.trimLeft = String.prototype.trimLeft ? function trimLeftNative(str) {
    return str.trimLeft();
  } : function trimLeftRegExp(str) {
    return str.replace(/^\s+/, "");
  };
  exports.trimRight = String.prototype.trimRight ? function trimRightNative(str) {
    return str.trimRight();
  } : function trimRightRegExp(str) {
    return str.replace(/\s+$/, "");
  };
});

// node_modules/csvtojson/v2/rowSplit.js
var require_rowSplit = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var getEol_1 = __importDefault(require_getEol());
  var util_1 = require_util3();
  var defaulDelimiters = [",", "|", "\t", ";", ":"];
  var RowSplit = function() {
    function RowSplit2(conv) {
      this.conv = conv;
      this.cachedRegExp = {};
      this.delimiterEmitted = false;
      this._needEmitDelimiter = undefined;
      this.quote = conv.parseParam.quote;
      this.trim = conv.parseParam.trim;
      this.escape = conv.parseParam.escape;
    }
    Object.defineProperty(RowSplit2.prototype, "needEmitDelimiter", {
      get: function() {
        if (this._needEmitDelimiter === undefined) {
          this._needEmitDelimiter = this.conv.listeners("delimiter").length > 0;
        }
        return this._needEmitDelimiter;
      },
      enumerable: true,
      configurable: true
    });
    RowSplit2.prototype.parse = function(fileline) {
      if (fileline.length === 0 || this.conv.parseParam.ignoreEmpty && fileline.trim().length === 0) {
        return { cells: [], closed: true };
      }
      var quote = this.quote;
      var trim2 = this.trim;
      var escape = this.escape;
      if (this.conv.parseRuntime.delimiter instanceof Array || this.conv.parseRuntime.delimiter.toLowerCase() === "auto") {
        this.conv.parseRuntime.delimiter = this.getDelimiter(fileline);
      }
      if (this.needEmitDelimiter && !this.delimiterEmitted) {
        this.conv.emit("delimiter", this.conv.parseRuntime.delimiter);
        this.delimiterEmitted = true;
      }
      var delimiter = this.conv.parseRuntime.delimiter;
      var rowArr = fileline.split(delimiter);
      if (quote === "off") {
        if (trim2) {
          for (var i = 0;i < rowArr.length; i++) {
            rowArr[i] = rowArr[i].trim();
          }
        }
        return { cells: rowArr, closed: true };
      } else {
        return this.toCSVRow(rowArr, trim2, quote, delimiter);
      }
    };
    RowSplit2.prototype.toCSVRow = function(rowArr, trim2, quote, delimiter) {
      var row = [];
      var inquote = false;
      var quoteBuff = "";
      for (var i = 0, rowLen = rowArr.length;i < rowLen; i++) {
        var e = rowArr[i];
        if (!inquote && trim2) {
          e = util_1.trimLeft(e);
        }
        var len = e.length;
        if (!inquote) {
          if (len === 2 && e === this.quote + this.quote) {
            row.push("");
            continue;
          } else if (this.isQuoteOpen(e)) {
            e = e.substr(1);
            if (this.isQuoteClose(e)) {
              e = e.substring(0, e.lastIndexOf(quote));
              e = this.escapeQuote(e);
              row.push(e);
              continue;
            } else if (e.indexOf(quote) !== -1) {
              var count = 0;
              var prev = "";
              for (var _i = 0, e_1 = e;_i < e_1.length; _i++) {
                var c = e_1[_i];
                if (c === quote && prev !== this.escape) {
                  count++;
                  prev = "";
                } else {
                  prev = c;
                }
              }
              if (count % 2 === 1) {
                if (trim2) {
                  e = util_1.trimRight(e);
                }
                row.push(quote + e);
                continue;
              } else {
                inquote = true;
                quoteBuff += e;
                continue;
              }
            } else {
              inquote = true;
              quoteBuff += e;
              continue;
            }
          } else {
            if (trim2) {
              e = util_1.trimRight(e);
            }
            row.push(e);
            continue;
          }
        } else {
          if (this.isQuoteClose(e)) {
            inquote = false;
            e = e.substr(0, len - 1);
            quoteBuff += delimiter + e;
            quoteBuff = this.escapeQuote(quoteBuff);
            if (trim2) {
              quoteBuff = util_1.trimRight(quoteBuff);
            }
            row.push(quoteBuff);
            quoteBuff = "";
          } else {
            quoteBuff += delimiter + e;
          }
        }
      }
      return { cells: row, closed: !inquote };
    };
    RowSplit2.prototype.getDelimiter = function(fileline) {
      var checker;
      if (this.conv.parseParam.delimiter === "auto") {
        checker = defaulDelimiters;
      } else if (this.conv.parseParam.delimiter instanceof Array) {
        checker = this.conv.parseParam.delimiter;
      } else {
        return this.conv.parseParam.delimiter;
      }
      var count = 0;
      var rtn = ",";
      checker.forEach(function(delim) {
        var delimCount = fileline.split(delim).length;
        if (delimCount > count) {
          rtn = delim;
          count = delimCount;
        }
      });
      return rtn;
    };
    RowSplit2.prototype.isQuoteOpen = function(str) {
      var quote = this.quote;
      var escape = this.escape;
      return str[0] === quote && (str[1] !== quote || str[1] === escape && (str[2] === quote || str.length === 2));
    };
    RowSplit2.prototype.isQuoteClose = function(str) {
      var quote = this.quote;
      var escape = this.escape;
      if (this.conv.parseParam.trim) {
        str = util_1.trimRight(str);
      }
      var count = 0;
      var idx = str.length - 1;
      while (str[idx] === quote || str[idx] === escape) {
        idx--;
        count++;
      }
      return count % 2 !== 0;
    };
    RowSplit2.prototype.escapeQuote = function(segment) {
      var key = "es|" + this.quote + "|" + this.escape;
      if (this.cachedRegExp[key] === undefined) {
        this.cachedRegExp[key] = new RegExp("\\" + this.escape + "\\" + this.quote, "g");
      }
      var regExp = this.cachedRegExp[key];
      return segment.replace(regExp, this.quote);
    };
    RowSplit2.prototype.parseMultiLines = function(lines) {
      var csvLines = [];
      var left = "";
      while (lines.length) {
        var line = left + lines.shift();
        var row = this.parse(line);
        if (row.cells.length === 0 && this.conv.parseParam.ignoreEmpty) {
          continue;
        }
        if (row.closed || this.conv.parseParam.alwaysSplitAtEOL) {
          if (this.conv.parseRuntime.selectedColumns) {
            csvLines.push(util_1.filterArray(row.cells, this.conv.parseRuntime.selectedColumns));
          } else {
            csvLines.push(row.cells);
          }
          left = "";
        } else {
          left = line + (getEol_1.default(line, this.conv.parseRuntime) || "\n");
        }
      }
      return { rowsCells: csvLines, partial: left };
    };
    return RowSplit2;
  }();
  exports.RowSplit = RowSplit;
});

// node_modules/csvtojson/v2/CSVError.js
var require_CSVError = __commonJS((exports) => {
  var __extends = exports && exports.__extends || function() {
    var extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d, b) {
      d.__proto__ = b;
    } || function(d, b) {
      for (var p in b)
        if (b.hasOwnProperty(p))
          d[p] = b[p];
    };
    return function(d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __);
    };
  }();
  Object.defineProperty(exports, "__esModule", { value: true });
  var CSVError = function(_super) {
    __extends(CSVError2, _super);
    function CSVError2(err, line, extra) {
      var _this = _super.call(this, "Error: " + err + ". JSON Line number: " + line + (extra ? " near: " + extra : "")) || this;
      _this.err = err;
      _this.line = line;
      _this.extra = extra;
      _this.name = "CSV Parse Error";
      return _this;
    }
    CSVError2.column_mismatched = function(index, extra) {
      return new CSVError2("column_mismatched", index, extra);
    };
    CSVError2.unclosed_quote = function(index, extra) {
      return new CSVError2("unclosed_quote", index, extra);
    };
    CSVError2.fromJSON = function(obj) {
      return new CSVError2(obj.err, obj.line, obj.extra);
    };
    CSVError2.prototype.toJSON = function() {
      return {
        err: this.err,
        line: this.line,
        extra: this.extra
      };
    };
    return CSVError2;
  }(Error);
  exports.default = CSVError;
});

// node_modules/lodash/_freeGlobal.js
var require__freeGlobal = __commonJS((exports, module) => {
  var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
  module.exports = freeGlobal;
});

// node_modules/lodash/_root.js
var require__root = __commonJS((exports, module) => {
  var freeGlobal = require__freeGlobal();
  var freeSelf = typeof self == "object" && self && self.Object === Object && self;
  var root = freeGlobal || freeSelf || Function("return this")();
  module.exports = root;
});

// node_modules/lodash/_Symbol.js
var require__Symbol = __commonJS((exports, module) => {
  var root = require__root();
  var Symbol2 = root.Symbol;
  module.exports = Symbol2;
});

// node_modules/lodash/_getRawTag.js
var require__getRawTag = __commonJS((exports, module) => {
  var getRawTag = function(value) {
    var isOwn = hasOwnProperty2.call(value, symToStringTag), tag = value[symToStringTag];
    try {
      value[symToStringTag] = undefined;
      var unmasked = true;
    } catch (e) {
    }
    var result = nativeObjectToString.call(value);
    if (unmasked) {
      if (isOwn) {
        value[symToStringTag] = tag;
      } else {
        delete value[symToStringTag];
      }
    }
    return result;
  };
  var Symbol2 = require__Symbol();
  var objectProto = Object.prototype;
  var hasOwnProperty2 = objectProto.hasOwnProperty;
  var nativeObjectToString = objectProto.toString;
  var symToStringTag = Symbol2 ? Symbol2.toStringTag : undefined;
  module.exports = getRawTag;
});

// node_modules/lodash/_objectToString.js
var require__objectToString = __commonJS((exports, module) => {
  var objectToString = function(value) {
    return nativeObjectToString.call(value);
  };
  var objectProto = Object.prototype;
  var nativeObjectToString = objectProto.toString;
  module.exports = objectToString;
});

// node_modules/lodash/_baseGetTag.js
var require__baseGetTag = __commonJS((exports, module) => {
  var baseGetTag = function(value) {
    if (value == null) {
      return value === undefined ? undefinedTag : nullTag;
    }
    return symToStringTag && (symToStringTag in Object(value)) ? getRawTag(value) : objectToString(value);
  };
  var Symbol2 = require__Symbol();
  var getRawTag = require__getRawTag();
  var objectToString = require__objectToString();
  var nullTag = "[object Null]";
  var undefinedTag = "[object Undefined]";
  var symToStringTag = Symbol2 ? Symbol2.toStringTag : undefined;
  module.exports = baseGetTag;
});

// node_modules/lodash/isObject.js
var require_isObject = __commonJS((exports, module) => {
  var isObject2 = function(value) {
    var type = typeof value;
    return value != null && (type == "object" || type == "function");
  };
  module.exports = isObject2;
});

// node_modules/lodash/isFunction.js
var require_isFunction = __commonJS((exports, module) => {
  var isFunction2 = function(value) {
    if (!isObject2(value)) {
      return false;
    }
    var tag = baseGetTag(value);
    return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
  };
  var baseGetTag = require__baseGetTag();
  var isObject2 = require_isObject();
  var asyncTag = "[object AsyncFunction]";
  var funcTag = "[object Function]";
  var genTag = "[object GeneratorFunction]";
  var proxyTag = "[object Proxy]";
  module.exports = isFunction2;
});

// node_modules/lodash/_coreJsData.js
var require__coreJsData = __commonJS((exports, module) => {
  var root = require__root();
  var coreJsData = root["__core-js_shared__"];
  module.exports = coreJsData;
});

// node_modules/lodash/_isMasked.js
var require__isMasked = __commonJS((exports, module) => {
  var isMasked = function(func) {
    return !!maskSrcKey && (maskSrcKey in func);
  };
  var coreJsData = require__coreJsData();
  var maskSrcKey = function() {
    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
    return uid ? "Symbol(src)_1." + uid : "";
  }();
  module.exports = isMasked;
});

// node_modules/lodash/_toSource.js
var require__toSource = __commonJS((exports, module) => {
  var toSource = function(func) {
    if (func != null) {
      try {
        return funcToString.call(func);
      } catch (e) {
      }
      try {
        return func + "";
      } catch (e) {
      }
    }
    return "";
  };
  var funcProto = Function.prototype;
  var funcToString = funcProto.toString;
  module.exports = toSource;
});

// node_modules/lodash/_baseIsNative.js
var require__baseIsNative = __commonJS((exports, module) => {
  var baseIsNative = function(value) {
    if (!isObject2(value) || isMasked(value)) {
      return false;
    }
    var pattern = isFunction2(value) ? reIsNative : reIsHostCtor;
    return pattern.test(toSource(value));
  };
  var isFunction2 = require_isFunction();
  var isMasked = require__isMasked();
  var isObject2 = require_isObject();
  var toSource = require__toSource();
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  var reIsHostCtor = /^\[object .+?Constructor\]$/;
  var funcProto = Function.prototype;
  var objectProto = Object.prototype;
  var funcToString = funcProto.toString;
  var hasOwnProperty2 = objectProto.hasOwnProperty;
  var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty2).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
  module.exports = baseIsNative;
});

// node_modules/lodash/_getValue.js
var require__getValue = __commonJS((exports, module) => {
  var getValue = function(object, key) {
    return object == null ? undefined : object[key];
  };
  module.exports = getValue;
});

// node_modules/lodash/_getNative.js
var require__getNative = __commonJS((exports, module) => {
  var getNative = function(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : undefined;
  };
  var baseIsNative = require__baseIsNative();
  var getValue = require__getValue();
  module.exports = getNative;
});

// node_modules/lodash/_defineProperty.js
var require__defineProperty = __commonJS((exports, module) => {
  var getNative = require__getNative();
  var defineProperty = function() {
    try {
      var func = getNative(Object, "defineProperty");
      func({}, "", {});
      return func;
    } catch (e) {
    }
  }();
  module.exports = defineProperty;
});

// node_modules/lodash/_baseAssignValue.js
var require__baseAssignValue = __commonJS((exports, module) => {
  var baseAssignValue = function(object, key, value) {
    if (key == "__proto__" && defineProperty) {
      defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      });
    } else {
      object[key] = value;
    }
  };
  var defineProperty = require__defineProperty();
  module.exports = baseAssignValue;
});

// node_modules/lodash/eq.js
var require_eq = __commonJS((exports, module) => {
  var eq = function(value, other) {
    return value === other || value !== value && other !== other;
  };
  module.exports = eq;
});

// node_modules/lodash/_assignValue.js
var require__assignValue = __commonJS((exports, module) => {
  var assignValue = function(object, key, value) {
    var objValue = object[key];
    if (!(hasOwnProperty2.call(object, key) && eq(objValue, value)) || value === undefined && !(key in object)) {
      baseAssignValue(object, key, value);
    }
  };
  var baseAssignValue = require__baseAssignValue();
  var eq = require_eq();
  var objectProto = Object.prototype;
  var hasOwnProperty2 = objectProto.hasOwnProperty;
  module.exports = assignValue;
});

// node_modules/lodash/isArray.js
var require_isArray = __commonJS((exports, module) => {
  var isArray2 = Array.isArray;
  module.exports = isArray2;
});

// node_modules/lodash/isObjectLike.js
var require_isObjectLike = __commonJS((exports, module) => {
  var isObjectLike = function(value) {
    return value != null && typeof value == "object";
  };
  module.exports = isObjectLike;
});

// node_modules/lodash/isSymbol.js
var require_isSymbol = __commonJS((exports, module) => {
  var isSymbol = function(value) {
    return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
  };
  var baseGetTag = require__baseGetTag();
  var isObjectLike = require_isObjectLike();
  var symbolTag = "[object Symbol]";
  module.exports = isSymbol;
});

// node_modules/lodash/_isKey.js
var require__isKey = __commonJS((exports, module) => {
  var isKey = function(value, object) {
    if (isArray2(value)) {
      return false;
    }
    var type = typeof value;
    if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
      return true;
    }
    return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && (value in Object(object));
  };
  var isArray2 = require_isArray();
  var isSymbol = require_isSymbol();
  var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/;
  var reIsPlainProp = /^\w*$/;
  module.exports = isKey;
});

// node_modules/lodash/_nativeCreate.js
var require__nativeCreate = __commonJS((exports, module) => {
  var getNative = require__getNative();
  var nativeCreate = getNative(Object, "create");
  module.exports = nativeCreate;
});

// node_modules/lodash/_hashClear.js
var require__hashClear = __commonJS((exports, module) => {
  var hashClear = function() {
    this.__data__ = nativeCreate ? nativeCreate(null) : {};
    this.size = 0;
  };
  var nativeCreate = require__nativeCreate();
  module.exports = hashClear;
});

// node_modules/lodash/_hashDelete.js
var require__hashDelete = __commonJS((exports, module) => {
  var hashDelete = function(key) {
    var result = this.has(key) && delete this.__data__[key];
    this.size -= result ? 1 : 0;
    return result;
  };
  module.exports = hashDelete;
});

// node_modules/lodash/_hashGet.js
var require__hashGet = __commonJS((exports, module) => {
  var hashGet = function(key) {
    var data4 = this.__data__;
    if (nativeCreate) {
      var result = data4[key];
      return result === HASH_UNDEFINED ? undefined : result;
    }
    return hasOwnProperty2.call(data4, key) ? data4[key] : undefined;
  };
  var nativeCreate = require__nativeCreate();
  var HASH_UNDEFINED = "__lodash_hash_undefined__";
  var objectProto = Object.prototype;
  var hasOwnProperty2 = objectProto.hasOwnProperty;
  module.exports = hashGet;
});

// node_modules/lodash/_hashHas.js
var require__hashHas = __commonJS((exports, module) => {
  var hashHas = function(key) {
    var data4 = this.__data__;
    return nativeCreate ? data4[key] !== undefined : hasOwnProperty2.call(data4, key);
  };
  var nativeCreate = require__nativeCreate();
  var objectProto = Object.prototype;
  var hasOwnProperty2 = objectProto.hasOwnProperty;
  module.exports = hashHas;
});

// node_modules/lodash/_hashSet.js
var require__hashSet = __commonJS((exports, module) => {
  var hashSet = function(key, value) {
    var data4 = this.__data__;
    this.size += this.has(key) ? 0 : 1;
    data4[key] = nativeCreate && value === undefined ? HASH_UNDEFINED : value;
    return this;
  };
  var nativeCreate = require__nativeCreate();
  var HASH_UNDEFINED = "__lodash_hash_undefined__";
  module.exports = hashSet;
});

// node_modules/lodash/_Hash.js
var require__Hash = __commonJS((exports, module) => {
  var Hash = function(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  };
  var hashClear = require__hashClear();
  var hashDelete = require__hashDelete();
  var hashGet = require__hashGet();
  var hashHas = require__hashHas();
  var hashSet = require__hashSet();
  Hash.prototype.clear = hashClear;
  Hash.prototype["delete"] = hashDelete;
  Hash.prototype.get = hashGet;
  Hash.prototype.has = hashHas;
  Hash.prototype.set = hashSet;
  module.exports = Hash;
});

// node_modules/lodash/_listCacheClear.js
var require__listCacheClear = __commonJS((exports, module) => {
  var listCacheClear = function() {
    this.__data__ = [];
    this.size = 0;
  };
  module.exports = listCacheClear;
});

// node_modules/lodash/_assocIndexOf.js
var require__assocIndexOf = __commonJS((exports, module) => {
  var assocIndexOf = function(array, key) {
    var length = array.length;
    while (length--) {
      if (eq(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  };
  var eq = require_eq();
  module.exports = assocIndexOf;
});

// node_modules/lodash/_listCacheDelete.js
var require__listCacheDelete = __commonJS((exports, module) => {
  var listCacheDelete = function(key) {
    var data4 = this.__data__, index = assocIndexOf(data4, key);
    if (index < 0) {
      return false;
    }
    var lastIndex = data4.length - 1;
    if (index == lastIndex) {
      data4.pop();
    } else {
      splice.call(data4, index, 1);
    }
    --this.size;
    return true;
  };
  var assocIndexOf = require__assocIndexOf();
  var arrayProto = Array.prototype;
  var splice = arrayProto.splice;
  module.exports = listCacheDelete;
});

// node_modules/lodash/_listCacheGet.js
var require__listCacheGet = __commonJS((exports, module) => {
  var listCacheGet = function(key) {
    var data4 = this.__data__, index = assocIndexOf(data4, key);
    return index < 0 ? undefined : data4[index][1];
  };
  var assocIndexOf = require__assocIndexOf();
  module.exports = listCacheGet;
});

// node_modules/lodash/_listCacheHas.js
var require__listCacheHas = __commonJS((exports, module) => {
  var listCacheHas = function(key) {
    return assocIndexOf(this.__data__, key) > -1;
  };
  var assocIndexOf = require__assocIndexOf();
  module.exports = listCacheHas;
});

// node_modules/lodash/_listCacheSet.js
var require__listCacheSet = __commonJS((exports, module) => {
  var listCacheSet = function(key, value) {
    var data4 = this.__data__, index = assocIndexOf(data4, key);
    if (index < 0) {
      ++this.size;
      data4.push([key, value]);
    } else {
      data4[index][1] = value;
    }
    return this;
  };
  var assocIndexOf = require__assocIndexOf();
  module.exports = listCacheSet;
});

// node_modules/lodash/_ListCache.js
var require__ListCache = __commonJS((exports, module) => {
  var ListCache = function(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  };
  var listCacheClear = require__listCacheClear();
  var listCacheDelete = require__listCacheDelete();
  var listCacheGet = require__listCacheGet();
  var listCacheHas = require__listCacheHas();
  var listCacheSet = require__listCacheSet();
  ListCache.prototype.clear = listCacheClear;
  ListCache.prototype["delete"] = listCacheDelete;
  ListCache.prototype.get = listCacheGet;
  ListCache.prototype.has = listCacheHas;
  ListCache.prototype.set = listCacheSet;
  module.exports = ListCache;
});

// node_modules/lodash/_Map.js
var require__Map = __commonJS((exports, module) => {
  var getNative = require__getNative();
  var root = require__root();
  var Map2 = getNative(root, "Map");
  module.exports = Map2;
});

// node_modules/lodash/_mapCacheClear.js
var require__mapCacheClear = __commonJS((exports, module) => {
  var mapCacheClear = function() {
    this.size = 0;
    this.__data__ = {
      hash: new Hash,
      map: new (Map2 || ListCache),
      string: new Hash
    };
  };
  var Hash = require__Hash();
  var ListCache = require__ListCache();
  var Map2 = require__Map();
  module.exports = mapCacheClear;
});

// node_modules/lodash/_isKeyable.js
var require__isKeyable = __commonJS((exports, module) => {
  var isKeyable = function(value) {
    var type = typeof value;
    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
  };
  module.exports = isKeyable;
});

// node_modules/lodash/_getMapData.js
var require__getMapData = __commonJS((exports, module) => {
  var getMapData = function(map, key) {
    var data4 = map.__data__;
    return isKeyable(key) ? data4[typeof key == "string" ? "string" : "hash"] : data4.map;
  };
  var isKeyable = require__isKeyable();
  module.exports = getMapData;
});

// node_modules/lodash/_mapCacheDelete.js
var require__mapCacheDelete = __commonJS((exports, module) => {
  var mapCacheDelete = function(key) {
    var result = getMapData(this, key)["delete"](key);
    this.size -= result ? 1 : 0;
    return result;
  };
  var getMapData = require__getMapData();
  module.exports = mapCacheDelete;
});

// node_modules/lodash/_mapCacheGet.js
var require__mapCacheGet = __commonJS((exports, module) => {
  var mapCacheGet = function(key) {
    return getMapData(this, key).get(key);
  };
  var getMapData = require__getMapData();
  module.exports = mapCacheGet;
});

// node_modules/lodash/_mapCacheHas.js
var require__mapCacheHas = __commonJS((exports, module) => {
  var mapCacheHas = function(key) {
    return getMapData(this, key).has(key);
  };
  var getMapData = require__getMapData();
  module.exports = mapCacheHas;
});

// node_modules/lodash/_mapCacheSet.js
var require__mapCacheSet = __commonJS((exports, module) => {
  var mapCacheSet = function(key, value) {
    var data4 = getMapData(this, key), size = data4.size;
    data4.set(key, value);
    this.size += data4.size == size ? 0 : 1;
    return this;
  };
  var getMapData = require__getMapData();
  module.exports = mapCacheSet;
});

// node_modules/lodash/_MapCache.js
var require__MapCache = __commonJS((exports, module) => {
  var MapCache = function(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  };
  var mapCacheClear = require__mapCacheClear();
  var mapCacheDelete = require__mapCacheDelete();
  var mapCacheGet = require__mapCacheGet();
  var mapCacheHas = require__mapCacheHas();
  var mapCacheSet = require__mapCacheSet();
  MapCache.prototype.clear = mapCacheClear;
  MapCache.prototype["delete"] = mapCacheDelete;
  MapCache.prototype.get = mapCacheGet;
  MapCache.prototype.has = mapCacheHas;
  MapCache.prototype.set = mapCacheSet;
  module.exports = MapCache;
});

// node_modules/lodash/memoize.js
var require_memoize = __commonJS((exports, module) => {
  var memoize = function(func, resolver) {
    if (typeof func != "function" || resolver != null && typeof resolver != "function") {
      throw new TypeError(FUNC_ERROR_TEXT);
    }
    var memoized = function() {
      var args = arguments, key = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
      if (cache.has(key)) {
        return cache.get(key);
      }
      var result = func.apply(this, args);
      memoized.cache = cache.set(key, result) || cache;
      return result;
    };
    memoized.cache = new (memoize.Cache || MapCache);
    return memoized;
  };
  var MapCache = require__MapCache();
  var FUNC_ERROR_TEXT = "Expected a function";
  memoize.Cache = MapCache;
  module.exports = memoize;
});

// node_modules/lodash/_memoizeCapped.js
var require__memoizeCapped = __commonJS((exports, module) => {
  var memoizeCapped = function(func) {
    var result = memoize(func, function(key) {
      if (cache.size === MAX_MEMOIZE_SIZE) {
        cache.clear();
      }
      return key;
    });
    var cache = result.cache;
    return result;
  };
  var memoize = require_memoize();
  var MAX_MEMOIZE_SIZE = 500;
  module.exports = memoizeCapped;
});

// node_modules/lodash/_stringToPath.js
var require__stringToPath = __commonJS((exports, module) => {
  var memoizeCapped = require__memoizeCapped();
  var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
  var reEscapeChar = /\\(\\)?/g;
  var stringToPath = memoizeCapped(function(string) {
    var result = [];
    if (string.charCodeAt(0) === 46) {
      result.push("");
    }
    string.replace(rePropName, function(match, number, quote, subString) {
      result.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
    });
    return result;
  });
  module.exports = stringToPath;
});

// node_modules/lodash/_arrayMap.js
var require__arrayMap = __commonJS((exports, module) => {
  var arrayMap = function(array, iteratee) {
    var index = -1, length = array == null ? 0 : array.length, result = Array(length);
    while (++index < length) {
      result[index] = iteratee(array[index], index, array);
    }
    return result;
  };
  module.exports = arrayMap;
});

// node_modules/lodash/_baseToString.js
var require__baseToString = __commonJS((exports, module) => {
  var baseToString = function(value) {
    if (typeof value == "string") {
      return value;
    }
    if (isArray2(value)) {
      return arrayMap(value, baseToString) + "";
    }
    if (isSymbol(value)) {
      return symbolToString ? symbolToString.call(value) : "";
    }
    var result = value + "";
    return result == "0" && 1 / value == -INFINITY ? "-0" : result;
  };
  var Symbol2 = require__Symbol();
  var arrayMap = require__arrayMap();
  var isArray2 = require_isArray();
  var isSymbol = require_isSymbol();
  var INFINITY = 1 / 0;
  var symbolProto = Symbol2 ? Symbol2.prototype : undefined;
  var symbolToString = symbolProto ? symbolProto.toString : undefined;
  module.exports = baseToString;
});

// node_modules/lodash/toString.js
var require_toString = __commonJS((exports, module) => {
  var toString3 = function(value) {
    return value == null ? "" : baseToString(value);
  };
  var baseToString = require__baseToString();
  module.exports = toString3;
});

// node_modules/lodash/_castPath.js
var require__castPath = __commonJS((exports, module) => {
  var castPath = function(value, object) {
    if (isArray2(value)) {
      return value;
    }
    return isKey(value, object) ? [value] : stringToPath(toString3(value));
  };
  var isArray2 = require_isArray();
  var isKey = require__isKey();
  var stringToPath = require__stringToPath();
  var toString3 = require_toString();
  module.exports = castPath;
});

// node_modules/lodash/_isIndex.js
var require__isIndex = __commonJS((exports, module) => {
  var isIndex = function(value, length) {
    var type = typeof value;
    length = length == null ? MAX_SAFE_INTEGER : length;
    return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
  };
  var MAX_SAFE_INTEGER = 9007199254740991;
  var reIsUint = /^(?:0|[1-9]\d*)$/;
  module.exports = isIndex;
});

// node_modules/lodash/_toKey.js
var require__toKey = __commonJS((exports, module) => {
  var toKey = function(value) {
    if (typeof value == "string" || isSymbol(value)) {
      return value;
    }
    var result = value + "";
    return result == "0" && 1 / value == -INFINITY ? "-0" : result;
  };
  var isSymbol = require_isSymbol();
  var INFINITY = 1 / 0;
  module.exports = toKey;
});

// node_modules/lodash/_baseSet.js
var require__baseSet = __commonJS((exports, module) => {
  var baseSet = function(object, path, value, customizer) {
    if (!isObject2(object)) {
      return object;
    }
    path = castPath(path, object);
    var index = -1, length = path.length, lastIndex = length - 1, nested = object;
    while (nested != null && ++index < length) {
      var key = toKey(path[index]), newValue = value;
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return object;
      }
      if (index != lastIndex) {
        var objValue = nested[key];
        newValue = customizer ? customizer(objValue, key, nested) : undefined;
        if (newValue === undefined) {
          newValue = isObject2(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {};
        }
      }
      assignValue(nested, key, newValue);
      nested = nested[key];
    }
    return object;
  };
  var assignValue = require__assignValue();
  var castPath = require__castPath();
  var isIndex = require__isIndex();
  var isObject2 = require_isObject();
  var toKey = require__toKey();
  module.exports = baseSet;
});

// node_modules/lodash/set.js
var require_set = __commonJS((exports, module) => {
  var set = function(object, path, value) {
    return object == null ? object : baseSet(object, path, value);
  };
  var baseSet = require__baseSet();
  module.exports = set;
});

// node_modules/csvtojson/v2/lineToJson.js
var require_lineToJson = __commonJS((exports) => {
  var default_1 = function(csvRows, conv) {
    var res = [];
    for (var i = 0, len = csvRows.length;i < len; i++) {
      var r = processRow(csvRows[i], conv, i);
      if (r) {
        res.push(r);
      }
    }
    return res;
  };
  var processRow = function(row, conv, index) {
    if (conv.parseParam.checkColumn && conv.parseRuntime.headers && row.length !== conv.parseRuntime.headers.length) {
      throw CSVError_1.default.column_mismatched(conv.parseRuntime.parsedLineNumber + index);
    }
    var headRow = conv.parseRuntime.headers || [];
    var resultRow = convertRowToJson(row, headRow, conv);
    if (resultRow) {
      return resultRow;
    } else {
      return null;
    }
  };
  var convertRowToJson = function(row, headRow, conv) {
    var hasValue = false;
    var resultRow = {};
    for (var i = 0, len = row.length;i < len; i++) {
      var item = row[i];
      if (conv.parseParam.ignoreEmpty && item === "") {
        continue;
      }
      hasValue = true;
      var head = headRow[i];
      if (!head || head === "") {
        head = headRow[i] = "field" + (i + 1);
      }
      var convFunc = getConvFunc(head, i, conv);
      if (convFunc) {
        var convRes = convFunc(item, head, resultRow, row, i);
        if (convRes !== undefined) {
          setPath(resultRow, head, convRes, conv, i);
        }
      } else {
        if (conv.parseParam.checkType) {
          var convertFunc = checkType(item, head, i, conv);
          item = convertFunc(item);
        }
        if (item !== undefined) {
          setPath(resultRow, head, item, conv, i);
        }
      }
    }
    if (hasValue) {
      return resultRow;
    } else {
      return null;
    }
  };
  var getConvFunc = function(head, i, conv) {
    if (conv.parseRuntime.columnConv[i] !== undefined) {
      return conv.parseRuntime.columnConv[i];
    } else {
      var flag = conv.parseParam.colParser[head];
      if (flag === undefined) {
        return conv.parseRuntime.columnConv[i] = null;
      }
      if (typeof flag === "object") {
        flag = flag.cellParser || "string";
      }
      if (typeof flag === "string") {
        flag = flag.trim().toLowerCase();
        var builtInFunc = builtInConv[flag];
        if (builtInFunc) {
          return conv.parseRuntime.columnConv[i] = builtInFunc;
        } else {
          return conv.parseRuntime.columnConv[i] = null;
        }
      } else if (typeof flag === "function") {
        return conv.parseRuntime.columnConv[i] = flag;
      } else {
        return conv.parseRuntime.columnConv[i] = null;
      }
    }
  };
  var setPath = function(resultJson, head, value, conv, headIdx) {
    if (!conv.parseRuntime.columnValueSetter[headIdx]) {
      if (conv.parseParam.flatKeys) {
        conv.parseRuntime.columnValueSetter[headIdx] = flatSetter;
      } else {
        if (head.indexOf(".") > -1) {
          var headArr = head.split(".");
          var jsonHead = true;
          while (headArr.length > 0) {
            var headCom = headArr.shift();
            if (headCom.length === 0) {
              jsonHead = false;
              break;
            }
          }
          if (!jsonHead || conv.parseParam.colParser[head] && conv.parseParam.colParser[head].flat) {
            conv.parseRuntime.columnValueSetter[headIdx] = flatSetter;
          } else {
            conv.parseRuntime.columnValueSetter[headIdx] = jsonSetter;
          }
        } else {
          conv.parseRuntime.columnValueSetter[headIdx] = flatSetter;
        }
      }
    }
    if (conv.parseParam.nullObject === true && value === "null") {
      value = null;
    }
    conv.parseRuntime.columnValueSetter[headIdx](resultJson, head, value);
  };
  var flatSetter = function(resultJson, head, value) {
    resultJson[head] = value;
  };
  var jsonSetter = function(resultJson, head, value) {
    set_1.default(resultJson, head, value);
  };
  var checkType = function(item, head, headIdx, conv) {
    if (conv.parseRuntime.headerType[headIdx]) {
      return conv.parseRuntime.headerType[headIdx];
    } else if (head.indexOf("number#!") > -1) {
      return conv.parseRuntime.headerType[headIdx] = numberType;
    } else if (head.indexOf("string#!") > -1) {
      return conv.parseRuntime.headerType[headIdx] = stringType;
    } else if (conv.parseParam.checkType) {
      return conv.parseRuntime.headerType[headIdx] = dynamicType;
    } else {
      return conv.parseRuntime.headerType[headIdx] = stringType;
    }
  };
  var numberType = function(item) {
    var rtn = parseFloat(item);
    if (isNaN(rtn)) {
      return item;
    }
    return rtn;
  };
  var stringType = function(item) {
    return item.toString();
  };
  var dynamicType = function(item) {
    var trimed = item.trim();
    if (trimed === "") {
      return stringType(item);
    }
    if (numReg.test(trimed)) {
      return numberType(item);
    } else if (trimed.length === 5 && trimed.toLowerCase() === "false" || trimed.length === 4 && trimed.toLowerCase() === "true") {
      return booleanType(item);
    } else if (trimed[0] === "{" && trimed[trimed.length - 1] === "}" || trimed[0] === "[" && trimed[trimed.length - 1] === "]") {
      return jsonType(item);
    } else {
      return stringType(item);
    }
  };
  var booleanType = function(item) {
    var trimed = item.trim();
    if (trimed.length === 5 && trimed.toLowerCase() === "false") {
      return false;
    } else {
      return true;
    }
  };
  var jsonType = function(item) {
    try {
      return JSON.parse(item);
    } catch (e) {
      return item;
    }
  };
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var CSVError_1 = __importDefault(require_CSVError());
  var set_1 = __importDefault(require_set());
  var numReg = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;
  exports.default = default_1;
  var builtInConv = {
    string: stringType,
    number: numberType,
    omit: function() {
    }
  };
});

// node_modules/csvtojson/v2/ProcessorLocal.js
var require_ProcessorLocal = __commonJS((exports) => {
  var processLineHook = function(lines, runtime, offset, cb) {
    if (offset >= lines.length) {
      cb();
    } else {
      if (runtime.preFileLineHook) {
        var line = lines[offset];
        var res = runtime.preFileLineHook(line, runtime.parsedLineNumber + offset);
        offset++;
        if (res && res.then) {
          res.then(function(value) {
            lines[offset - 1] = value;
            processLineHook(lines, runtime, offset, cb);
          });
        } else {
          lines[offset - 1] = res;
          while (offset < lines.length) {
            lines[offset] = runtime.preFileLineHook(lines[offset], runtime.parsedLineNumber + offset);
            offset++;
          }
          cb();
        }
      } else {
        cb();
      }
    }
  };
  var __extends = exports && exports.__extends || function() {
    var extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d, b) {
      d.__proto__ = b;
    } || function(d, b) {
      for (var p in b)
        if (b.hasOwnProperty(p))
          d[p] = b[p];
    };
    return function(d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __);
    };
  }();
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var Processor_1 = require_Processor();
  var bluebird_1 = __importDefault(require_bluebird());
  var dataClean_1 = require_dataClean();
  var getEol_1 = __importDefault(require_getEol());
  var fileline_1 = require_fileline();
  var util_1 = require_util3();
  var rowSplit_1 = require_rowSplit();
  var lineToJson_1 = __importDefault(require_lineToJson());
  var CSVError_1 = __importDefault(require_CSVError());
  var ProcessorLocal = function(_super) {
    __extends(ProcessorLocal2, _super);
    function ProcessorLocal2() {
      var _this = _super !== null && _super.apply(this, arguments) || this;
      _this.rowSplit = new rowSplit_1.RowSplit(_this.converter);
      _this.eolEmitted = false;
      _this._needEmitEol = undefined;
      _this.headEmitted = false;
      _this._needEmitHead = undefined;
      return _this;
    }
    ProcessorLocal2.prototype.flush = function() {
      var _this = this;
      if (this.runtime.csvLineBuffer && this.runtime.csvLineBuffer.length > 0) {
        var buf = this.runtime.csvLineBuffer;
        this.runtime.csvLineBuffer = undefined;
        return this.process(buf, true).then(function(res) {
          if (_this.runtime.csvLineBuffer && _this.runtime.csvLineBuffer.length > 0) {
            return bluebird_1.default.reject(CSVError_1.default.unclosed_quote(_this.runtime.parsedLineNumber, _this.runtime.csvLineBuffer.toString()));
          } else {
            return bluebird_1.default.resolve(res);
          }
        });
      } else {
        return bluebird_1.default.resolve([]);
      }
    };
    ProcessorLocal2.prototype.destroy = function() {
      return bluebird_1.default.resolve();
    };
    Object.defineProperty(ProcessorLocal2.prototype, "needEmitEol", {
      get: function() {
        if (this._needEmitEol === undefined) {
          this._needEmitEol = this.converter.listeners("eol").length > 0;
        }
        return this._needEmitEol;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(ProcessorLocal2.prototype, "needEmitHead", {
      get: function() {
        if (this._needEmitHead === undefined) {
          this._needEmitHead = this.converter.listeners("header").length > 0;
        }
        return this._needEmitHead;
      },
      enumerable: true,
      configurable: true
    });
    ProcessorLocal2.prototype.process = function(chunk, finalChunk) {
      var _this = this;
      if (finalChunk === undefined) {
        finalChunk = false;
      }
      var csvString;
      if (finalChunk) {
        csvString = chunk.toString();
      } else {
        csvString = dataClean_1.prepareData(chunk, this.converter.parseRuntime);
      }
      return bluebird_1.default.resolve().then(function() {
        if (_this.runtime.preRawDataHook) {
          return _this.runtime.preRawDataHook(csvString);
        } else {
          return csvString;
        }
      }).then(function(csv) {
        if (csv && csv.length > 0) {
          return _this.processCSV(csv, finalChunk);
        } else {
          return bluebird_1.default.resolve([]);
        }
      });
    };
    ProcessorLocal2.prototype.processCSV = function(csv, finalChunk) {
      var _this = this;
      var params = this.params;
      var runtime = this.runtime;
      if (!runtime.eol) {
        getEol_1.default(csv, runtime);
      }
      if (this.needEmitEol && !this.eolEmitted && runtime.eol) {
        this.converter.emit("eol", runtime.eol);
        this.eolEmitted = true;
      }
      if (params.ignoreEmpty && !runtime.started) {
        csv = util_1.trimLeft(csv);
      }
      var stringToLineResult = fileline_1.stringToLines(csv, runtime);
      if (!finalChunk) {
        this.prependLeftBuf(util_1.bufFromString(stringToLineResult.partial));
      } else {
        stringToLineResult.lines.push(stringToLineResult.partial);
        stringToLineResult.partial = "";
      }
      if (stringToLineResult.lines.length > 0) {
        var prom = undefined;
        if (runtime.preFileLineHook) {
          prom = this.runPreLineHook(stringToLineResult.lines);
        } else {
          prom = bluebird_1.default.resolve(stringToLineResult.lines);
        }
        return prom.then(function(lines) {
          if (!runtime.started && !_this.runtime.headers) {
            return _this.processDataWithHead(lines);
          } else {
            return _this.processCSVBody(lines);
          }
        });
      } else {
        return bluebird_1.default.resolve([]);
      }
    };
    ProcessorLocal2.prototype.processDataWithHead = function(lines) {
      if (this.params.noheader) {
        if (this.params.headers) {
          this.runtime.headers = this.params.headers;
        } else {
          this.runtime.headers = [];
        }
      } else {
        var left = "";
        var headerRow = [];
        while (lines.length) {
          var line = left + lines.shift();
          var row = this.rowSplit.parse(line);
          if (row.closed) {
            headerRow = row.cells;
            left = "";
            break;
          } else {
            left = line + getEol_1.default(line, this.runtime);
          }
        }
        this.prependLeftBuf(util_1.bufFromString(left));
        if (headerRow.length === 0) {
          return [];
        }
        if (this.params.headers) {
          this.runtime.headers = this.params.headers;
        } else {
          this.runtime.headers = headerRow;
        }
      }
      if (this.runtime.needProcessIgnoreColumn || this.runtime.needProcessIncludeColumn) {
        this.filterHeader();
      }
      if (this.needEmitHead && !this.headEmitted) {
        this.converter.emit("header", this.runtime.headers);
        this.headEmitted = true;
      }
      return this.processCSVBody(lines);
    };
    ProcessorLocal2.prototype.filterHeader = function() {
      this.runtime.selectedColumns = [];
      if (this.runtime.headers) {
        var headers = this.runtime.headers;
        for (var i = 0;i < headers.length; i++) {
          if (this.params.ignoreColumns) {
            if (this.params.ignoreColumns.test(headers[i])) {
              if (this.params.includeColumns && this.params.includeColumns.test(headers[i])) {
                this.runtime.selectedColumns.push(i);
              } else {
                continue;
              }
            } else {
              this.runtime.selectedColumns.push(i);
            }
          } else if (this.params.includeColumns) {
            if (this.params.includeColumns.test(headers[i])) {
              this.runtime.selectedColumns.push(i);
            }
          } else {
            this.runtime.selectedColumns.push(i);
          }
        }
        this.runtime.headers = util_1.filterArray(this.runtime.headers, this.runtime.selectedColumns);
      }
    };
    ProcessorLocal2.prototype.processCSVBody = function(lines) {
      if (this.params.output === "line") {
        return lines;
      } else {
        var result = this.rowSplit.parseMultiLines(lines);
        this.prependLeftBuf(util_1.bufFromString(result.partial));
        if (this.params.output === "csv") {
          return result.rowsCells;
        } else {
          return lineToJson_1.default(result.rowsCells, this.converter);
        }
      }
    };
    ProcessorLocal2.prototype.prependLeftBuf = function(buf) {
      if (buf) {
        if (this.runtime.csvLineBuffer) {
          this.runtime.csvLineBuffer = Buffer.concat([buf, this.runtime.csvLineBuffer]);
        } else {
          this.runtime.csvLineBuffer = buf;
        }
      }
    };
    ProcessorLocal2.prototype.runPreLineHook = function(lines) {
      var _this = this;
      return new bluebird_1.default(function(resolve, reject) {
        processLineHook(lines, _this.runtime, 0, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(lines);
          }
        });
      });
    };
    return ProcessorLocal2;
  }(Processor_1.Processor);
  exports.ProcessorLocal = ProcessorLocal;
});

// node_modules/csvtojson/v2/Result.js
var require_Result = __commonJS((exports) => {
  var processLineByLine = function(lines, conv, offset, needPushDownstream, cb) {
    if (offset >= lines.length) {
      cb();
    } else {
      if (conv.parseRuntime.subscribe && conv.parseRuntime.subscribe.onNext) {
        var hook_1 = conv.parseRuntime.subscribe.onNext;
        var nextLine_1 = lines[offset];
        var res = hook_1(nextLine_1, conv.parseRuntime.parsedLineNumber + offset);
        offset++;
        if (res && res.then) {
          res.then(function() {
            processRecursive(lines, hook_1, conv, offset, needPushDownstream, cb, nextLine_1);
          }, cb);
        } else {
          if (needPushDownstream) {
            pushDownstream(conv, nextLine_1);
          }
          while (offset < lines.length) {
            var line = lines[offset];
            hook_1(line, conv.parseRuntime.parsedLineNumber + offset);
            offset++;
            if (needPushDownstream) {
              pushDownstream(conv, line);
            }
          }
          cb();
        }
      } else {
        if (needPushDownstream) {
          while (offset < lines.length) {
            var line = lines[offset++];
            pushDownstream(conv, line);
          }
        }
        cb();
      }
    }
  };
  var processRecursive = function(lines, hook, conv, offset, needPushDownstream, cb, res) {
    if (needPushDownstream) {
      pushDownstream(conv, res);
    }
    processLineByLine(lines, conv, offset, needPushDownstream, cb);
  };
  var pushDownstream = function(conv, res) {
    if (typeof res === "object" && !conv.options.objectMode) {
      var data4 = JSON.stringify(res);
      conv.push(data4 + (conv.parseParam.downstreamFormat === "array" ? "," + os_1.EOL : os_1.EOL), "utf8");
    } else {
      conv.push(res);
    }
  };
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var bluebird_1 = __importDefault(require_bluebird());
  var os_1 = __require("os");
  var Result = function() {
    function Result2(converter) {
      this.converter = converter;
      this.finalResult = [];
    }
    Object.defineProperty(Result2.prototype, "needEmitLine", {
      get: function() {
        return !!this.converter.parseRuntime.subscribe && !!this.converter.parseRuntime.subscribe.onNext || this.needPushDownstream;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Result2.prototype, "needPushDownstream", {
      get: function() {
        if (this._needPushDownstream === undefined) {
          this._needPushDownstream = this.converter.listeners("data").length > 0 || this.converter.listeners("readable").length > 0;
        }
        return this._needPushDownstream;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Result2.prototype, "needEmitAll", {
      get: function() {
        return !!this.converter.parseRuntime.then && this.converter.parseParam.needEmitAll;
      },
      enumerable: true,
      configurable: true
    });
    Result2.prototype.processResult = function(resultLines) {
      var _this = this;
      var startPos = this.converter.parseRuntime.parsedLineNumber;
      if (this.needPushDownstream && this.converter.parseParam.downstreamFormat === "array") {
        if (startPos === 0) {
          pushDownstream(this.converter, "[" + os_1.EOL);
        }
      }
      return new bluebird_1.default(function(resolve, reject) {
        if (_this.needEmitLine) {
          processLineByLine(resultLines, _this.converter, 0, _this.needPushDownstream, function(err) {
            if (err) {
              reject(err);
            } else {
              _this.appendFinalResult(resultLines);
              resolve();
            }
          });
        } else {
          _this.appendFinalResult(resultLines);
          resolve();
        }
      });
    };
    Result2.prototype.appendFinalResult = function(lines) {
      if (this.needEmitAll) {
        this.finalResult = this.finalResult.concat(lines);
      }
      this.converter.parseRuntime.parsedLineNumber += lines.length;
    };
    Result2.prototype.processError = function(err) {
      if (this.converter.parseRuntime.subscribe && this.converter.parseRuntime.subscribe.onError) {
        this.converter.parseRuntime.subscribe.onError(err);
      }
      if (this.converter.parseRuntime.then && this.converter.parseRuntime.then.onrejected) {
        this.converter.parseRuntime.then.onrejected(err);
      }
    };
    Result2.prototype.endProcess = function() {
      if (this.converter.parseRuntime.then && this.converter.parseRuntime.then.onfulfilled) {
        if (this.needEmitAll) {
          this.converter.parseRuntime.then.onfulfilled(this.finalResult);
        } else {
          this.converter.parseRuntime.then.onfulfilled([]);
        }
      }
      if (this.converter.parseRuntime.subscribe && this.converter.parseRuntime.subscribe.onCompleted) {
        this.converter.parseRuntime.subscribe.onCompleted();
      }
      if (this.needPushDownstream && this.converter.parseParam.downstreamFormat === "array") {
        pushDownstream(this.converter, "]" + os_1.EOL);
      }
    };
    return Result2;
  }();
  exports.Result = Result;
});

// node_modules/csvtojson/v2/Converter.js
var require_Converter = __commonJS((exports) => {
  var __extends = exports && exports.__extends || function() {
    var extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d, b) {
      d.__proto__ = b;
    } || function(d, b) {
      for (var p in b)
        if (b.hasOwnProperty(p))
          d[p] = b[p];
    };
    return function(d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __);
    };
  }();
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var stream_1 = __require("stream");
  var Parameters_1 = require_Parameters();
  var ParseRuntime_1 = require_ParseRuntime();
  var bluebird_1 = __importDefault(require_bluebird());
  var ProcessorLocal_1 = require_ProcessorLocal();
  var Result_1 = require_Result();
  var Converter = function(_super) {
    __extends(Converter2, _super);
    function Converter2(param, options) {
      if (options === undefined) {
        options = {};
      }
      var _this = _super.call(this, options) || this;
      _this.options = options;
      _this.params = Parameters_1.mergeParams(param);
      _this.runtime = ParseRuntime_1.initParseRuntime(_this);
      _this.result = new Result_1.Result(_this);
      _this.processor = new ProcessorLocal_1.ProcessorLocal(_this);
      _this.once("error", function(err) {
        setImmediate(function() {
          _this.result.processError(err);
          _this.emit("done", err);
        });
      });
      _this.once("done", function() {
        _this.processor.destroy();
      });
      return _this;
    }
    Converter2.prototype.preRawData = function(onRawData) {
      this.runtime.preRawDataHook = onRawData;
      return this;
    };
    Converter2.prototype.preFileLine = function(onFileLine) {
      this.runtime.preFileLineHook = onFileLine;
      return this;
    };
    Converter2.prototype.subscribe = function(onNext, onError, onCompleted) {
      this.parseRuntime.subscribe = {
        onNext,
        onError,
        onCompleted
      };
      return this;
    };
    Converter2.prototype.fromFile = function(filePath, options) {
      var _this = this;
      var fs = __require("fs");
      fs.exists(filePath, function(exist) {
        if (exist) {
          var rs = fs.createReadStream(filePath, options);
          rs.pipe(_this);
        } else {
          _this.emit("error", new Error("File does not exist. Check to make sure the file path to your csv is correct."));
        }
      });
      return this;
    };
    Converter2.prototype.fromStream = function(readStream) {
      readStream.pipe(this);
      return this;
    };
    Converter2.prototype.fromString = function(csvString) {
      var csv = csvString.toString();
      var read = new stream_1.Readable;
      var idx = 0;
      read._read = function(size) {
        if (idx >= csvString.length) {
          this.push(null);
        } else {
          var str = csvString.substr(idx, size);
          this.push(str);
          idx += size;
        }
      };
      return this.fromStream(read);
    };
    Converter2.prototype.then = function(onfulfilled, onrejected) {
      var _this = this;
      return new bluebird_1.default(function(resolve, reject) {
        _this.parseRuntime.then = {
          onfulfilled: function(value) {
            if (onfulfilled) {
              resolve(onfulfilled(value));
            } else {
              resolve(value);
            }
          },
          onrejected: function(err) {
            if (onrejected) {
              resolve(onrejected(err));
            } else {
              reject(err);
            }
          }
        };
      });
    };
    Object.defineProperty(Converter2.prototype, "parseParam", {
      get: function() {
        return this.params;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Converter2.prototype, "parseRuntime", {
      get: function() {
        return this.runtime;
      },
      enumerable: true,
      configurable: true
    });
    Converter2.prototype._transform = function(chunk, encoding, cb) {
      var _this = this;
      this.processor.process(chunk).then(function(result) {
        if (result.length > 0) {
          _this.runtime.started = true;
          return _this.result.processResult(result);
        }
      }).then(function() {
        _this.emit("drained");
        cb();
      }, function(error) {
        _this.runtime.hasError = true;
        _this.runtime.error = error;
        _this.emit("error", error);
        cb();
      });
    };
    Converter2.prototype._flush = function(cb) {
      var _this = this;
      this.processor.flush().then(function(data4) {
        if (data4.length > 0) {
          return _this.result.processResult(data4);
        }
      }).then(function() {
        _this.processEnd(cb);
      }, function(err) {
        _this.emit("error", err);
        cb();
      });
    };
    Converter2.prototype.processEnd = function(cb) {
      this.result.endProcess();
      this.emit("done");
      cb();
    };
    Object.defineProperty(Converter2.prototype, "parsedLineNumber", {
      get: function() {
        return this.runtime.parsedLineNumber;
      },
      enumerable: true,
      configurable: true
    });
    return Converter2;
  }(stream_1.Transform);
  exports.Converter = Converter;
});

// node_modules/csvtojson/v2/index.js
var require_v2 = __commonJS((exports, module) => {
  var Converter_1 = require_Converter();
  var helper = function(param, options) {
    return new Converter_1.Converter(param, options);
  };
  helper["csv"] = helper;
  helper["Converter"] = Converter_1.Converter;
  module.exports = helper;
});

// node_modules/axios/lib/helpers/bind.js
function bind(fn, thisArg) {
  return function wrap() {
    return fn.apply(thisArg, arguments);
  };
}

// node_modules/axios/lib/utils.js
var isBuffer = function(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && isFunction(val.constructor.isBuffer) && val.constructor.isBuffer(val);
};
var isArrayBufferView = function(val) {
  let result;
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
    result = ArrayBuffer.isView(val);
  } else {
    result = val && val.buffer && isArrayBuffer(val.buffer);
  }
  return result;
};
var forEach = function(obj, fn, { allOwnKeys = false } = {}) {
  if (obj === null || typeof obj === "undefined") {
    return;
  }
  let i;
  let l;
  if (typeof obj !== "object") {
    obj = [obj];
  }
  if (isArray(obj)) {
    for (i = 0, l = obj.length;i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    const keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
    const len = keys.length;
    let key;
    for (i = 0;i < len; i++) {
      key = keys[i];
      fn.call(null, obj[key], key, obj);
    }
  }
};
var findKey = function(obj, key) {
  key = key.toLowerCase();
  const keys = Object.keys(obj);
  let i = keys.length;
  let _key;
  while (i-- > 0) {
    _key = keys[i];
    if (key === _key.toLowerCase()) {
      return _key;
    }
  }
  return null;
};
var merge = function() {
  const { caseless } = isContextDefined(this) && this || {};
  const result = {};
  const assignValue = (val, key) => {
    const targetKey = caseless && findKey(result, key) || key;
    if (isPlainObject(result[targetKey]) && isPlainObject(val)) {
      result[targetKey] = merge(result[targetKey], val);
    } else if (isPlainObject(val)) {
      result[targetKey] = merge({}, val);
    } else if (isArray(val)) {
      result[targetKey] = val.slice();
    } else {
      result[targetKey] = val;
    }
  };
  for (let i = 0, l = arguments.length;i < l; i++) {
    arguments[i] && forEach(arguments[i], assignValue);
  }
  return result;
};
var isSpecCompliantForm = function(thing) {
  return !!(thing && isFunction(thing.append) && thing[Symbol.toStringTag] === "FormData" && thing[Symbol.iterator]);
};
var { toString } = Object.prototype;
var { getPrototypeOf } = Object;
var kindOf = ((cache) => (thing) => {
  const str = toString.call(thing);
  return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));
var kindOfTest = (type) => {
  type = type.toLowerCase();
  return (thing) => kindOf(thing) === type;
};
var typeOfTest = (type) => (thing) => typeof thing === type;
var { isArray } = Array;
var isUndefined = typeOfTest("undefined");
var isArrayBuffer = kindOfTest("ArrayBuffer");
var isString = typeOfTest("string");
var isFunction = typeOfTest("function");
var isNumber = typeOfTest("number");
var isObject = (thing) => thing !== null && typeof thing === "object";
var isBoolean = (thing) => thing === true || thing === false;
var isPlainObject = (val) => {
  if (kindOf(val) !== "object") {
    return false;
  }
  const prototype = getPrototypeOf(val);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in val) && !(Symbol.iterator in val);
};
var isDate = kindOfTest("Date");
var isFile = kindOfTest("File");
var isBlob = kindOfTest("Blob");
var isFileList = kindOfTest("FileList");
var isStream = (val) => isObject(val) && isFunction(val.pipe);
var isFormData = (thing) => {
  let kind;
  return thing && (typeof FormData === "function" && thing instanceof FormData || isFunction(thing.append) && ((kind = kindOf(thing)) === "formdata" || kind === "object" && isFunction(thing.toString) && thing.toString() === "[object FormData]"));
};
var isURLSearchParams = kindOfTest("URLSearchParams");
var trim = (str) => str.trim ? str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
var _global = (() => {
  if (typeof globalThis !== "undefined")
    return globalThis;
  return typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : global;
})();
var isContextDefined = (context) => !isUndefined(context) && context !== _global;
var extend = (a, b, thisArg, { allOwnKeys } = {}) => {
  forEach(b, (val, key) => {
    if (thisArg && isFunction(val)) {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  }, { allOwnKeys });
  return a;
};
var stripBOM = (content) => {
  if (content.charCodeAt(0) === 65279) {
    content = content.slice(1);
  }
  return content;
};
var inherits = (constructor, superConstructor, props, descriptors) => {
  constructor.prototype = Object.create(superConstructor.prototype, descriptors);
  constructor.prototype.constructor = constructor;
  Object.defineProperty(constructor, "super", {
    value: superConstructor.prototype
  });
  props && Object.assign(constructor.prototype, props);
};
var toFlatObject = (sourceObj, destObj, filter, propFilter) => {
  let props;
  let i;
  let prop;
  const merged = {};
  destObj = destObj || {};
  if (sourceObj == null)
    return destObj;
  do {
    props = Object.getOwnPropertyNames(sourceObj);
    i = props.length;
    while (i-- > 0) {
      prop = props[i];
      if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
        destObj[prop] = sourceObj[prop];
        merged[prop] = true;
      }
    }
    sourceObj = filter !== false && getPrototypeOf(sourceObj);
  } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);
  return destObj;
};
var endsWith = (str, searchString, position) => {
  str = String(str);
  if (position === undefined || position > str.length) {
    position = str.length;
  }
  position -= searchString.length;
  const lastIndex = str.indexOf(searchString, position);
  return lastIndex !== -1 && lastIndex === position;
};
var toArray = (thing) => {
  if (!thing)
    return null;
  if (isArray(thing))
    return thing;
  let i = thing.length;
  if (!isNumber(i))
    return null;
  const arr = new Array(i);
  while (i-- > 0) {
    arr[i] = thing[i];
  }
  return arr;
};
var isTypedArray = ((TypedArray) => {
  return (thing) => {
    return TypedArray && thing instanceof TypedArray;
  };
})(typeof Uint8Array !== "undefined" && getPrototypeOf(Uint8Array));
var forEachEntry = (obj, fn) => {
  const generator = obj && obj[Symbol.iterator];
  const iterator = generator.call(obj);
  let result;
  while ((result = iterator.next()) && !result.done) {
    const pair = result.value;
    fn.call(obj, pair[0], pair[1]);
  }
};
var matchAll = (regExp, str) => {
  let matches;
  const arr = [];
  while ((matches = regExp.exec(str)) !== null) {
    arr.push(matches);
  }
  return arr;
};
var isHTMLForm = kindOfTest("HTMLFormElement");
var toCamelCase = (str) => {
  return str.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, function replacer(m, p1, p2) {
    return p1.toUpperCase() + p2;
  });
};
var hasOwnProperty = (({ hasOwnProperty: hasOwnProperty2 }) => (obj, prop) => hasOwnProperty2.call(obj, prop))(Object.prototype);
var isRegExp = kindOfTest("RegExp");
var reduceDescriptors = (obj, reducer) => {
  const descriptors = Object.getOwnPropertyDescriptors(obj);
  const reducedDescriptors = {};
  forEach(descriptors, (descriptor, name) => {
    let ret;
    if ((ret = reducer(descriptor, name, obj)) !== false) {
      reducedDescriptors[name] = ret || descriptor;
    }
  });
  Object.defineProperties(obj, reducedDescriptors);
};
var freezeMethods = (obj) => {
  reduceDescriptors(obj, (descriptor, name) => {
    if (isFunction(obj) && ["arguments", "caller", "callee"].indexOf(name) !== -1) {
      return false;
    }
    const value = obj[name];
    if (!isFunction(value))
      return;
    descriptor.enumerable = false;
    if ("writable" in descriptor) {
      descriptor.writable = false;
      return;
    }
    if (!descriptor.set) {
      descriptor.set = () => {
        throw Error("Can not rewrite read-only method \'" + name + "\'");
      };
    }
  });
};
var toObjectSet = (arrayOrString, delimiter) => {
  const obj = {};
  const define = (arr) => {
    arr.forEach((value) => {
      obj[value] = true;
    });
  };
  isArray(arrayOrString) ? define(arrayOrString) : define(String(arrayOrString).split(delimiter));
  return obj;
};
var noop = () => {
};
var toFiniteNumber = (value, defaultValue) => {
  value = +value;
  return Number.isFinite(value) ? value : defaultValue;
};
var ALPHA = "abcdefghijklmnopqrstuvwxyz";
var DIGIT = "0123456789";
var ALPHABET = {
  DIGIT,
  ALPHA,
  ALPHA_DIGIT: ALPHA + ALPHA.toUpperCase() + DIGIT
};
var generateString = (size = 16, alphabet = ALPHABET.ALPHA_DIGIT) => {
  let str = "";
  const { length } = alphabet;
  while (size--) {
    str += alphabet[Math.random() * length | 0];
  }
  return str;
};
var toJSONObject = (obj) => {
  const stack = new Array(10);
  const visit = (source, i) => {
    if (isObject(source)) {
      if (stack.indexOf(source) >= 0) {
        return;
      }
      if (!("toJSON" in source)) {
        stack[i] = source;
        const target = isArray(source) ? [] : {};
        forEach(source, (value, key) => {
          const reducedValue = visit(value, i + 1);
          !isUndefined(reducedValue) && (target[key] = reducedValue);
        });
        stack[i] = undefined;
        return target;
      }
    }
    return source;
  };
  return visit(obj, 0);
};
var isAsyncFn = kindOfTest("AsyncFunction");
var isThenable = (thing) => thing && (isObject(thing) || isFunction(thing)) && isFunction(thing.then) && isFunction(thing.catch);
var utils_default = {
  isArray,
  isArrayBuffer,
  isBuffer,
  isFormData,
  isArrayBufferView,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isPlainObject,
  isUndefined,
  isDate,
  isFile,
  isBlob,
  isRegExp,
  isFunction,
  isStream,
  isURLSearchParams,
  isTypedArray,
  isFileList,
  forEach,
  merge,
  extend,
  trim,
  stripBOM,
  inherits,
  toFlatObject,
  kindOf,
  kindOfTest,
  endsWith,
  toArray,
  forEachEntry,
  matchAll,
  isHTMLForm,
  hasOwnProperty,
  hasOwnProp: hasOwnProperty,
  reduceDescriptors,
  freezeMethods,
  toObjectSet,
  toCamelCase,
  noop,
  toFiniteNumber,
  findKey,
  global: _global,
  isContextDefined,
  ALPHABET,
  generateString,
  isSpecCompliantForm,
  toJSONObject,
  isAsyncFn,
  isThenable
};

// node_modules/axios/lib/core/AxiosError.js
var AxiosError = function(message, code, config, request, response) {
  Error.call(this);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack;
  }
  this.message = message;
  this.name = "AxiosError";
  code && (this.code = code);
  config && (this.config = config);
  request && (this.request = request);
  response && (this.response = response);
};
utils_default.inherits(AxiosError, Error, {
  toJSON: function toJSON() {
    return {
      message: this.message,
      name: this.name,
      description: this.description,
      number: this.number,
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      config: utils_default.toJSONObject(this.config),
      code: this.code,
      status: this.response && this.response.status ? this.response.status : null
    };
  }
});
var prototype = AxiosError.prototype;
var descriptors = {};
[
  "ERR_BAD_OPTION_VALUE",
  "ERR_BAD_OPTION",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ERR_NETWORK",
  "ERR_FR_TOO_MANY_REDIRECTS",
  "ERR_DEPRECATED",
  "ERR_BAD_RESPONSE",
  "ERR_BAD_REQUEST",
  "ERR_CANCELED",
  "ERR_NOT_SUPPORT",
  "ERR_INVALID_URL"
].forEach((code) => {
  descriptors[code] = { value: code };
});
Object.defineProperties(AxiosError, descriptors);
Object.defineProperty(prototype, "isAxiosError", { value: true });
AxiosError.from = (error, code, config, request, response, customProps) => {
  const axiosError = Object.create(prototype);
  utils_default.toFlatObject(error, axiosError, function filter(obj) {
    return obj !== Error.prototype;
  }, (prop) => {
    return prop !== "isAxiosError";
  });
  AxiosError.call(axiosError, error.message, code, config, request, response);
  axiosError.cause = error;
  axiosError.name = error.name;
  customProps && Object.assign(axiosError, customProps);
  return axiosError;
};
var AxiosError_default = AxiosError;

// node_modules/axios/lib/platform/node/classes/FormData.js
var import_form_data = __toESM(require_form_data(), 1);
var FormData_default = import_form_data.default;

// node_modules/axios/lib/helpers/toFormData.js
var isVisitable = function(thing) {
  return utils_default.isPlainObject(thing) || utils_default.isArray(thing);
};
var removeBrackets = function(key) {
  return utils_default.endsWith(key, "[]") ? key.slice(0, -2) : key;
};
var renderKey = function(path, key, dots) {
  if (!path)
    return key;
  return path.concat(key).map(function each(token, i) {
    token = removeBrackets(token);
    return !dots && i ? "[" + token + "]" : token;
  }).join(dots ? "." : "");
};
var isFlatArray = function(arr) {
  return utils_default.isArray(arr) && !arr.some(isVisitable);
};
var toFormData = function(obj, formData, options) {
  if (!utils_default.isObject(obj)) {
    throw new TypeError("target must be an object");
  }
  formData = formData || new (FormData_default || FormData);
  options = utils_default.toFlatObject(options, {
    metaTokens: true,
    dots: false,
    indexes: false
  }, false, function defined(option, source) {
    return !utils_default.isUndefined(source[option]);
  });
  const metaTokens = options.metaTokens;
  const visitor = options.visitor || defaultVisitor;
  const dots = options.dots;
  const indexes = options.indexes;
  const _Blob = options.Blob || typeof Blob !== "undefined" && Blob;
  const useBlob = _Blob && utils_default.isSpecCompliantForm(formData);
  if (!utils_default.isFunction(visitor)) {
    throw new TypeError("visitor must be a function");
  }
  function convertValue(value) {
    if (value === null)
      return "";
    if (utils_default.isDate(value)) {
      return value.toISOString();
    }
    if (!useBlob && utils_default.isBlob(value)) {
      throw new AxiosError_default("Blob is not supported. Use a Buffer instead.");
    }
    if (utils_default.isArrayBuffer(value) || utils_default.isTypedArray(value)) {
      return useBlob && typeof Blob === "function" ? new Blob([value]) : Buffer.from(value);
    }
    return value;
  }
  function defaultVisitor(value, key, path) {
    let arr = value;
    if (value && !path && typeof value === "object") {
      if (utils_default.endsWith(key, "{}")) {
        key = metaTokens ? key : key.slice(0, -2);
        value = JSON.stringify(value);
      } else if (utils_default.isArray(value) && isFlatArray(value) || (utils_default.isFileList(value) || utils_default.endsWith(key, "[]")) && (arr = utils_default.toArray(value))) {
        key = removeBrackets(key);
        arr.forEach(function each(el, index) {
          !(utils_default.isUndefined(el) || el === null) && formData.append(indexes === true ? renderKey([key], index, dots) : indexes === null ? key : key + "[]", convertValue(el));
        });
        return false;
      }
    }
    if (isVisitable(value)) {
      return true;
    }
    formData.append(renderKey(path, key, dots), convertValue(value));
    return false;
  }
  const stack = [];
  const exposedHelpers = Object.assign(predicates, {
    defaultVisitor,
    convertValue,
    isVisitable
  });
  function build(value, path) {
    if (utils_default.isUndefined(value))
      return;
    if (stack.indexOf(value) !== -1) {
      throw Error("Circular reference detected in " + path.join("."));
    }
    stack.push(value);
    utils_default.forEach(value, function each(el, key) {
      const result = !(utils_default.isUndefined(el) || el === null) && visitor.call(formData, el, utils_default.isString(key) ? key.trim() : key, path, exposedHelpers);
      if (result === true) {
        build(el, path ? path.concat(key) : [key]);
      }
    });
    stack.pop();
  }
  if (!utils_default.isObject(obj)) {
    throw new TypeError("data must be an object");
  }
  build(obj);
  return formData;
};
var predicates = utils_default.toFlatObject(utils_default, {}, null, function filter(prop) {
  return /^is[A-Z]/.test(prop);
});
var toFormData_default = toFormData;

// node_modules/axios/lib/helpers/AxiosURLSearchParams.js
var encode = function(str) {
  const charMap = {
    "!": "%21",
    "'": "%27",
    "(": "%28",
    ")": "%29",
    "~": "%7E",
    "%20": "+",
    "%00": "\0"
  };
  return encodeURIComponent(str).replace(/[!'()~]|%20|%00/g, function replacer(match) {
    return charMap[match];
  });
};
var AxiosURLSearchParams = function(params, options) {
  this._pairs = [];
  params && toFormData_default(params, this, options);
};
var prototype2 = AxiosURLSearchParams.prototype;
prototype2.append = function append(name, value) {
  this._pairs.push([name, value]);
};
prototype2.toString = function toString2(encoder) {
  const _encode = encoder ? function(value) {
    return encoder.call(this, value, encode);
  } : encode;
  return this._pairs.map(function each(pair) {
    return _encode(pair[0]) + "=" + _encode(pair[1]);
  }, "").join("&");
};
var AxiosURLSearchParams_default = AxiosURLSearchParams;

// node_modules/axios/lib/helpers/buildURL.js
var encode2 = function(val) {
  return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]");
};
function buildURL(url, params, options) {
  if (!params) {
    return url;
  }
  const _encode = options && options.encode || encode2;
  const serializeFn = options && options.serialize;
  let serializedParams;
  if (serializeFn) {
    serializedParams = serializeFn(params, options);
  } else {
    serializedParams = utils_default.isURLSearchParams(params) ? params.toString() : new AxiosURLSearchParams_default(params, options).toString(_encode);
  }
  if (serializedParams) {
    const hashmarkIndex = url.indexOf("#");
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
    url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
  }
  return url;
}

// node_modules/axios/lib/core/InterceptorManager.js
class InterceptorManager {
  constructor() {
    this.handlers = [];
  }
  use(fulfilled, rejected, options) {
    this.handlers.push({
      fulfilled,
      rejected,
      synchronous: options ? options.synchronous : false,
      runWhen: options ? options.runWhen : null
    });
    return this.handlers.length - 1;
  }
  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }
  clear() {
    if (this.handlers) {
      this.handlers = [];
    }
  }
  forEach(fn) {
    utils_default.forEach(this.handlers, function forEachHandler(h) {
      if (h !== null) {
        fn(h);
      }
    });
  }
}
var InterceptorManager_default = InterceptorManager;

// node_modules/axios/lib/defaults/transitional.js
var transitional_default = {
  silentJSONParsing: true,
  forcedJSONParsing: true,
  clarifyTimeoutError: false
};

// node_modules/axios/lib/platform/node/classes/URLSearchParams.js
import url from "url";
var URLSearchParams_default = url.URLSearchParams;

// node_modules/axios/lib/platform/node/index.js
var node_default = {
  isNode: true,
  classes: {
    URLSearchParams: URLSearchParams_default,
    FormData: FormData_default,
    Blob: typeof Blob !== "undefined" && Blob || null
  },
  protocols: ["http", "https", "file", "data"]
};

// node_modules/axios/lib/platform/common/utils.js
var exports_utils = {};
__export(exports_utils, {
  hasStandardBrowserWebWorkerEnv: () => {
    {
      return hasStandardBrowserWebWorkerEnv;
    }
  },
  hasStandardBrowserEnv: () => {
    {
      return hasStandardBrowserEnv;
    }
  },
  hasBrowserEnv: () => {
    {
      return hasBrowserEnv;
    }
  }
});
var hasBrowserEnv = typeof window !== "undefined" && typeof document !== "undefined";
var hasStandardBrowserEnv = ((product) => {
  return hasBrowserEnv && ["ReactNative", "NativeScript", "NS"].indexOf(product) < 0;
})(typeof navigator !== "undefined" && navigator.product);
var hasStandardBrowserWebWorkerEnv = (() => {
  return typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope && typeof self.importScripts === "function";
})();

// node_modules/axios/lib/platform/index.js
var platform_default = {
  ...exports_utils,
  ...node_default
};

// node_modules/axios/lib/helpers/toURLEncodedForm.js
function toURLEncodedForm(data, options) {
  return toFormData_default(data, new platform_default.classes.URLSearchParams, Object.assign({
    visitor: function(value, key, path, helpers) {
      if (platform_default.isNode && utils_default.isBuffer(value)) {
        this.append(key, value.toString("base64"));
        return false;
      }
      return helpers.defaultVisitor.apply(this, arguments);
    }
  }, options));
}

// node_modules/axios/lib/helpers/formDataToJSON.js
var parsePropPath = function(name) {
  return utils_default.matchAll(/\w+|\[(\w*)]/g, name).map((match) => {
    return match[0] === "[]" ? "" : match[1] || match[0];
  });
};
var arrayToObject = function(arr) {
  const obj = {};
  const keys = Object.keys(arr);
  let i;
  const len = keys.length;
  let key;
  for (i = 0;i < len; i++) {
    key = keys[i];
    obj[key] = arr[key];
  }
  return obj;
};
var formDataToJSON = function(formData) {
  function buildPath(path, value, target, index) {
    let name = path[index++];
    const isNumericKey = Number.isFinite(+name);
    const isLast = index >= path.length;
    name = !name && utils_default.isArray(target) ? target.length : name;
    if (isLast) {
      if (utils_default.hasOwnProp(target, name)) {
        target[name] = [target[name], value];
      } else {
        target[name] = value;
      }
      return !isNumericKey;
    }
    if (!target[name] || !utils_default.isObject(target[name])) {
      target[name] = [];
    }
    const result = buildPath(path, value, target[name], index);
    if (result && utils_default.isArray(target[name])) {
      target[name] = arrayToObject(target[name]);
    }
    return !isNumericKey;
  }
  if (utils_default.isFormData(formData) && utils_default.isFunction(formData.entries)) {
    const obj = {};
    utils_default.forEachEntry(formData, (name, value) => {
      buildPath(parsePropPath(name), value, obj, 0);
    });
    return obj;
  }
  return null;
};
var formDataToJSON_default = formDataToJSON;

// node_modules/axios/lib/defaults/index.js
var stringifySafely = function(rawValue, parser, encoder) {
  if (utils_default.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);
      return utils_default.trim(rawValue);
    } catch (e) {
      if (e.name !== "SyntaxError") {
        throw e;
      }
    }
  }
  return (encoder || JSON.stringify)(rawValue);
};
var defaults = {
  transitional: transitional_default,
  adapter: ["xhr", "http"],
  transformRequest: [function transformRequest(data, headers) {
    const contentType = headers.getContentType() || "";
    const hasJSONContentType = contentType.indexOf("application/json") > -1;
    const isObjectPayload = utils_default.isObject(data);
    if (isObjectPayload && utils_default.isHTMLForm(data)) {
      data = new FormData(data);
    }
    const isFormData2 = utils_default.isFormData(data);
    if (isFormData2) {
      if (!hasJSONContentType) {
        return data;
      }
      return hasJSONContentType ? JSON.stringify(formDataToJSON_default(data)) : data;
    }
    if (utils_default.isArrayBuffer(data) || utils_default.isBuffer(data) || utils_default.isStream(data) || utils_default.isFile(data) || utils_default.isBlob(data)) {
      return data;
    }
    if (utils_default.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils_default.isURLSearchParams(data)) {
      headers.setContentType("application/x-www-form-urlencoded;charset=utf-8", false);
      return data.toString();
    }
    let isFileList2;
    if (isObjectPayload) {
      if (contentType.indexOf("application/x-www-form-urlencoded") > -1) {
        return toURLEncodedForm(data, this.formSerializer).toString();
      }
      if ((isFileList2 = utils_default.isFileList(data)) || contentType.indexOf("multipart/form-data") > -1) {
        const _FormData = this.env && this.env.FormData;
        return toFormData_default(isFileList2 ? { "files[]": data } : data, _FormData && new _FormData, this.formSerializer);
      }
    }
    if (isObjectPayload || hasJSONContentType) {
      headers.setContentType("application/json", false);
      return stringifySafely(data);
    }
    return data;
  }],
  transformResponse: [function transformResponse(data) {
    const transitional2 = this.transitional || defaults.transitional;
    const forcedJSONParsing = transitional2 && transitional2.forcedJSONParsing;
    const JSONRequested = this.responseType === "json";
    if (data && utils_default.isString(data) && (forcedJSONParsing && !this.responseType || JSONRequested)) {
      const silentJSONParsing = transitional2 && transitional2.silentJSONParsing;
      const strictJSONParsing = !silentJSONParsing && JSONRequested;
      try {
        return JSON.parse(data);
      } catch (e) {
        if (strictJSONParsing) {
          if (e.name === "SyntaxError") {
            throw AxiosError_default.from(e, AxiosError_default.ERR_BAD_RESPONSE, this, null, this.response);
          }
          throw e;
        }
      }
    }
    return data;
  }],
  timeout: 0,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  maxContentLength: -1,
  maxBodyLength: -1,
  env: {
    FormData: platform_default.classes.FormData,
    Blob: platform_default.classes.Blob
  },
  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  },
  headers: {
    common: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": undefined
    }
  }
};
utils_default.forEach(["delete", "get", "head", "post", "put", "patch"], (method) => {
  defaults.headers[method] = {};
});
var defaults_default = defaults;

// node_modules/axios/lib/helpers/parseHeaders.js
var ignoreDuplicateOf = utils_default.toObjectSet([
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "user-agent"
]);
var parseHeaders_default = (rawHeaders) => {
  const parsed = {};
  let key;
  let val;
  let i;
  rawHeaders && rawHeaders.split("\n").forEach(function parser(line) {
    i = line.indexOf(":");
    key = line.substring(0, i).trim().toLowerCase();
    val = line.substring(i + 1).trim();
    if (!key || parsed[key] && ignoreDuplicateOf[key]) {
      return;
    }
    if (key === "set-cookie") {
      if (parsed[key]) {
        parsed[key].push(val);
      } else {
        parsed[key] = [val];
      }
    } else {
      parsed[key] = parsed[key] ? parsed[key] + ", " + val : val;
    }
  });
  return parsed;
};

// node_modules/axios/lib/core/AxiosHeaders.js
var normalizeHeader = function(header) {
  return header && String(header).trim().toLowerCase();
};
var normalizeValue = function(value) {
  if (value === false || value == null) {
    return value;
  }
  return utils_default.isArray(value) ? value.map(normalizeValue) : String(value);
};
var parseTokens = function(str) {
  const tokens = Object.create(null);
  const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let match;
  while (match = tokensRE.exec(str)) {
    tokens[match[1]] = match[2];
  }
  return tokens;
};
var matchHeaderValue = function(context, value, header, filter2, isHeaderNameFilter) {
  if (utils_default.isFunction(filter2)) {
    return filter2.call(this, value, header);
  }
  if (isHeaderNameFilter) {
    value = header;
  }
  if (!utils_default.isString(value))
    return;
  if (utils_default.isString(filter2)) {
    return value.indexOf(filter2) !== -1;
  }
  if (utils_default.isRegExp(filter2)) {
    return filter2.test(value);
  }
};
var formatHeader = function(header) {
  return header.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str) => {
    return char.toUpperCase() + str;
  });
};
var buildAccessors = function(obj, header) {
  const accessorName = utils_default.toCamelCase(" " + header);
  ["get", "set", "has"].forEach((methodName) => {
    Object.defineProperty(obj, methodName + accessorName, {
      value: function(arg1, arg2, arg3) {
        return this[methodName].call(this, header, arg1, arg2, arg3);
      },
      configurable: true
    });
  });
};
var $internals = Symbol("internals");
var isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());

class AxiosHeaders {
  constructor(headers) {
    headers && this.set(headers);
  }
  set(header, valueOrRewrite, rewrite) {
    const self2 = this;
    function setHeader(_value, _header, _rewrite) {
      const lHeader = normalizeHeader(_header);
      if (!lHeader) {
        throw new Error("header name must be a non-empty string");
      }
      const key = utils_default.findKey(self2, lHeader);
      if (!key || self2[key] === undefined || _rewrite === true || _rewrite === undefined && self2[key] !== false) {
        self2[key || _header] = normalizeValue(_value);
      }
    }
    const setHeaders = (headers, _rewrite) => utils_default.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));
    if (utils_default.isPlainObject(header) || header instanceof this.constructor) {
      setHeaders(header, valueOrRewrite);
    } else if (utils_default.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
      setHeaders(parseHeaders_default(header), valueOrRewrite);
    } else {
      header != null && setHeader(valueOrRewrite, header, rewrite);
    }
    return this;
  }
  get(header, parser) {
    header = normalizeHeader(header);
    if (header) {
      const key = utils_default.findKey(this, header);
      if (key) {
        const value = this[key];
        if (!parser) {
          return value;
        }
        if (parser === true) {
          return parseTokens(value);
        }
        if (utils_default.isFunction(parser)) {
          return parser.call(this, value, key);
        }
        if (utils_default.isRegExp(parser)) {
          return parser.exec(value);
        }
        throw new TypeError("parser must be boolean|regexp|function");
      }
    }
  }
  has(header, matcher) {
    header = normalizeHeader(header);
    if (header) {
      const key = utils_default.findKey(this, header);
      return !!(key && this[key] !== undefined && (!matcher || matchHeaderValue(this, this[key], key, matcher)));
    }
    return false;
  }
  delete(header, matcher) {
    const self2 = this;
    let deleted = false;
    function deleteHeader(_header) {
      _header = normalizeHeader(_header);
      if (_header) {
        const key = utils_default.findKey(self2, _header);
        if (key && (!matcher || matchHeaderValue(self2, self2[key], key, matcher))) {
          delete self2[key];
          deleted = true;
        }
      }
    }
    if (utils_default.isArray(header)) {
      header.forEach(deleteHeader);
    } else {
      deleteHeader(header);
    }
    return deleted;
  }
  clear(matcher) {
    const keys = Object.keys(this);
    let i = keys.length;
    let deleted = false;
    while (i--) {
      const key = keys[i];
      if (!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
        delete this[key];
        deleted = true;
      }
    }
    return deleted;
  }
  normalize(format) {
    const self2 = this;
    const headers = {};
    utils_default.forEach(this, (value, header) => {
      const key = utils_default.findKey(headers, header);
      if (key) {
        self2[key] = normalizeValue(value);
        delete self2[header];
        return;
      }
      const normalized = format ? formatHeader(header) : String(header).trim();
      if (normalized !== header) {
        delete self2[header];
      }
      self2[normalized] = normalizeValue(value);
      headers[normalized] = true;
    });
    return this;
  }
  concat(...targets) {
    return this.constructor.concat(this, ...targets);
  }
  toJSON(asStrings) {
    const obj = Object.create(null);
    utils_default.forEach(this, (value, header) => {
      value != null && value !== false && (obj[header] = asStrings && utils_default.isArray(value) ? value.join(", ") : value);
    });
    return obj;
  }
  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }
  toString() {
    return Object.entries(this.toJSON()).map(([header, value]) => header + ": " + value).join("\n");
  }
  get [Symbol.toStringTag]() {
    return "AxiosHeaders";
  }
  static from(thing) {
    return thing instanceof this ? thing : new this(thing);
  }
  static concat(first, ...targets) {
    const computed = new this(first);
    targets.forEach((target) => computed.set(target));
    return computed;
  }
  static accessor(header) {
    const internals = this[$internals] = this[$internals] = {
      accessors: {}
    };
    const accessors = internals.accessors;
    const prototype3 = this.prototype;
    function defineAccessor(_header) {
      const lHeader = normalizeHeader(_header);
      if (!accessors[lHeader]) {
        buildAccessors(prototype3, _header);
        accessors[lHeader] = true;
      }
    }
    utils_default.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);
    return this;
  }
}
AxiosHeaders.accessor(["Content-Type", "Content-Length", "Accept", "Accept-Encoding", "User-Agent", "Authorization"]);
utils_default.reduceDescriptors(AxiosHeaders.prototype, ({ value }, key) => {
  let mapped = key[0].toUpperCase() + key.slice(1);
  return {
    get: () => value,
    set(headerValue) {
      this[mapped] = headerValue;
    }
  };
});
utils_default.freezeMethods(AxiosHeaders);
var AxiosHeaders_default = AxiosHeaders;

// node_modules/axios/lib/core/transformData.js
function transformData(fns, response) {
  const config = this || defaults_default;
  const context = response || config;
  const headers = AxiosHeaders_default.from(context.headers);
  let data = context.data;
  utils_default.forEach(fns, function transform(fn) {
    data = fn.call(config, data, headers.normalize(), response ? response.status : undefined);
  });
  headers.normalize();
  return data;
}

// node_modules/axios/lib/cancel/isCancel.js
function isCancel(value) {
  return !!(value && value.__CANCEL__);
}

// node_modules/axios/lib/cancel/CanceledError.js
var CanceledError = function(message, config, request) {
  AxiosError_default.call(this, message == null ? "canceled" : message, AxiosError_default.ERR_CANCELED, config, request);
  this.name = "CanceledError";
};
utils_default.inherits(CanceledError, AxiosError_default, {
  __CANCEL__: true
});
var CanceledError_default = CanceledError;

// node_modules/axios/lib/core/settle.js
function settle(resolve, reject, response) {
  const validateStatus2 = response.config.validateStatus;
  if (!response.status || !validateStatus2 || validateStatus2(response.status)) {
    resolve(response);
  } else {
    reject(new AxiosError_default("Request failed with status code " + response.status, [AxiosError_default.ERR_BAD_REQUEST, AxiosError_default.ERR_BAD_RESPONSE][Math.floor(response.status / 100) - 4], response.config, response.request, response));
  }
}

// node_modules/axios/lib/helpers/isAbsoluteURL.js
function isAbsoluteURL(url2) {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url2);
}

// node_modules/axios/lib/helpers/combineURLs.js
function combineURLs(baseURL, relativeURL) {
  return relativeURL ? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
}

// node_modules/axios/lib/core/buildFullPath.js
function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
}

// node_modules/proxy-from-env/index.js
var getProxyForUrl = function(url2) {
  var parsedUrl = typeof url2 === "string" ? parseUrl(url2) : url2 || {};
  var proto = parsedUrl.protocol;
  var hostname = parsedUrl.host;
  var port = parsedUrl.port;
  if (typeof hostname !== "string" || !hostname || typeof proto !== "string") {
    return "";
  }
  proto = proto.split(":", 1)[0];
  hostname = hostname.replace(/:\d*$/, "");
  port = parseInt(port) || DEFAULT_PORTS[proto] || 0;
  if (!shouldProxy(hostname, port)) {
    return "";
  }
  var proxy = getEnv("npm_config_" + proto + "_proxy") || getEnv(proto + "_proxy") || getEnv("npm_config_proxy") || getEnv("all_proxy");
  if (proxy && proxy.indexOf("://") === -1) {
    proxy = proto + "://" + proxy;
  }
  return proxy;
};
var shouldProxy = function(hostname, port) {
  var NO_PROXY = (getEnv("npm_config_no_proxy") || getEnv("no_proxy")).toLowerCase();
  if (!NO_PROXY) {
    return true;
  }
  if (NO_PROXY === "*") {
    return false;
  }
  return NO_PROXY.split(/[,\s]/).every(function(proxy) {
    if (!proxy) {
      return true;
    }
    var parsedProxy = proxy.match(/^(.+):(\d+)$/);
    var parsedProxyHostname = parsedProxy ? parsedProxy[1] : proxy;
    var parsedProxyPort = parsedProxy ? parseInt(parsedProxy[2]) : 0;
    if (parsedProxyPort && parsedProxyPort !== port) {
      return true;
    }
    if (!/^[.*]/.test(parsedProxyHostname)) {
      return hostname !== parsedProxyHostname;
    }
    if (parsedProxyHostname.charAt(0) === "*") {
      parsedProxyHostname = parsedProxyHostname.slice(1);
    }
    return !stringEndsWith.call(hostname, parsedProxyHostname);
  });
};
var getEnv = function(key) {
  return process.env[key.toLowerCase()] || process.env[key.toUpperCase()] || "";
};
var parseUrl = __require("url").parse;
var DEFAULT_PORTS = {
  ftp: 21,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
};
var stringEndsWith = String.prototype.endsWith || function(s) {
  return s.length <= this.length && this.indexOf(s, this.length - s.length) !== -1;
};
var $getProxyForUrl = getProxyForUrl;

// node_modules/axios/lib/adapters/http.js
var import_follow_redirects = __toESM(require_follow_redirects(), 1);
import http from "http";
import https from "https";
import util from "util";
import zlib from "zlib";

// node_modules/axios/lib/env/data.js
var VERSION = "1.6.2";

// node_modules/axios/lib/helpers/parseProtocol.js
function parseProtocol(url2) {
  const match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url2);
  return match && match[1] || "";
}

// node_modules/axios/lib/helpers/fromDataURI.js
var DATA_URL_PATTERN = /^(?:([^;]+);)?(?:[^;]+;)?(base64|),([\s\S]*)$/;
function fromDataURI(uri, asBlob, options) {
  const _Blob = options && options.Blob || platform_default.classes.Blob;
  const protocol = parseProtocol(uri);
  if (asBlob === undefined && _Blob) {
    asBlob = true;
  }
  if (protocol === "data") {
    uri = protocol.length ? uri.slice(protocol.length + 1) : uri;
    const match = DATA_URL_PATTERN.exec(uri);
    if (!match) {
      throw new AxiosError_default("Invalid URL", AxiosError_default.ERR_INVALID_URL);
    }
    const mime = match[1];
    const isBase64 = match[2];
    const body = match[3];
    const buffer = Buffer.from(decodeURIComponent(body), isBase64 ? "base64" : "utf8");
    if (asBlob) {
      if (!_Blob) {
        throw new AxiosError_default("Blob is not supported", AxiosError_default.ERR_NOT_SUPPORT);
      }
      return new _Blob([buffer], { type: mime });
    }
    return buffer;
  }
  throw new AxiosError_default("Unsupported protocol " + protocol, AxiosError_default.ERR_NOT_SUPPORT);
}

// node_modules/axios/lib/adapters/http.js
import stream3 from "stream";

// node_modules/axios/lib/helpers/AxiosTransformStream.js
import stream from "stream";

// node_modules/axios/lib/helpers/throttle.js
var throttle = function(fn, freq) {
  let timestamp = 0;
  const threshold = 1000 / freq;
  let timer = null;
  return function throttled(force, args) {
    const now = Date.now();
    if (force || now - timestamp > threshold) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      timestamp = now;
      return fn.apply(null, args);
    }
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        timestamp = Date.now();
        return fn.apply(null, args);
      }, threshold - (now - timestamp));
    }
  };
};
var throttle_default = throttle;

// node_modules/axios/lib/helpers/speedometer.js
var speedometer = function(samplesCount, min) {
  samplesCount = samplesCount || 10;
  const bytes = new Array(samplesCount);
  const timestamps = new Array(samplesCount);
  let head = 0;
  let tail = 0;
  let firstSampleTS;
  min = min !== undefined ? min : 1000;
  return function push(chunkLength) {
    const now = Date.now();
    const startedAt = timestamps[tail];
    if (!firstSampleTS) {
      firstSampleTS = now;
    }
    bytes[head] = chunkLength;
    timestamps[head] = now;
    let i = tail;
    let bytesCount = 0;
    while (i !== head) {
      bytesCount += bytes[i++];
      i = i % samplesCount;
    }
    head = (head + 1) % samplesCount;
    if (head === tail) {
      tail = (tail + 1) % samplesCount;
    }
    if (now - firstSampleTS < min) {
      return;
    }
    const passed = startedAt && now - startedAt;
    return passed ? Math.round(bytesCount * 1000 / passed) : undefined;
  };
};
var speedometer_default = speedometer;

// node_modules/axios/lib/helpers/AxiosTransformStream.js
var kInternals = Symbol("internals");

class AxiosTransformStream extends stream.Transform {
  constructor(options) {
    options = utils_default.toFlatObject(options, {
      maxRate: 0,
      chunkSize: 64 * 1024,
      minChunkSize: 100,
      timeWindow: 500,
      ticksRate: 2,
      samplesCount: 15
    }, null, (prop, source) => {
      return !utils_default.isUndefined(source[prop]);
    });
    super({
      readableHighWaterMark: options.chunkSize
    });
    const self2 = this;
    const internals = this[kInternals] = {
      length: options.length,
      timeWindow: options.timeWindow,
      ticksRate: options.ticksRate,
      chunkSize: options.chunkSize,
      maxRate: options.maxRate,
      minChunkSize: options.minChunkSize,
      bytesSeen: 0,
      isCaptured: false,
      notifiedBytesLoaded: 0,
      ts: Date.now(),
      bytes: 0,
      onReadCallback: null
    };
    const _speedometer = speedometer_default(internals.ticksRate * options.samplesCount, internals.timeWindow);
    this.on("newListener", (event) => {
      if (event === "progress") {
        if (!internals.isCaptured) {
          internals.isCaptured = true;
        }
      }
    });
    let bytesNotified = 0;
    internals.updateProgress = throttle_default(function throttledHandler() {
      const totalBytes = internals.length;
      const bytesTransferred = internals.bytesSeen;
      const progressBytes = bytesTransferred - bytesNotified;
      if (!progressBytes || self2.destroyed)
        return;
      const rate = _speedometer(progressBytes);
      bytesNotified = bytesTransferred;
      process.nextTick(() => {
        self2.emit("progress", {
          loaded: bytesTransferred,
          total: totalBytes,
          progress: totalBytes ? bytesTransferred / totalBytes : undefined,
          bytes: progressBytes,
          rate: rate ? rate : undefined,
          estimated: rate && totalBytes && bytesTransferred <= totalBytes ? (totalBytes - bytesTransferred) / rate : undefined
        });
      });
    }, internals.ticksRate);
    const onFinish = () => {
      internals.updateProgress(true);
    };
    this.once("end", onFinish);
    this.once("error", onFinish);
  }
  _read(size) {
    const internals = this[kInternals];
    if (internals.onReadCallback) {
      internals.onReadCallback();
    }
    return super._read(size);
  }
  _transform(chunk, encoding, callback) {
    const self2 = this;
    const internals = this[kInternals];
    const maxRate = internals.maxRate;
    const readableHighWaterMark = this.readableHighWaterMark;
    const timeWindow = internals.timeWindow;
    const divider = 1000 / timeWindow;
    const bytesThreshold = maxRate / divider;
    const minChunkSize = internals.minChunkSize !== false ? Math.max(internals.minChunkSize, bytesThreshold * 0.01) : 0;
    function pushChunk(_chunk, _callback) {
      const bytes = Buffer.byteLength(_chunk);
      internals.bytesSeen += bytes;
      internals.bytes += bytes;
      if (internals.isCaptured) {
        internals.updateProgress();
      }
      if (self2.push(_chunk)) {
        process.nextTick(_callback);
      } else {
        internals.onReadCallback = () => {
          internals.onReadCallback = null;
          process.nextTick(_callback);
        };
      }
    }
    const transformChunk = (_chunk, _callback) => {
      const chunkSize = Buffer.byteLength(_chunk);
      let chunkRemainder = null;
      let maxChunkSize = readableHighWaterMark;
      let bytesLeft;
      let passed = 0;
      if (maxRate) {
        const now = Date.now();
        if (!internals.ts || (passed = now - internals.ts) >= timeWindow) {
          internals.ts = now;
          bytesLeft = bytesThreshold - internals.bytes;
          internals.bytes = bytesLeft < 0 ? -bytesLeft : 0;
          passed = 0;
        }
        bytesLeft = bytesThreshold - internals.bytes;
      }
      if (maxRate) {
        if (bytesLeft <= 0) {
          return setTimeout(() => {
            _callback(null, _chunk);
          }, timeWindow - passed);
        }
        if (bytesLeft < maxChunkSize) {
          maxChunkSize = bytesLeft;
        }
      }
      if (maxChunkSize && chunkSize > maxChunkSize && chunkSize - maxChunkSize > minChunkSize) {
        chunkRemainder = _chunk.subarray(maxChunkSize);
        _chunk = _chunk.subarray(0, maxChunkSize);
      }
      pushChunk(_chunk, chunkRemainder ? () => {
        process.nextTick(_callback, null, chunkRemainder);
      } : _callback);
    };
    transformChunk(chunk, function transformNextChunk(err, _chunk) {
      if (err) {
        return callback(err);
      }
      if (_chunk) {
        transformChunk(_chunk, transformNextChunk);
      } else {
        callback(null);
      }
    });
  }
  setLength(length) {
    this[kInternals].length = +length;
    return this;
  }
}
var AxiosTransformStream_default = AxiosTransformStream;

// node_modules/axios/lib/adapters/http.js
import EventEmitter from "events";

// node_modules/axios/lib/helpers/formDataToStream.js
import {TextEncoder} from "util";
import {Readable} from "stream";

// node_modules/axios/lib/helpers/readBlob.js
var { asyncIterator } = Symbol;
var readBlob = async function* (blob) {
  if (blob.stream) {
    yield* blob.stream();
  } else if (blob.arrayBuffer) {
    yield await blob.arrayBuffer();
  } else if (blob[asyncIterator]) {
    yield* blob[asyncIterator]();
  } else {
    yield blob;
  }
};
var readBlob_default = readBlob;

// node_modules/axios/lib/helpers/formDataToStream.js
var BOUNDARY_ALPHABET = utils_default.ALPHABET.ALPHA_DIGIT + "-_";
var textEncoder = new TextEncoder;
var CRLF = "\r\n";
var CRLF_BYTES = textEncoder.encode(CRLF);
var CRLF_BYTES_COUNT = 2;

class FormDataPart {
  constructor(name, value) {
    const { escapeName } = this.constructor;
    const isStringValue = utils_default.isString(value);
    let headers = `Content-Disposition: form-data; name="${escapeName(name)}"${!isStringValue && value.name ? `; filename="${escapeName(value.name)}"` : ""}${CRLF}`;
    if (isStringValue) {
      value = textEncoder.encode(String(value).replace(/\r?\n|\r\n?/g, CRLF));
    } else {
      headers += `Content-Type: ${value.type || "application/octet-stream"}${CRLF}`;
    }
    this.headers = textEncoder.encode(headers + CRLF);
    this.contentLength = isStringValue ? value.byteLength : value.size;
    this.size = this.headers.byteLength + this.contentLength + CRLF_BYTES_COUNT;
    this.name = name;
    this.value = value;
  }
  async* encode() {
    yield this.headers;
    const { value } = this;
    if (utils_default.isTypedArray(value)) {
      yield value;
    } else {
      yield* readBlob_default(value);
    }
    yield CRLF_BYTES;
  }
  static escapeName(name) {
    return String(name).replace(/[\r\n"]/g, (match) => ({
      "\r": "%0D",
      "\n": "%0A",
      '"': "%22"
    })[match]);
  }
}
var formDataToStream = (form, headersHandler, options) => {
  const {
    tag = "form-data-boundary",
    size = 25,
    boundary = tag + "-" + utils_default.generateString(size, BOUNDARY_ALPHABET)
  } = options || {};
  if (!utils_default.isFormData(form)) {
    throw TypeError("FormData instance required");
  }
  if (boundary.length < 1 || boundary.length > 70) {
    throw Error("boundary must be 10-70 characters long");
  }
  const boundaryBytes = textEncoder.encode("--" + boundary + CRLF);
  const footerBytes = textEncoder.encode("--" + boundary + "--" + CRLF + CRLF);
  let contentLength = footerBytes.byteLength;
  const parts = Array.from(form.entries()).map(([name, value]) => {
    const part = new FormDataPart(name, value);
    contentLength += part.size;
    return part;
  });
  contentLength += boundaryBytes.byteLength * parts.length;
  contentLength = utils_default.toFiniteNumber(contentLength);
  const computedHeaders = {
    "Content-Type": `multipart/form-data; boundary=${boundary}`
  };
  if (Number.isFinite(contentLength)) {
    computedHeaders["Content-Length"] = contentLength;
  }
  headersHandler && headersHandler(computedHeaders);
  return Readable.from(async function* () {
    for (const part of parts) {
      yield boundaryBytes;
      yield* part.encode();
    }
    yield footerBytes;
  }());
};
var formDataToStream_default = formDataToStream;

// node_modules/axios/lib/helpers/ZlibHeaderTransformStream.js
import stream2 from "stream";

class ZlibHeaderTransformStream extends stream2.Transform {
  __transform(chunk, encoding, callback) {
    this.push(chunk);
    callback();
  }
  _transform(chunk, encoding, callback) {
    if (chunk.length !== 0) {
      this._transform = this.__transform;
      if (chunk[0] !== 120) {
        const header = Buffer.alloc(2);
        header[0] = 120;
        header[1] = 156;
        this.push(header, encoding);
      }
    }
    this.__transform(chunk, encoding, callback);
  }
}
var ZlibHeaderTransformStream_default = ZlibHeaderTransformStream;

// node_modules/axios/lib/helpers/callbackify.js
var callbackify = (fn, reducer) => {
  return utils_default.isAsyncFn(fn) ? function(...args) {
    const cb = args.pop();
    fn.apply(this, args).then((value) => {
      try {
        reducer ? cb(null, ...reducer(value)) : cb(null, value);
      } catch (err) {
        cb(err);
      }
    }, cb);
  } : fn;
};
var callbackify_default = callbackify;

// node_modules/axios/lib/adapters/http.js
var dispatchBeforeRedirect = function(options) {
  if (options.beforeRedirects.proxy) {
    options.beforeRedirects.proxy(options);
  }
  if (options.beforeRedirects.config) {
    options.beforeRedirects.config(options);
  }
};
var setProxy = function(options, configProxy, location) {
  let proxy = configProxy;
  if (!proxy && proxy !== false) {
    const proxyUrl = $getProxyForUrl(location);
    if (proxyUrl) {
      proxy = new URL(proxyUrl);
    }
  }
  if (proxy) {
    if (proxy.username) {
      proxy.auth = (proxy.username || "") + ":" + (proxy.password || "");
    }
    if (proxy.auth) {
      if (proxy.auth.username || proxy.auth.password) {
        proxy.auth = (proxy.auth.username || "") + ":" + (proxy.auth.password || "");
      }
      const base64 = Buffer.from(proxy.auth, "utf8").toString("base64");
      options.headers["Proxy-Authorization"] = "Basic " + base64;
    }
    options.headers.host = options.hostname + (options.port ? ":" + options.port : "");
    const proxyHost = proxy.hostname || proxy.host;
    options.hostname = proxyHost;
    options.host = proxyHost;
    options.port = proxy.port;
    options.path = location;
    if (proxy.protocol) {
      options.protocol = proxy.protocol.includes(":") ? proxy.protocol : `${proxy.protocol}:`;
    }
  }
  options.beforeRedirects.proxy = function beforeRedirect(redirectOptions) {
    setProxy(redirectOptions, configProxy, redirectOptions.href);
  };
};
var zlibOptions = {
  flush: zlib.constants.Z_SYNC_FLUSH,
  finishFlush: zlib.constants.Z_SYNC_FLUSH
};
var brotliOptions = {
  flush: zlib.constants.BROTLI_OPERATION_FLUSH,
  finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH
};
var isBrotliSupported = utils_default.isFunction(zlib.createBrotliDecompress);
var { http: httpFollow, https: httpsFollow } = import_follow_redirects.default;
var isHttps = /https:?/;
var supportedProtocols = platform_default.protocols.map((protocol) => {
  return protocol + ":";
});
var isHttpAdapterSupported = typeof process !== "undefined" && utils_default.kindOf(process) === "process";
var wrapAsync = (asyncExecutor) => {
  return new Promise((resolve, reject) => {
    let onDone;
    let isDone;
    const done = (value, isRejected) => {
      if (isDone)
        return;
      isDone = true;
      onDone && onDone(value, isRejected);
    };
    const _resolve = (value) => {
      done(value);
      resolve(value);
    };
    const _reject = (reason) => {
      done(reason, true);
      reject(reason);
    };
    asyncExecutor(_resolve, _reject, (onDoneHandler) => onDone = onDoneHandler).catch(_reject);
  });
};
var resolveFamily = ({ address, family }) => {
  if (!utils_default.isString(address)) {
    throw TypeError("address must be a string");
  }
  return {
    address,
    family: family || (address.indexOf(".") < 0 ? 6 : 4)
  };
};
var buildAddressEntry = (address, family) => resolveFamily(utils_default.isObject(address) ? address : { address, family });
var http_default = isHttpAdapterSupported && function httpAdapter(config) {
  return wrapAsync(async function dispatchHttpRequest(resolve, reject, onDone) {
    let { data: data2, lookup, family } = config;
    const { responseType, responseEncoding } = config;
    const method = config.method.toUpperCase();
    let isDone;
    let rejected = false;
    let req;
    if (lookup) {
      const _lookup = callbackify_default(lookup, (value) => utils_default.isArray(value) ? value : [value]);
      lookup = (hostname, opt, cb) => {
        _lookup(hostname, opt, (err, arg0, arg1) => {
          const addresses = utils_default.isArray(arg0) ? arg0.map((addr) => buildAddressEntry(addr)) : [buildAddressEntry(arg0, arg1)];
          opt.all ? cb(err, addresses) : cb(err, addresses[0].address, addresses[0].family);
        });
      };
    }
    const emitter = new EventEmitter;
    const onFinished = () => {
      if (config.cancelToken) {
        config.cancelToken.unsubscribe(abort);
      }
      if (config.signal) {
        config.signal.removeEventListener("abort", abort);
      }
      emitter.removeAllListeners();
    };
    onDone((value, isRejected) => {
      isDone = true;
      if (isRejected) {
        rejected = true;
        onFinished();
      }
    });
    function abort(reason) {
      emitter.emit("abort", !reason || reason.type ? new CanceledError_default(null, config, req) : reason);
    }
    emitter.once("abort", reject);
    if (config.cancelToken || config.signal) {
      config.cancelToken && config.cancelToken.subscribe(abort);
      if (config.signal) {
        config.signal.aborted ? abort() : config.signal.addEventListener("abort", abort);
      }
    }
    const fullPath = buildFullPath(config.baseURL, config.url);
    const parsed = new URL(fullPath, "http://localhost");
    const protocol = parsed.protocol || supportedProtocols[0];
    if (protocol === "data:") {
      let convertedData;
      if (method !== "GET") {
        return settle(resolve, reject, {
          status: 405,
          statusText: "method not allowed",
          headers: {},
          config
        });
      }
      try {
        convertedData = fromDataURI(config.url, responseType === "blob", {
          Blob: config.env && config.env.Blob
        });
      } catch (err) {
        throw AxiosError_default.from(err, AxiosError_default.ERR_BAD_REQUEST, config);
      }
      if (responseType === "text") {
        convertedData = convertedData.toString(responseEncoding);
        if (!responseEncoding || responseEncoding === "utf8") {
          convertedData = utils_default.stripBOM(convertedData);
        }
      } else if (responseType === "stream") {
        convertedData = stream3.Readable.from(convertedData);
      }
      return settle(resolve, reject, {
        data: convertedData,
        status: 200,
        statusText: "OK",
        headers: new AxiosHeaders_default,
        config
      });
    }
    if (supportedProtocols.indexOf(protocol) === -1) {
      return reject(new AxiosError_default("Unsupported protocol " + protocol, AxiosError_default.ERR_BAD_REQUEST, config));
    }
    const headers = AxiosHeaders_default.from(config.headers).normalize();
    headers.set("User-Agent", "axios/" + VERSION, false);
    const onDownloadProgress = config.onDownloadProgress;
    const onUploadProgress = config.onUploadProgress;
    const maxRate = config.maxRate;
    let maxUploadRate = undefined;
    let maxDownloadRate = undefined;
    if (utils_default.isSpecCompliantForm(data2)) {
      const userBoundary = headers.getContentType(/boundary=([-_\w\d]{10,70})/i);
      data2 = formDataToStream_default(data2, (formHeaders) => {
        headers.set(formHeaders);
      }, {
        tag: `axios-${VERSION}-boundary`,
        boundary: userBoundary && userBoundary[1] || undefined
      });
    } else if (utils_default.isFormData(data2) && utils_default.isFunction(data2.getHeaders)) {
      headers.set(data2.getHeaders());
      if (!headers.hasContentLength()) {
        try {
          const knownLength = await util.promisify(data2.getLength).call(data2);
          Number.isFinite(knownLength) && knownLength >= 0 && headers.setContentLength(knownLength);
        } catch (e) {
        }
      }
    } else if (utils_default.isBlob(data2)) {
      data2.size && headers.setContentType(data2.type || "application/octet-stream");
      headers.setContentLength(data2.size || 0);
      data2 = stream3.Readable.from(readBlob_default(data2));
    } else if (data2 && !utils_default.isStream(data2)) {
      if (Buffer.isBuffer(data2)) {
      } else if (utils_default.isArrayBuffer(data2)) {
        data2 = Buffer.from(new Uint8Array(data2));
      } else if (utils_default.isString(data2)) {
        data2 = Buffer.from(data2, "utf-8");
      } else {
        return reject(new AxiosError_default("Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream", AxiosError_default.ERR_BAD_REQUEST, config));
      }
      headers.setContentLength(data2.length, false);
      if (config.maxBodyLength > -1 && data2.length > config.maxBodyLength) {
        return reject(new AxiosError_default("Request body larger than maxBodyLength limit", AxiosError_default.ERR_BAD_REQUEST, config));
      }
    }
    const contentLength = utils_default.toFiniteNumber(headers.getContentLength());
    if (utils_default.isArray(maxRate)) {
      maxUploadRate = maxRate[0];
      maxDownloadRate = maxRate[1];
    } else {
      maxUploadRate = maxDownloadRate = maxRate;
    }
    if (data2 && (onUploadProgress || maxUploadRate)) {
      if (!utils_default.isStream(data2)) {
        data2 = stream3.Readable.from(data2, { objectMode: false });
      }
      data2 = stream3.pipeline([data2, new AxiosTransformStream_default({
        length: contentLength,
        maxRate: utils_default.toFiniteNumber(maxUploadRate)
      })], utils_default.noop);
      onUploadProgress && data2.on("progress", (progress) => {
        onUploadProgress(Object.assign(progress, {
          upload: true
        }));
      });
    }
    let auth = undefined;
    if (config.auth) {
      const username = config.auth.username || "";
      const password = config.auth.password || "";
      auth = username + ":" + password;
    }
    if (!auth && parsed.username) {
      const urlUsername = parsed.username;
      const urlPassword = parsed.password;
      auth = urlUsername + ":" + urlPassword;
    }
    auth && headers.delete("authorization");
    let path;
    try {
      path = buildURL(parsed.pathname + parsed.search, config.params, config.paramsSerializer).replace(/^\?/, "");
    } catch (err) {
      const customErr = new Error(err.message);
      customErr.config = config;
      customErr.url = config.url;
      customErr.exists = true;
      return reject(customErr);
    }
    headers.set("Accept-Encoding", "gzip, compress, deflate" + (isBrotliSupported ? ", br" : ""), false);
    const options = {
      path,
      method,
      headers: headers.toJSON(),
      agents: { http: config.httpAgent, https: config.httpsAgent },
      auth,
      protocol,
      family,
      beforeRedirect: dispatchBeforeRedirect,
      beforeRedirects: {}
    };
    !utils_default.isUndefined(lookup) && (options.lookup = lookup);
    if (config.socketPath) {
      options.socketPath = config.socketPath;
    } else {
      options.hostname = parsed.hostname;
      options.port = parsed.port;
      setProxy(options, config.proxy, protocol + "//" + parsed.hostname + (parsed.port ? ":" + parsed.port : "") + options.path);
    }
    let transport;
    const isHttpsRequest = isHttps.test(options.protocol);
    options.agent = isHttpsRequest ? config.httpsAgent : config.httpAgent;
    if (config.transport) {
      transport = config.transport;
    } else if (config.maxRedirects === 0) {
      transport = isHttpsRequest ? https : http;
    } else {
      if (config.maxRedirects) {
        options.maxRedirects = config.maxRedirects;
      }
      if (config.beforeRedirect) {
        options.beforeRedirects.config = config.beforeRedirect;
      }
      transport = isHttpsRequest ? httpsFollow : httpFollow;
    }
    if (config.maxBodyLength > -1) {
      options.maxBodyLength = config.maxBodyLength;
    } else {
      options.maxBodyLength = Infinity;
    }
    if (config.insecureHTTPParser) {
      options.insecureHTTPParser = config.insecureHTTPParser;
    }
    req = transport.request(options, function handleResponse(res) {
      if (req.destroyed)
        return;
      const streams = [res];
      const responseLength = +res.headers["content-length"];
      if (onDownloadProgress) {
        const transformStream = new AxiosTransformStream_default({
          length: utils_default.toFiniteNumber(responseLength),
          maxRate: utils_default.toFiniteNumber(maxDownloadRate)
        });
        onDownloadProgress && transformStream.on("progress", (progress) => {
          onDownloadProgress(Object.assign(progress, {
            download: true
          }));
        });
        streams.push(transformStream);
      }
      let responseStream = res;
      const lastRequest = res.req || req;
      if (config.decompress !== false && res.headers["content-encoding"]) {
        if (method === "HEAD" || res.statusCode === 204) {
          delete res.headers["content-encoding"];
        }
        switch ((res.headers["content-encoding"] || "").toLowerCase()) {
          case "gzip":
          case "x-gzip":
          case "compress":
          case "x-compress":
            streams.push(zlib.createUnzip(zlibOptions));
            delete res.headers["content-encoding"];
            break;
          case "deflate":
            streams.push(new ZlibHeaderTransformStream_default);
            streams.push(zlib.createUnzip(zlibOptions));
            delete res.headers["content-encoding"];
            break;
          case "br":
            if (isBrotliSupported) {
              streams.push(zlib.createBrotliDecompress(brotliOptions));
              delete res.headers["content-encoding"];
            }
        }
      }
      responseStream = streams.length > 1 ? stream3.pipeline(streams, utils_default.noop) : streams[0];
      const offListeners = stream3.finished(responseStream, () => {
        offListeners();
        onFinished();
      });
      const response = {
        status: res.statusCode,
        statusText: res.statusMessage,
        headers: new AxiosHeaders_default(res.headers),
        config,
        request: lastRequest
      };
      if (responseType === "stream") {
        response.data = responseStream;
        settle(resolve, reject, response);
      } else {
        const responseBuffer = [];
        let totalResponseBytes = 0;
        responseStream.on("data", function handleStreamData(chunk) {
          responseBuffer.push(chunk);
          totalResponseBytes += chunk.length;
          if (config.maxContentLength > -1 && totalResponseBytes > config.maxContentLength) {
            rejected = true;
            responseStream.destroy();
            reject(new AxiosError_default("maxContentLength size of " + config.maxContentLength + " exceeded", AxiosError_default.ERR_BAD_RESPONSE, config, lastRequest));
          }
        });
        responseStream.on("aborted", function handlerStreamAborted() {
          if (rejected) {
            return;
          }
          const err = new AxiosError_default("maxContentLength size of " + config.maxContentLength + " exceeded", AxiosError_default.ERR_BAD_RESPONSE, config, lastRequest);
          responseStream.destroy(err);
          reject(err);
        });
        responseStream.on("error", function handleStreamError(err) {
          if (req.destroyed)
            return;
          reject(AxiosError_default.from(err, null, config, lastRequest));
        });
        responseStream.on("end", function handleStreamEnd() {
          try {
            let responseData = responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
            if (responseType !== "arraybuffer") {
              responseData = responseData.toString(responseEncoding);
              if (!responseEncoding || responseEncoding === "utf8") {
                responseData = utils_default.stripBOM(responseData);
              }
            }
            response.data = responseData;
          } catch (err) {
            return reject(AxiosError_default.from(err, null, config, response.request, response));
          }
          settle(resolve, reject, response);
        });
      }
      emitter.once("abort", (err) => {
        if (!responseStream.destroyed) {
          responseStream.emit("error", err);
          responseStream.destroy();
        }
      });
    });
    emitter.once("abort", (err) => {
      reject(err);
      req.destroy(err);
    });
    req.on("error", function handleRequestError(err) {
      reject(AxiosError_default.from(err, null, config, req));
    });
    req.on("socket", function handleRequestSocket(socket) {
      socket.setKeepAlive(true, 1000 * 60);
    });
    if (config.timeout) {
      const timeout = parseInt(config.timeout, 10);
      if (Number.isNaN(timeout)) {
        reject(new AxiosError_default("error trying to parse `config.timeout` to int", AxiosError_default.ERR_BAD_OPTION_VALUE, config, req));
        return;
      }
      req.setTimeout(timeout, function handleRequestTimeout() {
        if (isDone)
          return;
        let timeoutErrorMessage = config.timeout ? "timeout of " + config.timeout + "ms exceeded" : "timeout exceeded";
        const transitional3 = config.transitional || transitional_default;
        if (config.timeoutErrorMessage) {
          timeoutErrorMessage = config.timeoutErrorMessage;
        }
        reject(new AxiosError_default(timeoutErrorMessage, transitional3.clarifyTimeoutError ? AxiosError_default.ETIMEDOUT : AxiosError_default.ECONNABORTED, config, req));
        abort();
      });
    }
    if (utils_default.isStream(data2)) {
      let ended = false;
      let errored = false;
      data2.on("end", () => {
        ended = true;
      });
      data2.once("error", (err) => {
        errored = true;
        req.destroy(err);
      });
      data2.on("close", () => {
        if (!ended && !errored) {
          abort(new CanceledError_default("Request stream has been aborted", config, req));
        }
      });
      data2.pipe(req);
    } else {
      req.end(data2);
    }
  });
};

// node_modules/axios/lib/helpers/cookies.js
var cookies_default = platform_default.hasStandardBrowserEnv ? {
  write(name, value, expires, path, domain, secure) {
    const cookie = [name + "=" + encodeURIComponent(value)];
    utils_default.isNumber(expires) && cookie.push("expires=" + new Date(expires).toGMTString());
    utils_default.isString(path) && cookie.push("path=" + path);
    utils_default.isString(domain) && cookie.push("domain=" + domain);
    secure === true && cookie.push("secure");
    document.cookie = cookie.join("; ");
  },
  read(name) {
    const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
    return match ? decodeURIComponent(match[3]) : null;
  },
  remove(name) {
    this.write(name, "", Date.now() - 86400000);
  }
} : {
  write() {
  },
  read() {
    return null;
  },
  remove() {
  }
};

// node_modules/axios/lib/helpers/isURLSameOrigin.js
var isURLSameOrigin_default = platform_default.hasStandardBrowserEnv ? function standardBrowserEnv() {
  const msie = /(msie|trident)/i.test(navigator.userAgent);
  const urlParsingNode = document.createElement("a");
  let originURL;
  function resolveURL(url2) {
    let href = url2;
    if (msie) {
      urlParsingNode.setAttribute("href", href);
      href = urlParsingNode.href;
    }
    urlParsingNode.setAttribute("href", href);
    return {
      href: urlParsingNode.href,
      protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, "") : "",
      host: urlParsingNode.host,
      search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, "") : "",
      hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, "") : "",
      hostname: urlParsingNode.hostname,
      port: urlParsingNode.port,
      pathname: urlParsingNode.pathname.charAt(0) === "/" ? urlParsingNode.pathname : "/" + urlParsingNode.pathname
    };
  }
  originURL = resolveURL(window.location.href);
  return function isURLSameOrigin(requestURL) {
    const parsed = utils_default.isString(requestURL) ? resolveURL(requestURL) : requestURL;
    return parsed.protocol === originURL.protocol && parsed.host === originURL.host;
  };
}() : function nonStandardBrowserEnv() {
  return function isURLSameOrigin() {
    return true;
  };
}();

// node_modules/axios/lib/adapters/xhr.js
var progressEventReducer = function(listener, isDownloadStream) {
  let bytesNotified = 0;
  const _speedometer = speedometer_default(50, 250);
  return (e) => {
    const loaded = e.loaded;
    const total = e.lengthComputable ? e.total : undefined;
    const progressBytes = loaded - bytesNotified;
    const rate = _speedometer(progressBytes);
    const inRange = loaded <= total;
    bytesNotified = loaded;
    const data2 = {
      loaded,
      total,
      progress: total ? loaded / total : undefined,
      bytes: progressBytes,
      rate: rate ? rate : undefined,
      estimated: rate && total && inRange ? (total - loaded) / rate : undefined,
      event: e
    };
    data2[isDownloadStream ? "download" : "upload"] = true;
    listener(data2);
  };
};
var isXHRAdapterSupported = typeof XMLHttpRequest !== "undefined";
var xhr_default = isXHRAdapterSupported && function(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    let requestData = config.data;
    const requestHeaders = AxiosHeaders_default.from(config.headers).normalize();
    let { responseType, withXSRFToken } = config;
    let onCanceled;
    function done() {
      if (config.cancelToken) {
        config.cancelToken.unsubscribe(onCanceled);
      }
      if (config.signal) {
        config.signal.removeEventListener("abort", onCanceled);
      }
    }
    let contentType;
    if (utils_default.isFormData(requestData)) {
      if (platform_default.hasStandardBrowserEnv || platform_default.hasStandardBrowserWebWorkerEnv) {
        requestHeaders.setContentType(false);
      } else if ((contentType = requestHeaders.getContentType()) !== false) {
        const [type, ...tokens] = contentType ? contentType.split(";").map((token) => token.trim()).filter(Boolean) : [];
        requestHeaders.setContentType([type || "multipart/form-data", ...tokens].join("; "));
      }
    }
    let request = new XMLHttpRequest;
    if (config.auth) {
      const username = config.auth.username || "";
      const password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : "";
      requestHeaders.set("Authorization", "Basic " + btoa(username + ":" + password));
    }
    const fullPath = buildFullPath(config.baseURL, config.url);
    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);
    request.timeout = config.timeout;
    function onloadend() {
      if (!request) {
        return;
      }
      const responseHeaders = AxiosHeaders_default.from(("getAllResponseHeaders" in request) && request.getAllResponseHeaders());
      const responseData = !responseType || responseType === "text" || responseType === "json" ? request.responseText : request.response;
      const response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config,
        request
      };
      settle(function _resolve(value) {
        resolve(value);
        done();
      }, function _reject(err) {
        reject(err);
        done();
      }, response);
      request = null;
    }
    if ("onloadend" in request) {
      request.onloadend = onloadend;
    } else {
      request.onreadystatechange = function handleLoad() {
        if (!request || request.readyState !== 4) {
          return;
        }
        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf("file:") === 0)) {
          return;
        }
        setTimeout(onloadend);
      };
    }
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }
      reject(new AxiosError_default("Request aborted", AxiosError_default.ECONNABORTED, config, request));
      request = null;
    };
    request.onerror = function handleError() {
      reject(new AxiosError_default("Network Error", AxiosError_default.ERR_NETWORK, config, request));
      request = null;
    };
    request.ontimeout = function handleTimeout() {
      let timeoutErrorMessage = config.timeout ? "timeout of " + config.timeout + "ms exceeded" : "timeout exceeded";
      const transitional4 = config.transitional || transitional_default;
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject(new AxiosError_default(timeoutErrorMessage, transitional4.clarifyTimeoutError ? AxiosError_default.ETIMEDOUT : AxiosError_default.ECONNABORTED, config, request));
      request = null;
    };
    if (platform_default.hasStandardBrowserEnv) {
      withXSRFToken && utils_default.isFunction(withXSRFToken) && (withXSRFToken = withXSRFToken(config));
      if (withXSRFToken || withXSRFToken !== false && isURLSameOrigin_default(fullPath)) {
        const xsrfValue = config.xsrfHeaderName && config.xsrfCookieName && cookies_default.read(config.xsrfCookieName);
        if (xsrfValue) {
          requestHeaders.set(config.xsrfHeaderName, xsrfValue);
        }
      }
    }
    requestData === undefined && requestHeaders.setContentType(null);
    if ("setRequestHeader" in request) {
      utils_default.forEach(requestHeaders.toJSON(), function setRequestHeader(val, key) {
        request.setRequestHeader(key, val);
      });
    }
    if (!utils_default.isUndefined(config.withCredentials)) {
      request.withCredentials = !!config.withCredentials;
    }
    if (responseType && responseType !== "json") {
      request.responseType = config.responseType;
    }
    if (typeof config.onDownloadProgress === "function") {
      request.addEventListener("progress", progressEventReducer(config.onDownloadProgress, true));
    }
    if (typeof config.onUploadProgress === "function" && request.upload) {
      request.upload.addEventListener("progress", progressEventReducer(config.onUploadProgress));
    }
    if (config.cancelToken || config.signal) {
      onCanceled = (cancel) => {
        if (!request) {
          return;
        }
        reject(!cancel || cancel.type ? new CanceledError_default(null, config, request) : cancel);
        request.abort();
        request = null;
      };
      config.cancelToken && config.cancelToken.subscribe(onCanceled);
      if (config.signal) {
        config.signal.aborted ? onCanceled() : config.signal.addEventListener("abort", onCanceled);
      }
    }
    const protocol = parseProtocol(fullPath);
    if (protocol && platform_default.protocols.indexOf(protocol) === -1) {
      reject(new AxiosError_default("Unsupported protocol " + protocol + ":", AxiosError_default.ERR_BAD_REQUEST, config));
      return;
    }
    request.send(requestData || null);
  });
};

// node_modules/axios/lib/adapters/adapters.js
var knownAdapters = {
  http: http_default,
  xhr: xhr_default
};
utils_default.forEach(knownAdapters, (fn, value) => {
  if (fn) {
    try {
      Object.defineProperty(fn, "name", { value });
    } catch (e) {
    }
    Object.defineProperty(fn, "adapterName", { value });
  }
});
var renderReason = (reason) => `- ${reason}`;
var isResolvedHandle = (adapter) => utils_default.isFunction(adapter) || adapter === null || adapter === false;
var adapters_default = {
  getAdapter: (adapters) => {
    adapters = utils_default.isArray(adapters) ? adapters : [adapters];
    const { length } = adapters;
    let nameOrAdapter;
    let adapter;
    const rejectedReasons = {};
    for (let i = 0;i < length; i++) {
      nameOrAdapter = adapters[i];
      let id;
      adapter = nameOrAdapter;
      if (!isResolvedHandle(nameOrAdapter)) {
        adapter = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];
        if (adapter === undefined) {
          throw new AxiosError_default(`Unknown adapter '${id}'`);
        }
      }
      if (adapter) {
        break;
      }
      rejectedReasons[id || "#" + i] = adapter;
    }
    if (!adapter) {
      const reasons = Object.entries(rejectedReasons).map(([id, state]) => `adapter ${id} ` + (state === false ? "is not supported by the environment" : "is not available in the build"));
      let s = length ? reasons.length > 1 ? "since :\n" + reasons.map(renderReason).join("\n") : " " + renderReason(reasons[0]) : "as no adapter specified";
      throw new AxiosError_default(`There is no suitable adapter to dispatch the request ` + s, "ERR_NOT_SUPPORT");
    }
    return adapter;
  },
  adapters: knownAdapters
};

// node_modules/axios/lib/core/dispatchRequest.js
var throwIfCancellationRequested = function(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
  if (config.signal && config.signal.aborted) {
    throw new CanceledError_default(null, config);
  }
};
function dispatchRequest(config) {
  throwIfCancellationRequested(config);
  config.headers = AxiosHeaders_default.from(config.headers);
  config.data = transformData.call(config, config.transformRequest);
  if (["post", "put", "patch"].indexOf(config.method) !== -1) {
    config.headers.setContentType("application/x-www-form-urlencoded", false);
  }
  const adapter = adapters_default.getAdapter(config.adapter || defaults_default.adapter);
  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);
    response.data = transformData.call(config, config.transformResponse, response);
    response.headers = AxiosHeaders_default.from(response.headers);
    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);
      if (reason && reason.response) {
        reason.response.data = transformData.call(config, config.transformResponse, reason.response);
        reason.response.headers = AxiosHeaders_default.from(reason.response.headers);
      }
    }
    return Promise.reject(reason);
  });
}

// node_modules/axios/lib/core/mergeConfig.js
var headersToObject = (thing) => thing instanceof AxiosHeaders_default ? thing.toJSON() : thing;
function mergeConfig(config1, config2) {
  config2 = config2 || {};
  const config = {};
  function getMergedValue(target, source, caseless) {
    if (utils_default.isPlainObject(target) && utils_default.isPlainObject(source)) {
      return utils_default.merge.call({ caseless }, target, source);
    } else if (utils_default.isPlainObject(source)) {
      return utils_default.merge({}, source);
    } else if (utils_default.isArray(source)) {
      return source.slice();
    }
    return source;
  }
  function mergeDeepProperties(a, b, caseless) {
    if (!utils_default.isUndefined(b)) {
      return getMergedValue(a, b, caseless);
    } else if (!utils_default.isUndefined(a)) {
      return getMergedValue(undefined, a, caseless);
    }
  }
  function valueFromConfig2(a, b) {
    if (!utils_default.isUndefined(b)) {
      return getMergedValue(undefined, b);
    }
  }
  function defaultToConfig2(a, b) {
    if (!utils_default.isUndefined(b)) {
      return getMergedValue(undefined, b);
    } else if (!utils_default.isUndefined(a)) {
      return getMergedValue(undefined, a);
    }
  }
  function mergeDirectKeys(a, b, prop) {
    if (prop in config2) {
      return getMergedValue(a, b);
    } else if (prop in config1) {
      return getMergedValue(undefined, a);
    }
  }
  const mergeMap = {
    url: valueFromConfig2,
    method: valueFromConfig2,
    data: valueFromConfig2,
    baseURL: defaultToConfig2,
    transformRequest: defaultToConfig2,
    transformResponse: defaultToConfig2,
    paramsSerializer: defaultToConfig2,
    timeout: defaultToConfig2,
    timeoutMessage: defaultToConfig2,
    withCredentials: defaultToConfig2,
    withXSRFToken: defaultToConfig2,
    adapter: defaultToConfig2,
    responseType: defaultToConfig2,
    xsrfCookieName: defaultToConfig2,
    xsrfHeaderName: defaultToConfig2,
    onUploadProgress: defaultToConfig2,
    onDownloadProgress: defaultToConfig2,
    decompress: defaultToConfig2,
    maxContentLength: defaultToConfig2,
    maxBodyLength: defaultToConfig2,
    beforeRedirect: defaultToConfig2,
    transport: defaultToConfig2,
    httpAgent: defaultToConfig2,
    httpsAgent: defaultToConfig2,
    cancelToken: defaultToConfig2,
    socketPath: defaultToConfig2,
    responseEncoding: defaultToConfig2,
    validateStatus: mergeDirectKeys,
    headers: (a, b) => mergeDeepProperties(headersToObject(a), headersToObject(b), true)
  };
  utils_default.forEach(Object.keys(Object.assign({}, config1, config2)), function computeConfigValue(prop) {
    const merge2 = mergeMap[prop] || mergeDeepProperties;
    const configValue = merge2(config1[prop], config2[prop], prop);
    utils_default.isUndefined(configValue) && merge2 !== mergeDirectKeys || (config[prop] = configValue);
  });
  return config;
}

// node_modules/axios/lib/helpers/validator.js
var assertOptions = function(options, schema, allowUnknown) {
  if (typeof options !== "object") {
    throw new AxiosError_default("options must be an object", AxiosError_default.ERR_BAD_OPTION_VALUE);
  }
  const keys = Object.keys(options);
  let i = keys.length;
  while (i-- > 0) {
    const opt = keys[i];
    const validator = schema[opt];
    if (validator) {
      const value = options[opt];
      const result = value === undefined || validator(value, opt, options);
      if (result !== true) {
        throw new AxiosError_default("option " + opt + " must be " + result, AxiosError_default.ERR_BAD_OPTION_VALUE);
      }
      continue;
    }
    if (allowUnknown !== true) {
      throw new AxiosError_default("Unknown option " + opt, AxiosError_default.ERR_BAD_OPTION);
    }
  }
};
var validators = {};
["object", "boolean", "number", "function", "string", "symbol"].forEach((type, i) => {
  validators[type] = function validator(thing) {
    return typeof thing === type || "a" + (i < 1 ? "n " : " ") + type;
  };
});
var deprecatedWarnings = {};
validators.transitional = function transitional4(validator, version, message) {
  function formatMessage(opt, desc) {
    return "[Axios v" + VERSION + "] Transitional option \'" + opt + "\'" + desc + (message ? ". " + message : "");
  }
  return (value, opt, opts) => {
    if (validator === false) {
      throw new AxiosError_default(formatMessage(opt, " has been removed" + (version ? " in " + version : "")), AxiosError_default.ERR_DEPRECATED);
    }
    if (version && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      console.warn(formatMessage(opt, " has been deprecated since v" + version + " and will be removed in the near future"));
    }
    return validator ? validator(value, opt, opts) : true;
  };
};
var validator_default = {
  assertOptions,
  validators
};

// node_modules/axios/lib/core/Axios.js
var validators2 = validator_default.validators;

class Axios {
  constructor(instanceConfig) {
    this.defaults = instanceConfig;
    this.interceptors = {
      request: new InterceptorManager_default,
      response: new InterceptorManager_default
    };
  }
  request(configOrUrl, config) {
    if (typeof configOrUrl === "string") {
      config = config || {};
      config.url = configOrUrl;
    } else {
      config = configOrUrl || {};
    }
    config = mergeConfig(this.defaults, config);
    const { transitional: transitional5, paramsSerializer, headers } = config;
    if (transitional5 !== undefined) {
      validator_default.assertOptions(transitional5, {
        silentJSONParsing: validators2.transitional(validators2.boolean),
        forcedJSONParsing: validators2.transitional(validators2.boolean),
        clarifyTimeoutError: validators2.transitional(validators2.boolean)
      }, false);
    }
    if (paramsSerializer != null) {
      if (utils_default.isFunction(paramsSerializer)) {
        config.paramsSerializer = {
          serialize: paramsSerializer
        };
      } else {
        validator_default.assertOptions(paramsSerializer, {
          encode: validators2.function,
          serialize: validators2.function
        }, true);
      }
    }
    config.method = (config.method || this.defaults.method || "get").toLowerCase();
    let contextHeaders = headers && utils_default.merge(headers.common, headers[config.method]);
    headers && utils_default.forEach(["delete", "get", "head", "post", "put", "patch", "common"], (method) => {
      delete headers[method];
    });
    config.headers = AxiosHeaders_default.concat(contextHeaders, headers);
    const requestInterceptorChain = [];
    let synchronousRequestInterceptors = true;
    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
      if (typeof interceptor.runWhen === "function" && interceptor.runWhen(config) === false) {
        return;
      }
      synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;
      requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
    });
    const responseInterceptorChain = [];
    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
      responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
    });
    let promise;
    let i = 0;
    let len;
    if (!synchronousRequestInterceptors) {
      const chain = [dispatchRequest.bind(this), undefined];
      chain.unshift.apply(chain, requestInterceptorChain);
      chain.push.apply(chain, responseInterceptorChain);
      len = chain.length;
      promise = Promise.resolve(config);
      while (i < len) {
        promise = promise.then(chain[i++], chain[i++]);
      }
      return promise;
    }
    len = requestInterceptorChain.length;
    let newConfig = config;
    i = 0;
    while (i < len) {
      const onFulfilled = requestInterceptorChain[i++];
      const onRejected = requestInterceptorChain[i++];
      try {
        newConfig = onFulfilled(newConfig);
      } catch (error) {
        onRejected.call(this, error);
        break;
      }
    }
    try {
      promise = dispatchRequest.call(this, newConfig);
    } catch (error) {
      return Promise.reject(error);
    }
    i = 0;
    len = responseInterceptorChain.length;
    while (i < len) {
      promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
    }
    return promise;
  }
  getUri(config) {
    config = mergeConfig(this.defaults, config);
    const fullPath = buildFullPath(config.baseURL, config.url);
    return buildURL(fullPath, config.params, config.paramsSerializer);
  }
}
utils_default.forEach(["delete", "get", "head", "options"], function forEachMethodNoData(method) {
  Axios.prototype[method] = function(url2, config) {
    return this.request(mergeConfig(config || {}, {
      method,
      url: url2,
      data: (config || {}).data
    }));
  };
});
utils_default.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
  function generateHTTPMethod(isForm) {
    return function httpMethod(url2, data3, config) {
      return this.request(mergeConfig(config || {}, {
        method,
        headers: isForm ? {
          "Content-Type": "multipart/form-data"
        } : {},
        url: url2,
        data: data3
      }));
    };
  }
  Axios.prototype[method] = generateHTTPMethod();
  Axios.prototype[method + "Form"] = generateHTTPMethod(true);
});
var Axios_default = Axios;

// node_modules/axios/lib/cancel/CancelToken.js
class CancelToken {
  constructor(executor) {
    if (typeof executor !== "function") {
      throw new TypeError("executor must be a function.");
    }
    let resolvePromise;
    this.promise = new Promise(function promiseExecutor(resolve) {
      resolvePromise = resolve;
    });
    const token = this;
    this.promise.then((cancel) => {
      if (!token._listeners)
        return;
      let i = token._listeners.length;
      while (i-- > 0) {
        token._listeners[i](cancel);
      }
      token._listeners = null;
    });
    this.promise.then = (onfulfilled) => {
      let _resolve;
      const promise = new Promise((resolve) => {
        token.subscribe(resolve);
        _resolve = resolve;
      }).then(onfulfilled);
      promise.cancel = function reject() {
        token.unsubscribe(_resolve);
      };
      return promise;
    };
    executor(function cancel(message, config, request) {
      if (token.reason) {
        return;
      }
      token.reason = new CanceledError_default(message, config, request);
      resolvePromise(token.reason);
    });
  }
  throwIfRequested() {
    if (this.reason) {
      throw this.reason;
    }
  }
  subscribe(listener) {
    if (this.reason) {
      listener(this.reason);
      return;
    }
    if (this._listeners) {
      this._listeners.push(listener);
    } else {
      this._listeners = [listener];
    }
  }
  unsubscribe(listener) {
    if (!this._listeners) {
      return;
    }
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }
  static source() {
    let cancel;
    const token = new CancelToken(function executor(c) {
      cancel = c;
    });
    return {
      token,
      cancel
    };
  }
}
var CancelToken_default = CancelToken;

// node_modules/axios/lib/helpers/spread.js
function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
}

// node_modules/axios/lib/helpers/isAxiosError.js
function isAxiosError(payload) {
  return utils_default.isObject(payload) && payload.isAxiosError === true;
}

// node_modules/axios/lib/helpers/HttpStatusCode.js
var HttpStatusCode = {
  Continue: 100,
  SwitchingProtocols: 101,
  Processing: 102,
  EarlyHints: 103,
  Ok: 200,
  Created: 201,
  Accepted: 202,
  NonAuthoritativeInformation: 203,
  NoContent: 204,
  ResetContent: 205,
  PartialContent: 206,
  MultiStatus: 207,
  AlreadyReported: 208,
  ImUsed: 226,
  MultipleChoices: 300,
  MovedPermanently: 301,
  Found: 302,
  SeeOther: 303,
  NotModified: 304,
  UseProxy: 305,
  Unused: 306,
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  ProxyAuthenticationRequired: 407,
  RequestTimeout: 408,
  Conflict: 409,
  Gone: 410,
  LengthRequired: 411,
  PreconditionFailed: 412,
  PayloadTooLarge: 413,
  UriTooLong: 414,
  UnsupportedMediaType: 415,
  RangeNotSatisfiable: 416,
  ExpectationFailed: 417,
  ImATeapot: 418,
  MisdirectedRequest: 421,
  UnprocessableEntity: 422,
  Locked: 423,
  FailedDependency: 424,
  TooEarly: 425,
  UpgradeRequired: 426,
  PreconditionRequired: 428,
  TooManyRequests: 429,
  RequestHeaderFieldsTooLarge: 431,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  HttpVersionNotSupported: 505,
  VariantAlsoNegotiates: 506,
  InsufficientStorage: 507,
  LoopDetected: 508,
  NotExtended: 510,
  NetworkAuthenticationRequired: 511
};
Object.entries(HttpStatusCode).forEach(([key, value]) => {
  HttpStatusCode[value] = key;
});
var HttpStatusCode_default = HttpStatusCode;

// node_modules/axios/lib/axios.js
var createInstance = function(defaultConfig) {
  const context = new Axios_default(defaultConfig);
  const instance = bind(Axios_default.prototype.request, context);
  utils_default.extend(instance, Axios_default.prototype, context, { allOwnKeys: true });
  utils_default.extend(instance, context, null, { allOwnKeys: true });
  instance.create = function create(instanceConfig) {
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  };
  return instance;
};
var axios = createInstance(defaults_default);
axios.Axios = Axios_default;
axios.CanceledError = CanceledError_default;
axios.CancelToken = CancelToken_default;
axios.isCancel = isCancel;
axios.VERSION = VERSION;
axios.toFormData = toFormData_default;
axios.AxiosError = AxiosError_default;
axios.Cancel = axios.CanceledError;
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = spread;
axios.isAxiosError = isAxiosError;
axios.mergeConfig = mergeConfig;
axios.AxiosHeaders = AxiosHeaders_default;
axios.formToJSON = (thing) => formDataToJSON_default(utils_default.isHTMLForm(thing) ? new FormData(thing) : thing);
axios.getAdapter = adapters_default.getAdapter;
axios.HttpStatusCode = HttpStatusCode_default;
axios.default = axios;
var axios_default = axios;

// src/index.ts
var import_adm_zip = __toESM(require_adm_zip(), 1);
var import_csvtojson = __toESM(require_v2(), 1);

// node_modules/zod/lib/index.mjs
var setErrorMap = function(map) {
  overrideErrorMap = map;
};
var getErrorMap = function() {
  return overrideErrorMap;
};
var addIssueToContext = function(ctx, issueData) {
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      getErrorMap(),
      errorMap
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
};
var processCreateParams = function(params) {
  if (!params)
    return {};
  const { errorMap, invalid_type_error, required_error, description } = params;
  if (errorMap && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap)
    return { errorMap, description };
  const customMap = (iss, ctx) => {
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    if (typeof ctx.data === "undefined") {
      return { message: required_error !== null && required_error !== undefined ? required_error : ctx.defaultError };
    }
    return { message: invalid_type_error !== null && invalid_type_error !== undefined ? invalid_type_error : ctx.defaultError };
  };
  return { errorMap: customMap, description };
};
var isValidIP = function(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
};
var floatSafeRemainder = function(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
};
var deepPartialify = function(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
};
var mergeValues = function(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util2.objectKeys(b);
    const sharedKeys = util2.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
};
var createZodEnum = function(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
};
var util2;
(function(util3) {
  util3.assertEqual = (val) => val;
  function assertIs(_arg) {
  }
  util3.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error;
  }
  util3.assertNever = assertNever;
  util3.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util3.getValidEnumValues = (obj) => {
    const validKeys = util3.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util3.objectValues(filtered);
  };
  util3.objectValues = (obj) => {
    return util3.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util3.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util3.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return;
  };
  util3.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util3.joinValues = joinValues;
  util3.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util2 || (util2 = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util2.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data4) => {
  const t = typeof data4;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return isNaN(data4) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data4)) {
        return ZodParsedType.array;
      }
      if (data4 === null) {
        return ZodParsedType.null;
      }
      if (data4.then && typeof data4.then === "function" && data4.catch && typeof data4.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data4 instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data4 instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data4 instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
var ZodIssueCode = util2.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};

class ZodError extends Error {
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  get errors() {
    return this.issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util2.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
        fieldErrors[sub.path[0]].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util2.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util2.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util2.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util2.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util2.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util2.assertNever(issue);
  }
  return { message };
};
var overrideErrorMap = errorMap;
var makeIssue = (params) => {
  const { data: data4, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data: data4, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: issueData.message || errorMessage
  };
};
var EMPTY_PATH = [];

class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      syncPairs.push({
        key: await pair.key,
        value: await pair.value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === undefined ? undefined : message.message;
})(errorUtil || (errorUtil = {}));

class ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};

class ZodType {
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
  }
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus,
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data4, params) {
    const result = this.safeParse(data4, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data4, params) {
    var _a;
    const ctx = {
      common: {
        issues: [],
        async: (_a = params === null || params === undefined ? undefined : params.async) !== null && _a !== undefined ? _a : false,
        contextualErrorMap: params === null || params === undefined ? undefined : params.errorMap
      },
      path: (params === null || params === undefined ? undefined : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: data4,
      parsedType: getParsedType(data4)
    };
    const result = this._parseSync({ data: data4, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  async parseAsync(data4, params) {
    const result = await this.safeParseAsync(data4, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data4, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === undefined ? undefined : params.errorMap,
        async: true
      },
      path: (params === null || params === undefined ? undefined : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: data4,
      parsedType: getParsedType(data4)
    };
    const maybeAsyncResult = this._parse({ data: data4, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data4) => {
          if (!data4) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this, this._def);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(undefined).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[a-z][a-z0-9]*$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_+-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+\$`;
var emojiRegex;
var ipv4Regex = /^(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))$/;
var ipv6Regex = /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
var datetimeRegex = (args) => {
  if (args.precision) {
    if (args.offset) {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{${args.precision}}(([+-]\\d{2}(:?\\d{2})?)|Z)\$`);
    } else {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{${args.precision}}Z\$`);
    }
  } else if (args.precision === 0) {
    if (args.offset) {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(([+-]\\d{2}(:?\\d{2})?)|Z)\$`);
    } else {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z\$`);
    }
  } else {
    if (args.offset) {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(([+-]\\d{2}(:?\\d{2})?)|Z)\$`);
    } else {
      return new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z\$`);
    }
  }
};

class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus;
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data4) => regex.test(data4), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    var _a;
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options === null || options === undefined ? undefined : options.precision) === "undefined" ? null : options === null || options === undefined ? undefined : options.precision,
      offset: (_a = options === null || options === undefined ? undefined : options.offset) !== null && _a !== undefined ? _a : false,
      ...errorUtil.errToObj(options === null || options === undefined ? undefined : options.message)
    });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options === null || options === undefined ? undefined : options.position,
      ...errorUtil.errToObj(options === null || options === undefined ? undefined : options.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  var _a;
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: (_a = params === null || params === undefined ? undefined : params.coerce) !== null && _a !== undefined ? _a : false,
    ...processCreateParams(params)
  });
};

class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = undefined;
    const status = new ParseStatus;
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util2.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util2.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    ...processCreateParams(params)
  });
};

class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = BigInt(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = undefined;
    const status = new ParseStatus;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  var _a;
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: (_a = params === null || params === undefined ? undefined : params.coerce) !== null && _a !== undefined ? _a : false,
    ...processCreateParams(params)
  });
};

class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    ...processCreateParams(params)
  });
};

class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus;
    let ctx = undefined;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util2.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: (params === null || params === undefined ? undefined : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};

class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};

class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};

class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};

class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};

class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};

class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};

class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};

class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : undefined,
          maximum: tooBig ? def.exactLength.value : undefined,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};

class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util2.objectKeys(shape);
    return this._cached = { shape, keys };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip")
        ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          syncPairs.push({
            key,
            value: await pair.value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== undefined ? {
        errorMap: (issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === undefined ? undefined : _b.call(_a, issue, ctx).message) !== null && _c !== undefined ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== undefined ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util2.objectKeys(mask).forEach((key) => {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    util2.objectKeys(this.shape).forEach((key) => {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    util2.objectKeys(this.shape).forEach((key) => {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    util2.objectKeys(this.shape).forEach((key) => {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util2.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};

class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = undefined;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return Object.keys(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [undefined];
  } else if (type instanceof ZodNull) {
    return [null];
  } else {
    return null;
  }
};

class ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  static create(discriminator, options, params) {
    const optionsMap = new Map;
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
}

class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};

class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};

class ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key))
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
}

class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = new Map;
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = new Map;
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};

class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = new Set;
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};

class ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
}

class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};

class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};

class ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util2.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (this._def.values.indexOf(input.data) === -1) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values) {
    return ZodEnum.create(values);
  }
  exclude(values) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)));
  }
}
ZodEnum.create = createZodEnum;

class ZodNativeEnum extends ZodType {
  _parse(input) {
    const nativeEnumValues = util2.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util2.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util2.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (nativeEnumValues.indexOf(input.data) === -1) {
      const expectedValues = util2.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};

class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data4) => {
      return this._def.type.parseAsync(data4, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};

class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.issues.length) {
        return {
          status: "dirty",
          value: ctx.data
        };
      }
      if (ctx.common.async) {
        return Promise.resolve(processed).then((processed2) => {
          return this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
        });
      } else {
        return this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return base;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return base;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util2.assertNever(effect);
  }
}
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};

class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(undefined);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};

class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};

class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data4 = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data4 = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data: data4,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};

class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};

class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");

class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data4 = ctx.data;
    return this._def.type._parse({
      data: data4,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}

class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}

class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    if (isValid(result)) {
      result.value = Object.freeze(result.value);
    }
    return result;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
var custom = (check, params = {}, fatal) => {
  if (check)
    return ZodAny.create().superRefine((data4, ctx) => {
      var _a, _b;
      if (!check(data4)) {
        const p = typeof params === "function" ? params(data4) : typeof params === "string" ? { message: params } : params;
        const _fatal = (_b = (_a = p.fatal) !== null && _a !== undefined ? _a : fatal) !== null && _b !== undefined ? _b : true;
        const p2 = typeof p === "string" ? { message: p } : p;
        ctx.addIssue({ code: "custom", ...p2, fatal: _fatal });
      }
    });
  return ZodAny.create();
};
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data4) => data4 instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;
var z = Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap,
  setErrorMap,
  getErrorMap,
  makeIssue,
  EMPTY_PATH,
  addIssueToContext,
  ParseStatus,
  INVALID,
  DIRTY,
  OK,
  isAborted,
  isDirty,
  isValid,
  isAsync,
  get util() {
    return util2;
  },
  get objectUtil() {
    return objectUtil;
  },
  ZodParsedType,
  getParsedType,
  ZodType,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodSymbol,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodArray,
  ZodObject,
  ZodUnion,
  ZodDiscriminatedUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodEnum,
  ZodNativeEnum,
  ZodPromise,
  ZodEffects,
  ZodTransformer: ZodEffects,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodCatch,
  ZodNaN,
  BRAND,
  ZodBranded,
  ZodPipeline,
  ZodReadonly,
  custom,
  Schema: ZodType,
  ZodSchema: ZodType,
  late,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind;
  },
  coerce,
  any: anyType,
  array: arrayType,
  bigint: bigIntType,
  boolean: booleanType,
  date: dateType,
  discriminatedUnion: discriminatedUnionType,
  effect: effectsType,
  enum: enumType,
  function: functionType,
  instanceof: instanceOfType,
  intersection: intersectionType,
  lazy: lazyType,
  literal: literalType,
  map: mapType,
  nan: nanType,
  nativeEnum: nativeEnumType,
  never: neverType,
  null: nullType,
  nullable: nullableType,
  number: numberType,
  object: objectType,
  oboolean,
  onumber,
  optional: optionalType,
  ostring,
  pipeline: pipelineType,
  preprocess: preprocessType,
  promise: promiseType,
  record: recordType,
  set: setType,
  strictObject: strictObjectType,
  string: stringType,
  symbol: symbolType,
  transformer: effectsType,
  tuple: tupleType,
  undefined: undefinedType,
  union: unionType,
  unknown: unknownType,
  void: voidType,
  NEVER,
  ZodIssueCode,
  quotelessJson,
  ZodError
});

// src/index.ts
class Gtfs {
  location;
  zipEntries;
  zip;
  constructor(location) {
    this.location = location;
    this.zipEntries = null;
    this.zip = null;
  }
  async init() {
    const { zip, zipEntries } = await this.getZip(this.location);
    this.zip = zip;
    this.zipEntries = zipEntries;
  }
  async getZip(url2) {
    return await axios_default.get(url2, {
      responseType: "arraybuffer"
    }).then((body) => {
      const zip = new import_adm_zip.default(body.data);
      const zipEntries = zip.getEntries();
      if (!zipEntries || !zipEntries.length || zipEntries.length === 0)
        throw new Error("No zip entries found");
      return { zip, zipEntries };
    });
  }
  colParser = {
    id: "string",
    service_id: "string",
    route_id: "string",
    route_short_name: "string",
    route_long_name: "string",
    network_id: "string",
    route_text_color: "string",
    route_color: "string",
    shape_id: "string",
    stop_id: "string",
    stop_code: "string",
    tc_agency_id: "string",
    stop_name: "string",
    tts_stop_name: "string",
    stop_desc: "string",
    zone_id: "string",
    stop_url: "string",
    parent_station: "string",
    stop_timezone: "string",
    level_id: "string",
    platform_code: "string",
    from_stop_id: "string",
    to_stop_id: "string",
    from_route_id: "string",
    to_route_id: "string",
    from_trip_id: "string",
    to_trip_id: "string",
    trip_id: "string",
    trip_headsign: "string",
    trip_short_name: "string",
    block_id: "string",
    bikes_allowed: "string"
  };
  getFile(fileName) {
    if (!this.zipEntries)
      throw new Error("Gtfs has not been initialized use 'gtfs.init()'");
    const entry = this.zipEntries.find((zipEntry) => {
      return zipEntry.entryName === fileName;
    });
    if (!entry)
      throw new Error(`File ${fileName} not found`);
    return entry;
  }
  async fileParser(fileName) {
    try {
      const file = this.getFile(fileName);
      return await import_csvtojson.default({
        colParser: this.colParser,
        checkType: true,
        ignoreEmpty: true
      }).fromString(this.zip.readAsText(file.entryName)).then((json) => {
        const newArr = [];
        for (const item of json) {
          newArr.push(item);
        }
        return z.array(z.any()).parse(newArr);
      });
    } catch (e) {
      console.error(e);
      throw new Error(`Issue with parser for ${fileName}`);
    }
  }
  async tripsToGeojson() {
    var shapes = (await this.fileParser("shapes.txt")).reduce((memo, row) => {
      memo[row.shape_id] = (memo[row.shape_id] || []).concat(row);
      return memo;
    }, {});
    return {
      type: "FeatureCollection",
      features: Object.keys(shapes).map(function(id) {
        return {
          type: "Feature",
          id,
          properties: {
            shape_id: id
          },
          geometry: {
            type: "LineString",
            coordinates: shapes[id].sort(function(a, b) {
              return +a.shape_pt_sequence - b.shape_pt_sequence;
            }).map(function(coord) {
              return [coord.shape_pt_lon, coord.shape_pt_lat];
            })
          }
        };
      })
    };
  }
  async routesToGeojson() {
    const tripFeatureCollection = await this.tripsToGeojson();
    const routes = await this.fileParser("routes.txt");
    const trips = await this.fileParser("trips.txt");
    const routeFeaturesCollection = {
      type: "FeatureCollection",
      features: []
    };
    for (const route of routes) {
      const filteredTrips = trips.filter((trip) => trip.route_id === route.route_id);
      const shapeIds = filteredTrips.map((trip) => trip.shape_id);
      const routeFeatures = tripFeatureCollection.features.filter((feature) => shapeIds.includes(feature.id)).map((feature) => feature.geometry.coordinates);
      routeFeaturesCollection.features.push({
        type: "Feature",
        id: route.route_id,
        properties: {
          ...route
        },
        geometry: {
          type: "MultiLineString",
          coordinates: routeFeatures
        }
      });
    }
    return routeFeaturesCollection;
  }
  async stopsToGeojson() {
    var stops = await this.fileParser("stops.txt");
    return {
      type: "FeatureCollection",
      features: stops.map(function(stop) {
        return {
          type: "Feature",
          id: stop.stop_id,
          properties: {
            stop_id: stop.stop_id,
            stop_name: stop.stop_name,
            stop_lon: stop.stop_lon,
            stop_lat: stop.stop_lat
          },
          geometry: {
            type: "Point",
            coordinates: [stop.stop_lon, stop.stop_lat]
          }
        };
      })
    };
  }
}
export {
  Gtfs
};
