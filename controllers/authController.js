import bcrypt from "bcrypt";
import crypto from "crypto";
import User from "../models/User.js";

const SALT_ROUNDS = 10;

export async function signup(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    req.flash("error", "Username and password are required");
    return res.redirect("/signup");
  }

  if (User.findByUsername(username)) {
    req.flash("error", "Username already exists");
    return res.redirect("/signup");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  User.save({ id: crypto.randomUUID(), username, password: hashedPassword });

  req.flash("success", "Account created! Please log in.");
  res.redirect("/login");
}

export async function login(req, res) {
  const { username, password } = req.body;

  const user = User.findByUsername(username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    req.flash("error", "Invalid username or password");
    return res.redirect("/login");
  }
  console.log(user);
  req.session.user = {
    id: user.id,
    username: user.username,
  };
  req.session.save(() => {
    res.redirect("/hall");
  });
}

export function logout(req, res) {
  req.session.destroy();
  res.redirect("/");
}
