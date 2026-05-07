import { migrate } from "../db/migrate";

await migrate();
console.log("migrations applied");
