import express from "express";
import Project, { ensureProjectTable } from "../models/project.js";

const router = express.Router();

function withProjectTable(handler) {
  return async (req, res, next) => {
    try {
      await ensureProjectTable();
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

router.get("/", withProjectTable(async (req, res) => {
  const projects = await Project.findAll({
    order: [["createdAt", "DESC"]]
  });
  res.json({ success: true, data: projects });
}));

router.get("/:id", withProjectTable(async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ success: false, message: "Project not found" });
  }
  res.json({ success: true, data: project });
}));

router.post("/", withProjectTable(async (req, res) => {
  const { name, baseUrl, token, description } = req.body;
  if (!name || !baseUrl) {
    return res.status(400).json({ success: false, message: "Name and base URL are required" });
  }
  try {
    new URL(baseUrl);
  } catch (error) {
    return res.status(400).json({ success: false, message: "Base URL is not valid" });
  }

  const payload = {
    name: name.trim(),
    baseUrl: baseUrl.trim(),
    token: token ? token.trim() : null,
    description: description ? description.trim() : null,
    databaseType: "postgres"
  };

  const project = await Project.create(payload);
  res.status(201).json({ success: true, data: project });
}));

router.patch("/:id", withProjectTable(async (req, res) => {
  const { name, baseUrl, token, description, isFavorite } = req.body;
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ success: false, message: "Project not found" });
  }

  if (baseUrl) {
    try {
      new URL(baseUrl);
    } catch (error) {
      return res.status(400).json({ success: false, message: "Base URL is not valid" });
    }
  }

  if (name !== undefined) project.name = name.trim();
  if (baseUrl !== undefined) project.baseUrl = baseUrl.trim();
  if (token !== undefined) project.token = token ? token.trim() : null;
  if (description !== undefined) project.description = description ? description.trim() : null;
  if (isFavorite !== undefined) project.isFavorite = Boolean(isFavorite);

  await project.save();

  res.json({ success: true, data: project });
}));

router.patch("/:id/favorite", withProjectTable(async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ success: false, message: "Project not found" });
  }
  project.isFavorite = !project.isFavorite;
  await project.save();
  res.json({ success: true, data: project });
}));

router.delete("/:id", withProjectTable(async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    return res.status(404).json({ success: false, message: "Project not found" });
  }
  await project.destroy();
  res.json({ success: true });
}));

export default router;

