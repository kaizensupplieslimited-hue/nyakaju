import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const roomAssets = {
  deluxe: [
    ["delux_bed.webp", "Deluxe double-bed room at The Nyakaju", true],
    ["delux_bathroom.webp", "Deluxe tiled bathroom with an enclosed shower", false],
    ["delux_alt.webp", "Deluxe single-bed room at The Nyakaju", false],
  ],
  royal: [
    ["royal_bed.webp", "Royal bedroom with purple walls and natural light", true],
    ["royal_bathroom.webp", "Royal tiled bathroom with a walk-in shower", false],
    ["royal_alt.webp", "Royal bedroom with floral curtains", false],
  ],
  elite: [
    ["elite.webp", "Elite spacious bedroom and sitting area", true],
    ["elite_bathroom.webp", "Elite bathroom with an enclosed shower", false],
    ["elite_alt.webp", "Elite bathroom vanity and shower area", false],
  ],
};

const { data: rooms, error: roomsError } = await supabase
  .from("room_types")
  .select("id, slug");

if (roomsError) throw roomsError;

for (const room of rooms ?? []) {
  const assets = roomAssets[room.slug];
  if (!assets) continue;

  const { data: existingPrimary, error: primaryError } = await supabase
    .from("room_images")
    .select("storage_path")
    .eq("room_type_id", room.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (primaryError) throw primaryError;

  for (const [fileName, altText, defaultPrimary] of assets) {
    const optimizedFileName = fileName.replace(/\.webp$/i, "-1920.webp");
    const localPath = path.join(process.cwd(), "public", "media", "room_images", optimizedFileName);
    const storagePath = `seed-v2/${room.slug}/${optimizedFileName}`;
    const fileBody = await readFile(localPath);
    const { error: uploadError } = await supabase.storage
      .from("room-images")
      .upload(storagePath, fileBody, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const shouldBePrimary = existingPrimary
      ? existingPrimary.storage_path === storagePath
      : defaultPrimary;
    const { error: metadataError } = await supabase
      .from("room_images")
      .upsert(
        {
          room_type_id: room.id,
          storage_path: storagePath,
          alt_text: altText,
          is_primary: shouldBePrimary,
          display_order: assets.findIndex(([assetName]) => assetName === fileName),
        },
        { onConflict: "storage_path" },
      );

    if (metadataError) throw metadataError;
    console.log(`Seeded ${storagePath}`);
  }
}

console.log("Room image seed completed.");
