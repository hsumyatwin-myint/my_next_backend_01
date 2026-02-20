import jwt from "jsonwebtoken";
import cookie from "cookie";

const JWT_SECRET = process.env.JWT_SECRET || "mydefaultjwtsecret";

export function verifyJWT(req) {
  try {
    const cookies = req.headers.get("cookie") || "";
    const { token } = cookie.parse(cookies);

    if (!token) {
      return null;
    }

    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
