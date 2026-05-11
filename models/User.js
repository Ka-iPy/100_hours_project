import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, "../data/users.json");

class User {
  constructor(username, password) {
    this.id = crypto.randomUUID();
    this.username = username;
    this.password = password;
  }

  static findByUsername(username) {
    const users = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
    return users.find((user) => user.username === username);
  }

  static findById(id) {
    const users = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
    return users.find((user) => user.id === id);
  }

  static save(user) {
    if (!user.id) {
      user.id = crypto.randomUUID();
    }
    const users = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
    users.push(user);
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
  }
  static getUsers() {
    const data = fs.readFileSync(usersFilePath, "utf-8");
    return JSON.parse(data);
  }
  static saveUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
  }
}

export default User;
