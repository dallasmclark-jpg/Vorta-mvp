import { readFileSync, writeFileSync } from "node:fs";

const path = "src/screens/AiOperations/AskVortaWorkspace.tsx";
let source = readFileSync(path, "utf8");

const oldImport = 'import type { PreparedAskVortaImage } from "./askVortaImageClient";';
const newImport = 'import {\n  getAskVortaImagePreview,\n  type PreparedAskVortaImage,\n} from "./askVortaImageClient";';
if (source.includes(oldImport)) source = source.replace(oldImport, newImport);

const oldImage = `                        {message.imageName ? (\n                          <p className="text-xs font-semibold text-blue-100/80">\n                            Photo attached: {message.imageName}\n                          </p>\n                        ) : null}`;
const newImage = `                        {message.imageName && getAskVortaImagePreview(message.imageName) ? (\n                          <img\n                            src={getAskVortaImagePreview(message.imageName) ?? undefined}\n                            alt="Submitted maintenance photo"\n                            className="max-h-56 w-auto max-w-full rounded-xl border border-gray-800 bg-gray-950 object-contain"\n                          />\n                        ) : message.imageName ? (\n                          <p className="text-xs font-semibold text-blue-100/80">\n                            Photo attached: {message.imageName}\n                          </p>\n                        ) : null}`;
if (source.includes(oldImage)) source = source.replace(oldImage, newImage);

if (!source.includes("getAskVortaImagePreview") || !source.includes('alt="Submitted maintenance photo"')) {
  throw new Error("VOR-076 workspace image codemod did not apply cleanly.");
}
writeFileSync(path, source);
