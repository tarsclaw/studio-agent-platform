import { app } from "./app";

(async () => {
  await app.start();
  console.log(`\nBot started, app listening to`, process.env.PORT || process.env.port || 3978);
})();
