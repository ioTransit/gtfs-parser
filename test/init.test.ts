import { expect, test } from "bun:test";
import { Gtfs } from "..";

const url =
  "https://raw.githubusercontent.com/AvidDabbler/gtfs-parser/main/test/pts_google_transit.zip";

test("#routesToGeojson", async function (t: any) {
  const gtfs = new Gtfs(url);
  await gtfs.init();

  const routesGeojson = await gtfs.routesToGeojson();
  expect(1).toEqual(1);
});

test("#tripsToGeojson", async function (t: any) {
  const gtfs = new Gtfs(url);
  await gtfs.init();

  const tripsGeojson = await gtfs.tripsToGeojson();
  console.log(JSON.stringify(tripsGeojson));

  expect(1).toEqual(1);
});
