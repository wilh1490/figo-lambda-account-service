import mongoose from "mongoose";
mongoose.Promise = global.Promise;
import { getSecrets } from "./shared/config/secrets.js";

let { DATABASE_URL: dbUri } = await getSecrets();

console.log(dbUri, "duri");

try {
  await mongoose.connect(dbUri, {
    //useNewUrlParser: true,
  });
} catch (err) {
  mongoose.createConnection(dbUri);
}

const info = mongoose.connections[0];

mongoose.connection
  .on("error", () => console.error("Unable to connect to database"))
  .on("close", () => console.log("Database connection closed.")) // eslint-disable-line no-console
  .once("open", () =>
    console.log(`Connected to ${info.host}:${info.port}/${info.name}`)
  );
