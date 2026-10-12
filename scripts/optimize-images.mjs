import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "assets", "source-images");
const outputRoot = path.join(projectRoot, "public", "media");
const manifestPath = path.join(outputRoot, "image-manifest.json");
const sizes = [768, 1280, 1920];
const quality = 78;

const collections = [
  {
    name: "home_slides",
    files: [
      ["The_NyakajuHouse1.jpg", "slide_1"],
      ["The_NyakajuHouse2.jpg", "slide_2"],
      ["The_NyakajuHouse3.jpg", "slide_3"],
      ["SkylineTheNyakaju.jpg", "slide_4"],
      ["skyview1Thenyakaju.jpg", "slide_5"],
      ["skyview2Thenyakaju.jpg", "slide_6"],
      ["Zebra_TheNyakaju.jpg", "slide_7"],
      ["QuadBiking_TheNyakaju.jpg", "slide_8"],
      ["Dininginthewild TheNyakaju.jpg", "slide_9"],
      ["NaturewalkTheNyakaju.jpg", "slide_10"],
    ],
  },
  {
    name: "gallery",
    files: [
      ["TheNyakajuCompound.jpg", "gallery_1"],
      ["TheNyakajuRoom.jpg", "gallery_2"],
      ["TheNyakajuSittingRoom.jpg", "gallery_3"],
      ["Gallery_RoomTheNyakaju.jpg", "gallery_4"],
      ["ConferenceRoomTheNyakaju.jpg", "gallery_5"],
      ["CattleSitingTheNyakaju.jpg", "gallery_6"],
      ["WesternCultureGallery.jpg", "gallery_7"],
      ["LearnWesternCulture.jpg", "gallery_8"],
      ["gallery_skylineTheNyakaju.jpg", "gallery_9"],
    ],
  },
  {
    name: "room_images",
    files: [
      ["Deluxe bedeoom2.jpg", "delux_bed"],
      ["Deluxe Bathroom.jpg", "delux_bathroom"],
      ["Deluxe bedroom1.jpg", "delux_alt"],
      ["Royal Bedroom2.jpg", "royal_bed"],
      ["Royal Bathrrom.jpg", "royal_bathroom"],
      ["Royal Bedroom1.jpg", "royal_alt"],
      ["Elite Bedroom.jpg", "elite"],
      ["Elite Bathrrom1.jpg", "elite_bathroom"],
      ["Elite Bathrrom2.jpg", "elite_alt"],
    ],
  },
];

function assertGeneratedOutputPath() {
  const relativeOutput = path.relative(projectRoot, outputRoot);
  if (relativeOutput !== path.join("public", "media")) {
    throw new Error(`Refusing to replace unexpected output directory: ${outputRoot}`);
  }
}

function publicUrl(collection, fileName) {
  return `/media/${collection}/${fileName}`;
}

async function optimizeCollection({ name, files }) {
  const sourceDirectory = path.join(sourceRoot, name);
  const outputDirectory = path.join(outputRoot, name);

  await mkdir(outputDirectory, { recursive: true });
  const entries = {};

  for (const [fileName, stem] of files) {
    const sourcePath = path.join(sourceDirectory, fileName);
    const sourceBuffer = await readFile(sourcePath);
    const sourceMetadata = await sharp(sourceBuffer).metadata();
    const variants = [];

    for (const size of sizes) {
      const outputName = `${stem}-${size}.webp`;
      const outputPath = path.join(outputDirectory, outputName);
      await sharp(sourceBuffer)
        .rotate()
        .resize({
          width: size,
          height: size,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality,
          effort: 4,
          smartSubsample: true,
        })
        .toFile(outputPath);

      const [metadata, fileStats] = await Promise.all([
        sharp(outputPath).metadata(),
        stat(outputPath),
      ]);

      variants.push({
        url: publicUrl(name, outputName),
        width: metadata.width,
        height: metadata.height,
        bytes: fileStats.size,
      });
    }

    entries[`${name}/${stem}.webp`] = {
      source: fileName,
      sourceWidth: sourceMetadata.width,
      sourceHeight: sourceMetadata.height,
      variants,
    };
  }

  return entries;
}

assertGeneratedOutputPath();
await mkdir(outputRoot, { recursive: true });
for (const collection of collections) {
  await rm(path.join(outputRoot, collection.name), { recursive: true, force: true });
}
await rm(manifestPath, { force: true });

const manifest = {
  generatedAt: new Date().toISOString(),
  format: "webp",
  quality,
  sizes,
  images: {},
};

for (const collection of collections) {
  Object.assign(manifest.images, await optimizeCollection(collection));
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const sourceBytes = Object.values(manifest.images)
  .reduce((total, image) => total + image.variants[image.variants.length - 1].bytes, 0);
console.log(
  `Generated ${Object.keys(manifest.images).length * sizes.length} responsive images `
  + `(${(sourceBytes / 1024 / 1024).toFixed(2)} MB across largest variants).`,
);
