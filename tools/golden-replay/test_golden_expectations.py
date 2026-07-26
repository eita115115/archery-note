#!/usr/bin/env python3
"""ゴールデン再生のレビュー済み期待値ゲートを検証する。"""

import json
import tempfile
import unittest
from pathlib import Path

from golden_expectations import (
    GoldenConfigurationError,
    expand_video_arguments,
    prepare_case,
    validate_manifest,
    validate_result,
    validate_runtime_profile,
    verification_outcome,
)


PROFILE = {
    "handedness": "right",
    "delegate": "CPU",
    "playbackRate": 0.25,
}
VIDEO_HASH = "a" * 64


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


if __name__ == "__main__":
    unittest.main()
