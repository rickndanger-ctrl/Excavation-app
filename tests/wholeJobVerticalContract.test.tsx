import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseSemanticJobsiteManifest } from '../src/lib/semanticPackageAdapter';
import type { BlueprintObject, VerticalDesignBasis } from '../src/types/jobsite';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const { ObjectDetailsPanel } = await import('../src/components/ObjectDetailsPanel');

const provenance = {
  status: 'reviewed_assumption',
  source_ids: ['src-hilyard-test-plan'],
  decision_ids: ['decision-whole-job-vertical-coordination'],
};

const manifest = {
  schema_version: 'excavation-field-map.jobsite-package/v0.1.0',
  canonical_model_version: 'hilyard-apartment-test/v1',
  id: 'hilyard-apartment-test',
  projectName: 'Hilyard Apartment Civil Plan Test',
  disclaimer: 'FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION',
  plan: { widthFt: 120, heightFt: 100 },
  layers: [
    { id: 'site', name: 'Finished Site', color: '#64748b', defaultVisible: true },
    { id: 'sanitary', name: 'Sanitary', color: '#16a34a', defaultVisible: true },
    { id: 'water', name: 'Water', color: '#0f766e', defaultVisible: true },
    { id: 'dry-utilities', name: 'Dry Utilities', color: '#f59e0b', defaultVisible: true },
  ],
  phases: [{ id: 'phase-07-finish-site', name: 'Finish Site' }],
  verticalDesignBasis: {
    vertical_datum: 'NAVD88',
    units: 'feet',
    status: 'reviewed_assumption',
    benchmark_status: 'unknown',
    survey_authority: false,
    finished_floor_elevation_ft: 445,
    building_subgrade_elevation_ft: 443.5,
    finished_floor_to_subgrade_depth_ft: 1.5,
    exterior_landing_elevation_ft: 444.98,
    arrival_court_plane: {
      origin_feature_id: 'paving-arrival-court',
      origin_vertex_index: 0,
      origin_elevation_ft: 443.8,
      rise_per_foot_local_x: 0.005,
      rise_per_foot_local_y: 0.01,
      drainage_direction: 'toward_vertex_0_southwest',
    },
    gravity_network_edge_ids: ['san-edge-service-01'],
    pressure_and_dry_utility_vertical_status: 'cover_only_absolute_elevations_unavailable',
    decision_id: 'decision-whole-job-vertical-coordination',
    replacement_note: 'Replace every reviewed elevation with surveyed design control before real use.',
    warning: 'FICTIONAL TEST ELEVATIONS — NOT FOR CONSTRUCTION, STAKING, OR PERMITTING.',
  },
  objects: [
    {
      id: 'entry-south-primary', label: 'South primary entry', layerId: 'site', type: 'building_entry',
      phase: 'phase-07-finish-site', x: 10, y: 10, provenance,
      fieldDetail: {
        threshold_elevation_ft: 445,
        exterior_landing_elevation_ft: 444.98,
        vertical_datum: 'NAVD88',
        vertical_status: 'reviewed_assumption',
        vertical_callout: 'THRESH 445.00 / LANDING 444.98',
      },
    },
    {
      id: 'penetration-sanitary', label: 'Sanitary penetration', layerId: 'sanitary', type: 'sanitary_pipe',
      phase: 'phase-05-sanitary', x: 20, y: 20, provenance,
      fieldDetail: { invert_ft: 439.7, vertical_datum: 'NAVD88', vertical_status: 'reviewed_assumption' },
    },
    {
      id: 'sanitary-public-mh-13262', label: 'Public sanitary manhole', layerId: 'sanitary', type: 'manhole',
      phase: 'phase-05-sanitary', x: 30, y: 30, provenance,
      fieldDetail: {
        rim_elevation_navd88_ft: 443.87,
        outgoing_invert_navd88_ft: 438.87,
        vertical_datum: 'NAVD88',
        vertical_status: 'reference-derived',
      },
    },
  ],
  linearFeatures: [
    {
      id: 'curb-arrival-court-01', label: 'Arrival court curb', layerId: 'site', type: 'curb_line',
      phase: 'phase-07-finish-site', provenance,
      coordinates: [[0, 0], [40, 0], [40, 20], [0, 20]],
      fieldDetail: {
        curb_reveal_ft: 0.5,
        grade_controls: [
          { vertex_index: 0, gutter_elevation_ft: 443.8, top_of_curb_elevation_ft: 444.3 },
          { vertex_index: 1, gutter_elevation_ft: 444.11, top_of_curb_elevation_ft: 444.61 },
          { vertex_index: 2, gutter_elevation_ft: 444.5, top_of_curb_elevation_ft: 445 },
          { vertex_index: 3, gutter_elevation_ft: 444.19, top_of_curb_elevation_ft: 444.69 },
        ],
        vertical_datum: 'NAVD88',
        vertical_status: 'reviewed_assumption',
        vertical_callout: 'TC = GUTTER + 0.50 FT / GUTTER 443.80-444.50',
      },
    },
    {
      id: 'domestic-water-seg-01', label: 'Domestic water service', layerId: 'water', type: 'water_service',
      system: 'domestic_water', phase: 'phase-06-water-fire', provenance,
      coordinates: [[50, 0], [50, 20]], fieldDetail: {},
    },
    {
      id: 'power-route-01', label: 'Power conduit bank', layerId: 'dry-utilities', type: 'electric_conduit_bank',
      system: 'power', phase: 'phase-06-dry-utilities', provenance,
      coordinates: [[60, 0], [60, 20]], fieldDetail: {},
    },
  ],
  areas: [
    {
      id: 'building-apartment-1', label: 'Apartment building', layerId: 'site', type: 'building',
      phase: 'phase-07-finish-site', provenance,
      coordinates: [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]],
      fieldDetail: {
        finished_floor_elevation_ft: 445,
        building_subgrade_elevation_ft: 443.5,
        non_entry_perimeter_grade_range_ft: [444.45, 444.6],
        vertical_datum: 'NAVD88',
        vertical_status: 'reviewed_assumption',
        vertical_callout: 'FFE 445.00 / PAD SG 443.50',
      },
    },
    {
      id: 'pad-apartment-1', label: 'Apartment building pad', layerId: 'site', type: 'building_pad',
      phase: 'phase-07-finish-site', provenance,
      coordinates: [[0, 0], [22, 0], [22, 22], [0, 22], [0, 0]],
      fieldDetail: {
        subgrade_elevation_ft: 443.5,
        vertical_datum: 'NAVD88',
        vertical_status: 'reviewed_assumption',
        vertical_callout: 'PAD SG 443.50',
      },
    },
    {
      id: 'sidewalk-south-entry', label: 'South entry sidewalk', layerId: 'site', type: 'sidewalk',
      phase: 'phase-07-finish-site', provenance,
      coordinates: [[20, 0], [40, 0], [40, 10], [20, 10], [20, 0]],
      fieldDetail: {
        vertical_profile: {
          high_elevation_ft: 444.98,
          low_elevation_ft: 444.82,
          run_ft: 10.5,
          slope_percent: 1.52381,
          high_location: 'building landing',
          low_location: 'south outer edge',
        },
        vertical_datum: 'NAVD88',
        vertical_status: 'reviewed_assumption',
        vertical_callout: 'FG 444.82-444.98 / SLOPE 1.52%',
      },
    },
  ],
  surfaces: [],
  utilities: [
    {
      id: 'dom-edge-tie-meter', geometryFeatureId: 'domestic-water-seg-01',
      fromNodeId: 'dom-node-tie', toNodeId: 'dom-node-meter', system: 'domestic_water',
      fieldDetail: {
        surface_samples_ft: [443.98, 444.1],
        centerline_elevation_samples_ft: [440.396667, 440.516667],
        cover_reference: 'finished_surface_to_pipe_crown',
        vertical_datum: 'NAVD88', vertical_status: 'reviewed_assumption',
      },
    },
    {
      id: 'power-edge-poc-vault', geometryFeatureId: 'power-route-01',
      fromNodeId: 'power-node-poc', toNodeId: 'power-node-vault', system: 'power',
      fieldDetail: {
        surface_samples_ft: [444.05, 444.3],
        utility_top_elevation_samples_ft: [441.05, 441.3],
        cover_reference: 'finished_surface_to_top_of_utility',
        vertical_datum: 'NAVD88', vertical_status: 'reviewed_assumption',
      },
    },
  ],
  unavailable: [],
};

