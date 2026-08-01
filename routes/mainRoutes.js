import express from "express";
import * as mainController from "../controllers/mainController.js";
import characterController from "../controllers/characterController.js";

const router = express.Router();

/** Redirect to /login when the visitor has no session user. */
function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.flash("error", "Please log in first.");
    return res.redirect("/login");
  }
  next();
}

router.get("/", mainController.index);
router.get("/login", mainController.loginPage);
router.get("/signup", mainController.signupPage);
router.get("/hall", requireLogin, mainController.hall);
router.get("/createCharacter", characterController.getCharacterCreator);
router.post("/createCharacter", requireLogin, characterController.createCharacter);
router.get("/character/:id", characterController.getCharacter);
router.get("/character/:id/markdown", characterController.downloadMarkdown);
router.put("/character/:id", characterController.updateCharacter);
router.delete("/character/:id", characterController.deleteCharacter);

export default router;
