import { Low, JSONFile } from "lowdb";

interface Data {
  collections: {
    slug: string;
    floorThreshold: number;
    floorOnLastAlert?: number;
  }[];
}

const adapter = new JSONFile<Data>("db.json");
const db = new Low(adapter);

(async () => {
  await db.read();
  db.data = { collections: db.data?.collections || [] };
})();

export default db;
