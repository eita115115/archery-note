#!/usr/bin/env python3
"""ゴールデン再生のレビュー済み期待値検証と CLI 補助。"""

import math
import re
from dataclasses import dataclass
from glob import glob, has_magic


SCHEMA_VERSION = 1
SUCCESS_STATUSES = {"ok", "ok-no-shots"}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class GoldenConfigurationError(ValueError):
    """期待値 manifest または実行前条件が不正。"""


@dataclass(frozen=True)
class VerificationOutcome:
    """runner がそのまま終了判定へ使う検証結果。"""

    verification: str
    exit_code: int
    errors: tuple


def _require(condition, message):
    if not condition:
        raise GoldenConfigurationError(message)


def _is_number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _validate_profile(profile, label):
    _require(isinstance(profile, dict), f"{label} must be an object")
    _require(
        profile.get("handedness") in {"right", "left"},
        f"{label}.handedness must be right or left",
    )
    _require(
        profile.get("delegate") in {"CPU", "GPU"},
        f"{label}.delegate must be CPU or GPU",
    )
    playback_rate = profile.get("playbackRate")
    _require(
        _is_number(playback_rate) and playback_rate > 0,
        f"{label}.playbackRate must be a positive number",
    )


def validate_runtime_profile(profile):
    """record-only を含む実行 profile の構造を検証する。"""

    _validate_profile(profile, "runtimeProfile")
    return profile


def expand_video_arguments(arguments):
    """shell が展開しない glob を引数単位で安定順に展開する。"""

    expanded = []
    for argument in arguments:
        matches = glob(argument) if has_magic(argument) else []
        if matches:
            expanded.extend(
                sorted(matches, key=lambda path: (path.casefold(), path))
            )
        else:
            # 未一致を残し、runner 既存の「動画が見つかりません」へ渡す。
            expanded.append(argument)
    return expanded


def validate_manifest(manifest):
    """manifest の構造を検証してそのまま返す。"""

    _require(isinstance(manifest, dict), "manifest must be an object")
    _require(
        isinstance(manifest.get("schemaVersion"), int)
        and not isinstance(manifest.get("schemaVersion"), bool)
        and manifest.get("schemaVersion") == SCHEMA_VERSION,
        f"schemaVersion must be {SCHEMA_VERSION}",
    )
    _validate_profile(manifest.get("profile"), "profile")

    cases = manifest.get("cases")
    _require(isinstance(cases, list) and cases, "cases must be a non-empty array")
    seen_videos = set()
    for index, case in enumerate(cases):
        label = f"cases[{index}]"
        _require(isinstance(case, dict), f"{label} must be an object")

        video = case.get("video")
        _require(
            isinstance(video, str)
            and video
            and "/" not in video
            and "\\" not in video,
            f"{label}.video must be a basename",
        )
        _require(video not in seen_videos, f"duplicate video case: {video}")
        seen_videos.add(video)

        video_hash = case.get("sha256")
        _require(
            isinstance(video_hash, str) and SHA256_RE.fullmatch(video_hash),
            f"{label}.sha256 must be a lowercase SHA-256",
        )

        expected_status = case.get("expectedStatus")
        _require(
            expected_status in SUCCESS_STATUSES,
            f"{label}.expectedStatus must be ok or ok-no-shots",
        )
        expected_shots = case.get("expectedDetectedShots")
        _require(
            isinstance(expected_shots, int)
            and not isinstance(expected_shots, bool)
            and expected_shots >= 0,
            f"{label}.expectedDetectedShots must be a non-negative integer",
        )
        if expected_shots == 0:
            _require(
                expected_status == "ok-no-shots",
                f"{label}: zero shots require expectedStatus=ok-no-shots",
            )
        else:
            _require(
                expected_status == "ok",
                f"{label}: positive shots require expectedStatus=ok",
            )

        windows = case.get("retainedReleaseWindowsMs")
        _require(
            isinstance(windows, list) and len(windows) == expected_shots,
            f"{label}.retainedReleaseWindowsMs must contain one window per shot",
        )
        for window_index, window in enumerate(windows):
            window_label = f"{label}.retainedReleaseWindowsMs[{window_index}]"
            _require(
                isinstance(window, list) and len(window) == 2,
                f"{window_label} must be [startMs, endMs]",
            )
            start, end = window
            _require(
                _is_number(start) and _is_number(end) and 0 <= start <= end,
                f"{window_label} must be a finite non-negative ordered window",
            )

    return manifest


def prepare_case(
    manifest,
    *,
    video_name,
    video_sha256,
    runtime_profile,
):
    """実行 profile・動画名・ハッシュを manifest と照合する。"""

    validate_manifest(manifest)
    _validate_profile(runtime_profile, "runtimeProfile")

    expected_profile = manifest["profile"]
    for key in ("handedness", "delegate", "playbackRate"):
        if runtime_profile[key] != expected_profile[key]:
            raise GoldenConfigurationError(
                f"profile mismatch for {key}: "
                f"expected {expected_profile[key]!r}, got {runtime_profile[key]!r}"
            )

    case = next(
        (item for item in manifest["cases"] if item["video"] == video_name),
        None,
    )
    if case is None:
        raise GoldenConfigurationError(
            f"no reviewed expectation for video: {video_name}"
        )
    if video_sha256 != case["sha256"]:
        raise GoldenConfigurationError(
            f"SHA-256 mismatch for {video_name}: "
            f"expected {case['sha256']}, got {video_sha256}"
        )
    return case


