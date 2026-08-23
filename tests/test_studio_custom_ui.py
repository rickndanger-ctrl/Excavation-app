import unittest
from pathlib import Path


ASSET_ROOT = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "civil_plan_factory"
    / "studio_web"
)


class ModelStudioCustomUiTests(unittest.TestCase):
    def test_custom_lane_uses_project_authoring_mode_not_a_valid_contract(self):
        javascript = (ASSET_ROOT / "app.js").read_text(encoding="utf-8")

        self.assertIn(
            "function isCustomProject(){return state.active?.authoring_mode==='custom_semantic_design'}",
            javascript,
        )
        self.assertNotIn(
            "state.active?.authoring_contract?.mode==='custom_semantic_design'",
            javascript,
        )

    def test_goal_first_brief_has_a_full_width_legible_layout(self):
        stylesheet = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")

        self.assertIn("#design-brief-card{grid-column:1/-1}", stylesheet)
        self.assertIn(
            "#design-brief-form{display:grid;grid-template-columns:minmax(0,1fr)",
            stylesheet,
        )
        self.assertIn(
            "#design-brief-form .primary{justify-self:start;max-width:100%;white-space:normal}",
            stylesheet,
        )

    def test_operator_workspace_is_a_clear_four_step_product_flow(self):
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")
        javascript = (ASSET_ROOT / "app.js").read_text(encoding="utf-8")
        stylesheet = (ASSET_ROOT / "styles.css").read_text(encoding="utf-8")

        for step_id, label in (
            ("step-job", "Set up the job"),
            ("step-layout", "Build the finished-job 2D model"),
            ("step-layers", "Review the work layers"),
            ("step-publish", "Send it to the field app"),
        ):
            self.assertIn(f'id="{step_id}"', html)
            self.assertIn(label, html)

        self.assertIn('id="next-action-card"', html)
        self.assertIn('id="next-action-button"', html)
        self.assertIn('id="operator-steps"', html)
        self.assertIn("function renderOperatorFlow()", javascript)
        self.assertIn("What happens next", html)
        self.assertIn("Technical details", html)
        self.assertIn(".operator-step", stylesheet)
        self.assertIn(".next-action-card", stylesheet)
        step_job = html[html.index('id="step-job"'):html.index('id="step-layout"')]
        self.assertIn('id="dropzone"', step_job)
        self.assertIn("Add the company’s project plans", step_job)
        self.assertIn("stored and checksum-locked", step_job)

    def test_internal_pipeline_details_are_progressively_disclosed(self):
        html = (ASSET_ROOT / "index.html").read_text(encoding="utf-8")

        self.assertIn('<details class="advanced-panel">', html)
        self.assertIn("Technical details", html)
        self.assertIn("Validation, provenance, receipts, and run logs", html)


if __name__ == "__main__":
    unittest.main()
