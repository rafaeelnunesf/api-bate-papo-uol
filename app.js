import express, { json } from "express";
import cors from "cors";
import joi from "joi";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("API-UOL");
});

const participantSchema = joi.object({
  name: joi.string().required(),
});

app.post("/participants", async (req, res) => {
  const participant = req.body;
  /////////////////////////////////// START VALIDATION ///////////////////////////////////
  const validation = participantSchema.validate(participant, {
    abortEarly: true,
  });
  if (validation.error) {
    res.status(422).send(validation.error.details);
    return;
  }
  const user = await db.collection("participants").findOne(participant);
  if (user) {
    res.sendStatus(409);
    return;
  }
  /////////////////////////////////// END VALIDATION ///////////////////////////////////
  participant.lastStatus = Date.now();
  try {
    await db.collection("participants").insertOne(participant);
    await db.collection("messages").insertOne({
      from: participant.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  try {
    const participant = await db
      .collection("participants")
      .findOne({ name: req.headers.user });
    if (!participant) {
      res.sendStatus(404);
      return;
    }

    await db
      .collection("participants")
      .updateOne(
        { lastStatus: participant.lastStatus },
        { $set: { lastStatus: Date.now() } }
      );

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(5000, () => {
  console.log("servidor rodando na porta 5000...");
});
