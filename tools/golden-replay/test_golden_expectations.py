#!/usr/bin/env python3
"""ゴールデン再生のレビュー済み期待値ゲートを検証する。"""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from golden_expectations import (
    DERIVED_CAPTURE_CASES,
    MAX_DERIVED_FIXTURE_BYTES,
    GoldenConfigurationError,
    GoldenRuntimeError,
    capture_case_for_expectation,
    expand_video_arguments,
    prepare_case,
    replay_candidate_with_node,
    require_derived_capture_mode,
    validate_browser_node_parity,
    validate_manifest,
    validate_result,
    validate_runtime_profile,
    verification_outcome,
    write_immutable_candidate,
)


PROFILE = {
    "handedness": "right",
    "delegate": "CPU",
    "playbackRate": 0.25,
}
VIDEO_HASH = "a" * 64
FIXTURE_COLUMNS = [
    "tMs",
    "anchorNorm",
    "drawArm",
    "bodyScale",
    "conf",
    "dWx",
    "dWy",
    "dWVisibility",
]


def manifest():
    return {
        "schemaVersion": 1,
        "profile": dict(PROFILE),
        "cases": [
            {
                "video": "positive.mp4",
                "sha256": VIDEO_HASH,
                "expectedStatus": "ok",
                "expectedDetectedShots": 1,
                "retainedReleaseWindowsMs": [[4300, 4600]],
            }
        ],
    }


def result(
    *,
    status="ok",
    detected_shots=1,
    fires=None,
    canceled=None,
    include_diag=True,
):
    value = {
        "status": status,
        "detectedShots": detected_shots,
        "formAnalysis": {},
    }
    if include_diag:
        value["formAnalysis"]["formPhaseDiag"] = {
            "releaseFires": fires
            if fires is not None
            else [{"shotId": "kept", "ts": 4400}],
            "canceledEvents": canceled if canceled is not None else [],
        }
    return value


