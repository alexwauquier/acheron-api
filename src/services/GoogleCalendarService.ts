import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import process from "process";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const TOKEN_DIR = path.join(process.cwd(), "tokens");
const TOKEN_PATH = path.join(TOKEN_DIR, "token.json");

export class GoogleCalendarService {
  private auth;
  private calendar;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Google Credentials in .env");
    }

    this.auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.calendar = google.calendar({ version: "v3", auth: this.auth });
  }

  async loadToken(): Promise<boolean> {
    try {
      const content = await fs.readFile(TOKEN_PATH, "utf-8");
      const token = JSON.parse(content);
      this.auth.setCredentials(token);
      return true;
    } catch (err) {
      return false;
    }
  }

  
  generateAuthUrl(): string {
    return this.auth.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
  }

 
  async saveToken(code: string): Promise<void> {
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);

    try {
      await fs.mkdir(TOKEN_DIR, { recursive: true });
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
    } catch (err) {
      console.error("Error saving token:", err);
    }
  }
}
