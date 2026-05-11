import express from "express";
import * as apiController from "../controllers/apiController.js";
import characterController from "../controllers/characterController.js";

const router = express.Router();

router.get("/spells/context/:className/:level", apiController.getSpellContext);
router.get("/equipment/class/:className", apiController.getStartingEquipment);

router.get("/:collection", apiController.getCollection);
router.get("/relationships/feat-origin/:name", apiController.getFeatOrigin);
router.get("/relationships/subclass-feature-parent", apiController.getSubclassFeatureParent);
router.get("/relationships/subrace-parent", apiController.getSubraceParent);
router.get("/character/:id/sources/:attribute", characterController.getCharacterSources);

export default router;