function parsed() {
  return parseSemanticJobsiteManifest(structuredClone(manifest));
}

test('imports and validates the whole-job vertical design basis', () => {
  const jobsite = parsed();

  assert.deepEqual(jobsite.verticalDesignBasis, {
    verticalDatum: 'NAVD88',
    units: 'feet',
    status: 'reviewed_assumption',
    benchmarkStatus: 'unknown',
    surveyAuthority: false,
    finishedFloorElevationFt: 445,
    buildingSubgradeElevationFt: 443.5,
    finishedFloorToSubgradeDepthFt: 1.5,
    exteriorLandingElevationFt: 444.98,
    arrivalCourtPlane: {
      originFeatureId: 'paving-arrival-court',
      originVertexIndex: 0,
      originElevationFt: 443.8,
      risePerFootLocalX: 0.005,
      risePerFootLocalY: 0.01,
      drainageDirection: 'toward_vertex_0_southwest',
    },
    gravityNetworkEdgeIds: ['san-edge-service-01'],
    pressureAndDryUtilityVerticalStatus: 'cover_only_absolute_elevations_unavailable',
    decisionId: 'decision-whole-job-vertical-coordination',
    replacementNote: 'Replace every reviewed elevation with surveyed design control before real use.',
    warning: 'FICTIONAL TEST ELEVATIONS — NOT FOR CONSTRUCTION, STAKING, OR PERMITTING.',
  });
});

