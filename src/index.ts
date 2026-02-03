import Fastify from "fastify";
import { AurionClient } from "./aurion";

const server = Fastify({
  logger: true,
});

server.get("/", async (request, reply) => {
  return { status: "OK", message: "We gon be Alright" };
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
  const success = await client.login(username, password);

  if (!success) {
    return reply.status(401).send({ error: "Login failed" });
  }

  try {
    const tokens = await client.navigateToPlanning();
    if (!tokens) {
      return reply
        .status(500)
        .send({ error: "Failed to navigate to Planning page" });
    }

    const xml = await client.fetchPlanningEvents(
      tokens.viewState,
      tokens.idInit,
    );

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
