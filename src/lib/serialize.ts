import "server-only";
import { Types } from "mongoose";

type PlainRecord = Record<string, unknown>;

function hasToObject(value: unknown): value is { toObject: () => PlainRecord } {
  return typeof value === "object" && value !== null && typeof (value as PlainRecord).toObject === "function";
}

// Recursively converts Mongoose documents (including populated refs and
// embedded subdocuments) into plain JSON-safe objects with `_id` -> `id`,
// matching the shape the frontend expects (mirrors the old Prisma `id` field).
// ObjectId is converted to a plain string: it has a native toJSON() so it
// would serialize fine through NextResponse.json(), but passing a raw
// ObjectId instance as a Server Component -> Client Component prop is not
// valid (React's RSC wire format only allows plain, serializable values).
export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (hasToObject(value)) return serialize(value.toObject());

  if (typeof value === "object") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to exclude it from `rest`
    const { _id, __v, ...rest } = value as PlainRecord & { _id?: Types.ObjectId; __v?: number };
    const out: PlainRecord = {};
    if (_id !== undefined) out.id = _id.toString();
    for (const [key, val] of Object.entries(rest)) {
      out[key] = serialize(val);
    }
    return out;
  }

  return value;
}