test('fails closed when a declared whole-job vertical basis is unsafe or internally inconsistent', () => {
  const wrongDatum = structuredClone(manifest);
  wrongDatum.verticalDesignBasis.vertical_datum = 'LOCAL';
  assert.throws(() => parseSemanticJobsiteManifest(wrongDatum), /verticalDesignBasis.*NAVD88/i);

  const falseAuthority = structuredClone(manifest);
  falseAuthority.verticalDesignBasis.survey_authority = true;
  assert.throws(() => parseSemanticJobsiteManifest(falseAuthority), /survey_authority.*false/i);

  const badDepth = structuredClone(manifest);
  badDepth.verticalDesignBasis.finished_floor_to_subgrade_depth_ft = 2;
  assert.throws(() => parseSemanticJobsiteManifest(badDepth), /floor.*subgrade.*depth/i);
});

test('maps every vertical feature control into typed EveSite field values without dropping raw field detail', () => {
  const jobsite = parsed();
  const feature = (id: string) => {
    const found = jobsite.objects.find((object) => object.id === id);
    assert.ok(found, `expected ${id}`);
    return found;
  };

  const building = feature('building-apartment-1');
  assert.equal(building.finishedFloorElevation, '445');
  assert.equal(building.subgradeElev, '443.5');
  assert.equal(building.verticalDatum, 'NAVD88');
  assert.equal(building.verticalStatus, 'reviewed_assumption');
  assert.equal(building.verticalCallout, 'FFE 445.00 / PAD SG 443.50');
  assert.equal(building.fieldDetail?.finished_floor_elevation_ft, 445);

  const pad = feature('pad-apartment-1');
  assert.equal(pad.subgradeElev, '443.5');

  const walk = feature('sidewalk-south-entry');
  assert.equal(walk.finishedGrade, '444.82-444.98');
  assert.deepEqual(walk.verticalProfile, {
    highElevation: '444.98',
    lowElevation: '444.82',
    run: '10.5',
    slopePercent: '1.52381',
    highLocation: 'building landing',
    lowLocation: 'south outer edge',
  });
  assert.equal(walk.verticalCallout, 'FG 444.82-444.98 / SLOPE 1.52%');

  const entry = feature('entry-south-primary');
  assert.equal(entry.thresholdElevation, '445');
  assert.equal(entry.landingElevation, '444.98');

  const curb = feature('curb-arrival-court-01');
  assert.equal(curb.topElevation, '444.30-445.00');
  assert.equal(curb.gutterElevation, '443.80-444.50');
  assert.equal(curb.curbReveal, '0.5 ft');

  assert.equal(feature('penetration-sanitary').invertElevation, '439.7');
  assert.equal(feature('sanitary-public-mh-13262').rimElevation, '443.87');
  assert.equal(feature('sanitary-public-mh-13262').invertOut, '438.87');

  const water = feature('domestic-water-seg-01');
  assert.equal(water.finishedSurfaceElevation, '443.98-444.10');
  assert.equal(water.pipeCenterlineElevation, '440.40-440.52');
  assert.equal(water.utilityTopElevation, undefined);
  assert.equal(water.coverBasis, 'Finished surface to pipe crown');
  assert.deepEqual(water.fieldDetail?.surface_samples_ft, [443.98, 444.1]);

  const power = feature('power-route-01');
  assert.equal(power.finishedSurfaceElevation, '444.05-444.30');
  assert.equal(power.pipeCenterlineElevation, undefined);
  assert.equal(power.utilityTopElevation, '441.05-441.30');
  assert.equal(power.coverBasis, 'Finished surface to top of utility');
});

