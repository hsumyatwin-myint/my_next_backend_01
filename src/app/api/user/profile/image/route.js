import { verifyJWT } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs/promises";

const UPLOAD_SUBDIR = "profile-images";
const allowedMimeTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function getUserFilter(user) {
  if (user?.id && ObjectId.isValid(user.id)) {
    return { _id: new ObjectId(user.id) };
  }

  if (user?.email) {
    return { email: user.email };
  }

  return null;
}

function getSafeStoredFilename(profileImagePath) {
  if (!profileImagePath) {
    return null;
  }

  const filename = path.basename(profileImagePath);
  if (!filename || filename === "." || filename === "..") {
    return null;
  }

  return filename;
}

async function removeStoredImage(profileImagePath) {
  const filename = getSafeStoredFilename(profileImagePath);
  if (!filename) {
    return;
  }

  const filePath = path.join(process.cwd(), "public", UPLOAD_SUBDIR, filename);

  try {
    await fs.rm(filePath);
  } catch {
    // Ignore missing file and cleanup errors.
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  const user = verifyJWT(req);
  if (!user) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { message: "Invalid form data" },
      { status: 400, headers: corsHeaders }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { message: "No file uploaded" },
      { status: 400, headers: corsHeaders }
    );
  }

  const fileExt = allowedMimeTypes[file.type];
  if (!fileExt) {
    return NextResponse.json(
      { message: "Only image files allowed" },
      { status: 400, headers: corsHeaders }
    );
  }

  const filename = `${randomBytes(32).toString("hex")}${fileExt}`;
  const publicDirectory = path.join(process.cwd(), "public", UPLOAD_SUBDIR);
  const savePath = path.join(publicDirectory, filename);

  try {
    const filter = getUserFilter(user);
    if (!filter) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    await fs.mkdir(publicDirectory, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(savePath, Buffer.from(arrayBuffer));

    const client = await getClientPromise();
    const db = client.db("wad-01");

    const existing = await db.collection("user").findOne(filter, {
      projection: { profileImage: 1 },
    });

    const newPublicPath = `/${UPLOAD_SUBDIR}/${filename}`;
    await db.collection("user").updateOne(filter, {
      $set: { profileImage: newPublicPath },
    });

    if (existing?.profileImage) {
      await removeStoredImage(existing.profileImage);
    }

    return NextResponse.json(
      { imageUrl: newPublicPath },
      { status: 200, headers: corsHeaders }
    );
  } catch {
    try {
      await fs.rm(savePath);
    } catch {
      // Ignore cleanup errors.
    }

    return NextResponse.json(
      { message: "Failed to upload image" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(req) {
  const user = verifyJWT(req);
  if (!user) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const filter = getUserFilter(user);
    if (!filter) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const client = await getClientPromise();
    const db = client.db("wad-01");

    const profile = await db.collection("user").findOne(filter, {
      projection: { profileImage: 1 },
    });

    if (profile?.profileImage) {
      await removeStoredImage(profile.profileImage);
    }

    await db.collection("user").updateOne(filter, {
      $set: { profileImage: null },
    });

    return NextResponse.json(
      { message: "Image removed" },
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { message: "Failed to remove image" },
      { status: 500, headers: corsHeaders }
    );
  }
}
