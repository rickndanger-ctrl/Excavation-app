"""Local operator workspace for the canonical civil-plan pipeline.

This module owns workflow state only. Civil geometry and engineering decisions
remain in the project bundle and are always evaluated by the canonical loader,
validator, and builder.
"""

from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
from typing import Any

from .build import build_project
from .io import load_project_bundle
from .validation import DISCLAIMER, validate_model


HANDOFF_SCHEMA = "civil-plan-factory.field-map-handoff/v0.1.0"
FIELD_MAP_SCHEMA = "excavation-field-map.jobsite-package/v0.1.0"
DEFAULT_QGIS_APP = Path("/Applications/QGIS-final-4_2_1.app")
_SLUG = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _issue_key(issue: dict[str, Any]) -> str:
    basis = f"{issue.get('code', '')}\0{issue.get('path', '')}".encode()
    return hashlib.sha256(basis).hexdigest()[:20]


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not slug or not slug[0].isalpha():
        slug = f"source-{slug}".rstrip("-")
    return slug or "source"


def _readiness_inventory(issues: list[dict[str, Any]]) -> dict[str, Any]:
    definitions = {
        "spatial_basis": (
            {"crs.missing", "datum.missing", "units.missing"},
            "Establish the source-backed CRS, units, vertical datum, benchmark, and transformations in the authoritative model.",
        ),
        "system_coverage": (
            {"coverage.missing_system", "interface.missing_system"},
            "Model each required civil system and its building/field interfaces, or explicitly preserve it as unavailable with a reason.",
        ),
        "source_integrity": (
            {"source.lock_unreadable", "source.lock_mismatch", "source.reference_missing"},
            "Repair the cited source and checksum lock without changing its provenance category.",
        ),
        "canonical_model": (
            set(),
            "Correct the authoritative semantic model and rerun canonical validation; review notes cannot clear this gate.",
        ),
    }
    grouped: dict[str, dict[str, Any]] = {}
    assigned: set[int] = set()
    for name, (codes, action) in definitions.items():
        indexes = [index for index, issue in enumerate(issues) if issue.get("code") in codes]
        if name == "canonical_model":
            indexes = [index for index in range(len(issues)) if index not in assigned]
        if indexes:
            assigned.update(indexes)
            grouped[name] = {
                "blocker_count": len(indexes),
                "codes": sorted({issues[index].get("code", "unknown") for index in indexes}),
                "next_action": action,
            }
    return {
        "status": "blocked" if issues else "validation_clear",
        "blocker_count": len(issues),
        "groups": grouped,
    }


