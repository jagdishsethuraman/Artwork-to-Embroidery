# Embroidery Trace Engine Documentation Hub

Welcome to the technical documentation library for the Artwork-to-Embroidery Digitizer Engine.

---

## 📚 Documentation Index

| Document | Purpose & Core Content | Key Audience |
| :--- | :--- | :--- |
| **[Architecture Overview](ARCHITECTURE.md)** | Full end-to-end 6-stage pipeline, data structures (`Point2D`, `Polygon`, `ColorLayer`), commercial compliance matrix. | Architects & Core Developers |
| **[Algorithms & Math Specifications](ALGORITHMS.md)** | Mathematical specifications for canonical branch decomposition, CIELAB $\Delta E$, pull compensation, and Tajima binary encoding. | Algorithm & Embroidery Engineers |
| **[Changelog](CHANGELOG.md)** | Chronological history of milestones, features, and bug fixes following Semantic Versioning and Keep a Changelog. | All Developers & Contributors |
| **[Roadmap](ROADMAP.md)** | Strategic horizons covering Phase 3 (Radial/PES/JEF), Phase 4 (Local AI SAM/Typography), and Phase 5 (3D Puff/Hardware Fleet). | Product & Engineering Leads |

---

## 🧪 Verification & Test Suite
To verify the entire pipeline and all commercial test assertions:
```bash
node test/run-all-tests.js
```
Currently **160 unit and integration tests passing** covering geometry, weave generation (Satin, Tatami, Twill, Radial Satin, Archimedean Spiral, Meander Stippling), binary encoding (DST, EXP, PES, JEF), hole avoidance, multi-polygon consolidation, non-destructive stitch switching, draggable construction sequencing, and in-canvas typography lettering.
