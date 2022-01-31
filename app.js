import express, { json } from "express";
import cors from "cors";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
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

const userSchema = joi.string().required();
const participantSchema = joi.object({
  name: joi.string().required(),
});

const messagesSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
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

app.post("/messages", async (req, res) => {
  /////////////////////////////////// START VALIDATION ///////////////////////////////////
  const messageValidation = messagesSchema.validate(req.body, {
    abortEarly: true,
  });
  const userValidation = userSchema.validate(req.headers.user, {
    abortEarly: true,
  });
  if (messageValidation.error) {
    return res.status(422).send(messageValidation.error.details);
  } else if (userValidation.error) {
    return res.status(422).send(userValidation.error.details);
  }
  const user = await db
    .collection("participants")
    .findOne({ name: req.headers.user });
  if (!user) {
    res.sendStatus(409);
    return;
  }
  /////////////////////////////////// END VALIDATION ///////////////////////////////////
  try {
    await db.collection("messages").insertOne({
      from: req.headers.user,
      to: req.body.to,
      text: req.body.text,
      type: req.body.type,
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  const user = await db
    .collection("participants")
    .findOne({ name: req.headers.user });
  if (!user) {
    res.sendStatus(409);
    return;
  }
  try {
    const messages = await db
      .collection("messages")
      .find({ to: { $in: ["Todos", req.headers.user] } })
      .toArray();

    const limitedMessages = messages.reverse().slice(0, req.query.limit);

    res.send(limitedMessages);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.delete("/messages/:idMessage", async (req, res) => {
  const { idMessage } = req.params;
  const user = req.headers.user;
  try {
    const message = await db
      .collection("messages")
      .findOne({ _id: new ObjectId(idMessage) });
    if (!message) {
      res.sendStatus(404);
      return;
    } else if (message.from !== user) {
      res.sendStatus(401);
      return;
    }
    await db.collection("messages").deleteOne({ _id: new ObjectId(idMessage) });
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

setInterval(async () => {
  const participants = await db
    .collection("participants")
    .find({ lastStatus: { $lt: Date.now() - 10000 } })
    .toArray();

  await db
    .collection("participants")
    .deleteMany({ lastStatus: { $lt: Date.now() - 10000 } });

  participants.map(async (user) => {
    await db.collection("messages").insertOne({
      from: user.name,
      to: "Todos",
      text: "sai da sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
  });
}, 15000);

app.listen(5000, () => {
  console.log("servidor rodando na porta 5000...");
});
