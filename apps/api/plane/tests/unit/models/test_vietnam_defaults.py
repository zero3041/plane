"""Defaults for newly created accounts and workspaces in this deployment."""

import pytest

from plane.db.models import Cycle, Profile, Project, User, Workspace


@pytest.mark.unit
def test_new_account_defaults_to_vietnam():
    assert User._meta.get_field("user_timezone").get_default() == "Asia/Ho_Chi_Minh"
    assert Profile._meta.get_field("language").get_default() == "vi-VN"
    assert Profile._meta.get_field("billing_address_country").get_default() == "VIETNAM"
    assert Profile._meta.get_field("start_of_the_week").get_default() == Profile.MONDAY


@pytest.mark.unit
def test_new_work_items_default_to_vietnam_timezone():
    for model in (Workspace, Project, Cycle):
        assert model._meta.get_field("timezone").get_default() == "Asia/Ho_Chi_Minh"


@pytest.mark.unit
def test_explicit_account_preferences_are_preserved():
    user = User(user_timezone="Europe/Paris")
    profile = Profile(language="en", billing_address_country="FRANCE", start_of_the_week=Profile.SUNDAY)

    assert user.user_timezone == "Europe/Paris"
    assert profile.language == "en"
    assert profile.billing_address_country == "FRANCE"
    assert profile.start_of_the_week == Profile.SUNDAY
