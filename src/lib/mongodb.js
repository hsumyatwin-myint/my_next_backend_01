import { MongoClient } from "mongodb";
const options = {};
let globalClientPromise;
export function getClientPromise() {
 const uri = process.env.MONGODB_URI;
 if (!uri) {
    throw new Error("mongodb+srv://u6726115_db_user:LXWyruEMyeCHpVeK@wad-01.donu9nt.mongodb.net/?appName=Wad-01");
 }
 if (process.env.NODE_ENV === "development") {
 if (!globalClientPromise) {
 const client = new MongoClient(uri, options);
 globalClientPromise = client.connect();
 }
 return globalClientPromise;
 } else { 
    const client = new MongoClient(uri, options);
 return client.connect();
 }
} 