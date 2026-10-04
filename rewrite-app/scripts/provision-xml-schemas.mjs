import { resolve } from "node:path";
import { prepareOriginalXmlSchemaValidator, originalXmlSchemaVersions } from
  "../packages/application/dist/packages/application/src/original-xml-schema.js";

const directory = resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || ".data/original-xml-schemas");
const downloadFlag = (process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD || "true").trim().toLowerCase() || "true";
const trueFlags = ["1", "true", "yes", "on", "required"];
const falseFlags = ["0", "false", "no", "off", "optional"];
if (![...trueFlags, ...falseFlags].includes(downloadFlag)) {
  throw Error("FIRST_SLICE_XML_SCHEMA_DOWNLOAD must be a supported boolean flag.");
}
await prepareOriginalXmlSchemaValidator(directory, trueFlags.includes(downloadFlag));
console.log(JSON.stringify({ profile: "original-19", verifiedSchemas: originalXmlSchemaVersions }));
