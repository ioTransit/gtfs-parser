import AdmZip from "adm-zip";
import { type FeatureCollection, MultiLineString } from "geojson";
import type { Route } from "gtfs-types";
export declare class Gtfs {
    location: string;
    zipEntries: null | AdmZip.IZipEntry[];
    zip: any;
    constructor(location: string);
    init(): Promise<void>;
    private getZip;
    private colParser;
    private getFile;
    fileParser(fileName: string): Promise<any[]>;
    tripsToGeojson(): Promise<{
        type: string;
        features: {
            type: string;
            id: string;
            properties: {
                shape_id: string;
            };
            geometry: {
                type: string;
                coordinates: number[][];
            };
        }[];
    }>;
    routesToGeojson(): Promise<FeatureCollection<MultiLineString, Route>>;
    stopsToGeojson(): Promise<{
        type: string;
        features: {
            type: string;
            id: string;
            properties: {
                stop_id: string;
                stop_name: string | undefined;
                stop_lon: number | undefined;
                stop_lat: number | undefined;
            };
            geometry: {
                type: string;
                coordinates: (number | undefined)[];
            };
        }[];
    }>;
}
