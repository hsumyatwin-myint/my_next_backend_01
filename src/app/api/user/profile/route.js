import { verifyJWT } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

function getUserFilter(user) {
  if (user?.id && ObjectId.isValid(user.id)) {
    return { _id: new ObjectId(user.id) };
  }

  if (user?.email) {
    return { email: user.email };
  }

  return null;
}

function toProfileResponse(profile) {
  return {
    id: profile._id?.toString() || "",
    email: profile.email || "",
    firstname: profile.firstname || "",
    lastname: profile.lastname || "",
    profileImage: profile.profileImage || null,
  };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
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
      projection: {
        email: 1,
        firstname: 1,
        lastname: 1,
        profileImage: 1,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(toProfileResponse(profile), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch profile" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PUT(req) {
  const user = verifyJWT(req);
  if (!user) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400, headers: corsHeaders }
    );
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const firstname = String(body?.firstname || "").trim();
  const lastname = String(body?.lastname || "").trim();

  if (!email || !firstname || !lastname) {
    return NextResponse.json(
      { message: "Email, first name and last name are required" },
      { status: 400, headers: corsHeaders }
    );
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { message: "Invalid email format" },
      { status: 400, headers: corsHeaders }
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

    const result = await db.collection("user").findOneAndUpdate(
      filter,
      {
        $set: {
          email,
          firstname,
          lastname,
        },
      },
      {
        returnDocument: "after",
        projection: {
          email: 1,
          firstname: 1,
          lastname: 1,
          profileImage: 1,
        },
      }
    );

    if (!result) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(toProfileResponse(result), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    if (String(error).includes("E11000") && String(error).includes("email")) {
      return NextResponse.json(
        { message: "Email already in use" },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { message: "Failed to update profile" },
      { status: 500, headers: corsHeaders }
    );
  }
}
