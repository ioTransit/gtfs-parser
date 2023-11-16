import { deepEquals, test } from "bun:test";
import { Gtfs } from "..";

test("#routesToGeojson", async function (t) {
  const url =
    "https://raw.githubusercontent.com/AvidDabbler/simple-transit-map/main/public/pts_google_transit.zip";

  const gtfs = new Gtfs(url);
  await gtfs.init();

  const routesGeojson = await gtfs.routesToGeojson();
  console.log(routesGeojson);
  // var shapesInput = fs.readFileSync(
  //   path.join(__dirname, "fixtures/shapes.input"),
  //   "utf8",
  // );
  // var routesInput = fs.readFileSync(
  //   path.join(__dirname, "fixtures/routes.input"),
  //   "utf8",
  // );
  // var tripsInput = fs.readFileSync(
  //   path.join(__dirname, "fixtures/trips.input"),
  //   "utf8",
  // );
  //
  // var result = gtfs2geojson.routes(shapesInput, routesInput, tripsInput);
  //
  // if (process.env.UPDATE) {
  //   fs.writeFileSync(
  //     path.join(__dirname, "fixtures/routes.geojson"),
  //     JSON.stringify(result, null, 2),
  //   );
  // }
  //
  // deepEquals(
  //   result,
  //   JSON.parse(
  //     fs.readFileSync(path.join(__dirname, "fixtures/routes.geojson")),
  //   ),
  // );
  // t.end();
});
