# GTFS-PARSER ⚠️Work In Progress

The GTFS-PARSER library is supposed to be a simple way to parse GTFS zip files from urls. It should be able to handle reading zip files without taking up space on your harddrive and convert the text files to json array's based on the GTFS specification. It takes the liberty of converting non-string fields over to integers, but by default the csvtojson library used under the hood will convert everything to strings.

## Getting Started

To get started you will first need to define where the zip file is located and then the `gtfs.init()` method needs to be run to fetch the file.

```javascript
const url =
  "https://raw.githubusercontent.com/AvidDabbler/gtfs-parser/main/test/pts_google_transit.zip";

const gtfs = new Gtfs(url);
await gtfs.init();
```

## Methods

After the `gtfs.init()` is run you can then access the methods in the `Gtfs` class.

### tripsToGeojson

Using the `gtfs.tripsToGeojson()` will build and return the trips geometries and properties from the gtfs as geojson.

### routesToGeojson

Using the `gtfs.routesToGeojson()` will build and return the routes geometries and properties from the gtfs as geojson.
