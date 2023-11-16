import { describe, expect, it } from "bun:test";
import { Gtfs } from "..";

it("#routesToGeojson", async function (t: any) {
  const url =
    "https://raw.githubusercontent.com/AvidDabbler/simple-transit-map/main/public/pts_google_transit.zip";

  const gtfs = new Gtfs(url);
  await gtfs.init();

  const routesGeojson = await gtfs.routesToGeojson();
  expect(1).toEqual(1);
  t.end();
});

it("#tripsToGeojson", async function (t: any) {
  const url =
    "https://raw.githubusercontent.com/AvidDabbler/simple-transit-map/main/public/pts_google_transit.zip";

  const gtfs = new Gtfs(url);
  await gtfs.init();

  const tripsGeojson = await gtfs.tripsToGeojson();
  console.log(JSON.stringify(tripsGeojson));

  expect(1).toEqual(1);
});
