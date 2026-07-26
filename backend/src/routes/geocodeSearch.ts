import { Router, type Request, type Response } from "express";
import { searchPlaces } from "../services/geocode";

export const geocodeSearchRouter = Router();

// Thin proxy to Geoapify autocomplete so the frontend never holds the API key.
geocodeSearchRouter.get("/geocode-search", async (req: Request, res: Response) => {
  const q = req.query.q;
  if (typeof q !== "string" || !q.trim()) {
    return res.status(400).json({ error: "q query param is required" });
  }

  const biasLat = Number(req.query.bias_lat);
  const biasLng = Number(req.query.bias_lng);
  const biasLocation = Number.isFinite(biasLat) && Number.isFinite(biasLng) ? { lat: biasLat, lng: biasLng } : undefined;

  try {
    const results = await searchPlaces(q, biasLocation);
    return res.json({ results });
  } catch (err) {
    console.error("[GET /geocode-search] failure:", err);
    return res.status(502).json({ error: "Place search is temporarily unavailable. Please try again." });
  }
});
