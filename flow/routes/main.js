//import { Router } from "express";

export default function registerMainRoute(router) {
  router.get("/", (req, res) => {
    console.log("i got here 401");
    res.send("👉🏾 Flow");
  });

  router.get("/ping", (req, res) => {
    res.status(200).send("Pong 🔔.");
  });
}
