import Fastify from "fastify";
import { AurionClient } from "./aurion";
import { PlanningParser } from "./utils/PlanningParser";
import { AurionDateUtils } from "./utils/AurionDateUtils";

import { GoogleCalendarService } from "./services/GoogleCalendarService";

const server = Fastify({
  logger: true,
});

const googleService = new GoogleCalendarService();

server.get("/", async (request, reply) => {
  return { status: "OK", message: "We gon be Alright" };
});

server.get("/api/auth/google", async (request, reply) => {
  const { code } = request.query as { code: string };
  if (!code) {
    return reply
      .status(400)
      .send({ error: "Missing 'code' in query parameters" });
  }

  await googleService.saveToken(code);
  return { status: "Authenticated", message: "Token saved successfully!" };
});

server.get("/api/sync/google", async (request, reply) => {
  const username = process.env.AURION_USERNAME;
  const password = process.env.AURION_PASSWORD;

  if (!username || !password) {
    return reply
      .status(500)
      .send({ error: "Missing AURION_USERNAME or AURION_PASSWORD in .env" });
  }

  const isAuthenticated = await googleService.loadToken();
  if (!isAuthenticated) {
    return reply
      .status(401)
      .send({ error: "Google Calendar Not Authenticated" });
  }

  const client = new AurionClient();

  try {
    const xml = await client.getPlanningXml(username, password);
    const events = PlanningParser.parseXmlResponse(xml);

    await googleService.syncEvents(events);

    return {
      status: "Synced",
      message: `Successfully synced ${events.length} events to Google Calendar`,
    };
  } catch (error: any) {
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: "Failed to sync", details: error.message });
  }
});

server.delete("/api/sync/google", async (request, reply) => {
  const { date } = request.query as { date?: string };
  const targetDate = date ? new Date(date) : new Date();

  if (isNaN(targetDate.getTime())) {
    return reply.status(400).send({ error: "Invalid date format" });
  }

  const isAuthenticated = await googleService.loadToken();
  if (!isAuthenticated) {
    return reply
      .status(401)
      .send({ error: "Google Calendar Not Authenticated" });
  }

  const { startMs, endMs } = AurionDateUtils.getWeekParams(targetDate);
  const start = new Date(startMs).toISOString();
  const end = new Date(endMs).toISOString();

  try {
    const count = await googleService.deleteAurionEvents(start, end);
    return {
      status: "Success",
      message: `Deleted ${count} Aurion events from the week of ${AurionDateUtils.toDateString(
        targetDate,
      )}`,
      range: { start, end },
    };
  } catch (error: any) {
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: "Failed to delete events", details: error.message });
  }
});

server.get("/api/check-auth", async (request, reply) => {
  const isAuthenticated = await googleService.loadToken();
  if (isAuthenticated) {
    return { status: "Authenticated", message: "User is logged in to Google" };
  } else {
    const authUrl = googleService.generateAuthUrl();
    return { status: "Not Authenticated", authUrl };
  }
});

server.get("/planning", async (request, reply) => {
  const username = process.env.AURION_USERNAME;
  const password = process.env.AURION_PASSWORD;

  if (!username || !password) {
    return reply
      .status(500)
      .send({ error: "Missing AURION_USERNAME or AURION_PASSWORD in .env" });
  }

  const client = new AurionClient();

  try {
    const xml = await client.getPlanningXml(username, password);
    reply.type("application/xml");
    return xml;
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: "Failed to connect to Aurion" });
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Serveur démarré sur http://localhost:3000");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
