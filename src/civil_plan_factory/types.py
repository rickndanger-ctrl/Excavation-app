"""Versioned Python type contract for the canonical civil job model."""

from typing import Literal, NotRequired, TypedDict

ProvenanceStatus = Literal[
    "confirmed", "reference-derived", "reviewed_assumption", "generated", "unknown"
]


class Provenance(TypedDict):
    status: ProvenanceStatus
    source_ids: list[str]
    decision_ids: NotRequired[list[str]]
    unavailable_reason: NotRequired[str]


class SourceLock(TypedDict):
    kind: Literal["url", "local_file", "legal_citation"]
    status: Literal["checksum_locked", "citation_only"]
    sha256: str | None


class SourceRecord(TypedDict):
    id: str
    title: str
    authority: str
    provenance_status: ProvenanceStatus
    citation: str
    citation_scope: NotRequired[Literal["project_bundle"]]
    lock: SourceLock
    supports: list[str]


class DecisionRecord(TypedDict):
    id: str
    subject: str
    status: ProvenanceStatus
    value: object | None
    rationale: str
    source_ids: list[str]


class SpatialReference(TypedDict):
    horizontal_crs: str
    horizontal_units: str
    vertical_datum: str
    vertical_units: str
    benchmark: dict
    transformations: list[dict]
    tolerances: dict


class FeatureBase(TypedDict):
    id: str
    feature_type: str
    layer_id: str
    phase_id: str
    label: str
    provenance: Provenance
    field_detail: NotRequired[dict]


class PointFeature(FeatureBase):
    coordinates: list[float]


class LineFeature(FeatureBase):
    coordinates: list[list[float]]


class PolygonFeature(FeatureBase):
    coordinates: list[list[float]]


class ControlPoint(PointFeature):
    control_class: str
    gps_coordinate: NotRequired[dict[str, float]]


class SurfaceFeature(FeatureBase):
    id: str
    boundary: list[list[float]]
    vertical_datum: str


class NetworkNode(TypedDict):
    id: str
    node_type: str
    geometry_feature_id: str | None
    provenance: Provenance
    field_detail: NotRequired[dict]


class NetworkEdge(TypedDict):
    id: str
    edge_type: str
    from_node_id: str
    to_node_id: str
    geometry_feature_id: str | None
    provenance: Provenance
    field_detail: NotRequired[dict]


class UtilityNetwork(TypedDict):
    id: str
    system: str
    network_kind: Literal["gravity", "pressure", "dry", "drainage"]
    nodes: list[NetworkNode]
    edges: list[NetworkEdge]


class DerivedDeliverables(TypedDict):
    plans: list[dict]
    profiles: list[dict]
    sections: list[dict]
    schedules: list[dict]
    detail_cards: list[dict]


class PlanDefinition(TypedDict):
    id: str
    title: str
    asset_ids: list[str]
    scale: str


class ProfileDefinition(TypedDict):
    id: str
    title: str
    alignment_edge_ids: list[str]
    vertical_datum: str
    segments: list[dict]
    surface_samples: list[dict]
    provenance: Provenance


class SectionDefinition(TypedDict):
    id: str
    cut_line_id: str
    asset_ids: list[str]


class ScheduleDefinition(TypedDict):
    id: str
    schedule_type: str
    asset_ids: list[str]


class SemanticManifest(TypedDict):
    schema_version: str
    canonical_model_version: str
    id: str
    projectName: str
    disclaimer: str
    plan: dict
    phases: list[dict]
    layers: list[dict]
    objects: list[dict]
    utilities: list[dict]
    calibrationPoints: list[dict]
    unavailable: list[dict]
    provenance: dict


class CanonicalModel(TypedDict):
    schema_version: str
    project: dict
    spatial_reference: SpatialReference
    sources: list[SourceRecord]
    decisions: list[DecisionRecord]
    phases: list[dict]
    layers: list[dict]
    features: dict
    networks: list[UtilityNetwork]
    deliverables: DerivedDeliverables
    contract_coverage: list[dict]
