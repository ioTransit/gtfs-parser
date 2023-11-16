import csvtojson from "csvtojson";
import { type FeatureCollection, MultiLineString } from "geojson";
import type { Route, Shapes, Stop } from "gtfs-types";
import { z } from "zod";

export class Gtfs2Geojson {
  constructor() {}

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
    bikes_allowed: "string",
  };

  async parser(fileName: string) {
    return await csvtojson({
      colParser: this.colParser,
      checkType: true,
      ignoreEmpty: true,
    })
      .fromFile(fileName)
      .then((json) => {
        const newArr: any = [];
        for (const item of json) {
          newArr.push(item);
        }

        return z.array(z.any()).parse(newArr);
      });
  }

  async lines(shapesInput: string) {
    var shapes: { [k: string]: Shapes[] } = (
      await this.parser(shapesInput)
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

  async route(shapesInput: string, routesInput: string, tripsInput: string) {
    const tripFeatureCollection = await this.lines(shapesInput);
    const routes = await this.parser(routesInput);
    const trips = await this.parser(tripsInput);

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

  async stops(stopsInput: string) {
    var stops: Stop[] = await this.parser(stopsInput);
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
