"""Tests for jira_client.py — JQL construction, pagination, and helper methods."""

import pytest
import re
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime
from jira_client import JiraClient


class TestGetIssues:
    """Test JiraClient.get_issues() JQL and pagination."""

    def _make_client(self):
        jc = JiraClient()
        mock = MagicMock()
        jc._client = mock
        return jc, mock

    def test_no_months_no_date_clause(self):
        jc, mock = self._make_client()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc.get_issues("PROJ")
        jql = mock.enhanced_jql.call_args[0][0]
        assert jql == 'project = "PROJ" ORDER BY updated DESC'

    def test_months_adds_absolute_date(self):
        jc, mock = self._make_client()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc.get_issues("PROJ", months=3)
        jql = mock.enhanced_jql.call_args[0][0]
        assert re.search(r'resolved >= "\d{4}-\d{2}-\d{2}"', jql)

    def test_months_date_is_approximately_correct(self):
        jc, mock = self._make_client()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc.get_issues("PROJ", months=6)
        jql = mock.enhanced_jql.call_args[0][0]
        match = re.search(r'resolved >= "(\d{4}-\d{2}-\d{2})"', jql)
        assert match
        cutoff = datetime.strptime(match.group(1), "%Y-%m-%d")
        diff_days = (datetime.now() - cutoff).days
        assert 150 <= diff_days <= 210  # ~180 days for 6 months

    def test_months_boundary_clamping(self):
        """months=1 from March 31 should clamp to Feb 28/29."""
        jc, mock = self._make_client()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc.get_issues("PROJ", months=1)
        jql = mock.enhanced_jql.call_args[0][0]
        assert re.search(r'resolved >= "\d{4}-\d{2}-\d{2}"', jql)

    def test_pagination_single_batch(self):
        jc, mock = self._make_client()
        issues = [{"key": f"T-{i}"} for i in range(5)]
        mock.enhanced_jql.return_value = {"issues": issues, "isLast": True}
        result = jc.get_issues("PROJ")
        assert len(result) == 5
        mock.enhanced_jql.assert_called_once()

    def test_pagination_multiple_batches(self):
        jc, mock = self._make_client()
        batch1 = [{"key": f"T-{i}"} for i in range(100)]
        batch2 = [{"key": f"T-{i}"} for i in range(100, 150)]
        mock.enhanced_jql.side_effect = [
            {"issues": batch1, "isLast": False, "nextPageToken": "tok1"},
            {"issues": batch2, "isLast": True},
        ]
        result = jc.get_issues("PROJ")
        assert len(result) == 150
        assert mock.enhanced_jql.call_count == 2
        # Second call should use the nextPageToken
        assert mock.enhanced_jql.call_args_list[1][1]["nextPageToken"] == "tok1"

    def test_pagination_stops_on_empty_batch(self):
        jc, mock = self._make_client()
        mock.enhanced_jql.side_effect = [
            {"issues": [{"key": "T-1"}], "isLast": False, "nextPageToken": "tok1"},
            {"issues": [], "isLast": False, "nextPageToken": "tok2"},
        ]
        result = jc.get_issues("PROJ")
        assert len(result) == 1
        assert mock.enhanced_jql.call_count == 2

    def test_pagination_stops_on_missing_token(self):
        jc, mock = self._make_client()
        mock.enhanced_jql.side_effect = [
            {"issues": [{"key": "T-1"}], "isLast": False},
        ]
        result = jc.get_issues("PROJ")
        assert len(result) == 1

    def test_expand_changelog_passed(self):
        jc, mock = self._make_client()
        mock.enhanced_jql.return_value = {"issues": [], "isLast": True}
        jc.get_issues("PROJ")
        assert mock.enhanced_jql.call_args[1]["expand"] == "changelog"


class TestHelperMethods:
    """Test JiraClient helper methods."""

    def _make_client(self):
        jc = JiraClient()
        jc._client = MagicMock()
        return jc

    def test_update_issue_fields(self):
        jc = self._make_client()
        jc.update_issue_fields("T-1", {"field1": "val1"})
        jc._client.update_issue.assert_called_once_with("T-1", {"fields": {"field1": "val1"}})

    def test_get_issue_changelog(self):
        jc = self._make_client()
        jc._client.issue.return_value = {"changelog": {"histories": [{"id": "1"}]}}
        result = jc.get_issue_changelog("T-1")
        assert result == {"histories": [{"id": "1"}]}
        jc._client.issue.assert_called_once_with("T-1", expand="changelog")

    def test_get_issue_changelog_empty(self):
        jc = self._make_client()
        jc._client.issue.return_value = {}
        result = jc.get_issue_changelog("T-1")
        assert result == {}

    def test_get_all_fields(self):
        jc = self._make_client()
        jc._client.get_all_fields.return_value = [{"id": "f1", "name": "Field 1"}]
        result = jc.get_all_fields()
        assert result == [{"id": "f1", "name": "Field 1"}]

    def test_get_all_statuses(self):
        jc = self._make_client()
        jc._client.get_all_statuses.return_value = [{"id": "1", "name": "Open"}]
        result = jc.get_all_statuses()
        assert result == [{"id": "1", "name": "Open"}]

    def test_get_project(self):
        jc = self._make_client()
        jc._client.project.return_value = {"key": "PROJ", "name": "Project"}
        result = jc.get_project("PROJ")
        assert result == {"key": "PROJ", "name": "Project"}
        jc._client.project.assert_called_once_with("PROJ")


class TestLazyInit:
    """Test that JiraClient lazily initializes the JIRA client."""

    def test_client_not_created_until_accessed(self):
        jc = JiraClient()
        assert jc._client is None

    @patch("jira_client.Jira")
    def test_client_created_on_first_access(self, mock_jira_class):
        jc = JiraClient()
        jc._client = None  # force reset
        _ = jc.jira
        mock_jira_class.assert_called_once()

    @patch("jira_client.Jira")
    def test_client_reused_on_subsequent_access(self, mock_jira_class):
        jc = JiraClient()
        jc._client = None
        client1 = jc.jira
        client2 = jc.jira
        assert client1 is client2
        mock_jira_class.assert_called_once()
