"""Tests for config.py — Config class loading, updates, persistence, and migration."""

import pytest
import yaml
import tempfile
import os
from pathlib import Path
from unittest.mock import patch


class TestConfigInit:
    """Test Config class initialization from YAML."""

    def test_loads_from_yaml(self):
        from config import Config
        cfg_data = {
            "jira": {
                "base_url": "https://test.atlassian.net",
                "email": "test@test.com",
                "project_key": "TEST",
                "field_ids": {"tpd_bu": "cf_1", "eng_hours": "cf_2", "work_stream": "cf_3"},
            },
            "office_hours": {"start": "09:00", "end": "18:00", "timezone": "Europe/Berlin", "exclude_weekends": True},
            "sync": {"auto_write_to_jira": False, "interval_minutes": 60},
            "engineering_hours_start_status": "In Progress",
            "engineering_hours_end_status": "In Review",
            "engineering_hours_excluded_statuses": ["Blocked"],
            "ticket_filter": {"mode": "last_x_months", "months": 6},
            "sp_to_days": 2.0,
            "tracked_engineers": [{"displayName": "Alice", "accountId": "a1"}],
            "mapping_rules": {"tpd_bu": {}, "work_stream": {}},
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.safe_dump(cfg_data, f)
            path = f.name

        try:
            with patch.dict(os.environ, {"JIRA_API_TOKEN": "tok", "JIRA_EMAIL": "env@test.com", "JIRA_BASE_URL": "https://env.atlassian.net"}):
                cfg = Config(config_path=path)

            assert cfg.project_key == "TEST"
            assert cfg.jira_email == "env@test.com"  # env override
            assert cfg.jira_base_url == "https://env.atlassian.net"  # env override
            assert cfg.jira_api_token == "tok"
            assert cfg.sp_to_days == 2.0
            assert cfg.tracked_engineers == [{"displayName": "Alice", "accountId": "a1"}]
            assert cfg.eng_start_status == "In Progress"
            assert cfg.eng_end_status == "In Review"
            assert cfg.eng_excluded_statuses == ["Blocked"]
            assert cfg.ticket_filter == {"mode": "last_x_months", "months": 6}
        finally:
            os.unlink(path)

    def test_defaults_when_optional_fields_missing(self):
        from config import Config
        cfg_data = {
            "jira": {
                "base_url": "https://test.atlassian.net",
                "email": "test@test.com",
                "project_key": "TEST",
            },
            "office_hours": {"start": "09:00", "end": "18:00", "timezone": "UTC", "exclude_weekends": True},
            "sync": {"auto_write_to_jira": False},
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.safe_dump(cfg_data, f)
            path = f.name

        try:
            with patch.dict(os.environ, {"JIRA_API_TOKEN": "tok"}, clear=False):
                cfg = Config(config_path=path)

            assert cfg.eng_start_status == "In Progress"
            assert cfg.eng_end_status == "In Review"
            assert cfg.eng_excluded_statuses == ["Blocked"]
            assert cfg.ticket_filter == {"mode": "last_x_months", "months": 6}
            assert cfg.sp_to_days == 1
            assert cfg.tracked_engineers == []
        finally:
            os.unlink(path)

    def test_migrates_old_mapping_format(self):
        """Old parent-key mappings should be migrated to Rule[][] format."""
        from config import Config
        cfg_data = {
            "jira": {
                "base_url": "https://test.atlassian.net",
                "email": "test@test.com",
                "project_key": "TEST",
            },
            "office_hours": {"start": "09:00", "end": "18:00", "timezone": "UTC", "exclude_weekends": True},
            "sync": {},
            "tpd_business_unit_mapping": {
                "B2C": ["PROJ-1", "PROJ-2"],
                "B2B": ["PROJ-3"],
            },
            "work_stream_mapping": {
                "Product": ["PROJ-10"],
            },
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.safe_dump(cfg_data, f)
            path = f.name

        try:
            with patch.dict(os.environ, {"JIRA_API_TOKEN": "tok"}, clear=False):
                cfg = Config(config_path=path)

            # B2C should have 2 OR-blocks
            assert len(cfg.mapping_rules["tpd_bu"]["B2C"]) == 2
            assert cfg.mapping_rules["tpd_bu"]["B2C"][0] == [{"field": "parent_key", "operator": "equals", "value": "PROJ-1"}]
            assert cfg.mapping_rules["tpd_bu"]["B2C"][1] == [{"field": "parent_key", "operator": "equals", "value": "PROJ-2"}]
            assert len(cfg.mapping_rules["tpd_bu"]["B2B"]) == 1
            assert len(cfg.mapping_rules["work_stream"]["Product"]) == 1
        finally:
            os.unlink(path)


class TestConfigUpdate:
    """Test Config.update_config() persistence."""

    def _make_config(self):
        from config import Config
        cfg_data = {
            "jira": {
                "base_url": "https://test.atlassian.net",
                "email": "test@test.com",
                "project_key": "TEST",
                "field_ids": {"tpd_bu": "cf_1"},
            },
            "office_hours": {"start": "09:00", "end": "18:00", "timezone": "UTC", "exclude_weekends": True},
            "sync": {},
            "mapping_rules": {"tpd_bu": {}, "work_stream": {}},
        }
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False)
        yaml.safe_dump(cfg_data, f)
        f.close()
        with patch.dict(os.environ, {"JIRA_API_TOKEN": "tok"}, clear=False):
            cfg = Config(config_path=f.name)
        return cfg, f.name

    def test_update_project_key(self):
        cfg, path = self._make_config()
        try:
            cfg.update_config(project_key="NEWPROJ")
            assert cfg.project_key == "NEWPROJ"
            assert cfg.data["jira"]["project_key"] == "NEWPROJ"
            # Verify persisted to file
            with open(path) as f:
                data = yaml.safe_load(f)
            assert data["jira"]["project_key"] == "NEWPROJ"
        finally:
            os.unlink(path)

    def test_update_eng_statuses(self):
        cfg, path = self._make_config()
        try:
            cfg.update_config(eng_start="Open", eng_end="Done", eng_excluded_statuses=["Blocked", "On Hold"])
            assert cfg.eng_start_status == "Open"
            assert cfg.eng_end_status == "Done"
            assert cfg.eng_excluded_statuses == ["Blocked", "On Hold"]
        finally:
            os.unlink(path)

    def test_update_ticket_filter(self):
        cfg, path = self._make_config()
        try:
            cfg.update_config(ticket_filter={"mode": "missing_fields", "months": 3})
            assert cfg.ticket_filter == {"mode": "missing_fields", "months": 3}
        finally:
            os.unlink(path)

    def test_update_field_ids(self):
        cfg, path = self._make_config()
        try:
            new_ids = {"tpd_bu": "cf_new", "eng_hours": "cf_new2"}
            cfg.update_config(field_ids=new_ids)
            assert cfg.field_ids == new_ids
        finally:
            os.unlink(path)

    def test_update_mapping_rules_removes_old_keys(self):
        cfg, path = self._make_config()
        try:
            cfg.data["tpd_business_unit_mapping"] = {"old": True}
            cfg.data["work_stream_mapping"] = {"old": True}
            new_rules = {"tpd_bu": {"B2C": []}, "work_stream": {"Product": []}}
            cfg.update_config(mapping_rules=new_rules)
            assert cfg.mapping_rules == new_rules
            assert "tpd_business_unit_mapping" not in cfg.data
            assert "work_stream_mapping" not in cfg.data
        finally:
            os.unlink(path)

    def test_update_sp_to_days(self):
        cfg, path = self._make_config()
        try:
            cfg.update_config(sp_to_days=2.5)
            assert cfg.sp_to_days == 2.5
        finally:
            os.unlink(path)

    def test_update_tracked_engineers(self):
        cfg, path = self._make_config()
        try:
            engineers = [{"displayName": "Bob", "accountId": "b1"}]
            cfg.update_config(tracked_engineers=engineers)
            assert cfg.tracked_engineers == engineers
        finally:
            os.unlink(path)

    def test_update_ignores_unknown_keys(self):
        cfg, path = self._make_config()
        try:
            # Should not raise
            cfg.update_config(unknown_field="something", another_thing=42)
            assert cfg.project_key == "TEST"  # unchanged
        finally:
            os.unlink(path)

    def test_no_update_when_none(self):
        cfg, path = self._make_config()
        try:
            original_key = cfg.project_key
            cfg.update_config(project_key=None)
            assert cfg.project_key == original_key  # None is falsy, no update
        finally:
            os.unlink(path)