const gps = {
  lat: null, lng: null, accuracyM: null, heading: null,
  available: false, active: false, error: null,
};

function renderDetails(object: BlueprintObject, verticalDesignBasis: VerticalDesignBasis): string {
  return renderToStaticMarkup(
    <ObjectDetailsPanel
      object={object}
      verticalDesignBasis={verticalDesignBasis}
      distanceFt={null}
      status="not_started"
      onSetStatus={() => undefined}
      calibrationPoints={[]}
      gps={gps}
      onAddCalibrationPoint={() => undefined}
      onClearCalibration={() => undefined}
    />,
  );
}

test('shows the coordinated basis, callouts, profile, and field elevations clearly in the phone detail panel', () => {
  const jobsite = parsed();
  assert.ok(jobsite.verticalDesignBasis);
  const feature = (id: string) => jobsite.objects.find((object) => object.id === id)!;

  const building = renderDetails(feature('building-apartment-1'), jobsite.verticalDesignBasis);
  assert.match(building, /Whole-job vertical basis/);
  assert.match(building, /NAVD88/);
  assert.match(building, /Benchmark unknown/);
  assert.match(building, /Finished Floor/);
  assert.match(building, /445 ft/);
  assert.match(building, /Subgrade/);
  assert.match(building, /443\.5 ft/);
  assert.match(building, /Vertical Callout/);
  assert.match(building, /FFE 445\.00 \/ PAD SG 443\.50/);
  assert.ok(
    building.indexOf('Vertical Callout') < building.indexOf('Whole-job vertical basis'),
    'the selected feature callout must appear before the shared whole-job basis on a phone',
  );

  const walk = renderDetails(feature('sidewalk-south-entry'), jobsite.verticalDesignBasis);
  assert.match(walk, /Finished Grade/);
  assert.match(walk, /444\.82-444\.98 ft/);
  assert.match(walk, /Profile High/);
  assert.match(walk, /Profile Low/);
  assert.match(walk, /Profile Run/);
  assert.match(walk, /Profile Slope/);
  assert.match(walk, /1\.52381%/);

  const entry = renderDetails(feature('entry-south-primary'), jobsite.verticalDesignBasis);
  assert.match(entry, /Threshold/);
  assert.match(entry, /Exterior Landing/);

  const curb = renderDetails(feature('curb-arrival-court-01'), jobsite.verticalDesignBasis);
  assert.match(curb, /Top of Curb/);
  assert.match(curb, /Gutter/);
  assert.match(curb, /Curb Reveal/);

  const penetration = renderDetails(feature('penetration-sanitary'), jobsite.verticalDesignBasis);
  assert.match(penetration, /Invert/);
  assert.match(penetration, /439\.7 ft/);

  const manhole = renderDetails(feature('sanitary-public-mh-13262'), jobsite.verticalDesignBasis);
  assert.match(manhole, /Rim \/ Grate/);
  assert.match(manhole, /443\.87 ft/);

  const water = renderDetails(feature('domestic-water-seg-01'), jobsite.verticalDesignBasis);
  assert.match(water, /Finished Surface/);
  assert.match(water, /443\.98-444\.10 ft/);
  assert.match(water, /Pipe Centerline/);
  assert.match(water, /440\.40-440\.52 ft/);
  assert.match(water, /Cover Basis/);
  assert.match(water, /Finished surface to pipe crown/);
  assert.ok(
    water.indexOf('Finished Surface') < water.indexOf('Whole-job vertical basis'),
    'selected utility elevations must appear before the shared whole-job basis on a phone',
  );

  const power = renderDetails(feature('power-route-01'), jobsite.verticalDesignBasis);
  assert.match(power, /Finished Surface/);
  assert.match(power, /444\.05-444\.30 ft/);
  assert.match(power, /Utility Top/);
  assert.match(power, /441\.05-441\.30 ft/);
  assert.match(power, /Finished surface to top of utility/);
});
