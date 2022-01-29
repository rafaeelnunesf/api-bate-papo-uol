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

  await db.collection("participants").insertOne(participant);
  await db.collection("messages").insertOne({
    from: participant.name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs().format("HH:mm:ss"),
  });

  res.sendStatus(201);
});
app.listen(5000, () => {
  console.log("servidor rodando na porta 5000...");
});