def fixture_payload():
    return (
        json.dumps(
            {
                "schemaVersion": 1,
                "caseId": "scene-cut-arrow-retrieval",
                "videoSha256": (
                    "1d80f5688fff8a1e90ad2cada188ce51f3a491978fe6bd1ed678f776135c243e"
                ),
                "coreSha256": "a" * 64,
                "appBaseCommit": "b" * 40,
                "poseModelSha256": "c" * 64,
                "visionBundleSha256": "d" * 64,
                "visionWasmJsSha256": "e" * 64,
                "visionWasmSha256": "f" * 64,
                "playwrightVersion": "1.61.1",
                "chromiumVersion": "140.0.7339.16",
                "runtimeProfile": dict(PROFILE),
                "eosMs": 10,
                "columns": FIXTURE_COLUMNS,
                "frames": [[0, None, None, None, None, None, None, None]],
            },
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


class GoldenExpectationTests(unittest.TestCase):
    def case(self):
        return prepare_case(
            validate_manifest(manifest()),
            video_name="positive.mp4",
            video_sha256=VIDEO_HASH,
            runtime_profile=PROFILE,
        )

    def test_reviewed_result_passes(self):
        self.assertEqual(validate_result(self.case(), result()), [])

    def test_detected_count_mismatch_fails(self):
        errors = validate_result(
            self.case(),
            result(
                status="ok-no-shots",
                detected_shots=0,
                fires=[],
            ),
        )
        self.assertTrue(any("detectedShots" in error for error in errors), errors)

    def test_runtime_status_failure_fails(self):
        errors = validate_result(
            self.case(),
            result(
                status="timeout",
                detected_shots=0,
                fires=[],
            ),
        )
        self.assertTrue(any("runtime status" in error for error in errors), errors)

    def test_default_mismatch_maps_to_fail_and_exit_one(self):
        outcome = verification_outcome(
            case=self.case(),
            result=result(
                status="ok-no-shots",
                detected_shots=0,
                fires=[],
            ),
            record_only=False,
        )
        self.assertEqual(outcome.verification, "FAIL")
        self.assertEqual(outcome.exit_code, 1)
        self.assertTrue(
            any("detectedShots" in error for error in outcome.errors),
            outcome.errors,
        )

    def test_record_only_skips_semantics_but_runtime_failure_exits_one(self):
        skipped = verification_outcome(
            case=None,
            result=result(fires=[{"shotId": "wrong-event", "ts": 2500}]),
            record_only=True,
        )
        self.assertEqual(skipped.verification, "SKIPPED")
        self.assertEqual(skipped.exit_code, 0)
        self.assertEqual(skipped.errors, ())

        failed_runtime = verification_outcome(
            case=None,
            result=result(status="timeout", detected_shots=0, fires=[]),
            record_only=True,
        )
        self.assertEqual(failed_runtime.verification, "SKIPPED")
        self.assertEqual(failed_runtime.exit_code, 1)
        self.assertTrue(
            any("runtime status" in error for error in failed_runtime.errors),
            failed_runtime.errors,
        )

    def test_equal_count_but_release_outside_reviewed_window_fails(self):
        errors = validate_result(
            self.case(),
            result(fires=[{"shotId": "kept", "ts": 2500}]),
        )
        self.assertTrue(any("reviewed window" in error for error in errors), errors)

    def test_canceled_fire_is_removed_before_internal_count_check(self):
        value = result(
            fires=[
                {"shotId": "canceled", "ts": 1200},
                {"shotId": "kept", "ts": 4400},
            ],
            canceled=[{"shotId": "canceled", "ts": 1600}],
        )
        self.assertEqual(validate_result(self.case(), value), [])

    def test_internal_retained_count_must_equal_detected_shots(self):
        errors = validate_result(
            self.case(),
            result(
                fires=[
                    {"shotId": "kept", "ts": 4400},
                    {"shotId": "extra", "ts": 4500},
                ]
            ),
        )
        self.assertTrue(
            any("internal retained release count" in error for error in errors),
            errors,
        )

    def test_negative_release_timestamp_fails_closed(self):
        errors = validate_result(
            self.case(),
            result(fires=[{"shotId": "kept", "ts": -1}]),
        )
        self.assertTrue(any("non-negative" in error for error in errors), errors)

    def test_cancellation_must_refer_to_a_release_fire(self):
        errors = validate_result(
            self.case(),
            result(canceled=[{"shotId": "unknown", "ts": 4500}]),
        )
        self.assertTrue(
            any("does not refer to a release fire" in error for error in errors),
            errors,
        )

    def test_missing_diagnostics_for_positive_result_fails(self):
        errors = validate_result(self.case(), result(include_diag=False))
        self.assertTrue(any("formPhaseDiag" in error for error in errors), errors)

    def test_manifest_schema_error_is_configuration_error(self):
        value = manifest()
        value["schemaVersion"] = 2
        with self.assertRaises(GoldenConfigurationError):
            validate_manifest(value)

    def test_malformed_case_is_configuration_error(self):
        value = manifest()
        del value["cases"][0]["sha256"]
        with self.assertRaises(GoldenConfigurationError):
            validate_manifest(value)

    def test_missing_case_is_configuration_error(self):
        with self.assertRaises(GoldenConfigurationError):
            prepare_case(
                validate_manifest(manifest()),
                video_name="unknown.mp4",
                video_sha256=VIDEO_HASH,
                runtime_profile=PROFILE,
            )

    def test_profile_mismatch_is_configuration_error(self):
        profile = dict(PROFILE)
        profile["delegate"] = "GPU"
        with self.assertRaises(GoldenConfigurationError):
            prepare_case(
                validate_manifest(manifest()),
                video_name="positive.mp4",
                video_sha256=VIDEO_HASH,
                runtime_profile=profile,
            )

    def test_runtime_profile_rejects_non_positive_or_nan_playback_rate(self):
        for playback_rate in (0, -0.25, float("nan")):
            with self.subTest(playback_rate=playback_rate):
                profile = dict(PROFILE)
                profile["playbackRate"] = playback_rate
                with self.assertRaises(GoldenConfigurationError):
                    validate_runtime_profile(profile)

    def test_hash_mismatch_is_configuration_error(self):
        with self.assertRaises(GoldenConfigurationError):
            prepare_case(
                validate_manifest(manifest()),
                video_name="positive.mp4",
                video_sha256="b" * 64,
                runtime_profile=PROFILE,
            )

    def test_repository_manifest_contains_the_five_reviewed_cases(self):
        manifest_path = Path(__file__).with_name("expectations.json")
        loaded = validate_manifest(
            json.loads(manifest_path.read_text(encoding="utf-8"))
        )
        self.assertEqual(loaded["schemaVersion"], 1)
        self.assertEqual(loaded["profile"], PROFILE)
        self.assertEqual(
            {
                case["video"]: (
                    case["sha256"],
                    case["expectedStatus"],
                    case["expectedDetectedShots"],
                    case["retainedReleaseWindowsMs"],
                )
                for case in loaded["cases"]
            },
            {
                "pixabay-43254-archery-woman.mp4": (
                    "d2beecfa6cf924354212dd23e79a7540a2ee8c7fbf1c60cade342f6116843bfc",
                    "ok",
                    1,
                    [[4300, 4600]],
                ),
                "pixabay-40769-archer.mp4": (
                    "1d80f5688fff8a1e90ad2cada188ce51f3a491978fe6bd1ed678f776135c243e",
                    "ok-no-shots",
                    0,
                    [],
                ),
                "mixkit-34710-female-archer.mp4": (
                    "39ae04e9e07bc67d4ae7d1c1aadd10f2b60cad9eca46445a77522b9bea58f9e5",
                    "ok-no-shots",
                    0,
                    [],
                ),
                "mixkit-48725-closeup-firing.mp4": (
                    "b2f87dd0a9f2e8923d7586a154642013782d7488c282b1a7f10069d179cef9fc",
                    "ok-no-shots",
                    0,
                    [],
                ),
                "pixabay-150869-arrows-target.mp4": (
                    "54e26bb6472f4a5afcb9df4cda8bff2ccca0b700f3b6f2e8866c194e7272b12a",
                    "ok-no-shots",
                    0,
                    [],
                ),
            },
        )

    def test_literal_glob_expands_deterministically(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            second = root / "b.mp4"
            first = root / "a.mp4"
            second.write_bytes(b"b")
            first.write_bytes(b"a")

            self.assertEqual(
                expand_video_arguments([str(root / "*.mp4")]),
                [str(first), str(second)],
            )

    def test_unmatched_glob_is_preserved_for_missing_file_error(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            pattern = str(Path(temp_dir) / "*.missing")
            self.assertEqual(expand_video_arguments([pattern]), [pattern])

    def test_fetch_selection_excludes_restricted_personal_sources_by_default(self):
        fetch_path = Path(__file__).with_name("fetch-videos.py")
        spec = importlib.util.spec_from_file_location(
            "archery_note_fetch_videos",
            fetch_path,
        )
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        public_names = set(module.PUBLIC_VIDEOS)
        restricted_names = set(module.RESTRICTED_PERSONAL_VIDEOS)
        self.assertEqual(
            public_names,
            {
                "pixabay-43254-archery-woman.mp4",
                "pixabay-40769-archer.mp4",
                "pixabay-150869-arrows-target.mp4",
            },
        )
        self.assertEqual(
            restricted_names,
            {
                "mixkit-34710-female-archer.mp4",
                "mixkit-48725-closeup-firing.mp4",
            },
        )
        self.assertEqual(set(module.select_videos(False)), public_names)
        self.assertEqual(
            set(module.select_videos(True)),
            public_names | restricted_names,
        )

    def test_derived_capture_requires_record_only(self):
        with self.assertRaises(GoldenConfigurationError):
            require_derived_capture_mode(
                capture_derived_fixtures=True,
                record_only=False,
            )
        require_derived_capture_mode(
            capture_derived_fixtures=True,
            record_only=True,
        )
        require_derived_capture_mode(
            capture_derived_fixtures=False,
            record_only=False,
        )

    def test_derived_capture_allowlist_uses_semantic_case_ids_and_source_sha(self):
        self.assertEqual(
            set(DERIVED_CAPTURE_CASES),
            {
                "oblique-single-release",
                "scene-cut-arrow-retrieval",
            },
        )
        case = capture_case_for_expectation(
            {
                "video": "renamed-public-source.mp4",
                "sha256": (
                    "d2beecfa6cf924354212dd23e79a7540a2ee8c7fbf1c60cade342f6116843bfc"
                ),
            }
        )
        self.assertEqual(case, "oblique-single-release")
        with self.assertRaises(GoldenConfigurationError):
            capture_case_for_expectation(
                {
                    "video": "mixkit-34710-female-archer.mp4",
                    "sha256": (
                        "39ae04e9e07bc67d4ae7d1c1aadd10f2b60cad9eca46445a77522b9bea58f9e5"
                    ),
                }
            )

    def test_derived_fixture_size_limit_is_256_kib(self):
        self.assertEqual(MAX_DERIVED_FIXTURE_BYTES, 262_144)
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(GoldenConfigurationError):
                write_immutable_candidate(
                    Path(temp_dir),
                    "oblique-single-release",
                    b"x" * (MAX_DERIVED_FIXTURE_BYTES + 1),
                )

    def test_python_to_node_bridge_replays_a_valid_fixture(self):
        replay = replay_candidate_with_node(
            Path(__file__).resolve().parent,
            fixture_payload(),
        )
        self.assertEqual(replay["caseId"], "scene-cut-arrow-retrieval")
        self.assertEqual(replay["retainedCount"], 0)

    def test_python_to_node_bridge_maps_child_one_to_runtime_and_two_to_config(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            script = root / "replay-form-fixtures.js"

            script.write_text(
                'process.stderr.write("RUNTIME ERROR: core failed\\n");'
                "process.exitCode=1;\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(GoldenRuntimeError, "core failed"):
                replay_candidate_with_node(root, b"{}\n")

            script.write_text(
                'process.stderr.write("CONFIG ERROR: bad fixture\\n");'
                "process.exitCode=2;\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(GoldenConfigurationError, "bad fixture"):
                replay_candidate_with_node(root, b"{}\n")

            script.write_text(
                'process.stdout.write("not-json\\n");\n',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(GoldenRuntimeError, "invalid JSON"):
                replay_candidate_with_node(root, b"{}\n")

    def test_browser_node_parity_includes_actual_visible_shot_count(self):
        replay = {
            "events": [{"type": "release", "tMs": 10, "label": "close"}],
            "retainedReleases": [{"tMs": 10, "label": "close"}],
            "retainedCount": 1,
            "finalPhase": "FOLLOW",
            "pendingAtEnd": False,
        }
        validate_browser_node_parity(replay, dict(replay), visible_shot_count=1)

        changed = dict(replay)
        changed["pendingAtEnd"] = True
        with self.assertRaisesRegex(GoldenRuntimeError, "parity mismatch"):
            validate_browser_node_parity(
                replay,
                changed,
                visible_shot_count=1,
            )

        with self.assertRaisesRegex(GoldenRuntimeError, "visible shot count"):
            validate_browser_node_parity(
                replay,
                dict(replay),
                visible_shot_count=0,
            )

    def test_candidate_write_is_content_addressed_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            payload = b'{"schemaVersion":1}\n'
            first = write_immutable_candidate(
                root,
                "oblique-single-release",
                payload,
            )
            self.assertTrue(first.is_file())
            self.assertEqual(first.read_bytes(), payload)
            self.assertRegex(
                first.name,
                r"^oblique-single-release-[0-9a-f]{64}\.json$",
            )
            self.assertEqual(
                write_immutable_candidate(
                    root,
                    "oblique-single-release",
                    payload,
                ),
                first,
            )

            first.write_bytes(b"different")
            with self.assertRaises(GoldenConfigurationError):
                write_immutable_candidate(
                    root,
                    "oblique-single-release",
                    payload,
                )


if __name__ == "__main__":
    unittest.main()
