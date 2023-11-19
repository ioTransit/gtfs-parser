"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Gtfs: () => Gtfs
});
module.exports = __toCommonJS(src_exports);
var import_axios = __toESM(require("axios"), 1);
var import_adm_zip = __toESM(require("adm-zip"), 1);
var import_csvtojson = __toESM(require("csvtojson"), 1);
var import_zod = require("zod");
var Gtfs = class {
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
  async getZip(url) {
    return await import_axios.default.get(url, {
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
      return await (0, import_csvtojson.default)({
        colParser: this.colParser,
        checkType: true,
        ignoreEmpty: true
      }).fromString(this.zip.readAsText(file.entryName)).then((json) => {
        const newArr = [];
        for (const item of json) {
          newArr.push(item);
        }
        return import_zod.z.array(import_zod.z.any()).parse(newArr);
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
      const filteredTrips = trips.filter(
        (trip) => trip.route_id === route.route_id
      );
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
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Gtfs
});
