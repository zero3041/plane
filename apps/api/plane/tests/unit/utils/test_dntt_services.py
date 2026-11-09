# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

from plane.dntt.services import store_private_workbook

pytestmark = pytest.mark.unit


def test_source_upload_can_omit_acl_for_acl_free_s3_buckets():
    uploaded_file = SimpleUploadedFile("snapshot.xlsx", b"xlsx data")
    with override_settings(DNTT_SOURCE_ACL=None), patch(
        "plane.dntt.services.S3Storage.upload_file", return_value=True
    ) as upload_file:
        key = store_private_workbook(uploaded_file, date(2026, 10, 1), "a" * 64)

    assert key.startswith("dntt/private/2026-10/")
    assert "ACL" not in upload_file.call_args.kwargs["extra_args"]
