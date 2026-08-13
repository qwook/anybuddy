import process from "node:process";
import AnyBuddy from "../src";
import * as fs from "node:fs/promises";

(async () => {
  const anybuddy = new AnyBuddy("http://127.0.0.1:56877");

  let token = "";
  try {
    token = await fs.readFile("./token", { encoding: "utf-8" });
  } catch (e) {
    token = await anybuddy.authenticate(process.env.MNEMONIC || "");
    await fs.writeFile("./token", token, { encoding: "utf-8" });
  }
  await anybuddy.login(token);

  console.log(await anybuddy.getSpaces());
  console.log(token);
})();
