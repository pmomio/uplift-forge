from atlassian import Jira
from config import config

class JiraClient:
    def __init__(self):
        self._client = None

    @property
    def jira(self):
        if self._client is None:
            self._client = Jira(
                url=config.jira_base_url,
                username=config.jira_email,
                password=config.jira_api_token,
                cloud=True
            )
        return self._client

    def get_issues(self, project_key: str):
        jql = f'project = "{project_key}" ORDER BY updated DESC'
        all_issues = []
        next_token = None
        batch_size = 100
        while True:
            result = self.jira.enhanced_jql(jql, expand='changelog', nextPageToken=next_token, limit=batch_size)
            issues = result.get('issues', [])
            all_issues.extend(issues)
            if result.get('isLast', True) or not issues:
                break
            next_token = result.get('nextPageToken')
            if not next_token:
                break
        return all_issues

    def update_issue_fields(self, issue_key: str, fields: dict):
        return self.jira.update_issue(issue_key, {"fields": fields})

    def get_issue_changelog(self, issue_key: str):
        # Using expand='changelog' in a direct issue fetch is more reliable
        issue = self.jira.issue(issue_key, expand='changelog')
        return issue.get('changelog', {})

    def get_all_fields(self):
        return self.jira.get_all_fields()

    def get_all_statuses(self):
        """Fetch all workflow statuses from the JIRA instance."""
        return self.jira.get_all_statuses()

jira_client = JiraClient()