def validate_result(case, result):
    """1件の実行結果を期待値と照合し、semantic error の一覧を返す。"""

    errors = []
    if not isinstance(result, dict):
        return ["result must be an object"]

    status = result.get("status")
    if status not in SUCCESS_STATUSES:
        return [f"runtime status is not successful: {status!r}"]
    if status != case["expectedStatus"]:
        errors.append(
            f"status mismatch: expected {case['expectedStatus']!r}, got {status!r}"
        )

    detected_shots = result.get("detectedShots")
    if (
        not isinstance(detected_shots, int)
        or isinstance(detected_shots, bool)
        or detected_shots < 0
    ):
        errors.append("detectedShots must be a non-negative integer")
        detected_shots = None
    elif detected_shots != case["expectedDetectedShots"]:
        errors.append(
            "detectedShots mismatch: "
            f"expected {case['expectedDetectedShots']}, got {detected_shots}"
        )

    form_analysis = result.get("formAnalysis")
    diag = (
        form_analysis.get("formPhaseDiag")
        if isinstance(form_analysis, dict)
        else None
    )
    if not isinstance(diag, dict):
        errors.append("formAnalysis.formPhaseDiag is required")
        return errors

    release_fires = diag.get("releaseFires")
    canceled_events = diag.get("canceledEvents")
    if not isinstance(release_fires, list):
        errors.append("formPhaseDiag.releaseFires must be an array")
    if not isinstance(canceled_events, list):
        errors.append("formPhaseDiag.canceledEvents must be an array")
    if not isinstance(release_fires, list) or not isinstance(
        canceled_events, list
    ):
        return errors

    canceled_ids = set()
    for index, event in enumerate(canceled_events):
        shot_id = event.get("shotId") if isinstance(event, dict) else None
        if not isinstance(shot_id, str) or not shot_id:
            errors.append(
                f"canceledEvents[{index}].shotId must be a non-empty string"
            )
        else:
            canceled_ids.add(shot_id)

    retained = []
    seen_fire_ids = set()
    for index, fire in enumerate(release_fires):
        if not isinstance(fire, dict):
            errors.append(f"releaseFires[{index}] must be an object")
            continue
        shot_id = fire.get("shotId")
        timestamp = fire.get("ts")
        if not isinstance(shot_id, str) or not shot_id:
            errors.append(
                f"releaseFires[{index}].shotId must be a non-empty string"
            )
            continue
        if shot_id in seen_fire_ids:
            errors.append(f"duplicate release fire shotId: {shot_id}")
            continue
        seen_fire_ids.add(shot_id)
        if not _is_number(timestamp) or timestamp < 0:
            errors.append(
                f"releaseFires[{index}].ts must be a finite non-negative number"
            )
            continue
        if shot_id not in canceled_ids:
            retained.append((timestamp, shot_id))

    for shot_id in sorted(canceled_ids - seen_fire_ids):
        errors.append(
            f"canceled shotId {shot_id!r} does not refer to a release fire"
        )

    if detected_shots is not None and len(retained) != detected_shots:
        errors.append(
            "internal retained release count mismatch: "
            f"derived {len(retained)}, detectedShots {detected_shots}"
        )

    windows = case["retainedReleaseWindowsMs"]
    if (
        len(retained) == len(windows)
        and detected_shots == case["expectedDetectedShots"]
    ):
        retained.sort()
        ordered_windows = sorted(windows, key=lambda window: (window[0], window[1]))
        for index, ((timestamp, shot_id), window) in enumerate(
            zip(retained, ordered_windows)
        ):
            start, end = window
            if not start <= timestamp <= end:
                errors.append(
                    f"retained release {index} ({shot_id}) at {timestamp}ms "
                    f"is outside reviewed window [{start}, {end}]ms"
                )

    return errors


def verification_outcome(*, case, result, record_only):
    """semantic 検証・記録専用・runtime failure を終了コードへ写像する。"""

    if record_only:
        if not isinstance(result, dict):
            return VerificationOutcome(
                verification="SKIPPED",
                exit_code=1,
                errors=("runtime result must be an object",),
            )
        status = result.get("status")
        if status not in SUCCESS_STATUSES:
            return VerificationOutcome(
                verification="SKIPPED",
                exit_code=1,
                errors=(f"runtime status is not successful: {status!r}",),
            )
        return VerificationOutcome(
            verification="SKIPPED",
            exit_code=0,
            errors=(),
        )

    if case is None:
        raise GoldenConfigurationError(
            "reviewed expectation case is required outside record-only mode"
        )
    errors = tuple(validate_result(case, result))
    return VerificationOutcome(
        verification="FAIL" if errors else "PASS",
        exit_code=1 if errors else 0,
        errors=errors,
    )
