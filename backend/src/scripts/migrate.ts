import { migrate } from "../db/migrate";
import { syncCapabilities } from "../services/capabilities";

await migrate();
await syncCapabilities();
console.log("migrations applied");
