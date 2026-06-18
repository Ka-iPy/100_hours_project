import { Character } from "../models/Character.js";

export function index(req, res) {
  res.render("index");
}

export function loginPage(req, res) {
  res.render("login");
}

export function signupPage(req, res) {
  res.render("signup");
}
// Notice it uses EJS variables
export async function hall(req, res) {
  const characters = await Character.loadAllForPlayer(req.session.user.id);
  console.log(req.session.user.id);
  res.render("hall", {
    username: req.session.user.username,
    userID: req.session.user.id,
    characters,
  });
}
