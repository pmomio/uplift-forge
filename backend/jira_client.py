import logging
from datetime import datetime, timezone
from atlassian import Jira
from config import config

logger = logging.getLogger(__name__)

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

    def get_issues(self, project_key: str, months: int = None):
        jql = f'project = "{project_key}"'
        if months:
            now = datetime.now(timezone.utc)
            # Calculate date X months ago
            m = now.month - months
            y = now.year
            while m <= 0:
                m += 12
                y -= 1
            # Clamp day to valid range for the target month
            import calendar
            max_day = calendar.monthrange(y, m)[1]
            d = min(now.day, max_day)
            cutoff = now.replace(year=y, month=m, day=d)
            date_str = cutoff.strftime("%Y-%m-%d")
            jql += f' AND resolved >= "{date_str}"'
        jql += ' ORDER BY updated DESC'
        logger.info(f"JQL: {jql}")
        all_issues = []
        next_token = None
        batch_size = 100
        while True:
            result = self.jira.enhanced_jql(jql, expand='changelog', nextPageToken=next_token, limit=batch_size)
            issues = result.get('issues', [])
            all_issues.extend(issues)
            logger.info(f"Fetched batch: {len(issues)} issues (running total: {len(all_issues)})")
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
