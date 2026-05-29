import express from "express";
import { retrieveChat } from "../controllers/chat.controllers";

const router = express.Router();

// Define the route for processing RAG queries
// This maps to /api/chat/query
router.post("/query", retrieveChat);

export default router;
