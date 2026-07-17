import express from "express";
import * as mainController from "../controllers/mainController.js";
import characterController from "../controllers/characterController.js";

const router = express.Router();

router.get("/", mainController.index);
router.get("/login", mainController.loginPage);
router.get("/signup", mainController.signupPage);
router.get("/hall", mainController.hall);
router.get("/createCharacter", characterController.getCharacterCreator);
router.post("/createCharacter", characterController.createCharacter);
router.get("/character/:id", characterController.getCharacter);
router.get("/character/:id/markdown", characterController.downloadMarkdown);
router.put("/character/:id", characterController.updateCharacter);
router.delete("/character/:id", characterController.deleteCharacter);

export default router;
