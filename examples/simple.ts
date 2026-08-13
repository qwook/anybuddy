import process from "node:process";
import AnyBuddy from "../src";
import * as fs from "node:fs/promises";

// Put your mnemonic phrase here to authenticate.
const MNEMONIC = "";

(async () => {
  const anybuddy = new AnyBuddy("http://127.0.0.1:56877");

  // Let's get a session token.
  // A session token is something we can store somewhere on our computer.
  // On the browser can store this in our cookies.
  let token = "";
  try {
    token = await fs.readFile("./.token", { encoding: "utf-8" });
  } catch (e) {
    token = await anybuddy.authenticate(process.env.MNEMONIC || MNEMONIC);
    await fs.writeFile("./.token", token, { encoding: "utf-8" });
  }

  // Let's login!
  await anybuddy.login(token);

  console.log(await anybuddy.getSpaces());
})();