class StudioWorkspace:
    """Filesystem-backed workflow facade for one local Model Studio repository."""

    def __init__(
        self,
        repository: Path,
        *,
        state_root: Path | None = None,
        qgis_app: Path = DEFAULT_QGIS_APP,
    ) -> None:
        self.repository = Path(repository).resolve()
        self.projects_root = self.repository / "projects"
        self.state_root = Path(state_root or self.repository / ".model-studio").resolve()
        self.qgis_app = Path(qgis_app).resolve()
        self.projects_root.mkdir(parents=True, exist_ok=True)
        self.state_root.mkdir(parents=True, exist_ok=True)

    def _project_dir(self, slug: str) -> Path:
        if not _SLUG.fullmatch(slug):
            raise ValueError("Project slug must be a lowercase, hyphen-separated identifier")
        project_dir = (self.projects_root / slug).resolve()
        if project_dir.parent != self.projects_root:
            raise ValueError("Project path escapes the projects directory")
        return project_dir

    def _project_file(self, slug: str) -> Path:
        project_file = self._project_dir(slug) / "project.json"
        if not project_file.is_file():
            raise FileNotFoundError(f"Unknown project: {slug}")
        return project_file

    def _review_file(self, slug: str) -> Path:
        return self.state_root / "reviews" / f"{slug}.json"

    def _reviews(self, slug: str) -> dict[str, dict[str, Any]]:
        path = self._review_file(slug)
        if not path.exists():
            return {}
        return _read_json(path).get("reviews", {})

    def _validation(self, slug: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        try:
            model = load_project_bundle(self._project_file(slug))
            issues = [issue.to_dict() for issue in validate_model(model)]
            return model, issues
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            return None, [{
                "severity": "error",
                "code": "bundle.load_failed",
                "path": "project.json",
                "message": str(error),
            }]

    @staticmethod
    def _provenance_summary(model: dict[str, Any] | None) -> dict[str, int]:
        counts: Counter[str] = Counter()
        if not model:
            return {status: 0 for status in (
                "confirmed", "reference-derived", "reviewed_assumption", "generated", "unknown"
            )}
        for source in model.get("sources", []):
            counts[source.get("provenance_status", "unknown")] += 1
        for decision in model.get("decisions", []):
            counts[decision.get("status", "unknown")] += 1
        features = model.get("features", {})
        for group in ("points", "lines", "polygons", "surfaces"):
            for feature in features.get(group, []):
                counts[feature.get("provenance", {}).get("status", "unknown")] += 1
        for network in model.get("networks", []):
            for group in ("nodes", "edges"):
                for feature in network.get(group, []):
                    counts[feature.get("provenance", {}).get("status", "unknown")] += 1
        return {status: counts[status] for status in (
            "confirmed", "reference-derived", "reviewed_assumption", "generated", "unknown"
        )}

    def list_projects(self) -> list[dict[str, Any]]:
        return [
            self.project_detail(path.parent.name, include_issues=False)
            for path in sorted(self.projects_root.glob("*/project.json"))
        ]

    def project_detail(self, slug: str, *, include_issues: bool = True) -> dict[str, Any]:
        self._project_file(slug)
        model, raw_issues = self._validation(slug)
        reviews = self._reviews(slug)
        active_keys: set[str] = set()
        issues: list[dict[str, Any]] = []
        for raw in raw_issues:
            issue = dict(raw)
            key = _issue_key(issue)
            issue["key"] = key
            active_keys.add(key)
            if key in reviews:
                issue["review"] = {**reviews[key], "status": "reviewed_not_cleared"}
            issues.append(issue)
        cleared_reviews = [
            {**review, "key": key, "status": "cleared_by_validation"}
            for key, review in reviews.items() if key not in active_keys
        ]
        project = (model or {}).get("project", {})
        directory = self._project_dir(slug)
        current_fingerprint = self._fingerprint(slug)
        runs = [
            {**run, "is_current": run.get("project_fingerprint") == current_fingerprint}
            for run in self.list_runs(slug)
        ]
        current_run = next((run for run in runs if run["is_current"]), None)
        result: dict[str, Any] = {
            "slug": slug,
            "project_id": project.get("id", slug),
            "name": project.get("name", slug.replace("-", " ").title()),
            "revision": project.get("revision", "draft"),
            "disclaimer": project.get("disclaimer", DISCLAIMER),
            "validation_status": "invalid" if raw_issues else "valid",
            "issue_count": len(raw_issues),
            "readiness_inventory": _readiness_inventory(raw_issues),
            "provenance": self._provenance_summary(model),
            "input_count": len(list((directory / "inputs").glob("*"))) if (directory / "inputs").exists() else 0,
            "project_file": str(directory / "project.json"),
            "cleared_reviews": cleared_reviews,
            "runs": runs,
            "current_run": current_run,
        }
        if include_issues:
            result["issues"] = issues
            result["limitations"] = (model or {}).get("limitations", [])
            result["sources"] = (model or {}).get("sources", [])
        return result

    def create_project(self, name: str, slug: str | None = None) -> dict[str, Any]:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("Project name is required")
        project_slug = slug or _slugify(clean_name)
        directory = self._project_dir(project_slug)
        if directory.exists():
            raise FileExistsError(f"Project already exists: {project_slug}")
        directory.mkdir(parents=True)
        project = {
            "schema_version": "civil-plan-factory.project/v0.1.0",
            "project": {
                "id": project_slug,
                "name": clean_name,
                "revision": "draft-intake-0",
                "disclaimer": DISCLAIMER,
            },
            "spatial_reference": {
                "horizontal_crs": None,
                "horizontal_units": None,
                "vertical_datum": None,
                "vertical_units": None,
                "benchmark": {},
                "transformations": [],
                "tolerances": {},
            },
            "source_ledger": "sources.lock.json",
            "decision_ledger": "decisions.json",
            "phases": [],
            "layers": [],
            "features": {"points": [], "lines": [], "polygons": [], "surfaces": []},
            "networks": [],
            "deliverables": {"plans": [], "profiles": [], "sections": [], "schedules": [], "detail_cards": []},
            "contract_coverage": [],
            "relationships": {},
            "limitations": [
                "Intake draft only. CRS, datum, control, geometry, engineering basis, and approvals are unknown."
            ],
        }
        _write_json(directory / "project.json", project)
        _write_json(directory / "sources.lock.json", {"disclaimer": DISCLAIMER, "sources": []})
        _write_json(directory / "decisions.json", {"disclaimer": DISCLAIMER, "decisions": []})
        return self.project_detail(project_slug)

    def add_input(self, slug: str, filename: str, content: bytes) -> dict[str, Any]:
        if not filename.lower().endswith(".pdf") or not content.startswith(b"%PDF-"):
            raise ValueError("Plan-set intake currently accepts PDF files only")
        project_dir = self._project_dir(slug)
        self._project_file(slug)
        digest = hashlib.sha256(content).hexdigest()
        stem = _slugify(Path(filename).stem)
        source_id = f"input-{stem}-{digest[:12]}"
        ledger_path = project_dir / "sources.lock.json"
        ledger = _read_json(ledger_path)
        for existing in ledger.get("sources", []):
            if existing.get("id") == source_id:
                return {
                    "id": source_id,
                    "filename": Path(existing["citation"]).name,
                    "path": existing["citation"],
                    "sha256": digest,
                    "provenance_status": existing["provenance_status"],
                    "supports": existing.get("supports", []),
                }
        stored_name = f"{stem}-{digest[:12]}.pdf"
        stored_path = (project_dir / "inputs" / stored_name).resolve()
        stored_path.parent.mkdir(parents=True, exist_ok=True)
        if stored_path.exists() and _sha256(stored_path) != digest:
            raise ValueError("Existing intake file does not match its content address")
        if not stored_path.exists():
            stored_path.write_bytes(content)
        source = {
            "id": source_id,
            "title": Path(filename).name,
            "authority": "Unreviewed operator plan-set intake",
            "provenance_status": "unknown",
            "citation": str(stored_path),
            "lock": {"kind": "local_file", "status": "checksum_locked", "sha256": digest},
            "supports": [],
            "unavailable_reason": "Content has not been reviewed into the authoritative civil job model.",
        }
        ledger.setdefault("sources", []).append(source)
        ledger["sources"] = sorted(ledger["sources"], key=lambda row: row["id"])
        ledger["disclaimer"] = DISCLAIMER
        _write_json(ledger_path, ledger)
        return {
            "id": source_id,
            "filename": stored_name,
            "path": str(stored_path),
            "sha256": digest,
            "provenance_status": "unknown",
            "supports": [],
        }

    def review_issue(self, slug: str, issue_key: str, *, reviewer: str, note: str) -> dict[str, Any]:
        clean_reviewer = reviewer.strip()
        clean_note = note.strip()
        if not clean_reviewer or not clean_note:
            raise ValueError("Reviewer and recovery note are required")
        detail = self.project_detail(slug)
        issue = next((row for row in detail["issues"] if row["key"] == issue_key), None)
        if issue is None:
            raise ValueError("Issue is not active; rerun validation before recording a review")
        record = {
            "issue_code": issue["code"],
            "issue_path": issue["path"],
            "reviewer": clean_reviewer,
            "note": clean_note,
            "reviewed_at": _now(),
            "status": "reviewed_not_cleared",
        }
        reviews = self._reviews(slug)
        reviews[issue_key] = record
        _write_json(self._review_file(slug), {
            "schema_version": "civil-plan-factory.issue-reviews/v0.1.0",
            "disclaimer": DISCLAIMER,
            "project_slug": slug,
            "reviews": reviews,
        })
        return record

    def _fingerprint(self, slug: str) -> str:
        digest = hashlib.sha256()
        project_dir = self._project_dir(slug)
        for path in sorted(path for path in project_dir.rglob("*") if path.is_file()):
            digest.update(path.relative_to(project_dir).as_posix().encode())
            digest.update(b"\0")
            digest.update(path.read_bytes())
            digest.update(b"\0")
        return digest.hexdigest()

    def list_runs(self, slug: str) -> list[dict[str, Any]]:
        root = self.state_root / "runs" / slug
        if not root.exists():
            return []
        runs = []
        for path in root.glob("*/run.json"):
            try:
                runs.append(_read_json(path))
            except (OSError, ValueError, json.JSONDecodeError):
                continue
        return sorted(
            runs,
            key=lambda run: (run.get("completed_at") or run.get("started_at") or "", run.get("run_id", "")),
            reverse=True,
        )

    def run_project(self, slug: str) -> dict[str, Any]:
        project_file = self._project_file(slug)
        fingerprint = self._fingerprint(slug)
        model, issues = self._validation(slug)
        revision = (model or {}).get("project", {}).get("revision", "draft")
        run_id = f"{_slugify(str(revision))}-{fingerprint[:16]}"
        run_dir = self.state_root / "runs" / slug / run_id
        metadata_path = run_dir / "run.json"
        if metadata_path.exists():
            previous = _read_json(metadata_path)
            if previous.get("project_fingerprint") == fingerprint and previous.get("status") in {"valid", "invalid"}:
                return previous
        run_dir.mkdir(parents=True, exist_ok=True)
        started_at = _now()
        metadata: dict[str, Any] = {
            "schema_version": "civil-plan-factory.studio-run/v0.1.0",
            "disclaimer": DISCLAIMER,
            "run_id": run_id,
            "project_slug": slug,
            "project_fingerprint": fingerprint,
            "started_at": started_at,
            "completed_at": None,
            "stage": "canonical_validation",
            "status": "running",
            "publication_readiness": "blocked",
            "artifacts": {},
        }
        _write_json(metadata_path, metadata)
        if model is None:
            report = {
                "schema_version": "civil-plan-factory.validation-report/v0.2.0",
                "disclaimer": DISCLAIMER,
                "project_id": slug,
                "status": "invalid",
                "issues": issues,
                "limitations": ["Project bundle could not be loaded."],
            }
            _write_json(run_dir / "validation-report.json", report)
            return self._finish_run(metadata_path, metadata, 1)
        metadata["stage"] = "canonical_build"
        _write_json(metadata_path, metadata)
        try:
            return_code = build_project(model, run_dir, self.qgis_app)
        except Exception as error:
            metadata["error"] = f"{type(error).__name__}: {error}"
            return_code = 1
        return self._finish_run(metadata_path, metadata, return_code)

    def _finish_run(self, metadata_path: Path, metadata: dict[str, Any], return_code: int) -> dict[str, Any]:
        run_dir = metadata_path.parent
        validation = _read_json(run_dir / "validation-report.json") if (run_dir / "validation-report.json").exists() else {}
        parity = _read_json(run_dir / "parity-report.json") if (run_dir / "parity-report.json").exists() else {}
        semantic_path = run_dir / "semantic-manifest.json"
        ready = (
            return_code == 0
            and validation.get("status") == "valid"
            and parity.get("status") == "valid"
            and semantic_path.is_file()
        )
        artifacts = {
            path.name: _sha256(path)
            for path in sorted(run_dir.iterdir())
            if path.is_file() and path.name != "run.json"
        }
        metadata.update({
            "completed_at": _now(),
            "stage": "complete" if ready else "blocked",
            "status": "valid" if ready else "invalid",
            "publication_readiness": "ready" if ready else "blocked",
            "return_code": return_code,
            "artifacts": artifacts,
        })
        _write_json(metadata_path, metadata)
        return metadata

    def publish(self, slug: str, run_id: str) -> dict[str, Any]:
        run_path = (self.state_root / "runs" / slug / run_id).resolve()
        expected_root = (self.state_root / "runs" / slug).resolve()
        if run_path.parent != expected_root or not (run_path / "run.json").is_file():
            raise ValueError("Publication requires an existing validated run")
        run = _read_json(run_path / "run.json")
        validation_path = run_path / "validation-report.json"
        parity_path = run_path / "parity-report.json"
        semantic_path = run_path / "semantic-manifest.json"
        if run.get("publication_readiness") != "ready" or not all(
            path.is_file() for path in (validation_path, parity_path, semantic_path)
        ):
            raise ValueError("Publication requires a validated run with passing parity")
        validation = _read_json(validation_path)
        parity = _read_json(parity_path)
        semantic = _read_json(semantic_path)
        if validation.get("status") != "valid" or parity.get("status") != "valid":
            raise ValueError("Publication gate is no longer valid")
        if semantic.get("schema_version") != FIELD_MAP_SCHEMA or semantic.get("disclaimer") != DISCLAIMER:
            raise ValueError("Semantic package does not satisfy the Field Map handoff contract")
        artifact_names = sorted(name for name in run.get("artifacts", {}) if name != "run.json")
        current_hashes = {name: _sha256(run_path / name) for name in artifact_names}
        if current_hashes != run.get("artifacts"):
            raise ValueError("Run artifacts changed after validation; rerun before publishing")
        publication_basis = {
            "project_fingerprint": run["project_fingerprint"],
            "artifacts": current_hashes,
            "contract": FIELD_MAP_SCHEMA,
        }
        publication_id = hashlib.sha256(
            json.dumps(publication_basis, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        publication_dir = self.state_root / "published" / slug / publication_id
        handoff_path = publication_dir / "handoff-manifest.json"
        if not publication_dir.exists():
            staging = publication_dir.with_name(f".{publication_id}.staging")
            if staging.exists():
                shutil.rmtree(staging)
            staging.mkdir(parents=True)
            for name in artifact_names:
                shutil.copy2(run_path / name, staging / name)
            handoff = {
                "schema_version": HANDOFF_SCHEMA,
                "disclaimer": DISCLAIMER,
                "publication_id": publication_id,
                "project_slug": slug,
                "project_id": semantic.get("id"),
                "canonical_model_version": semantic.get("canonical_model_version"),
                "source_run_id": run_id,
                "project_fingerprint": run["project_fingerprint"],
                "published_at": run["completed_at"],
                "consumer": {
                    "application": "Excavation Field Map",
                    "accepted_schema": FIELD_MAP_SCHEMA,
                    "delivery": "local_file_import",
                    "integration_seam": "Choose semantic-manifest.json in the Field Map model-package file input.",
                    "remote_delivery": "not_configured",
                },
                "artifacts": current_hashes,
            }
            _write_json(staging / "handoff-manifest.json", handoff)
            staging.replace(publication_dir)
        else:
            existing = _read_json(handoff_path)
            try:
                published_hashes = {name: _sha256(publication_dir / name) for name in artifact_names}
            except OSError as error:
                raise ValueError("Immutable publication is missing a locked artifact") from error
            if (
                existing.get("publication_id") != publication_id
                or existing.get("artifacts") != current_hashes
                or published_hashes != current_hashes
            ):
                raise ValueError("Immutable publication directory does not match its content address")
        return {
            "publication_id": publication_id,
            "directory": str(publication_dir),
            "import_file": str(publication_dir / "semantic-manifest.json"),
            "handoff_manifest": str(handoff_path),
        }
