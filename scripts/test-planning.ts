import { AurionSession } from "../src/sessions/AurionSession";
import { AurionPlanning } from "../src/services/AurionPlanning";
import { AurionDateUtils } from "../src/utils/AurionDateUtils";

const run = async () => {
  const startTime = performance.now();
  const username = process.env.AURION_USERNAME;
  const password = process.env.AURION_PASSWORD;

  if (!username || !password) {
    console.error("Error: AURION_USERNAME or AURION_PASSWORD not set in .env");
    process.exit(1);
  }

  const session = new AurionSession();

  console.log("Logging in...");
  const loginSuccess = await session.login(username, password);
  if (!loginSuccess) {
    console.error("Login failed");
    process.exit(1);
  }
  console.log("Login Success");

  const planningService = new AurionPlanning(session);

  console.log("Navigating to Planning Page...");
  const tokens = await planningService.navigateToPlanning();

  if (!tokens) {
    console.error("Failed to get Planning Tokens.");
    process.exit(1);
  }

  console.log("Fetching Events (6 Months Loop)...");

  const allEvents = new Map<string, any>();
  const currentDate = new Date();

  currentDate.setDate(1);

  const monthsToFetch = 2;

  for (let i = 0; i < monthsToFetch; i++) {
    const targetDate = new Date(currentDate);
    targetDate.setMonth(targetDate.getMonth() + i);

    const params = AurionDateUtils.getMonthParams(targetDate);
    params.view = "agendaWeek";

    console.log(
      `Fetching Month ${i + 1}/${monthsToFetch}: ${params.dateStr} (Start: ${new Date(params.startMs).toLocaleDateString()})`,
    );

    try {
      const events = await planningService.fetchEvents(
        tokens.viewState,
        tokens.idInit,
        params,
      );

      events.forEach((e) => allEvents.set(e.id, e));

      await new Promise((r) => setTimeout(r, 50));
    } catch (error) {
      console.error(`Error fetching month ${params.dateStr}:`, error);
    }
  }

  const eventsArray = Array.from(allEvents.values());
  console.log(`\nSuccess! Fetched ${eventsArray.length} classes.`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = `./scripts/planning-${monthsToFetch}months-${timestamp}.json`;

  await Bun.write(Bun.file(dumpPath), JSON.stringify(eventsArray, null, 2));
  console.log(`Saved JSON to ${dumpPath}`);

  if (eventsArray.length > 0) {
    console.log("\nFirst Class:");
    console.log(eventsArray[0]);
  }

  const endTime = performance.now();
  console.log(
    `\nTotal Execution Time: ${((endTime - startTime) / 1000).toFixed(2)}s`,
  );
};

run();
