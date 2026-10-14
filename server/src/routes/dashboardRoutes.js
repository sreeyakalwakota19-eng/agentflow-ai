const express = require("express");
const { stats } = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

router.get("/stats", stats);

module.exports = router;
