import express from "express";
import cors from "cors";
import { unit, soldiers } from "./data.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/unit", (_req, res) => {
  res.json(unit);
});

app.get("/api/sections", (_req, res) => {
  const withCounts = unit.sections.map((section) => ({
    ...section,
    soldierCount: soldiers.filter((s) => s.sectionId === section.id).length
  }));

  res.json(withCounts);
});

app.get("/api/sections/:sectionId/soldiers", (req, res) => {
  const { sectionId } = req.params;
  const section = unit.sections.find((s) => s.id === sectionId);

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  const result = soldiers.filter((s) => s.sectionId === sectionId);
  res.json({ section, soldiers: result });
});

app.get("/api/soldiers", (req, res) => {
  const query = (req.query.search || "").toString().trim().toLowerCase();

  if (!query) {
    res.json(soldiers);
    return;
  }

  const filtered = soldiers.filter((soldier) =>
    soldier.name.toLowerCase().includes(query)
  );

  res.json(filtered);
});

app.get("/api/soldiers/:id", (req, res) => {
  const soldier = soldiers.find((s) => s.id === req.params.id);

  if (!soldier) {
    res.status(404).json({ message: "Soldier not found" });
    return;
  }

  res.json(soldier);
});

app.listen(PORT, () => {
  console.log(`Unit Directory API running on http://localhost:${PORT}`);
});
