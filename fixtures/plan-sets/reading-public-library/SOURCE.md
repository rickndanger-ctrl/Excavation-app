# Reading Public Library civil-plan fixture

This folder contains the official bid drawings for the Reading Public Library
Terrace and Landscape Improvements project in Reading, Massachusetts.

## Source

- Publisher: Town of Reading, Massachusetts
- Official document URL: <https://readingma.gov/DocumentCenter/View/17910/25020-RPL_Bid_Drawings_2025_07_11?bidId=>
- Document date: July 23, 2025
- Local filename: `25020-RPL_Bid_Drawings_2025_07_11.pdf`
- SHA-256: `835e28d8d981b4c0a0c5840e006c4cc19f259fc7fcb218ddc744bfec97da97d1`
- Pages: 8
- PDF version: 1.7
- Page size: 1728 x 2592 points
- Encrypted: no
- Embedded JavaScript: no

## Sheet inventory

1. Cover and drawing index
2. Topographic survey
3. `SP1.1` — Site Preparation Plan
4. `SP1.2` — Site Preparation Details
5. `L1.1` — Layout and Materials Plan
6. `L2.1` — Grading and Utility Plan
7. `L3.1` — Planting Plan and Details
8. `L4.1` — Detail Sheet I

## Intended use in EveSite

This is the first real-world evaluation fixture for the plan-ingestion
pipeline. Start with `L2.1` because it includes contours, spot elevations,
slopes, top/bottom wall elevations, existing utility references, a legend, and
a stated scale. Preserve the original PDF and derive rendered pages, extracted
text, normalized geometry, and human-reviewed ground truth into separate
generated folders.

Public availability does not by itself grant unrestricted commercial model-
training rights. Keep this provenance record with every derivative and use the
document as an internal evaluation/development fixture unless reuse rights are
confirmed separately.
