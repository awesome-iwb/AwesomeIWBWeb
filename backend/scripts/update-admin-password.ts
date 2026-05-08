import { sql } from "../src/db/client";
import argon2 from "argon2";

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

async function updatePassword() {
  const newPassword = process.env.NEW_PASSWORD || "aiwb1246790";
  const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

  console.log("Generated hash:", passwordHash);

  await sql()`
    UPDATE local_accounts
    SET password_hash = ${passwordHash},
        must_change_password = false,
        failed_attempts = 0,
        locked_until = null
    WHERE username = 'lincube'
  `;

  console.log("Password updated successfully!");

  const result = await sql()`
    SELECT username, is_active, must_change_password, failed_attempts
    FROM local_accounts
    WHERE username = 'lincube'
  `;

  console.log("Updated record:", result[0]);
  process.exit(0);
}

updatePassword().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
