import axios from "axios";
import AdmZip from "adm-zip";
import csvtojson from "csvtojson";
import { type FeatureCollection, MultiLineString } from "geojson";
import type { Route, Shapes, Stop } from "gtfs-types";
import { z } from "zod";

export class Gtfs {
  location: string;
  zipEntries: null | AdmZip.IZipEntry[];
  zip: any;

  constructor(location: string) {
    this.location = location;
    this.zipEntries = null;
    this.zip = null;
  }

  public async init() {
    const { zip, zipEntries } = await this.getZip(this.location);
    this.zip = zip;
    this.zipEntries = zipEntries;
  }

  private async getZip(url: string) {
    return await axios
      .get(url, {
        responseType: "arraybuffer",
      })
      .then((body) => {
        const zip = new AdmZip(body.data);
        const zipEntries = zip.getEntries();
        if (!zipEntries || !zipEntries.length || zipEntries.length === 0)
          throw new Error("No zip entries found");
        return { zip, zipEntries };
      });
  }

  private colParser = {
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
    bikes_allowed: "string",
  };

  private getFile(fileName: string) {
    if (!this.zipEntries)
      throw new Error("Gtfs has not been initialized use 'gtfs.init()'");
    const entry = this.zipEntries.find((zipEntry) => {
      return zipEntry.entryName === fileName;
    });
    if (!entry) throw new Error(`File ${fileName} not found`);
    return entry;
  }

  public async fileParser(fileName: string) {
    try {
      const file = this.getFile(fileName);
      return await csvtojson({
        colParser: this.colParser,
        checkType: true,
        ignoreEmpty: true,
      })
        .fromString(this.zip.readAsText(file.entryName))
        .then((json) => {
          const newArr: any = [];
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

  public async tripsToGeojson() {
    var shapes: { [k: string]: Shapes[] } = (
      await this.fileParser("shapes.txt")
    ).reduce((memo: { [k: string]: Shapes[] }, row: Shapes) => {
      memo[row.shape_id] = (memo[row.shape_id] || []).concat(row);
      return memo;
    }, {});
    return {
      type: "FeatureCollection",
      features: Object.keys(shapes).map(function (id) {
        return {
          type: "Feature",
          id: id,
          properties: {
            shape_id: id,
          },
          geometry: {
            type: "LineString",
            coordinates: shapes[id]
              .sort(function (a, b) {
                return +a.shape_pt_sequence - b.shape_pt_sequence;
              })
              .map(function (coord) {
                return [coord.shape_pt_lon, coord.shape_pt_lat];
              }),
          },
        };
      }),
    };
  }

  public async routesToGeojson() {
    const tripFeatureCollection = await this.tripsToGeojson();
    const routes = await this.fileParser("routes.txt");
    const trips = await this.fileParser("trips.txt");

    const routeFeaturesCollection: FeatureCollection<MultiLineString, Route> = {
      type: "FeatureCollection",
      features: [],
    };

    for (const route of routes) {
      const filteredTrips = trips.filter(
        (trip) => trip.route_id === route.route_id,
      );
      const shapeIds = filteredTrips.map((trip) => trip.shape_id);
      const routeFeatures = tripFeatureCollection.features
        .filter((feature) => shapeIds.includes(feature.id))
        .map((feature) => feature.geometry.coordinates);
      routeFeaturesCollection.features.push({
        type: "Feature",
        id: route.route_id,
        properties: {
          ...route,
        },
        geometry: {
          type: "MultiLineString",
          coordinates: routeFeatures,
        },
      });
    }
    return routeFeaturesCollection;
  }

  public async stopsToGeojson() {
    var stops: Stop[] = await this.fileParser("stops.txt");
    return {
      type: "FeatureCollection",
      features: stops.map(function (stop) {
        return {
          type: "Feature",
          id: stop.stop_id,
          properties: {
            stop_id: stop.stop_id,
            stop_name: stop.stop_name,
            stop_lon: stop.stop_lon,
            stop_lat: stop.stop_lat,
          },
          geometry: {
            type: "Point",
            coordinates: [stop.stop_lon, stop.stop_lat],
          },
        };
      }),
    };
  }
}
